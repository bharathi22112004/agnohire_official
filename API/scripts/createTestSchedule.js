import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Setting up test candidate and interview schedule...');

  // 1. Fetch IT Recruiter
  const recruiter = await prisma.user.findFirst({
    where: { email: 'recruiter@it.agnohire.com' },
  });

  if (!recruiter) {
    console.error('❌ Could not find recruiter recruiter@it.agnohire.com. Run npm run db:seed first.');
    process.exit(1);
  }

  // 2. Fetch IT Frontend domain
  const domain = await prisma.domain.findFirst({
    where: { name: 'Frontend Development' },
  });

  if (!domain) {
    console.error('❌ Frontend Development domain not found.');
    process.exit(1);
  }

  // 3. Upsert Candidate
  const candidate = await prisma.candidate.upsert({
    where: { email: 'alice.dev@example.com' },
    update: {
      status: 'pending',
    },
    create: {
      name: 'Alice Dev',
      email: 'alice.dev@example.com',
      phone: '+1 555-019-2834',
      domainId: domain.id,
      sectorId: recruiter.sectorId,
      experienceLevel: 'mid',
      skills: ['React', 'TypeScript', 'TailwindCSS'],
      status: 'pending',
    },
  });

  console.log(`✅ Candidate verified: ${candidate.name} (${candidate.email})`);

  // 4. Create or reuse Interview record
  let interview = await prisma.interview.findFirst({
    where: {
      candidateId: candidate.id,
      recruiterId: recruiter.id,
      status: 'scheduled',
    },
  });

  if (!interview) {
    interview = await prisma.interview.create({
      data: {
        candidateId: candidate.id,
        recruiterId: recruiter.id,
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      },
    });
  }

  console.log(`✅ Interview created: ${interview.id}`);

  // 5. Create secure Schedule link token
  const token = 'test-token-123456';

  await prisma.interviewSchedule.upsert({
    where: { linkToken: token },
    update: {},
    create: {
      interviewId: interview.id,
      recruiterId: recruiter.id,
      date: new Date(),
      timeStart: '10:00 AM',
      timeEnd: '11:00 AM',
      linkToken: token,
    },
  });

  console.log('\n🎉 TEST ASSESSMENT SETUP SUCCESSFUL!');
  console.log('----------------------------------------------------');
  console.log(`Candidate Link: http://localhost:3000/interview?token=${token}&rid=${recruiter.id}`);
  console.log(`Recruiter ID  : ${recruiter.id}`);
  console.log('----------------------------------------------------\n');
}

main()
  .catch((err) => {
    console.error('❌ Failed to seed test schedule:', err);
  })
  .finally(() => prisma.$disconnect());
