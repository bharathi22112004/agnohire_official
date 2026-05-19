import { prisma } from '../configs/db.js';

export const candidateRepository = {
  async findById(id) {
    return prisma.candidate.findUnique({
      where: { id, deletedAt: null },
      include: {
        domain: true,
        sector: true,
        resumes: { orderBy: { uploadedAt: 'desc' } },
        assignments: { include: { recruiter: true, list: true } },
      },
    });
  },

  async findAll({ page = 1, limit = 20, sectorId, status, search, recruiterId, listId } = {}) {
    const where = {
      deletedAt: null,
      ...(sectorId && { sectorId }),
      ...(status && { status }),
      ...(recruiterId && { assignments: { some: { recruiterId } } }),
      ...(listId && { assignments: { some: { listId } } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        include: { domain: true, sector: true, assignments: { include: { recruiter: true } } },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.candidate.count({ where }),
    ]);

    return { candidates, total };
  },

  async createMany(data) {
    return prisma.candidate.createMany({ data, skipDuplicates: true });
  },

  async create(data) {
    return prisma.candidate.create({ data, include: { domain: true } });
  },

  async update(id, data) {
    return prisma.candidate.update({ where: { id }, data });
  },

  async softDelete(id) {
    return prisma.candidate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async countByStatus(sectorId) {
    return prisma.candidate.groupBy({
      by: ['status'],
      where: { ...(sectorId && { sectorId }), deletedAt: null },
      _count: { status: true },
    });
  },
};
