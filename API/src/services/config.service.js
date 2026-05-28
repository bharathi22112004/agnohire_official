import { prisma } from '../configs/db.js';

class ConfigService {
  constructor() {
    this.cache = {};
    this.lastFetched = 0;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  async fetchAll() {
    if (Date.now() - this.lastFetched < this.CACHE_TTL && Object.keys(this.cache).length > 0) {
      return this.cache;
    }
    const configs = await prisma.systemConfiguration.findMany();
    const newCache = {};
    configs.forEach((c) => {
      newCache[c.key] = c.value;
    });
    this.cache = newCache;
    this.lastFetched = Date.now();
    return this.cache;
  }

  async get(key, defaultValue = null) {
    const configs = await this.fetchAll();
    return configs[key] !== undefined ? configs[key] : defaultValue;
  }

  async getPlatformName() {
    return this.get('platform_name', 'AgnoHire');
  }

  async getMaxAdminsPerSector() {
    return this.get('max_admins_per_sector', 2);
  }

  async getMaxHrsPerSector() {
    return this.get('max_hrs_per_sector', 5);
  }

  async getMaxBulkUploadLimit() {
    return this.get('max_candidates_per_hr_upload', 500);
  }

  async getMaxCandidatesPerRecruiter() {
    return this.get('max_candidates_per_recruiter', 50);
  }

  async isAiScoringEnabled() {
    return this.get('ai_scoring_enabled', true);
  }

  async getInterviewTokenExpiryHours() {
    return this.get('interview_link_expiry_hours', 48);
  }
}

export const configService = new ConfigService();
