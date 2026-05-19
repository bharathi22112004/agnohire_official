import { prisma } from '../configs/db.js';

export const interviewRepository = {
  async findById(id) {
    return prisma.interview.findUnique({
      where: { id },
      include: {
        candidate: { include: { domain: true } },
        recruiter: { include: { role: true } },
        schedule: true,
        result: true,
        answers: { include: { question: true } },
      },
    });
  },

  async findByToken(linkToken) {
    return prisma.interviewSchedule.findUnique({
      where: { linkToken },
      include: {
        interview: {
          include: {
            candidate: true,
            recruiter: true,
            result: true,
          },
        },
      },
    });
  },

  async findAll({ page = 1, limit = 20, recruiterId, candidateId, status, sectorId } = {}) {
    const where = {
      ...(recruiterId && { recruiterId }),
      ...(candidateId && { candidateId }),
      ...(status && { status }),
    };

    const [interviews, total] = await Promise.all([
      prisma.interview.findMany({
        where,
        include: {
          candidate: { include: { domain: true } },
          schedule: true,
          result: true,
        },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.interview.count({ where }),
    ]);

    return { interviews, total };
  },

  async create(data) {
    return prisma.interview.create({
      data,
      include: { candidate: true, schedule: true },
    });
  },

  async update(id, data) {
    return prisma.interview.update({ where: { id }, data });
  },

  async createResult(data) {
    return prisma.interviewResult.upsert({
      where: { interviewId: data.interviewId },
      create: data,
      update: data,
    });
  },

  async createSchedule(data) {
    return prisma.interviewSchedule.create({ data });
  },
};
