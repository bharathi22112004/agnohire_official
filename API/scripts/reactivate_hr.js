import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const hrUser = await prisma.user.findUnique({
    where: { email: 'hr@it.agnohire.com' }
  });

  if (hrUser) {
    console.log("Current state:", hrUser.isActive, hrUser.deletedAt);

    await prisma.user.update({
      where: { email: 'hr@it.agnohire.com' },
      data: {
        isActive: true,
        deletedAt: null
      }
    });
    console.log("Successfully re-activated hr@it.agnohire.com");
  } else {
    console.log("User not found.");
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
