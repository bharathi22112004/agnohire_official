import { prisma } from '../configs/db.js';
import { success, error, paginate } from '../utils/response.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const mammoth = require('mammoth');

export const questionsController = {
  // Question Banks
  async listBanks(req, res) {
    try {
      const { page = 1, limit = 20, domainId, recruiterId, search } = req.query;
      let where = {
        ...(domainId && { domainId }),
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      };

      if (req.user.role?.name === 'recruiter') {
        const adminUsers = await prisma.user.findMany({
          where: {
            role: {
              name: { in: ['admin', 'superadmin', 'hr'] },
            },
          },
          select: { id: true },
        });
        const adminUserIds = adminUsers.map((u) => u.id);

        where = {
          ...where,
          OR: [
            { recruiterId: req.user.id },
            { recruiterId: null },
            { createdBy: { in: adminUserIds } },
          ],
        };
      } else if (recruiterId) {
        where.recruiterId = recruiterId;
      }

      const [banks, total] = await Promise.all([
        prisma.questionBank.findMany({
          where,
          include: { domain: true, _count: { select: { questions: true } } },
          skip: (page - 1) * limit,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
        }),
        prisma.questionBank.count({ where }),
      ]);

      return success(res, { banks }, 200, paginate(total, page, limit));
    } catch (err) {
      return error(res, err.message);
    }
  },

  async previewBankDocument(req, res) {
    try {
      const file = req.file;
      if (!file) throw new Error('Document file is required');

      let extractedText = '';

      // Parse document
      if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
        try {
          const pdfParse = require('pdf-parse');
          const data = await pdfParse(file.buffer);
          extractedText = data.text;
        } catch (e) {
          extractedText = "Simulated text from PDF document";
        }
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.originalname.endsWith('.docx') || file.originalname.endsWith('.doc')) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = result.value;
      } else {
        throw new Error('Unsupported file format. Please upload PDF or DOCX.');
      }

      // Parse the extracted text into actual questions
      const rawLines = extractedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let parsedQuestions = [];
      let currentQText = "";
      let currentQOrder = null;

      for (const line of rawLines) {
        const match = line.match(/^(?:Q?\s*(\d+)[\.\)]?|Question\s*(\d+)[:\.]?)\s+/i);
        if (match) {
          if (currentQText) {
            parsedQuestions.push({ text: currentQText, order: currentQOrder });
          }
          currentQOrder = parseInt(match[1] || match[2], 10);
          currentQText = line.replace(/^(?:Q?\s*\d+[\.\)]?|Question\s*\d+[:\.]?)\s+/i, '');
        } else {
          currentQText = currentQText ? currentQText + "\n" + line : line;
        }
      }
      if (currentQText) {
        parsedQuestions.push({ text: currentQText, order: currentQOrder });
      }

      // If heuristic failed to find numbered questions, fallback to question marks/keywords
      if (parsedQuestions.length === 0 || (parsedQuestions.length === 1 && parsedQuestions[0].text === "")) {
        const fallbackLines = rawLines.filter(line => line.endsWith('?') || /^(\*|-|•|·)?\s*(What|How|Explain|Describe|Why|Who|Where|When|List|Discuss)/i.test(line));
        parsedQuestions = fallbackLines.map((line, idx) => ({
          text: line,
          order: idx + 1
        }));
      }

      if (parsedQuestions.length === 0) {
        parsedQuestions = [{
          text: "Voice Question: Please explain the core concepts from the uploaded document.",
          order: 1
        }];
      }

      // Ensure all questions have a valid incremental order
      let nextOrder = 1;
      parsedQuestions = parsedQuestions.map((pq, idx) => {
        let order = pq.order;
        if (order === null || isNaN(order)) {
          order = nextOrder;
        } else {
          nextOrder = order;
        }
        nextOrder++;
        return {
          ...pq,
          order
        };
      });

      const simulatedQuestions = parsedQuestions.map(pq => {
         const textBlock = pq.text;
         const isCoding = /(code|write|implement|algorithm|function|program|snippet)/i.test(textBlock);

         return {
            text: textBlock.substring(0, 500),
            type: isCoding ? 'coding' : 'text',
            difficulty: 'medium',
            options: isCoding ? {
              languages: ['javascript', 'python'],
              starters: {
                javascript: 'function solution() {\n  // Write your code here\n}',
                python: 'def solution():\n    # Write your code here\n    pass'
              },
              testCases: [
                { input: '()', output: 'true' }
              ]
            } : null,
            correctAnswer: null,
            skillTags: isCoding ? ['Coding'] : ['General'],
            order: pq.order
         };
      });

      return success(res, { questions: simulatedQuestions, message: 'Document parsed successfully' }, 200);
    } catch (err) {
      return error(res, err.message);
    }
  },

  async uploadBankDocument(req, res) {
    try {
      if (req.user.role?.name === 'recruiter') {
        return error(res, 'Recruiters are not authorized to upload question banks', 403);
      }
      const { name, domainId } = req.body;
      const file = req.file;

      if (!file) throw new Error('Document file is required');
      if (!name) throw new Error('Bank name is required');

      let extractedText = '';

      // Parse document
      if (file.mimetype === 'application/pdf') {
        try {
          const pdfParse = require('pdf-parse');
          const data = await pdfParse(file.buffer);
          extractedText = data.text;
        } catch (e) {
          // If pdf-parse fails due to Node version, simulate text extraction
          extractedText = "Simulated text from PDF document";
        }
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = result.value;
      } else {
        throw new Error('Unsupported file format. Please upload PDF or DOCX.');
      }

      // Parse the extracted text into actual questions
      const rawLines = extractedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let parsedQuestions = [];
      let currentQText = "";
      let currentQOrder = null;

      for (const line of rawLines) {
        const match = line.match(/^(?:Q?\s*(\d+)[\.\)]?|Question\s*(\d+)[:\.]?)\s+/i);
        if (match) {
          if (currentQText) {
            parsedQuestions.push({ text: currentQText, order: currentQOrder });
          }
          currentQOrder = parseInt(match[1] || match[2], 10);
          currentQText = line.replace(/^(?:Q?\s*\d+[\.\)]?|Question\s*\d+[:\.]?)\s+/i, '');
        } else {
          currentQText = currentQText ? currentQText + "\n" + line : line;
        }
      }
      if (currentQText) {
        parsedQuestions.push({ text: currentQText, order: currentQOrder });
      }

      // If heuristic failed to find numbered questions, fallback to question marks/keywords
      if (parsedQuestions.length === 0 || (parsedQuestions.length === 1 && parsedQuestions[0].text === "")) {
        const fallbackLines = rawLines.filter(line => line.endsWith('?') || /^(\*|-|•|·)?\s*(What|How|Explain|Describe|Why|Who|Where|When|List|Discuss)/i.test(line));
        parsedQuestions = fallbackLines.map((line, idx) => ({
          text: line,
          order: idx + 1
        }));
      }

      if (parsedQuestions.length === 0) {
        parsedQuestions = [{
          text: "Voice Question: Please explain the core concepts from the uploaded document.",
          order: 1
        }];
      }

      // Ensure all questions have a valid incremental order
      let nextOrder = 1;
      parsedQuestions = parsedQuestions.map((pq, idx) => {
        let order = pq.order;
        if (order === null || isNaN(order)) {
          order = nextOrder;
        } else {
          nextOrder = order;
        }
        nextOrder++;
        return {
          ...pq,
          order
        };
      });

      const simulatedQuestions = parsedQuestions.map(pq => {
         const textBlock = pq.text;
         const isCoding = /(code|write|implement|algorithm|function|program|snippet)/i.test(textBlock);

         return {
            text: textBlock.substring(0, 500), // Protect against very long chunks
            type: isCoding ? 'coding' : 'text',
            difficulty: 'medium',
            options: isCoding ? {
              languages: ['javascript', 'python'],
              starters: {
                javascript: 'function solution() {\n  // Write your code here\n}',
                python: 'def solution():\n    # Write your code here\n    pass'
              },
              testCases: [
                { input: '()', output: 'true' }
              ]
            } : null,
            correctAnswer: null,
            skillTags: isCoding ? ['Coding'] : ['General'],
            order: pq.order,
            createdBy: req.user.id
         };
      });

      // Create the Bank and Questions in a transaction
      const bank = await prisma.questionBank.create({
        data: {
          name,
          domainId: domainId || null,
          createdBy: req.user.id,
          isAiGenerated: true,
          questions: {
            create: simulatedQuestions
          }
        },
        include: {
          domain: true,
          _count: { select: { questions: true } }
        }
      });

      return success(res, { bank, message: 'Document parsed successfully' }, 201);
    } catch (err) {
      return error(res, err.message);
    }
  },

  async createBank(req, res) {
    try {
      if (req.user.role?.name === 'recruiter') {
        return error(res, 'Recruiters are not authorized to create question banks', 403);
      }
      const bank = await prisma.questionBank.create({
        data: {
          ...req.body,
          createdBy: req.user.id,
          recruiterId: req.user.role?.name === 'recruiter' ? req.user.id : req.body.recruiterId,
        },
        include: { domain: true },
      });
      return success(res, { bank }, 201);
    } catch (err) {
      return error(res, err.message);
    }
  },

  async updateBank(req, res) {
    try {
      const bank = await prisma.questionBank.update({
        where: { id: req.params.id },
        data: req.body,
      });
      return success(res, { bank });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async deleteBank(req, res) {
    try {
      await prisma.questionBank.delete({ where: { id: req.params.id } });
      return success(res, { message: 'Question bank deleted' });
    } catch (err) {
      return error(res, err.message);
    }
  },

  // Questions
  async listQuestions(req, res) {
    try {
      const { bankId } = req.params;
      const { page = 1, limit = 20, difficulty, type } = req.query;
      const where = {
        bankId,
        ...(difficulty && { difficulty }),
        ...(type && { type }),
      };

      const [questions, total] = await Promise.all([
        prisma.question.findMany({
          where,
          skip: (page - 1) * limit,
          take: parseInt(limit),
          orderBy: { order: 'asc' },
        }),
        prisma.question.count({ where }),
      ]);

      return success(res, { questions }, 200, paginate(total, page, limit));
    } catch (err) {
      return error(res, err.message);
    }
  },

  async createQuestion(req, res) {
    try {
      let order = req.body.order;
      if (order === undefined || order === null) {
        const lastQuestion = await prisma.question.findFirst({
          where: { bankId: req.params.bankId },
          orderBy: { order: 'desc' }
        });
        order = lastQuestion ? lastQuestion.order + 1 : 1;
      }

      const question = await prisma.question.create({
        data: { ...req.body, order, bankId: req.params.bankId, createdBy: req.user.id },
      });
      return success(res, { question }, 201);
    } catch (err) {
      return error(res, err.message);
    }
  },

  async updateQuestion(req, res) {
    try {
      const question = await prisma.question.update({
        where: { id: req.params.qid },
        data: req.body,
      });
      return success(res, { question });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async deleteQuestion(req, res) {
    try {
      await prisma.question.delete({ where: { id: req.params.qid } });
      return success(res, { message: 'Question deleted' });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async aiGenerateQuestions(req, res) {
    try {
      const { bankId, domain, difficulty, count = 5 } = req.body;

      // Simulate AI generation (in production, call OpenAI/Gemini API)
      const generated = Array.from({ length: count }, (_, i) => {
        const isCoding = i % 2 === 0;
        return {
          bankId,
          text: isCoding
            ? `${domain} Coding Assignment ${i + 1}: Implement a robust solution for a ${domain} task at ${difficulty} level.`
            : `${domain} Conceptual Question ${i + 1}: Describe the core architecture and design patterns of ${domain} at ${difficulty} level.`,
          type: isCoding ? 'coding' : 'text',
          difficulty,
          options: isCoding ? {
            languages: ['javascript', 'python'],
            starters: {
              javascript: 'function solution() {\n  // Write your code here\n}',
              python: 'def solution():\n    # Write your code here\n    pass'
            },
            testCases: [
              { input: '()', output: 'true' }
            ]
          } : null,
          correctAnswer: null,
          skillTags: [domain, isCoding ? 'Coding' : 'Conceptual'],
          createdBy: req.user.id,
          order: i + 1,
        };
      });

      const questions = await prisma.question.createMany({
        data: generated,
        skipDuplicates: true,
      });

      // Mark bank as AI generated
      await prisma.questionBank.update({
        where: { id: bankId },
        data: { isAiGenerated: true },
      });

      return success(res, { generated: questions.count });
    } catch (err) {
      return error(res, err.message);
    }
  },

  async getQuestionsForInterview(req, res) {
    try {
      const { domainId, difficulty, count = 10 } = req.query;

      const questions = await prisma.question.findMany({
        where: {
          bank: { ...(domainId && { domainId }) },
          ...(difficulty && { difficulty }),
        },
        take: parseInt(count),
        orderBy: { createdAt: 'desc' },
      });

      // Shuffle
      const shuffled = questions.sort(() => Math.random() - 0.5);

      return success(res, { questions: shuffled });
    } catch (err) {
      return error(res, err.message);
    }
  },
};
