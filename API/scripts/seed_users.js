/**
 * seed_users.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates the minimal data needed for all demo-credential logins to work:
 *   • IT Sector (required so Admin / HR / Recruiter have a sectorId)
 *   • Admin    → admin@it.agnohire.com     / Admin@123456
 *   • HR       → hr@it.agnohire.com        / Hr@123456
 *   • Recruiter→ recruiter@it.agnohire.com / Recruiter@123
 *
 * Superadmin already exists from reset_data.js — skipped here.
 *
 * Usage:
 *   node scripts/seed_users.js
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('👤  Seeding demo users...\n');

  // ── Fetch existing roles ──────────────────────────────────────────────────
  const roles = await prisma.role.findMany();
  if (!roles.length) {
    throw new Error('No roles found. Run `npm run db:clean` first to create roles.');
  }
  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r]));

  // ── Fetch superadmin (needed as sector creator) ───────────────────────────
  const superadmin = await prisma.user.findUnique({
    where: { email: 'superadmin@agnohire.com' },
  });
  if (!superadmin) {
    throw new Error('Superadmin not found. Run `npm run db:clean` first.');
  }

  // ── IT Sector ─────────────────────────────────────────────────────────────
  const itSector = await prisma.sector.upsert({
    where: { id: 'it-sector-seed-id' },
    update: {},
    create: {
      id: 'it-sector-seed-id',
      name: 'Information Technology',
      type: 'IT',
      status: 'active',
      createdBy: superadmin.id,
    },
  });
  console.log('  ✓ IT Sector ready');

  // ── IT Domains ───────────────────────────────────────────────────────────
  const frontendDomain = await prisma.domain.upsert({
    where: { id: 'domain-frontend-development' },
    update: {},
    create: {
      id: 'domain-frontend-development',
      sectorId: itSector.id,
      name: 'Frontend Development',
    },
  });

  const backendDomain = await prisma.domain.upsert({
    where: { id: 'domain-backend-development' },
    update: {},
    create: {
      id: 'domain-backend-development',
      sectorId: itSector.id,
      name: 'Backend Development',
    },
  });
  console.log('  ✓ IT Domains ready (Frontend Development, Backend Development)');

  // ── Users ─────────────────────────────────────────────────────────────────
  const users = [
    { name: 'IT Admin',              email: 'admin@it.agnohire.com',     password: 'Admin@123456',  role: 'admin' },
    { name: 'IT HR Manager',         email: 'hr@it.agnohire.com',        password: 'Hr@123456',     role: 'hr' },
    { name: 'Frontend Recruiter',    email: 'recruiter@it.agnohire.com', password: 'Recruiter@123', role: 'recruiter' },
    { name: 'Senior Tech Recruiter', email: 'recruiter2@it.agnohire.com',password: 'Recruiter@123', role: 'recruiter' },
  ];

  const createdUsers = {};
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        roleId: roleMap[u.role].id,
        sectorId: itSector.id,
        isActive: true,
      },
    });
    createdUsers[u.email] = created;
    console.log(`  ✓ ${u.role.padEnd(10)} → ${created.email}`);
  }

  // ── Recruiter Skills / Domain mapping ──────────────────────────────────────
  // Clear any existing skills mapping first to prevent duplicate entries
  await prisma.recruiterSkill.deleteMany({
    where: {
      recruiterId: {
        in: [createdUsers['recruiter@it.agnohire.com'].id, createdUsers['recruiter2@it.agnohire.com'].id]
      }
    }
  });

  // Assign skills for Frontend Recruiter
  await prisma.recruiterSkill.create({
    data: {
      recruiterId: createdUsers['recruiter@it.agnohire.com'].id,
      domainId: frontendDomain.id,
      skillTags: ['React', 'TypeScript', 'CSS', 'Redux'],
    }
  });

  // Assign skills for Senior Tech Recruiter
  await prisma.recruiterSkill.createMany({
    data: [
      {
        recruiterId: createdUsers['recruiter2@it.agnohire.com'].id,
        domainId: frontendDomain.id,
        skillTags: ['Vue.js', 'Angular', 'Tailwind'],
      },
      {
        recruiterId: createdUsers['recruiter2@it.agnohire.com'].id,
        domainId: backendDomain.id,
        skillTags: ['Node.js', 'Express', 'Prisma', 'PostgreSQL'],
      }
    ]
  });
  console.log('  ✓ Recruiter domains & skills mapped');

  console.log('\n✅ Done! All demo users and recruiter skill mappings are ready.\n');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  Role        Email                        Password          │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  Superadmin  superadmin@agnohire.com       SuperAdmin@123   │');
  console.log('│  Admin       admin@it.agnohire.com         Admin@123456     │');
  console.log('│  HR          hr@it.agnohire.com            Hr@123456        │');
  console.log('│  Recruiter 1 recruiter@it.agnohire.com     Recruiter@123    │');
  console.log('│  Recruiter 2 recruiter2@it.agnohire.com    Recruiter@123    │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
