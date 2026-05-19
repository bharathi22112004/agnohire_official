import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SECTOR_TYPES = [
  'IT', 'Civil', 'MBBS', 'Mechanical', 'AI/ML',
  'Finance', 'Marketing', 'HR', 'Legal', 'Operations',
];

const PREDEFINED_DOMAINS = {
  IT: [
    { name: 'Frontend Development', children: ['React', 'Angular', 'Vue.js', 'TypeScript'] },
    { name: 'Backend Development', children: ['Node.js', 'Python/Django', 'Java/Spring', 'Go'] },
    { name: 'DevOps', children: ['Docker', 'Kubernetes', 'CI/CD', 'AWS'] },
    { name: 'Mobile', children: ['React Native', 'Flutter', 'iOS', 'Android'] },
  ],
  'AI/ML': [
    { name: 'Machine Learning', children: ['TensorFlow', 'PyTorch', 'Scikit-learn'] },
    { name: 'NLP', children: ['BERT', 'LLM Fine-tuning', 'Text Classification'] },
    { name: 'Computer Vision', children: ['OpenCV', 'YOLO', 'Image Segmentation'] },
  ],
};

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ── Roles ──────────────────────────────────────────────
  const roles = await Promise.all(
    ['superadmin', 'admin', 'hr', 'recruiter', 'candidate'].map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: {
          name,
          permissions: getDefaultPermissions(name),
        },
      })
    )
  );

  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r]));
  console.log('✅ Roles created');

  // ── Superadmin ─────────────────────────────────────────
  const passwordHash = await bcrypt.hash('SuperAdmin@123', 12);
  const superadmin = await prisma.user.upsert({
    where: { email: 'superadmin@agnohire.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'superadmin@agnohire.com',
      passwordHash,
      roleId: roleMap.superadmin.id,
      isActive: true,
    },
  });
  console.log('✅ Superadmin created:', superadmin.email);

  // ── IT Sector with domains ─────────────────────────────
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

  // IT Domains
  for (const domain of PREDEFINED_DOMAINS.IT) {
    const parent = await prisma.domain.upsert({
      where: { id: `domain-${domain.name.replace(/\s/g, '-').toLowerCase()}` },
      update: {},
      create: {
        id: `domain-${domain.name.replace(/\s/g, '-').toLowerCase()}`,
        sectorId: itSector.id,
        name: domain.name,
      },
    });

    for (const child of domain.children) {
      await prisma.domain.upsert({
        where: { id: `domain-${child.replace(/\s/g, '-').toLowerCase()}-child` },
        update: {},
        create: {
          id: `domain-${child.replace(/\s/g, '-').toLowerCase()}-child`,
          sectorId: itSector.id,
          name: child,
          parentId: parent.id,
        },
      });
    }
  }
  console.log('✅ IT Sector and domains created');

  // ── Sample Admin for IT ────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@it.agnohire.com' },
    update: {},
    create: {
      name: 'IT Admin',
      email: 'admin@it.agnohire.com',
      passwordHash: adminHash,
      roleId: roleMap.admin.id,
      sectorId: itSector.id,
    },
  });

  // ── Sample HR ─────────────────────────────────────────
  const hrHash = await bcrypt.hash('Hr@123456', 12);
  const hr = await prisma.user.upsert({
    where: { email: 'hr@it.agnohire.com' },
    update: {},
    create: {
      name: 'IT HR Manager',
      email: 'hr@it.agnohire.com',
      passwordHash: hrHash,
      roleId: roleMap.hr.id,
      sectorId: itSector.id,
    },
  });

  // ── Sample Recruiter ──────────────────────────────────
  const recHash = await bcrypt.hash('Recruiter@123', 12);
  const recruiter = await prisma.user.upsert({
    where: { email: 'recruiter@it.agnohire.com' },
    update: {},
    create: {
      name: 'Frontend Recruiter',
      email: 'recruiter@it.agnohire.com',
      passwordHash: recHash,
      roleId: roleMap.recruiter.id,
      sectorId: itSector.id,
    },
  });

  console.log('✅ Sample users created');

  // ── AI/ML Sector ───────────────────────────────────────
  const aiSector = await prisma.sector.upsert({
    where: { id: 'aiml-sector-seed-id' },
    update: {},
    create: {
      id: 'aiml-sector-seed-id',
      name: 'Artificial Intelligence & Machine Learning',
      type: 'AI/ML',
      status: 'active',
      createdBy: superadmin.id,
    },
  });
  console.log('✅ AI/ML Sector created');

  // ── System Configurations ──────────────────────────────
  const configs = [
    { key: 'max_admins_per_sector', value: 3 },
    { key: 'max_hrs_per_sector', value: 10 },
    { key: 'max_candidates_per_hr_upload', value: 500 },
    { key: 'max_candidates_per_recruiter', value: 50 },
    { key: 'interview_link_expiry_hours', value: 48 },
    { key: 'ai_scoring_enabled', value: true },
    { key: 'platform_name', value: 'AgnoHire' },
    { key: 'dark_mode_default', value: false },
  ];

  for (const cfg of configs) {
    await prisma.systemConfiguration.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value },
      create: { key: cfg.key, value: cfg.value },
    });
  }
  console.log('✅ System configurations seeded');

  // ── Email Templates ────────────────────────────────────
  await prisma.emailTemplate.createMany({
    skipDuplicates: true,
    data: [
      {
        name: 'Interview Invitation',
        type: 'invite',
        subject: 'You have been invited for an AI Interview — AgnoHire',
        bodyHtml: '<p>Dear {{candidateName}},<br/>You are invited to complete your AI interview on {{date}} at {{time}}.<br/>Click here: {{link}}</p>',
        createdBy: superadmin.id,
      },
      {
        name: 'Interview Passed',
        type: 'pass',
        subject: 'Congratulations! Interview Result — PASSED',
        bodyHtml: '<p>Dear {{candidateName}},<br/>Congratulations! You have successfully passed the interview.</p>',
        createdBy: superadmin.id,
      },
      {
        name: 'Interview Failed',
        type: 'fail',
        subject: 'Interview Result — AgnoHire',
        bodyHtml: '<p>Dear {{candidateName}},<br/>Thank you for your participation. Unfortunately we will not be moving forward at this time.</p>',
        createdBy: superadmin.id,
      },
      {
        name: 'Interview On Hold',
        type: 'hold',
        subject: 'Interview Result — Under Review',
        bodyHtml: '<p>Dear {{candidateName}},<br/>Your application is currently under review. We will contact you shortly.</p>',
        createdBy: superadmin.id,
      },
    ],
  });
  console.log('✅ Email templates seeded');

  console.log('\n🎉 Seed complete!\n');
  console.log('Default credentials:');
  console.log('  Superadmin → superadmin@agnohire.com / SuperAdmin@123');
  console.log('  Admin      → admin@it.agnohire.com / Admin@123456');
  console.log('  HR         → hr@it.agnohire.com / Hr@123456');
  console.log('  Recruiter  → recruiter@it.agnohire.com / Recruiter@123\n');
}

function getDefaultPermissions(role) {
  const all = { read: true, create: true, update: true, delete: true };
  const readOnly = { read: true };
  const map = {
    superadmin: { sectors: all, users: all, candidates: all, interviews: all, questions: all, analytics: all, audit: all, config: all },
    admin: { users: all, candidates: all, interviews: { read: true, create: true }, questions: all, analytics: { read: true } },
    hr: { candidates: all, interviews: { read: true }, email_templates: all },
    recruiter: { candidates: { read: true, update: true }, interviews: all, questions: all },
    candidate: { interviews: { read: true, create: true } },
  };
  return map[role] || {};
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
