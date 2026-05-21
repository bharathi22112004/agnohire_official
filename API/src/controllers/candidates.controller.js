import { candidateRepository } from '../repositories/candidate.repository.js';
import { prisma } from '../configs/db.js';
import { success, error, paginate } from '../utils/response.js';
import { v4 as uuidv4 } from 'uuid';
import { emailService } from '../services/email.service.js';
import { configService } from '../services/config.service.js';
import { socketService } from '../services/socket.service.js';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

export const candidatesController = {
  async list(req, res) {
    try {
      const { page = 1, limit = 20, sectorId, status, search, recruiterId } = req.query;

      let effectiveSectorId = sectorId;
      if (['admin', 'hr'].includes(req.user.role?.name)) {
        effectiveSectorId = req.user.sectorId;
      }

      const { candidates, total } = await candidateRepository.findAll({
        page: parseInt(page),
        limit: parseInt(limit),
        sectorId: effectiveSectorId,
        status,
        search,
        recruiterId,
      });

      return success(res, { candidates }, 200, paginate(total, page, limit));
    } catch (err) {
      return error(res, err.message);
    }
  },

  async getOne(req, res) {
    try {
      const candidate = await candidateRepository.findById(req.params.id);
      if (!candidate) return error(res, 'Candidate not found', 404, 'NOT_FOUND');
      return success(res, { candidate });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async create(req, res) {
    try {
      const email = req.body.email ? String(req.body.email).trim().toLowerCase() : undefined;
      if (email) {
        const existing = await prisma.candidate.findFirst({
          where: { email, deletedAt: null },
        });
        if (existing) {
          return error(res, 'A candidate with this email address already exists.', 400, 'DUPLICATE_EMAIL');
        }
      }

      const candidate = await candidateRepository.create({
        ...req.body,
        email,
        sectorId: req.user.sectorId,
      });
      return success(res, { candidate }, 201);
    } catch (err) {
      return error(res, err.message);
    }
  },

  async update(req, res) {
    try {
      const email = req.body.email ? String(req.body.email).trim().toLowerCase() : undefined;
      if (email) {
        const existing = await prisma.candidate.findFirst({
          where: { 
            email, 
            id: { not: req.params.id },
            deletedAt: null 
          },
        });
        if (existing) {
          return error(res, 'Another candidate with this email address already exists.', 400, 'DUPLICATE_EMAIL');
        }
      }

      const candidate = await candidateRepository.update(req.params.id, {
        ...req.body,
        ...(email && { email }),
      });
      return success(res, { candidate });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async remove(req, res) {
    try {
      await candidateRepository.softDelete(req.params.id);
      return success(res, { message: 'Candidate removed' });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async bulkUpload(req, res) {
    try {
      if (!req.file) return error(res, 'Upload file required', 400, 'NO_FILE');

      let data = [];
      const ext = path.extname(req.file.originalname).toLowerCase();
      const isExcel = ext === '.xlsx' || ext === '.xls' || req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      if (isExcel) {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        fs.unlinkSync(req.file.path);
      } else {
        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        fs.unlinkSync(req.file.path);

        const parsed = Papa.parse(fileContent, {
          header: true,
          skipEmptyLines: true,
        });

        if (parsed.errors.length) {
          return error(res, 'CSV parse errors', 422, 'CSV_PARSE_ERROR', parsed.errors);
        }
        data = parsed.data;
      }

      const uploadLimit = await configService.getMaxBulkUploadLimit();
      if (data.length > uploadLimit) {
        return error(res, `Upload exceeds the maximum allowed limit of ${uploadLimit} candidates per file`, 403, 'LIMIT_EXCEEDED');
      }

      const required = ['name', 'email'];
      const validRows = [];
      const errorRows = [];

      let listId = null;
      let effectiveSectorId = req.user.sectorId;
      if (!effectiveSectorId) {
        const firstSector = await prisma.sector.findFirst();
        effectiveSectorId = firstSector?.id || null;
      }

      if (req.body.listName) {
        const list = await prisma.candidateList.create({
          data: {
            name: req.body.listName,
            hrId: req.user.id,
            sectorId: effectiveSectorId,
            candidateCount: 0,
          },
        });
        listId = list.id;
      }

      data.forEach((rawRow, idx) => {
        // Normalize keys by removing special chars (like colons/punctuation), trimming spacing, and replacing spaces/hyphens with underscores
        const row = {};
        Object.keys(rawRow).forEach((k) => {
          const normKey = k.toLowerCase()
                           .replace(/[^a-z0-9\s_\-]/g, '')
                           .trim()
                           .replace(/[\s_\-]+/g, '_');
          row[normKey] = rawRow[k];
        });

        const missing = required.filter((f) => !row[f]);
        if (missing.length) {
          errorRows.push({ row: idx + 2, error: `Missing: ${missing.join(', ')}`, data: row });
          return;
        }
        let parsedSkills = [];
        if (row.skills) {
          try {
            const parsed = JSON.parse(row.skills);
            parsedSkills = Array.isArray(parsed) ? parsed : [String(parsed)];
          } catch {
            parsedSkills = String(row.skills).split(',').map(s => s.trim()).filter(Boolean);
          }
        }

        validRows.push({
          name: row.name ? String(row.name).trim() : undefined,
          email: row.email ? String(row.email).trim().toLowerCase() : undefined,
          phone: row.phone ? String(row.phone).trim() : null,
          experienceLevel: row.experience_level ? String(row.experience_level).trim() : null,
          skills: parsedSkills,
          sectorId: effectiveSectorId,
          status: 'pending',
          listId,
        });
      });

      let imported = 0;
      if (validRows.length) {
        const result = await candidateRepository.createMany(validRows);
        imported = result.count;

        if (listId) {
          await prisma.candidateList.update({
            where: { id: listId },
            data: { candidateCount: imported },
          });

          // Notify Admin and HR about successful list upload
          const notifyUsers = await prisma.user.findMany({
            where: {
              role: { name: { in: ['admin', 'superadmin', 'hr'] } },
              sectorId: effectiveSectorId,
              isActive: true,
              deletedAt: null,
            },
            select: { id: true }
          });
          
          if (notifyUsers.length > 0) {
            await socketService.notifyMany(notifyUsers.map(u => u.id), {
              type: 'list_uploaded',
              title: 'Candidate List Uploaded',
              message: `A new candidate list "${req.body.listName || 'Uploaded'}" with ${imported} candidates has been added.`,
              metadata: { listId },
            });
          }
        }
      }

      return success(res, {
        imported,
        total: data.length,
        errors: errorRows,
        candidates: validRows,
      }, 201);
    } catch (err) {
      return error(res, err.message);
    }
  },

  async assign(req, res) {
    try {
      const { candidateIds, recruiterIds, listId } = req.body;

      const maxPerRecruiter = await configService.getMaxCandidatesPerRecruiter();

      // Check existing assigned counts for these recruiters
      const existingCounts = await Promise.all(recruiterIds.map(async (rid) => {
        const count = await prisma.candidateAssignment.count({ where: { recruiterId: rid } });
        return { recruiterId: rid, count };
      }));

      // Distribute evenly but enforce limits
      const assignments = [];
      const countsMap = Object.fromEntries(existingCounts.map(ec => [ec.recruiterId, ec.count]));
      
      for (let i = 0; i < candidateIds.length; i++) {
        const candidateId = candidateIds[i];
        const recruiterId = recruiterIds[i % recruiterIds.length];
        
        if (countsMap[recruiterId] >= maxPerRecruiter) {
          return error(res, `Recruiter assignment limit of ${maxPerRecruiter} reached for a selected recruiter`, 403, 'LIMIT_EXCEEDED');
        }
        
        assignments.push({
          candidateId,
          recruiterId,
          listId,
          assignedAt: new Date(),
        });
        countsMap[recruiterId]++;
      }

      await prisma.candidateAssignment.createMany({ data: assignments, skipDuplicates: true });

      // Update candidate statuses
      await prisma.candidate.updateMany({
        where: { id: { in: candidateIds } },
        data: { status: 'assigned' },
      });

      // Notify recruiters
      const uniqueRecruiterIds = [...new Set(recruiterIds)];
      await socketService.notifyMany(uniqueRecruiterIds, {
        type: 'candidates_assigned',
        title: 'New Candidates Assigned',
        message: `You have been assigned new candidates to interview.`,
        metadata: { listId },
      });

      return success(res, { assigned: assignments.length });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async bulkTemplateEmail(req, res) {
    try {
      const { templateId, candidateIds } = req.body;
      if (!templateId || !candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
        return error(res, 'Template ID and a valid array of candidate IDs are required', 400, 'BAD_REQUEST');
      }

      const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
      if (!template) {
        return error(res, 'Email template not found', 404, 'NOT_FOUND');
      }

      const candidates = await prisma.candidate.findMany({
        where: { id: { in: candidateIds } },
        include: {
          sector: true,
          interviews: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { recruiter: true, schedule: true }
          }
        }
      });

      let sentCount = 0;
      let failCount = 0;

      for (const candidate of candidates) {
        const interview = candidate.interviews[0];
        const recruiter = interview?.recruiter;

        let finalHtml = template.bodyHtml;
        let finalSubject = template.subject;

        // Replacements
        const replacements = {
          '{{candidateName}}': candidate.name || 'Candidate',
          '{{link}}': interview?.schedule?.linkToken ? `${process.env.CLIENT_URL || 'http://localhost:5173'}/interview?token=${interview.schedule.linkToken}` : '#',
          '{{platformName}}': 'AgnoHire',
          '{{recruiterName}}': recruiter?.name || 'Recruitment Team',
          '{{sectorName}}': candidate.sector?.name || 'our organization'
        };

        for (const [key, val] of Object.entries(replacements)) {
          finalHtml = finalHtml.split(key).join(val);
          finalSubject = finalSubject.split(key).join(val);
        }

        const customSmtp = await emailService.getSmtpConfig(candidate.sectorId || req.user.sectorId);

        try {
          await emailService.sendEmail({
            to: candidate.email,
            subject: finalSubject,
            html: finalHtml,
            templateId: template.id,
            candidateId: candidate.id,
            customSmtp
          });
          sentCount++;
        } catch (e) {
          console.error(`Bulk template email failed for ${candidate.email}:`, e);
          failCount++;
        }
      }

      return success(res, {
        message: `Successfully dispatched emails to ${sentCount} candidates. ${failCount > 0 ? `Failed for ${failCount}.` : ''}`,
        sentCount,
        failCount
      });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async uploadResume(req, res) {
    try {
      if (!req.file) return error(res, 'Resume file required', 400, 'NO_FILE');

      const resume = await prisma.resume.create({
        data: {
          candidateId: req.params.id,
          fileUrl: `/uploads/resumes/${req.file.filename}`,
          fileName: req.file.originalname,
        },
      });

      return success(res, { resume }, 201);
    } catch (err) {
      return error(res, err.message);
    }
  },

  async listLists(req, res) {
    try {
      const { sectorId } = req.query;
      const where = {};
      
      if (['admin', 'hr'].includes(req.user.role?.name)) {
        where.sectorId = req.user.sectorId;
      } else if (sectorId) {
        where.sectorId = sectorId;
      } else if (req.user.sectorId) {
        where.sectorId = req.user.sectorId;
      }

      const lists = await prisma.candidateList.findMany({
        where,
        orderBy: { uploadDate: 'desc' },
      });
      return success(res, { lists });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async bulkSchedule(req, res) {
    try {
      const { candidateIds } = req.body;
      if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
        return error(res, 'Candidate IDs array is required', 400, 'BAD_REQUEST');
      }

      const scheduledCandidates = [];

      for (const candidateId of candidateIds) {
        const candidate = await prisma.candidate.findUnique({
          where: { id: candidateId },
          include: { assignments: { include: { recruiter: true } } }
        });

        if (!candidate || candidate.status !== 'assigned') continue;

        const recruiter = candidate.assignments?.[0]?.recruiter || req.user;
        const linkToken = uuidv4();
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 7); // Valid for next 7 days

        await prisma.$transaction(async (tx) => {
          // Update candidate status
          await tx.candidate.update({
            where: { id: candidateId },
            data: { status: 'scheduled' }
          });

          // Create Interview
          const iv = await tx.interview.create({
            data: {
              candidateId,
              recruiterId: recruiter.id,
              status: 'scheduled',
              scheduledAt: defaultDate,
            }
          });

          // Create InterviewSchedule
          await tx.interviewSchedule.create({
            data: {
              interviewId: iv.id,
              recruiterId: recruiter.id,
              date: defaultDate,
              timeStart: '09:00',
              timeEnd: '18:00',
              linkToken,
            }
          });
        });

        // Send invite email using the recruiter's (or fallback global) SMTP settings
        try {
          await emailService.sendInterviewInvite({
            candidate,
            recruiter,
            schedule: { date: defaultDate, timeStart: '09:00', timeEnd: '18:00' },
            linkToken,
          });
        } catch (emailErr) {
          console.error(`Bulk invite email failed for ${candidate.email}:`, emailErr);
        }

        scheduledCandidates.push(candidateId);
      }

      // Group by recruiter and notify
      const candidatesByRecruiter = await prisma.interview.findMany({
        where: { candidateId: { in: scheduledCandidates }, status: 'scheduled' },
        select: { recruiterId: true, candidateId: true }
      });

      const recruiterMap = new Map();
      for (const item of candidatesByRecruiter) {
        recruiterMap.set(item.recruiterId, (recruiterMap.get(item.recruiterId) || 0) + 1);
      }

      for (const [recruiterId, count] of recruiterMap.entries()) {
        await socketService.notify(recruiterId, {
          type: 'bulk_scheduled',
          title: 'Interviews Scheduled',
          message: `${count} interview(s) have been scheduled for your candidates.`,
        });
      }

      return success(res, { scheduledCount: scheduledCandidates.length, scheduledCandidates });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async deleteList(req, res) {
    try {
      const { id } = req.params;

      const list = await prisma.candidateList.findUnique({
        where: { id },
      });

      if (!list) {
        return error(res, 'Candidate list not found', 404, 'NOT_FOUND');
      }

      if (['admin', 'hr'].includes(req.user.role?.name) && list.sectorId !== req.user.sectorId) {
        return error(res, 'Unauthorized to delete lists from another sector', 403, 'FORBIDDEN');
      }

      const candidates = await prisma.candidate.findMany({
        where: { listId: id },
        select: { id: true },
      });
      const candidateIds = candidates.map((c) => c.id);

      await prisma.$transaction(async (tx) => {
        if (candidateIds.length > 0) {
          await tx.interviewResult.deleteMany({
            where: { interview: { candidateId: { in: candidateIds } } },
          });

          await tx.interviewSchedule.deleteMany({
            where: { interview: { candidateId: { in: candidateIds } } },
          });

          await tx.candidateAnswer.deleteMany({
            where: { interview: { candidateId: { in: candidateIds } } },
          });

          await tx.interview.deleteMany({
            where: { candidateId: { in: candidateIds } },
          });

          await tx.candidateAssignment.deleteMany({
            where: { candidateId: { in: candidateIds } },
          });

          await tx.resume.deleteMany({
            where: { candidateId: { in: candidateIds } },
          });

          await tx.emailLog.deleteMany({
            where: { candidateId: { in: candidateIds } },
          });

          await tx.candidate.deleteMany({
            where: { id: { in: candidateIds } },
          });
        }

        await tx.candidateAssignment.deleteMany({
          where: { listId: id },
        });

        await tx.candidateList.delete({
          where: { id },
        });
      });

      return success(res, { message: 'Candidate list and all associated data deleted successfully' });
    } catch (err) {
      return error(res, err.message);
    }
  }
};
