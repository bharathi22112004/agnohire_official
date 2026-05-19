import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Starting candidate duplicate cleanup and merge...');

  // 1. Find duplicate emails
  const duplicates = await prisma.candidate.groupBy({
    by: ['email'],
    where: { deletedAt: null },
    _count: { email: true },
    having: {
      email: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  console.log(`Found ${duplicates.length} duplicate email addresses in the system.`);

  for (const dup of duplicates) {
    const email = dup.email;
    const candidates = await prisma.candidate.findMany({
      where: { email, deletedAt: null },
      orderBy: { createdAt: 'asc' }, // oldest first
    });

    const primary = candidates[0];
    const secondaries = candidates.slice(1);

    console.log(`\nProcessing email: "${email}"`);
    console.log(`  Keeping primary candidate ID: ${primary.id} (Name: ${primary.name})`);
    console.log(`  Merging ${secondaries.length} secondary duplicate candidate(s).`);

    for (const secondary of secondaries) {
      console.log(`    -> Merging secondary ID: ${secondary.id} (Name: ${secondary.name})`);

      // A. Re-associate CandidateAssignments
      const assignments = await prisma.candidateAssignment.findMany({
        where: { candidateId: secondary.id },
      });
      for (const assign of assignments) {
        // Check if primary already has an assignment for this recruiter and list
        const exists = await prisma.candidateAssignment.findFirst({
          where: {
            candidateId: primary.id,
            listId: assign.listId,
            recruiterId: assign.recruiterId,
          },
        });
        if (exists) {
          // Delete duplicate assignment
          await prisma.candidateAssignment.delete({ where: { id: assign.id } });
        } else {
          // Re-assign to primary candidate
          await prisma.candidateAssignment.update({
            where: { id: assign.id },
            data: { candidateId: primary.id },
          });
        }
      }

      // B. Re-associate Resumes
      await prisma.resume.updateMany({
        where: { candidateId: secondary.id },
        data: { candidateId: primary.id },
      });

      // C. Re-associate Interviews
      await prisma.interview.updateMany({
        where: { candidateId: secondary.id },
        data: { candidateId: primary.id },
      });

      // D. Re-associate Email Logs
      await prisma.emailLog.updateMany({
        where: { candidateId: secondary.id },
        data: { candidateId: primary.id },
      });

      // E. Delete the secondary candidate
      await prisma.candidate.delete({
        where: { id: secondary.id },
      });
    }
  }

  console.log('\n🎉 Cleanup and merge complete!');
}

main()
  .catch((err) => {
    console.error('❌ Duplicate cleanup script failed:', err);
  })
  .finally(() => prisma.$disconnect());
