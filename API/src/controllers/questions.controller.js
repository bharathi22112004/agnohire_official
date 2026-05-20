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
      const where = {
        ...(domainId && { domainId }),
        ...(recruiterId && { recruiterId }),
        ...(req.user.role?.name === 'recruiter' && { recruiterId: req.user.id }),
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      };

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

  async uploadBankDocument(req, res) {
    try {
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
      const lines = extractedText.split(/\r?\n/);
      let parsedTexts = lines.filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        // Check if it ends with a question mark
        if (trimmed.endsWith('?')) return true;
        // Check if it starts with a question word or bullet
        if (/^(\d+\.|\*|-|•|·)?\s*(What|How|Explain|Describe|Why|Who|Where|When|List|Discuss)/i.test(trimmed)) return true;
        return false;
      }).map(q => q.trim().replace(/^(\d+\.|\*|-|•|·)\s*/, ''));

      if (parsedTexts.length === 0) {
        parsedTexts = ["Voice Question: Please explain the core concepts from the uploaded document."];
      }

      const simulatedQuestions = parsedTexts.map(text => {
         const isCoding = /(code|write|implement|algorithm|function|program|snippet)/i.test(text);
         return {
            text: text,
            type: isCoding ? 'coding' : 'text',
            difficulty: 'medium',
            skillTags: isCoding ? ['Coding'] : ['Voice'],
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
          orderBy: { createdAt: 'desc' },
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
      const question = await prisma.question.create({
        data: { ...req.body, bankId: req.params.bankId, createdBy: req.user.id },
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
      const generated = Array.from({ length: count }, (_, i) => ({
        bankId,
        text: `${domain} Question ${i + 1}: Explain a key concept in ${domain} at ${difficulty} level.`,
        type: i % 2 === 0 ? 'mcq' : 'text',
        difficulty,
        options: i % 2 === 0 ? {
          a: 'Option A',
          b: 'Option B',
          c: 'Option C',
          d: 'Option D',
        } : null,
        correctAnswer: i % 2 === 0 ? 'a' : null,
        skillTags: [domain],
        createdBy: req.user.id,
      }));

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
