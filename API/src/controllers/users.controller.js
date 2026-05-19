import { userRepository } from '../repositories/user.repository.js';
import { hashPassword } from '../utils/hash.js';
import { success, error, paginate } from '../utils/response.js';
import { prisma } from '../configs/db.js';
import { emailService } from '../services/email.service.js';

export const usersController = {
  async getProfile(req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          avatarUrl: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          smtpPass: true,
          role: { select: { id: true, name: true } },
          sector: { select: { id: true, name: true } }
        }
      });
      return success(res, { user });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async updateProfile(req, res) {
    try {
      const { name, email, password, avatarUrl, smtpHost, smtpPort, smtpUser, smtpPass } = req.body;

      if (email && email !== req.user.email) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return error(res, 'Email already in use', 409, 'CONFLICT');
      }

      const updateData = {
        ...(name && { name }),
        ...(email && { email }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(smtpHost !== undefined && { smtpHost: smtpHost || null }),
        ...(smtpPort !== undefined && { smtpPort: smtpPort ? parseInt(smtpPort) : null }),
        ...(smtpUser !== undefined && { smtpUser: smtpUser || null }),
        ...(smtpPass !== undefined && { smtpPass: smtpPass || null }),
      };

      if (password) {
        updateData.passwordHash = await hashPassword(password);
      }

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          smtpPass: true,
        }
      });

      return success(res, { user: updated });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async list(req, res) {
    try {
      const { page = 1, limit = 20, role, sectorId, search, isActive } = req.query;

      // Admin/HR can only see their sector
      let effectiveSectorId = sectorId;
      if (['admin', 'hr'].includes(req.user.role?.name)) {
        effectiveSectorId = req.user.sectorId;
      }

      const { users, total } = await userRepository.findAll({
        page: parseInt(page),
        limit: parseInt(limit),
        role,
        sectorId: effectiveSectorId,
        search,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
      });

      return success(res, { users }, 200, paginate(total, page, limit));
    } catch (err) {
      return error(res, err.message);
    }
  },

  async getOne(req, res) {
    try {
      const user = await userRepository.findById(req.params.id);
      if (!user) return error(res, 'User not found', 404, 'NOT_FOUND');
      return success(res, { user });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async create(req, res) {
    try {
      const { name, email, password, roleId, sectorId, skills } = req.body;

      // Check email exists
      const existing = await userRepository.findByEmail(email);
      if (existing) return error(res, 'Email already in use', 409, 'CONFLICT');

      const passwordHash = password ? await hashPassword(password) : null;

      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            roleId,
            sectorId,
          },
          include: { role: true },
        });

        if (skills && Array.isArray(skills) && skills.length > 0 && newUser.role?.name === 'recruiter') {
          await tx.recruiterSkill.createMany({
            data: skills.map((s) => ({
              recruiterId: newUser.id,
              domainId: s.domainId,
              skillTags: s.skillTags,
            })),
          });
        }

        return newUser;
      });

      return success(res, { user }, 201);
    } catch (err) {
      return error(res, err.message);
    }
  },

  async update(req, res) {
    try {
      const { name, email, isActive, sectorId, roleId } = req.body;
      const user = await userRepository.update(req.params.id, {
        ...(name && { name }),
        ...(email && { email }),
        ...(isActive !== undefined && { isActive }),
        ...(sectorId && { sectorId }),
        ...(roleId && { roleId }),
      });
      return success(res, { user });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async remove(req, res) {
    try {
      await userRepository.softDelete(req.params.id);
      return success(res, { message: 'User deactivated successfully' });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async getRecruiterSkills(req, res) {
    try {
      const skills = await prisma.recruiterSkill.findMany({
        where: { recruiterId: req.params.id },
        include: { domain: true },
      });
      return success(res, { skills });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async setRecruiterSkills(req, res) {
    try {
      const { recruiterId } = req.params;
      const { skills } = req.body; // [{ domainId, skillTags }]

      await prisma.recruiterSkill.deleteMany({ where: { recruiterId } });

      const created = await prisma.recruiterSkill.createMany({
        data: skills.map((s) => ({ recruiterId, domainId: s.domainId, skillTags: s.skillTags })),
      });

      return success(res, { created });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async getAllConfigs(req, res) {
    try {
      const configs = await prisma.systemConfiguration.findMany();
      return success(res, { configs });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async updateConfig(req, res) {
    try {
      const { key, value } = req.body;
      const config = await prisma.systemConfiguration.upsert({
        where: { key },
        update: { value, updatedBy: req.user.id },
        create: { key, value, updatedBy: req.user.id },
      });
      return success(res, { config });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async listEmailTemplates(req, res) {
    try {
      const templates = await prisma.emailTemplate.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return success(res, { templates });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async updateEmailTemplate(req, res) {
    try {
      const { id } = req.params;
      const { subject, bodyHtml } = req.body;
      const template = await prisma.emailTemplate.update({
        where: { id },
        data: { subject, bodyHtml },
      });
      return success(res, { template });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async sendTestEmail(req, res) {
    try {
      const { email, subject, bodyHtml } = req.body;
      if (!email) return error(res, 'Email address is required', 400, 'BAD_REQUEST');

      let renderedSubject = subject || 'AgnoHire Test Email';
      let renderedBody = bodyHtml || '<p>AgnoHire Test Email Body</p>';

      const replacements = {
        '{{candidateName}}': 'John Doe (Test Candidate)',
        '{{link}}': 'https://agnohire.com/interview/test-preview-link',
        '{{platformName}}': 'AgnoHire',
        '{{recruiterName}}': 'Sarah Jenkins (Test Recruiter)',
        '{{sectorName}}': 'Software Development',
        '{{date}}': new Date().toLocaleDateString(),
        '{{time}}': '10:00 AM'
      };

      Object.entries(replacements).forEach(([key, val]) => {
        renderedSubject = renderedSubject.replaceAll(key, val);
        renderedBody = renderedBody.replaceAll(key, val);
      });

      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id }
      });

      const customSmtp = (dbUser?.smtpHost && dbUser?.smtpUser && dbUser?.smtpPass) ? {
        smtpHost: dbUser.smtpHost,
        smtpPort: dbUser.smtpPort,
        smtpUser: dbUser.smtpUser,
        smtpPass: dbUser.smtpPass
      } : null;

      await emailService.sendEmail({
        to: email,
        subject: renderedSubject,
        html: renderedBody,
        customSmtp
      });

      return success(res, { message: 'Test email successfully sent' });
    } catch (err) {
      return error(res, `Failed to dispatch test email over SMTP: ${err.message}`, 500, 'SMTP_ERROR');
    }
  },
};
