import { prisma } from '../configs/db.js';

export const userRepository = {
  async findById(id) {
    return prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: { role: true, sector: true },
    });
  },

  async findByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  },

  async findAll({ page = 1, limit = 20, role, sectorId, search, isActive } = {}) {
    const where = {
      deletedAt: null,
      ...(role && { role: { name: role } }),
      ...(sectorId && { sectorId }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { role: true, sector: true },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  },

  async create(data) {
    return prisma.user.create({
      data,
      include: { role: true },
    });
  },

  async update(id, data) {
    return prisma.user.update({
      where: { id },
      data,
      include: { role: true },
    });
  },

  async softDelete(id) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  },

  async countByRole(roleName, sectorId) {
    return prisma.user.count({
      where: {
        role: { name: roleName },
        ...(sectorId && { sectorId }),
        deletedAt: null,
        isActive: true,
      },
    });
  },
};
