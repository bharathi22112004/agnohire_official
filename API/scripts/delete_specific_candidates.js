import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const EMAILS_TO_DELETE = [
  'abinayachinnadurai24@gmail.com',
  'harikaran8231@gmail.com',
  'karunakaran08112004@gmail.com'
];

async function main() {
  console.log('🧹 Starting targeted candidate deletion from database...');

  for (const email of EMAILS_TO_DELETE) {
    console.log(`\n----------------------------------------`);
    console.log(`🔍 Searching for candidate: ${email}`);

    const candidate = await prisma.candidate.findUnique({
      where: { email }
    });

    if (!candidate) {
      console.log(`⚠️  Candidate with email "${email}" not found in database.`);
      continue;
    }

    console.log(`Found candidate:`);
    console.log(`  ID: ${candidate.id}`);
    console.log(`  Name: ${candidate.name}`);
    console.log(`  Status: ${candidate.status}`);
    console.log(`  Created At: ${candidate.createdAt}`);

    // 1. Delete Candidate Assignments
    const assignmentCount = await prisma.candidateAssignment.deleteMany({
      where: { candidateId: candidate.id }
    });
    console.log(`  ✓ Deleted ${assignmentCount.count} candidate assignment(s).`);

    // 2. Delete Email Logs
    const emailLogCount = await prisma.emailLog.deleteMany({
      where: { candidateId: candidate.id }
    });
    console.log(`  ✓ Deleted ${emailLogCount.count} email log(s).`);

    // 3. Delete Interviews (which cascades to interview schedules, results, answers, etc.)
    const interviews = await prisma.interview.findMany({
      where: { candidateId: candidate.id }
    });

    if (interviews.length > 0) {
      console.log(`  Found ${interviews.length} interview(s) associated. Deleting cascades...`);
      for (const interview of interviews) {
        // Delete the interview. Since onDelete: Cascade is configured on:
        // - interview_schedules
        // - interview_results
        // - candidate_answers
        // - interview_sessions
        // - face_registrations
        // - proctoring_violations
        // these will automatically be deleted by Postgres/Prisma.
        await prisma.interview.delete({
          where: { id: interview.id }
        });
      }
      console.log(`  ✓ Deleted ${interviews.length} interview(s) and their cascading records.`);
    } else {
      console.log(`  ✓ No interviews associated.`);
    }

    // 4. Delete the Candidate record (cascading to resumes)
    await prisma.candidate.delete({
      where: { id: candidate.id }
    });
    console.log(`  🎉 CANDIDATE "${candidate.name}" DELETED COMPLETELY.`);
  }

  console.log(`\n----------------------------------------`);
  console.log('✅ Targeted candidate deletion script complete!\n');
}

main()
  .catch((err) => {
    console.error('❌ Deletion script failed:', err);
  })
  .finally(() => prisma.$disconnect());
