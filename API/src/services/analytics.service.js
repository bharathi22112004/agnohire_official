import { prisma } from '../configs/db.js';

export const analyticsService = {
  async getGlobalStats() {
    const [sectors, admins, hrs, recruiters, candidates] = await Promise.all([
      prisma.sector.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { role: { name: 'admin' }, deletedAt: null } }),
      prisma.user.count({ where: { role: { name: 'hr' }, deletedAt: null } }),
      prisma.user.count({ where: { role: { name: 'recruiter' }, deletedAt: null } }),
      prisma.candidate.count({ where: { deletedAt: null } }),
    ]);

    const interviewStats = await prisma.interviewResult.groupBy({
      by: ['recruiterDecision'],
      _count: { recruiterDecision: true },
    });

    const passCount = interviewStats.find((s) => s.recruiterDecision === 'pass')?._count.recruiterDecision || 0;
    const failCount = interviewStats.find((s) => s.recruiterDecision === 'fail')?._count.recruiterDecision || 0;
    const holdCount = interviewStats.find((s) => s.recruiterDecision === 'hold')?._count.recruiterDecision || 0;

    return {
      sectors,
      admins,
      hrs,
      recruiters,
      candidates,
      interviews: { passed: passCount, failed: failCount, held: holdCount, total: passCount + failCount + holdCount },
    };
  },

  async getSectorStats(sectorId) {
    const [hrs, recruiters, candidates] = await Promise.all([
      prisma.user.count({ where: { role: { name: 'hr' }, sectorId, deletedAt: null } }),
      prisma.user.count({ where: { role: { name: 'recruiter' }, sectorId, deletedAt: null } }),
      prisma.candidate.count({ where: { sectorId, deletedAt: null } }),
    ]);

    const candidateStatuses = await prisma.candidate.groupBy({
      by: ['status'],
      where: { sectorId, deletedAt: null },
      _count: { status: true },
    });

    return { hrs, recruiters, candidates, candidateStatuses };
  },

  async getInterviewTrends({ sectorId, days = 30 }) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const interviews = await prisma.interview.findMany({
      where: {
        createdAt: { gte: since },
        ...(sectorId && { candidate: { sectorId } }),
      },
      include: { result: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const grouped = {};
    interviews.forEach((iv) => {
      const date = iv.createdAt.toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = { date, total: 0, passed: 0, failed: 0 };
      grouped[date].total++;
      if (iv.result?.recruiterDecision === 'pass') grouped[date].passed++;
      if (iv.result?.recruiterDecision === 'fail') grouped[date].failed++;
    });

    return Object.values(grouped);
  },

  async getAuditLogs({ page = 1, limit = 20, userId, actionType, entity, search, dateFrom, dateTo }) {
    const where = {
      ...(userId && { userId }),
      ...(actionType && { actionType }),
      ...(entity && { entity }),
      ...(dateFrom || dateTo ? {
        timestamp: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      } : {}),
      ...(search && {
        OR: [
          { actionType: { contains: search, mode: 'insensitive' } },
          { entity: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  },
};
