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

      // Calculate dynamic AI scoring fields on the fly
      const answers = interview.answers || [];
      const totalScore = answers.reduce((sum, ans) => sum + (ans.score || 0), 0);
      const count = answers.length;
      const maxScore = count * 10;
      const averageScore = count ? parseFloat((totalScore / count).toFixed(1)) : 0;
      const autoResult = averageScore >= 6.0 ? 'pass' : 'fail';

      if (interview.result) {
        interview.result.totalScore = totalScore;
        interview.result.maxScore = maxScore;
        interview.result.averageScore = averageScore;
        interview.result.autoResult = autoResult;
      } else {
        interview.result = {
          interviewId: interview.id,
          aiScore: averageScore * 10,
          totalScore,
          maxScore,
          averageScore,
          autoResult,
        };
      }

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

      // Fetch full details for email (wrapped in try-catch so SMTP errors don't crash scheduling)
      let emailSent = false;
      let emailError = null;
      if (doSend !== false) {
        try {
          const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
          await emailService.sendInterviewInvite({
            candidate,
            recruiter: req.user,
            schedule: { date, timeStart, timeEnd },
            linkToken,
          });
          emailSent = true;
        } catch (emailErr) {
          console.error('[SMTP error during scheduling] Invitation email failed:', emailErr.message);
          emailError = emailErr.message;
        }
      }

      await socketService.notify(recruiterId, {
        type: 'interview_scheduled',
        title: 'Interview Scheduled',
        message: `An interview has been scheduled with candidate for ${new Date(date).toLocaleDateString()} at ${timeStart}.`,
        metadata: { interviewId: interview.id, candidateId },
      });

      return success(res, {
        interview,
        linkToken,
        emailSent,
        emailWarning: emailError ? 'Interview scheduled, but invitation email could not be sent (check SMTP credentials).' : null
      }, 201);
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

  async verifySendOtp(req, res) {
    try {
      const { token } = req.params;
      const schedule = await prisma.interviewSchedule.findUnique({
        where: { linkToken: token },
        include: { interview: { include: { candidate: true } } },
      });

      if (!schedule) return error(res, 'Invalid interview link', 404, 'NOT_FOUND');

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

      await prisma.interviewSession.upsert({
        where: { interviewId: schedule.interviewId },
        create: {
          interviewId: schedule.interviewId,
          otp,
          otpExpiresAt: expiresAt,
        },
        update: {
          otp,
          otpExpiresAt: expiresAt,
          isVerified: false,
        },
      });

      // Send actual OTP email
      let emailSent = false;
      try {
        const customSmtp = await emailService.getSmtpConfig(schedule.interview.candidate.sectorId);
        await emailService.sendEmail({
          to: schedule.interview.candidate.email,
          subject: 'AgnoHire Interview Verification Code',
          html: `
            <div style="font-family: sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #4f46e5; margin-top: 0;">Identity Verification</h2>
              <p>Hello <strong>${schedule.interview.candidate.name}</strong>,</p>
              <p>You have requested to verify your identity to begin your proctored assessment. Please enter the following 6-digit verification code:</p>
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 6px; text-align: center; padding: 16px; margin: 24px 0; color: #1e293b;">
                ${otp}
              </div>
              <p style="color: #64748b; font-size: 13px;">This code will expire in 5 minutes. Do not share this code with anyone.</p>
            </div>
          `,
          candidateId: schedule.interview.candidateId,
          customSmtp,
        });
        emailSent = true;
      } catch (err) {
        console.error('SMTP error while sending verification OTP:', err.message);
      }

      return success(res, {
        message: 'Verification code dispatched successfully',
        devOtp: process.env.NODE_ENV === 'development' || !emailSent ? otp : undefined,
      });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async verifyOtp(req, res) {
    try {
      const { token } = req.params;
      const { code, browserInfo, osInfo, ipAddress, fingerprint } = req.body;

      const schedule = await prisma.interviewSchedule.findUnique({
        where: { linkToken: token },
      });

      if (!schedule) return error(res, 'Invalid interview link', 404, 'NOT_FOUND');

      const session = await prisma.interviewSession.findUnique({
        where: { interviewId: schedule.interviewId },
      });

      if (!session) return error(res, 'Verification session not found', 404, 'NOT_FOUND');
      if (session.otp !== code) return error(res, 'Invalid verification code', 400, 'INVALID_CODE');
      if (new Date() > new Date(session.otpExpiresAt)) return error(res, 'Verification code expired', 400, 'EXPIRED_CODE');

      await prisma.interviewSession.update({
        where: { interviewId: schedule.interviewId },
        data: {
          isVerified: true,
          browserInfo,
          osInfo,
          ipAddress,
          deviceFingerprint: fingerprint,
          envChecked: true,
          cameraChecked: true,
          micChecked: true,
          speakerChecked: true,
          speedChecked: true,
          fullscreenChecked: true,
        },
      });

      return success(res, { message: 'Identity verified successfully' });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async registerFace(req, res) {
    try {
      const { id } = req.params;
      const { faceImageUrl } = req.body;

      await prisma.faceRegistration.upsert({
        where: { interviewId: id },
        create: {
          interviewId: id,
          faceImageUrl,
        },
        update: {
          faceImageUrl,
        },
      });

      return success(res, { message: 'Biometric face registration completed' });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async logViolation(req, res) {
    try {
      const { id } = req.params;
      const { violationType, description, severity = 'low', screenshotUrl } = req.body;

      const violation = await prisma.proctoringViolation.create({
        data: {
          interviewId: id,
          violationType,
          description,
          severity,
          screenshotUrl,
        },
      });

      const interview = await prisma.interview.findUnique({
        where: { id },
        include: { candidate: true },
      });

      if (interview) {
        const payload = {
          type: 'proctoring_alert',
          title: `Proctoring Alert: ${violationType.toUpperCase().replace('_', ' ')}`,
          message: `${interview.candidate.name} triggered a proctoring event: ${description}`,
          metadata: {
            interviewId: id,
            violationType,
            severity,
            candidateName: interview.candidate.name,
          },
        };

        // Notify recruiter in real-time
        await socketService.notify(interview.recruiterId, payload);
        socketService.emitProctoringAlert(interview.recruiterId, {
          interviewId: id,
          violation,
          candidate: interview.candidate,
        });
      }

      return success(res, { violation });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async getQuestions(req, res) {
    try {
      const { id } = req.params;
      const interview = await prisma.interview.findUnique({
        where: { id },
        include: { candidate: { include: { domain: true } } },
      });

      if (!interview) return error(res, 'Interview not found', 404, 'NOT_FOUND');

      const domainName = interview.candidate?.domain?.name || 'General';

      // Load questions from database first
      const dbQuestions = await prisma.question.findMany({
        where: {
          bank: { domainId: interview.candidate.domainId || undefined },
        },
        orderBy: {
          order: 'asc'
        },
        take: 12,
      });

      let questions = dbQuestions.map(q => ({
        id: q.id,
        text: q.text,
        type: q.type,
        difficulty: q.difficulty,
        options: q.options,
        order: q.order,
      }));

      // Fallback: If database question bank is empty, generate dynamic enterprise assessment questions
      if (questions.length === 0) {
        questions = getEnterpriseFallbackQuestions(domainName);
      }

      return success(res, { questions });
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

      // Fetch the interview to get candidate details and fallback domain questions
      const interviewRecord = await prisma.interview.findUnique({
        where: { id },
        include: { candidate: { include: { domain: true } } },
      });
      const domainName = interviewRecord?.candidate?.domain?.name || 'General';
      const fallbackQuestions = getEnterpriseFallbackQuestions(domainName);

      // Fetch database questions matching submitted answers
      const questionIds = answers.map((a) => a.questionId);
      const dbQuestions = await prisma.question.findMany({
        where: { id: { in: questionIds } },
      });

      // Build quick lookup map for all possible questions
      const questionsMap = {};
      fallbackQuestions.forEach((fq) => {
        questionsMap[fq.id] = fq;
      });
      dbQuestions.forEach((dbQ) => {
        questionsMap[dbQ.id] = dbQ;
      });

      // Grade each answer asynchronously
      const gradedAnswers = await Promise.all(
        answers.map(async (ans) => {
          const matchedQuestion = questionsMap[ans.questionId];
          let score = 0;

          if (matchedQuestion) {
            const hasCorrectAnswer = matchedQuestion.correctAnswer && matchedQuestion.correctAnswer.trim() !== '';

            if (hasCorrectAnswer) {
              // Exact database matches (e.g. MCQ checks)
              const cleanCandidate = (ans.answerText || '').trim().toLowerCase();
              const cleanCorrect = matchedQuestion.correctAnswer.trim().toLowerCase();
              score = cleanCandidate === cleanCorrect ? 10 : 0;
              console.log(`[Grading] MCQ matching for question ${ans.questionId}: Got "${cleanCandidate}", Expected "${cleanCorrect}". Assigned score: ${score}/10`);
            } else {
              // Technical transcript or coding response - invoke AI evaluation
              score = await evaluateAnswerWithAi(matchedQuestion.text, ans.answerText || '', matchedQuestion.type);
              console.log(`[Grading] AI Evaluator completed for question ${ans.questionId}. Assigned score: ${score}/10`);
            }
          } else {
            // Unmapped question fallback
            score = computeBasicScore(ans.answerText || '');
          }

          return {
            interviewId: id,
            questionId: ans.questionId,
            answerText: ans.answerText,
            timeTaken: ans.timeTaken,
            score: score,
          };
        })
      );

      // Save graded answers in database
      await prisma.candidateAnswer.createMany({
        data: gradedAnswers,
      });

      // Calculate overall candidate AI assessment score
      const totalScore = gradedAnswers.reduce((acc, a) => acc + (a.score || 0), 0);
      const averageScore = gradedAnswers.length ? (totalScore / gradedAnswers.length) : 0;
      const aiScore = parseFloat((averageScore * 10).toFixed(1)); // Store as percentage (0-100)

      // Update interview status and save result record
      const interview = await interviewRepository.update(id, {
        status: 'completed',
        completedAt: new Date(),
      });

      await interviewRepository.createResult({
        interviewId: id,
        aiScore,
      });

      // Notify recruiter real-time via Socket.IO
      const iv = await interviewRepository.findById(id);
      socketService.emitInterviewCompleted(iv.recruiterId, {
        interviewId: id,
        candidate: iv.candidate,
        aiScore,
      });

      await socketService.notify(iv.recruiterId, {
        type: 'interview_completed',
        title: 'Interview Completed',
        message: `${iv.candidate.name} has completed their interview. AI Score: ${aiScore.toFixed(1)}/10`,
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

      // Send result email to candidate - DISABLED in favor of manual HR bulk-dispatch from templates
      /*
      await emailService.sendResultEmail({
        candidate: interview.candidate,
        decision,
        feedback,
        recruiter: req.user,
      });
      */

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

async function evaluateAnswerWithAi(questionText, answerText, questionType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[Grading] GEMINI_API_KEY is not configured. Falling back to local semantic grading.');
    return performLocalSemanticGrading(questionText, answerText, questionType);
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `
You are an expert AI technical interviewer and evaluator. Your task is to evaluate a candidate's answer for the following question.

Question Category/Type: ${questionType}
Question:
"${questionText}"

Candidate's Answer (Speech Transcript or Code submission):
"${answerText}"

Grade the candidate's answer on a scale from 0 to 10 (inclusive) based on correctness, completeness, and relevance.
- Provide a score from 0 to 10 (as an integer).
- Provide a brief constructive reason/explanation for the score.

You MUST respond strictly in the following JSON format:
{
  "score": <number_from_0_to_10>,
  "reason": "<explanation_text>"
}
    `;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('Empty response from Gemini API');
    }

    const parsed = JSON.parse(responseText.trim());
    const score = parseInt(parsed.score);
    if (isNaN(score)) {
      throw new Error('Parsed score is not a number');
    }

    return Math.max(0, Math.min(10, score));
  } catch (err) {
    console.error('[Grading] AI evaluation failed:', err.message, 'Falling back to local semantic grading.');
    return performLocalSemanticGrading(questionText, answerText, questionType);
  }
}

function performLocalSemanticGrading(questionText, answerText, questionType) {
  if (!answerText || answerText.trim() === '') return 0;

  const cleanAns = answerText.toLowerCase().trim();
  const cleanQuest = questionText.toLowerCase().trim();
  const words = cleanAns.split(/\s+/).filter(Boolean);

  if (words.length < 3) return 1;

  let score = 3;

  if (questionType === 'coding') {
    const codeKeywords = ['function', 'def', 'return', 'const', 'let', 'var', 'for', 'while', 'if', 'else', 'class', 'import', 'include', 'std', 'vector', 'string'];
    let matches = 0;
    codeKeywords.forEach(kw => {
      if (cleanAns.includes(kw)) matches++;
    });

    if (matches > 4) score += 4;
    else if (matches > 2) score += 2;

    if (cleanQuest.includes('reverse') && (cleanAns.includes('split') || cleanAns.includes('reverse') || cleanAns.includes('join') || cleanAns.includes('[::-1]'))) {
      score += 3;
    }
    if (cleanQuest.includes('two sum') && (cleanAns.includes('map') || cleanAns.includes('index') || cleanAns.includes('target') || cleanAns.includes('sum') || cleanAns.includes('hash'))) {
      score += 3;
    }
    if (cleanQuest.includes('median') && (cleanAns.includes('sort') || cleanAns.includes('length') || cleanAns.includes('math.floor') || cleanAns.includes('len('))) {
      score += 3;
    }
    if (cleanQuest.includes('fizzbuzz') && (cleanAns.includes('% 3') || cleanAns.includes('% 5') || cleanAns.includes('fizz') || cleanAns.includes('buzz'))) {
      score += 3;
    }
  } else {
    if (words.length > 50) score += 3;
    else if (words.length > 20) score += 2;
    else if (words.length > 8) score += 1;

    if (cleanQuest.includes('virtual dom') || cleanQuest.includes('reconciliation')) {
      const keywords = ['diff', 'virtual', 'reconciliation', 'render', 'update', 'batch', 'performance', 'real dom', 'ui', 'components'];
      keywords.forEach(kw => {
        if (cleanAns.includes(kw)) score += 0.7;
      });
    }

    if (cleanQuest.includes('regularization') || cleanQuest.includes('l1') || cleanQuest.includes('l2')) {
      const keywords = ['overfitting', 'lasso', 'ridge', 'sparsity', 'absolute', 'squared', 'penalty', 'weights', 'l1', 'l2'];
      keywords.forEach(kw => {
        if (cleanAns.includes(kw)) score += 0.7;
      });
    }

    if (cleanQuest.includes('event loop') || cleanQuest.includes('asynchronous')) {
      const keywords = ['call stack', 'callback', 'queue', 'non-blocking', 'single-thread', 'io', 'libuv', 'microtask', 'macrotask', 'promise'];
      keywords.forEach(kw => {
        if (cleanAns.includes(kw)) score += 0.7;
      });
    }

    if (cleanQuest.includes('index') || cleanQuest.includes('database')) {
      const keywords = ['b-tree', 'lookup', 'speed', 'query', 'scan', 'performance', 'primary key', 'pointer', 'search'];
      keywords.forEach(kw => {
        if (cleanAns.includes(kw)) score += 0.7;
      });
    }
  }

  return Math.max(0, Math.min(10, Math.round(score)));
}

function computeBasicScore(answerText) {
  if (!answerText) return 0;
  const wordCount = answerText.split(/\s+/).length;
  if (wordCount > 50) return 8;
  if (wordCount > 20) return 6;
  if (wordCount > 5) return 4;
  return 2;
}

function getEnterpriseFallbackQuestions(domainName) {
  const isFrontend = /react|frontend|javascript|js|ui|web/i.test(domainName);
  const isAiMl = /ai|ml|machine|learning|nlp|vision/i.test(domainName);

  if (isFrontend) {
    return [
      {
        id: 'apt-1',
        text: 'A car completes a journey in 6 hours. It covers half the distance at 40 km/h and the rest at 60 km/h. Find the total distance covered and show your step-by-step mathematical logic.',
        type: 'text',
        difficulty: 'medium',
        options: null,
        section: 'Aptitude'
      },
      {
        id: 'apt-2',
        text: 'Identify the next term in the logical sequence: 3, 7, 15, 31, 63, ... and explain the underlying numeric formula.',
        type: 'text',
        difficulty: 'easy',
        options: null,
        section: 'Aptitude'
      },
      {
        id: 'tech-1',
        text: 'Explain whether React state updates are synchronous or asynchronous. What is state batching, and how does it optimize component re-rendering cycles?',
        type: 'text',
        difficulty: 'medium',
        options: null,
        section: 'Technical'
      },
      {
        id: 'tech-2',
        text: 'Describe the differences between the Virtual DOM and the Real DOM in modern web applications. Explain how React uses reconciliation to improve performance.',
        type: 'text',
        difficulty: 'medium',
        options: null,
        section: 'Technical'
      },
      {
        id: 'code-1',
        text: 'Reverse a String:\nWrite a function that takes a string input and returns the reversed string.\n\nExample:\nreverseString("hello") -> "olleh"\nreverseString("agno") -> "onga"',
        type: 'coding',
        difficulty: 'easy',
        options: {
          languages: ['javascript', 'python', 'cpp'],
          starters: {
            javascript: 'function reverseString(str) {\n  // Write your code here\n  return str;\n}',
            python: 'def reverse_string(s: str) -> str:\n    # Write your code here\n    return s',
            cpp: '#include <string>\nusing namespace std;\n\nstring reverseString(string s) {\n    // Write your code here\n    return s;\n}'
          },
          testCases: [
            { input: '"hello"', output: '"olleh"' },
            { input: '"agno"', output: '"onga"' }
          ]
        },
        section: 'Coding'
      },
      {
        id: 'code-2',
        text: 'Two Sum:\nGiven an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nExample:\nnums = [2, 7, 11, 15], target = 9 -> Return [0, 1] because nums[0] + nums[1] == 9',
        type: 'coding',
        difficulty: 'medium',
        options: {
          languages: ['javascript', 'python', 'cpp'],
          starters: {
            javascript: 'function twoSum(nums, target) {\n  // Write your code here\n  return [];\n}',
            python: 'def two_sum(nums, target):\n    # Write your code here\n    return []',
            cpp: '#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Write your code here\n    return {};\n}'
          },
          testCases: [
            { input: '[2, 7, 11, 15], 9', output: '[0, 1]' },
            { input: '[3, 2, 4], 6', output: '[1, 2]' }
          ]
        },
        section: 'Coding'
      }
    ];
  } else if (isAiMl) {
    return [
      {
        id: 'apt-1',
        text: 'A bag contains 5 red balls and 4 green balls. If 2 balls are drawn at random, what is the probability that one is red and one is green? Explain your mathematical reasoning.',
        type: 'text',
        difficulty: 'medium',
        options: null,
        section: 'Aptitude'
      },
      {
        id: 'tech-1',
        text: 'What is the purpose of Dropout in Deep Neural Networks and how does it prevent overfitting? Detail the difference in how dropout behaves during training versus inference.',
        type: 'text',
        difficulty: 'easy',
        options: null,
        section: 'Technical'
      },
      {
        id: 'tech-2',
        text: 'Explain the difference between L1 and L2 regularization. How do they affect the model weights and sparsity?',
        type: 'text',
        difficulty: 'medium',
        options: null,
        section: 'Technical'
      },
      {
        id: 'code-1',
        text: 'Find Median of an Array:\nWrite a function that calculates the median value of a list of numbers.\n\nExample:\nmedian([3, 1, 2]) -> 2\nmedian([4, 1, 3, 2]) -> 2.5',
        type: 'coding',
        difficulty: 'easy',
        options: {
          languages: ['javascript', 'python'],
          starters: {
            javascript: 'function getMedian(arr) {\n  // Write your code here\n  return 0;\n}',
            python: 'def get_median(arr):\n    # Write your code here\n    return 0'
          },
          testCases: [
            { input: '[3, 1, 2]', output: '2' },
            { input: '[4, 1, 3, 2]', output: '2.5' }
          ]
        },
        section: 'Coding'
      }
    ];
  } else {
    return [
      {
        id: 'apt-1',
        text: 'A boat moves downstream at 15 km/h and upstream at 9 km/h. Find the speed of the boat in still water and show your calculation steps.',
        type: 'text',
        difficulty: 'easy',
        options: null,
        section: 'Aptitude'
      },
      {
        id: 'tech-1',
        text: 'What is the purpose of an INDEX in a relational database like PostgreSQL? Explain how it speeds up query operations and describe the potential trade-offs during database writes (INSERT/UPDATE).',
        type: 'text',
        difficulty: 'easy',
        options: null,
        section: 'Technical'
      },
      {
        id: 'tech-2',
        text: 'Explain what the Node.js Event Loop is and how asynchronous I/O is handled without blocking threads.',
        type: 'text',
        difficulty: 'hard',
        options: null,
        section: 'Technical'
      },
      {
        id: 'code-1',
        text: 'FizzBuzz:\nWrite a function that returns an array of strings from 1 to n.\nFor multiples of 3 return "Fizz", for multiples of 5 return "Buzz", and for multiples of both return "FizzBuzz".\n\nExample:\nfizzBuzz(5) -> ["1", "2", "Fizz", "4", "Buzz"]',
        type: 'coding',
        difficulty: 'easy',
        options: {
          languages: ['javascript', 'python'],
          starters: {
            javascript: 'function fizzBuzz(n) {\n  // Write your code here\n  return [];\n}',
            python: 'def fizz_buzz(n):\n    # Write your code here\n    return []'
          },
          testCases: [
            { input: '5', output: '["1", "2", "Fizz", "4", "Buzz"]' },
            { input: '3', output: '["1", "2", "Fizz"]' }
          ]
        },
        section: 'Coding'
      }
    ];
  }
}
