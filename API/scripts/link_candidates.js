import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const lists = await prisma.candidateList.findMany({
    orderBy: { uploadDate: 'asc' }
  });

  const candidates = await prisma.candidate.findMany({
    where: { listId: null },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${lists.length} lists and ${candidates.length} unlinked candidates.`);

  let candidateIdx = 0;
  for (const list of lists) {
    const count = list.candidateCount;
    const listCandidates = candidates.slice(candidateIdx, candidateIdx + count);
    candidateIdx += count;

    if (listCandidates.length > 0) {
      const ids = listCandidates.map(c => c.id);
      await prisma.candidate.updateMany({
        where: { id: { in: ids } },
        data: { listId: list.id }
      });
      console.log(`✅ Linked ${ids.length} candidates to list "${list.name}"`);
    }
  }
}

main()
  .catch((err) => {
    console.error('❌ Migration script failed:', err);
  })
  .finally(() => prisma.$disconnect());
