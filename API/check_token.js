import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  try {
    const token = 'a9a4ac86-fa37-45d3-876d-2a7781ddb802';
    console.log('Querying token:', token);
    const schedule = await prisma.interviewSchedule.findUnique({
      where: { linkToken: token },
      include: {
        interview: {
          include: {
            candidate: true
          }
        }
      }
    });
    console.log('--- SCHEDULE ---');
    console.log(JSON.stringify(schedule, null, 2));

    const config = await prisma.systemConfiguration.findUnique({
      where: { key: 'interview_link_expiry_hours' }
    });
    console.log('--- CONFIG ---');
    console.log(JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
