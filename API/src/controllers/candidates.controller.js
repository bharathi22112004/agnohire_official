import { candidateRepository } from '../repositories/candidate.repository.js';
import { prisma } from '../configs/db.js';
import { success, error, paginate } from '../utils/response.js';
import { v4 as uuidv4 } from 'uuid';
import { emailService } from '../services/email.service.js';
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

      // Distribute evenly
      const assignments = candidateIds.map((candidateId, idx) => ({
        candidateId,
        recruiterId: recruiterIds[idx % recruiterIds.length],
        listId,
        assignedAt: new Date(),
      }));

      await prisma.candidateAssignment.createMany({ data: assignments, skipDuplicates: true });

      // Update candidate statuses
      await prisma.candidate.updateMany({
        where: { id: { in: candidateIds } },
        data: { status: 'assigned' },
      });

      return success(res, { assigned: assignments.length });
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
