/**
 * reset_data.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Deletes ALL data from every table in the correct dependency order,
 * then re-creates only:
 *   • The five core roles
 *   • The superadmin user  (superadmin@agnohire.com / SuperAdmin@123)
 *
 * Usage:
 *   node scripts/reset_data.js
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Starting data reset...\n');

  // ── 1. Delete in dependency order (children before parents) ──────────────
  await prisma.analyticsSnapshot.deleteMany();
  console.log('  ✓ analyticsSnapshots cleared');

  await prisma.emailLog.deleteMany();
  console.log('  ✓ emailLogs cleared');

  await prisma.emailTemplate.deleteMany();
  console.log('  ✓ emailTemplates cleared');

  await prisma.systemConfiguration.deleteMany();
  console.log('  ✓ systemConfigurations cleared');

  await prisma.auditLog.deleteMany();
  console.log('  ✓ auditLogs cleared');

  await prisma.notification.deleteMany();
  console.log('  ✓ notifications cleared');

  await prisma.candidateAnswer.deleteMany();
  console.log('  ✓ candidateAnswers cleared');

  await prisma.interviewResult.deleteMany();
  console.log('  ✓ interviewResults cleared');

  await prisma.interviewSchedule.deleteMany();
  console.log('  ✓ interviewSchedules cleared');

  await prisma.interview.deleteMany();
  console.log('  ✓ interviews cleared');

  await prisma.question.deleteMany();
  console.log('  ✓ questions cleared');

  await prisma.questionBank.deleteMany();
  console.log('  ✓ questionBanks cleared');

  await prisma.candidateAssignment.deleteMany();
  console.log('  ✓ candidateAssignments cleared');

  await prisma.resume.deleteMany();
  console.log('  ✓ resumes cleared');

  await prisma.candidate.deleteMany();
  console.log('  ✓ candidates cleared');

  await prisma.candidateList.deleteMany();
  console.log('  ✓ candidateLists cleared');

  await prisma.recruiterSkill.deleteMany();
  console.log('  ✓ recruiterSkills cleared');

  await prisma.domain.deleteMany();
  console.log('  ✓ domains cleared');

  await prisma.sector.deleteMany();
  console.log('  ✓ sectors cleared');

  await prisma.session.deleteMany();
  console.log('  ✓ sessions cleared');

  await prisma.oAuthAccount.deleteMany();
  console.log('  ✓ oauthAccounts cleared');

  // Delete all users EXCEPT we'll recreate superadmin right after
  await prisma.user.deleteMany();
  console.log('  ✓ users cleared');

  // ── 2. Re-seed essential roles ───────────────────────────────────────────
  const roleNames = ['superadmin', 'admin', 'hr', 'recruiter', 'candidate'];
  const roles = await Promise.all(
    roleNames.map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name, permissions: getDefaultPermissions(name) },
      })
    )
  );
  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r]));
  console.log('\n  ✓ Core roles ensured');

  // ── 3. Re-seed superadmin ────────────────────────────────────────────────
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
  console.log('  ✓ Superadmin re-created:', superadmin.email);

  console.log('\n✅ Reset complete! Database is clean.\n');
  console.log('Login with:');
  console.log('  superadmin@agnohire.com  /  SuperAdmin@123\n');
}

function getDefaultPermissions(role) {
  const all = { read: true, create: true, update: true, delete: true };
  const map = {
    superadmin: { sectors: all, users: all, candidates: all, interviews: all, questions: all, analytics: all, audit: all, config: all },
    admin:      { users: all, candidates: all, interviews: { read: true, create: true }, questions: all, analytics: { read: true } },
    hr:         { candidates: all, interviews: { read: true }, email_templates: all },
    recruiter:  { candidates: { read: true, update: true }, interviews: all, questions: all },
    candidate:  { interviews: { read: true, create: true } },
  };
  return map[role] || {};
}

main()
  .catch((e) => {
    console.error('\n❌ Reset failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
