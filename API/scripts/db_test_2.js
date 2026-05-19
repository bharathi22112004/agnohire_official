import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const lists = await prisma.candidateList.findMany();
  const candidates = await prisma.candidate.findMany();
  console.log("=== DB STATE AFTER UPLOAD ===");
  console.log("CandidateLists count:", lists.length);
  console.log("CandidateLists detail:", JSON.stringify(lists, null, 2));
  console.log("Candidates count:", candidates.length);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
