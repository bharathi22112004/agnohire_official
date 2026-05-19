import { analyticsService } from '../services/analytics.service.js';
import { success, error, paginate } from '../utils/response.js';

export const analyticsController = {
  async globalStats(req, res) {
    try {
      const stats = await analyticsService.getGlobalStats();
      return success(res, { stats });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async sectorStats(req, res) {
    try {
      const sectorId = req.params.sectorId || req.user.sectorId;
      const stats = await analyticsService.getSectorStats(sectorId);
      return success(res, { stats });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async interviewTrends(req, res) {
    try {
      const { sectorId, days } = req.query;
      const trends = await analyticsService.getInterviewTrends({
        sectorId: sectorId || req.user.sectorId,
        days: parseInt(days) || 30,
      });
      return success(res, { trends });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async auditLogs(req, res) {
    try {
      const { page = 1, limit = 20, userId, actionType, entity, search, dateFrom, dateTo } = req.query;
      const { logs, total } = await analyticsService.getAuditLogs({
        page: parseInt(page),
        limit: parseInt(limit),
        userId,
        actionType,
        entity,
        search,
        dateFrom,
        dateTo,
      });
      return success(res, { logs }, 200, paginate(total, page, limit));
    } catch (err) {
      return error(res, err.message);
    }
  },
};
