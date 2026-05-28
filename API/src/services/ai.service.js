// Global fetch is natively supported in Node 18+ and is used directly.

export const aiService = {
  /**
   * Evaluates a candidate's answer for correctness, completeness, and relevance.
   * Grades on a scale from 0 to 10 (inclusive) using Gemini or Grok API.
   * 
   * @param {string} questionText 
   * @param {string} answerText 
   * @param {string} questionType 
   * @returns {Promise<number>} Score from 0 to 10
   */
  async evaluateAnswer(questionText, answerText, questionType) {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const grokApiKey = process.env.GROK_API_KEY;

    // Try Gemini First if key is configured
    if (geminiApiKey && geminiApiKey !== 'gemini-placeholder-key') {
      try {
        console.log('[Gemini AI] Evaluating answer using Gemini API.');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
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
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json'
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

        console.log(`[Gemini AI] Successfully graded answer for question. Score: ${score}/10`);
        return Math.max(0, Math.min(10, score));
      } catch (err) {
        console.error('[Gemini AI] Evaluation failed, checking Grok fallback:', err.message);
      }
    }

    // Try Grok if key is configured
    if (grokApiKey && grokApiKey !== 'xai-placeholder-key') {
      try {
        console.log('[Grok AI] Evaluating answer using Grok API.');
        const url = 'https://api.x.ai/v1/chat/completions';
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
            'Authorization': `Bearer ${grokApiKey}`,
          },
          body: JSON.stringify({
            model: 'grok-beta',
            messages: [
              { role: 'system', content: 'You are an advanced, strict, and precise technical interviewer and grading assistant. Always return valid JSON.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Grok API returned status ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content;
        if (!responseText) {
          throw new Error('Empty response from Grok API');
        }

        const parsed = JSON.parse(responseText.trim());
        const score = parseInt(parsed.score);
        if (isNaN(score)) {
          throw new Error('Parsed score is not a number');
        }

        console.log(`[Grok AI] Successfully graded answer for question. Score: ${score}/10`);
        return Math.max(0, Math.min(10, score));
      } catch (err) {
        console.error('[Grok AI] AI evaluation failed:', err.message);
      }
    }

    console.log('[AI Service] No valid API keys configured or active. Falling back to local semantic evaluator.');
    return this.performLocalSemanticGrading(questionText, answerText, questionType);
  },

  /**
   * Generates premium assessment questions in the requested domain.
   * 
   * @param {string} domain 
   * @param {string} difficulty 
   * @param {number} count 
   * @returns {Promise<Array>} List of generated questions
   */
  async generateQuestions(domain, difficulty, count) {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const grokApiKey = process.env.GROK_API_KEY;

    // Try Gemini First if key is configured
    if (geminiApiKey && geminiApiKey !== 'gemini-placeholder-key') {
      try {
        console.log('[Gemini AI] Generating questions using Gemini API.');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const prompt = `
You are a state-of-the-art AI curriculum designer and senior technical architect.
Generate exactly ${count} highly professional assessment questions for a candidate specializing in the domain: "${domain}".
Target Difficulty Level: "${difficulty}" (easy, medium, or hard).

Provide a balanced mixture of:
- Coding Lab Assignments (where the candidate writes actual code solutions)
- Subjective Technical Text Questions (where they explain architecture, performance, or theory)

For Coding Lab questions:
- "type" MUST be "coding".
- Provide an "options" JSON object containing:
  - "languages": ["javascript", "python"]
  - "starters": A JSON object with boilerplate templates under "javascript" and "python" keys.
  - "testCases": A list of at least 2 test cases with "input" and "output" fields.

For Text questions:
- "type" MUST be "text".
- "options" MUST be null.
- Provide a clear "correctAnswer" summarizing the key points that should be in a optimal response.

You MUST respond strictly in the following JSON format:
{
  "questions": [
    {
      "text": "The detailed wording of the question...",
      "type": "coding" or "text",
      "difficulty": "${difficulty}",
      "options": <options_object_or_null>,
      "correctAnswer": "<optimal_expected_response_summary_or_null>",
      "skillTags": ["${domain}"]
    }
  ]
}
        `;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json'
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
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          throw new Error('Invalid questions array format returned by Gemini API');
        }

        console.log(`[Gemini AI] Successfully generated ${parsed.questions.length} premium questions.`);
        return parsed.questions;
      } catch (err) {
        console.error('[Gemini AI] Generation failed, checking Grok fallback:', err.message);
      }
    }

    // Try Grok if key is configured
    if (grokApiKey && grokApiKey !== 'xai-placeholder-key') {
      try {
        console.log('[Grok AI] Generating questions using Grok API.');
        const url = 'https://api.x.ai/v1/chat/completions';
        const prompt = `
You are a state-of-the-art AI curriculum designer and senior technical architect.
Generate exactly ${count} highly professional assessment questions for a candidate specializing in the domain: "${domain}".
Target Difficulty Level: "${difficulty}" (easy, medium, or hard).

Provide a balanced mixture of:
- Coding Lab Assignments (where the candidate writes actual code solutions)
- Subjective Technical Text Questions (where they explain architecture, performance, or theory)

For Coding Lab questions:
- "type" MUST be "coding".
- Provide an "options" JSON object containing:
  - "languages": ["javascript", "python"]
  - "starters": A JSON object with boilerplate templates under "javascript" and "python" keys.
  - "testCases": A list of at least 2 test cases with "input" and "output" fields.

For Text questions:
- "type" MUST be "text".
- "options" MUST be null.
- Provide a clear "correctAnswer" summarizing the key points that should be in a optimal response.

You MUST respond strictly in the following JSON format:
{
  "questions": [
    {
      "text": "The detailed wording of the question...",
      "type": "coding" or "text",
      "difficulty": "${difficulty}",
      "options": <options_object_or_null>,
      "correctAnswer": "<optimal_expected_response_summary_or_null>",
      "skillTags": ["${domain}"]
    }
  ]
}
        `;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${grokApiKey}`,
          },
          body: JSON.stringify({
            model: 'grok-beta',
            messages: [
              { role: 'system', content: 'You are an advanced syllabus designer who outputs clean, structured JSON assessment questions. Always return valid JSON matching the requested format.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Grok API returned status ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content;
        if (!responseText) {
          throw new Error('Empty response from Grok API');
        }

        const parsed = JSON.parse(responseText.trim());
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          throw new Error('Invalid questions array format returned by Grok API');
        }

        console.log(`[Grok AI] Successfully generated ${parsed.questions.length} premium questions via Grok.`);
        return parsed.questions;
      } catch (err) {
        console.error('[Grok AI] AI generation failed:', err.message);
      }
    }

    console.log('[AI Service] No valid API keys configured. Question generation requires an active AI integration (Gemini or Grok).');
    throw new Error('AI question generation requires a valid Gemini or Grok API key in your environment variables.');
  },

  /**
   * Fallback semantic grading logic.
   */
  performLocalSemanticGrading(questionText, answerText, questionType) {
    if (!answerText || answerText.trim() === '') return 0;

    const cleanAns = answerText.toLowerCase().trim();
    const cleanQuest = questionText.toLowerCase().trim();
    const words = cleanAns.split(/\s+/).filter(Boolean);

    if (words.length < 3) return 1;

    let score = 4; // Start with baseline

    if (questionType === 'coding') {
      const codeKeywords = ['function', 'def', 'return', 'const', 'let', 'var', 'for', 'while', 'if', 'else', 'class', 'import', 'include', 'std', 'vector', 'string'];
      let matches = 0;
      codeKeywords.forEach(kw => {
        if (cleanAns.includes(kw)) matches++;
      });

      if (matches > 4) score += 4;
      else if (matches > 2) score += 2;

      if (cleanQuest.includes('reverse') && (cleanAns.includes('split') || cleanAns.includes('reverse') || cleanAns.includes('join') || cleanAns.includes('[::-1]'))) {
        score += 2;
      }
      if (cleanQuest.includes('two sum') && (cleanAns.includes('map') || cleanAns.includes('index') || cleanAns.includes('target') || cleanAns.includes('sum') || cleanAns.includes('hash'))) {
        score += 2;
      }
    } else {
      if (words.length > 50) score += 3;
      else if (words.length > 20) score += 2;
      else if (words.length > 8) score += 1;

      const techKeywords = ['virtual', 'reconciliation', 'render', 'update', 'performance', 'overfitting', 'lasso', 'penalty', 'event loop', 'call stack', 'callback', 'non-blocking', 'single-thread', 'index', 'b-tree', 'lookup', 'speed'];
      techKeywords.forEach(kw => {
        if (cleanAns.includes(kw)) score += 0.5;
      });
    }

    return Math.max(0, Math.min(10, Math.round(score)));
  }
};
