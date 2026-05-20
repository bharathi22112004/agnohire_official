import { interviewRepository } from '../repositories/interview.repository.js';
import { emailService } from '../services/email.service.js';
import { socketService } from '../services/socket.service.js';
import { prisma } from '../configs/db.js';
import { success, error, paginate } from '../utils/response.js';
import { v4 as uuidv4 } from 'uuid';
import { configService } from '../services/config.service.js';

export const interviewsController = {
  async list(req, res) {
    try {
      const { page = 1, limit = 20, status, candidateId } = req.query;
      const recruiterId = req.user.role?.name === 'recruiter' ? req.user.id : req.query.recruiterId;

      const { interviews, total } = await interviewRepository.findAll({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        candidateId,
        recruiterId,
      });

      return success(res, { interviews }, 200, paginate(total, page, limit));
    } catch (err) {
      return error(res, err.message);
    }
  },

  async getOne(req, res) {
    try {
      const interview = await interviewRepository.findById(req.params.id);
      if (!interview) return error(res, 'Interview not found', 404, 'NOT_FOUND');
      return success(res, { interview });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async schedule(req, res) {
    try {
      const { candidateId, date, timeStart, timeEnd, sendEmail: doSend } = req.body;
      const recruiterId = req.user.id;

      const linkToken = uuidv4();

      const interview = await prisma.$transaction(async (tx) => {
        const iv = await tx.interview.create({
          data: {
            candidateId,
            recruiterId,
            status: 'scheduled',
            scheduledAt: new Date(date),
          },
          include: { candidate: true },
        });

        await tx.interviewSchedule.create({
          data: {
            interviewId: iv.id,
            recruiterId,
            date: new Date(date),
            timeStart,
            timeEnd,
            linkToken,
          },
        });

        return iv;
      });

      // Fetch full details for email
      if (doSend !== false) {
        const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
        await emailService.sendInterviewInvite({
          candidate,
          recruiter: req.user,
          schedule: { date, timeStart, timeEnd },
          linkToken,
        });
      }

      await socketService.notify(recruiterId, {
        type: 'interview_scheduled',
        title: 'Interview Scheduled',
        message: `An interview has been scheduled with candidate for ${new Date(date).toLocaleDateString()} at ${timeStart}.`,
        metadata: { interviewId: interview.id, candidateId },
      });

      return success(res, { interview, linkToken }, 201);
    } catch (err) {
      return error(res, err.message);
    }
  },

  async getByToken(req, res) {
    try {
      const { token } = req.params;
      const schedule = await interviewRepository.findByToken(token);
      if (!schedule) return error(res, 'Invalid interview link', 404, 'NOT_FOUND');
      
      const expiryHours = await configService.getInterviewTokenExpiryHours();
      const expiryTime = new Date(schedule.createdAt).getTime() + (expiryHours * 60 * 60 * 1000);
      if (Date.now() > expiryTime) {
        return error(res, 'Interview link has expired', 403, 'EXPIRED_LINK');
      }

      return success(res, { schedule });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async startInterview(req, res) {
    try {
      const { id } = req.params;
      await interviewRepository.update(id, { status: 'in_progress' });

      const interview = await interviewRepository.findById(id);
      socketService.emitInterviewStarted(interview.recruiterId, {
        interviewId: id,
        candidate: interview.candidate,
      });

      return success(res, { message: 'Interview started' });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async submitAnswers(req, res) {
    try {
      const { id } = req.params;
      const { answers } = req.body; // [{ questionId, answerText, timeTaken }]

      // Save answers
      await prisma.candidateAnswer.createMany({
        data: answers.map((a) => ({
          interviewId: id,
          questionId: a.questionId,
          answerText: a.answerText,
          timeTaken: a.timeTaken,
          score: computeScore(a),
        })),
      });

      // Calculate AI score
      const aiEnabled = await configService.isAiScoringEnabled();
      let aiScore = 0;
      if (aiEnabled) {
        const totalScore = answers.reduce((acc, a) => acc + (computeScore(a) || 0), 0);
        aiScore = answers.length ? totalScore / answers.length : 0;
      }

      // Update interview + create result
      const interview = await interviewRepository.update(id, {
        status: 'completed',
        completedAt: new Date(),
      });

      await interviewRepository.createResult({
        interviewId: id,
        aiScore,
      });

      // Notify recruiter
      const iv = await interviewRepository.findById(id);
      socketService.emitInterviewCompleted(iv.recruiterId, {
        interviewId: id,
        candidate: iv.candidate,
        aiScore,
      });

      await socketService.notify(iv.recruiterId, {
        type: 'interview_completed',
        title: 'Interview Completed',
        message: `${iv.candidate.name} has completed their interview. AI Score: ${aiScore.toFixed(1)}`,
      });

      return success(res, { aiScore });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async validate(req, res) {
    try {
      const { id } = req.params;
      const { decision, feedback } = req.body; // pass | fail | hold

      const result = await interviewRepository.createResult({
        interviewId: id,
        recruiterDecision: decision,
        feedback,
        validatedAt: new Date(),
      });

      // Update candidate status
      const interview = await interviewRepository.findById(id);
      await prisma.candidate.update({
        where: { id: interview.candidateId },
        data: { status: decision === 'pass' ? 'passed' : decision === 'fail' ? 'failed' : 'held' },
      });

      // Send result email to candidate
      await emailService.sendResultEmail({
        candidate: interview.candidate,
        decision,
        feedback,
        recruiter: req.user,
      });

      // Notify HR, Admin, Superadmin
      const hrAdmins = await prisma.user.findMany({
        where: {
          role: { name: { in: ['hr', 'admin', 'superadmin'] } },
          sectorId: interview.candidate.sectorId,
          deletedAt: null,
          isActive: true,
        },
      });

      const superadmins = await prisma.user.findMany({
        where: { role: { name: 'superadmin' }, deletedAt: null, isActive: true },
      });

      const notifyUsers = [...new Set([...hrAdmins, ...superadmins].map((u) => u.id))];

      await socketService.notifyMany(notifyUsers, {
        type: 'interview_validated',
        title: 'Interview Validated',
        message: `${interview.candidate.name}'s interview has been marked as ${decision.toUpperCase()} by ${req.user.name}`,
        metadata: { interviewId: id, decision, candidateId: interview.candidateId },
      });

      socketService.emitInterviewValidated(notifyUsers, {
        interviewId: id,
        decision,
        candidate: interview.candidate,
      });

      return success(res, { result });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async bulkSchedule(req, res) {
    try {
      const { candidateIds, date, timeStart, timeEnd, sendEmail: doSend } = req.body;
      const recruiterId = req.user.id;

      if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
        return error(res, 'Candidate IDs array is required', 400, 'BAD_REQUEST');
      }

      const scheduledList = [];

      for (const candidateId of candidateIds) {
        const linkToken = uuidv4();

        const interview = await prisma.$transaction(async (tx) => {
          const candidate = await tx.candidate.findUnique({
            where: { id: candidateId }
          });

          if (!candidate || candidate.status !== 'assigned') {
            return null;
          }

          await tx.candidate.update({
            where: { id: candidateId },
            data: { status: 'scheduled' }
          });

          const iv = await tx.interview.create({
            data: {
              candidateId,
              recruiterId,
              status: 'scheduled',
              scheduledAt: new Date(date),
            },
            include: { candidate: true },
          });

          await tx.interviewSchedule.create({
            data: {
              interviewId: iv.id,
              recruiterId,
              date: new Date(date),
              timeStart,
              timeEnd,
              linkToken,
            },
          });

          return { iv, linkToken };
        });

        if (!interview) continue;

        if (doSend !== false) {
          const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
          try {
            await emailService.sendInterviewInvite({
              candidate,
              recruiter: req.user,
              schedule: { date, timeStart, timeEnd },
              linkToken: interview.linkToken,
            });
          } catch (emailErr) {
            console.error(`Email send failed for candidate ${candidate.email}:`, emailErr);
          }
        }

        scheduledList.push({ candidateId, interviewId: interview.iv.id });
      }

      return success(res, { scheduledCount: scheduledList.length, scheduledList }, 201);
    } catch (err) {
      return error(res, err.message);
    }
  },
};

function computeScore(answer) {
  // Simple keyword-based scoring (production: use AI API)
  if (!answer.answerText) return 0;
  const wordCount = answer.answerText.split(/\s+/).length;
  if (wordCount > 50) return 8;
  if (wordCount > 20) return 6;
  if (wordCount > 5) return 4;
  return 2;
}
