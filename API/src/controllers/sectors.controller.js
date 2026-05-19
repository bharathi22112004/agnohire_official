import { prisma } from '../configs/db.js';
import { success, error, paginate } from '../utils/response.js';
import { hashPassword } from '../utils/hash.js';

export const sectorsController = {
  async list(req, res) {
    try {
      const { page = 1, limit = 20, status, search } = req.query;
      const where = {
        deletedAt: null,
        ...(status && { status }),
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      };

      const [sectors, total] = await Promise.all([
        prisma.sector.findMany({
          where,
          include: {
            creator: { select: { id: true, name: true, email: true } },
            _count: { select: { users: true, candidates: true, domains: true } },
          },
          skip: (page - 1) * limit,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
        }),
        prisma.sector.count({ where }),
      ]);

      return success(res, { sectors }, 200, paginate(total, page, limit));
    } catch (err) {
      return error(res, err.message);
    }
  },

  async getOne(req, res) {
    try {
      const sector = await prisma.sector.findUnique({
        where: { id: req.params.id },
        include: { domains: true, _count: { select: { users: true, candidates: true } } },
      });
      if (!sector) return error(res, 'Sector not found', 404, 'NOT_FOUND');
      return success(res, { sector });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async create(req, res) {
    try {
      const { name, type, adminName, adminEmail, adminPassword, hrName, hrEmail, hrPassword, domains } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        // Create sector
        const sector = await tx.sector.create({
          data: { name, type, createdBy: req.user.id },
        });

        // Get roles
        const [adminRole, hrRole] = await Promise.all([
          tx.role.findFirst({ where: { name: 'admin' } }),
          tx.role.findFirst({ where: { name: 'hr' } }),
        ]);

        // Create default Admin
        const adminHash = await hashPassword(adminPassword || 'Admin@123');
        const admin = await tx.user.create({
          data: {
            name: adminName,
            email: adminEmail,
            passwordHash: adminHash,
            roleId: adminRole.id,
            sectorId: sector.id,
          },
        });

        // Create default HR
        const hrHash = await hashPassword(hrPassword || 'Hr@123456');
        const hr = await tx.user.create({
          data: {
            name: hrName,
            email: hrEmail,
            passwordHash: hrHash,
            roleId: hrRole.id,
            sectorId: sector.id,
          },
        });

        // Create domains
        if (domains?.length) {
          await tx.domain.createMany({
            data: domains.map((d) => ({
              sectorId: sector.id,
              name: d.name,
              parentId: d.parentId || null,
            })),
          });
        }

        return { sector, admin, hr };
      });

      return success(res, result, 201);
    } catch (err) {
      return error(res, err.message);
    }
  },

  async update(req, res) {
    try {
      const { name, status } = req.body;
      const sector = await prisma.sector.update({
        where: { id: req.params.id },
        data: { ...(name && { name }), ...(status && { status }) },
      });
      return success(res, { sector });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async remove(req, res) {
    try {
      await prisma.sector.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date(), status: 'inactive' },
      });
      return success(res, { message: 'Sector deleted' });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async getDomains(req, res) {
    try {
      const domains = await prisma.domain.findMany({
        where: { sectorId: req.params.id, parentId: null },
        include: { children: true },
      });
      return success(res, { domains });
    } catch (err) {
      return error(res, err.message);
    }
  },
};
