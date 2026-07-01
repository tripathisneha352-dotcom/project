/**Express backend for Smart Study Assistant
 * Endpoint: POST /generate
 * Uses Google Gemini API to generate summary or quiz.
 * Supports both plain text and PDF (base64) uploads.
 */
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fetch from 'node-fetch';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(cors());
app.use(express.static(path.join(__dirname, '..')));

/**
 * Call the Gemini API.
 * @param {Array} parts - Array of parts (text and/or inlineData) for the Gemini request
 */
async function callGemini(parts, timeoutMs = 45000) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Missing GEMINI_API_KEY environment variable.');
    }

    const models = [
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-2.5-flash-lite',
    ];

    let lastError = 'Gemini API request failed.';

    for (const model of models) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        let response;
        try {
            response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: parts
                    }],
                })
            });
        } catch (err) {
            clearTimeout(timeout);
            lastError = err.name === 'AbortError'
                ? `Request timed out for ${model}.`
                : (err.message || 'Network error calling Gemini.');
            if (model !== models[models.length - 1]) continue;
            throw new Error(lastError);
        }
        clearTimeout(timeout);

        const data = await response.json();

        if (!response.ok) {
            lastError = data?.error?.message || `Gemini API request failed (${model}).`;
            const retryable = /high demand|overloaded|unavailable|503|429/i.test(lastError);
            if (retryable && model !== models[models.length - 1]) continue;
            throw new Error(lastError);
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            lastError = 'Gemini returned an empty response.';
            continue;
        }

        return text;
    }

    throw new Error(lastError);
}

app.post('/generate', async (req, res) => {
    try {
        const { text, fileData, fileMimeType, type } = req.body;

        // Validate type
        if (type !== 'summary' && type !== 'quiz' && type !== 'flashcards') {
            return res.status(400).json({ error: 'Invalid input: "type" must be "summary", "quiz", or "flashcards".' });
        }

        // Must have either text or fileData
        if ((!text || typeof text !== 'string') && !fileData) {
            return res.status(400).json({ error: 'Invalid input: provide "text" or a file (fileData).' });
        }

        // Build the prompt
        let promptText;
        if (type === 'summary') {
            promptText = `Summarize the following content in 5–8 clear, simple bullet points that a student can easily understand.\n\nReturn ONLY valid JSON with this exact format:\n{"summary":"• Point 1\\n• Point 2\\n...","quiz":[]}`;
        } else if (type === 'quiz') {
            promptText = `Generate 5 multiple choice questions with 4 options (A, B, C, D) and the correct answer from the following content.\n\nReturn ONLY valid JSON with this exact format:\n{"summary":"","quiz":[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A. ..."}]}`;
        } else {
            promptText = `You are an expert study assistant and educational designer. Analyze the uploaded PDF thoroughly and convert it into a complete set of aesthetically pleasing, easy-to-study digital flashcards.

Instructions:
- Read every page carefully and do not skip important concepts.
- Create flashcards covering all key topics, definitions, formulas, facts, diagrams (describe them if necessary), examples, and important points.
- Break large topics into multiple smaller flashcards instead of making long cards.
- Use simple, student-friendly language while preserving technical accuracy.
- Highlight keywords using **bold** markdown in front and back text.
- Use emojis sparingly to improve memorization (📚✨💡🧠🌸).
- Add small memory tricks or mnemonics wherever helpful.
- Include comparison tables in the back text when concepts are commonly confused.
- If the PDF contains processes, convert them into step-by-step flashcards.
- If there are formulas, include: formula, meaning of each variable, when to use it, and one quick example.
- If there are lists, convert each important point into separate flashcards.
- Generate as many flashcards as necessary for complete coverage (aim for thorough coverage, typically 15–40 cards depending on PDF length).

Important: Do not invent information. Only use content from the uploaded PDF. If a section is unclear or incomplete, list it in unclearSections rather than guessing. Ensure no major topic from the PDF is omitted.

Return ONLY valid JSON with this exact format:
{"flashcards":[{"number":1,"emoji":"🌸","front":"Question or concept title with **keywords** bolded","back":"Clear explanation\\n• Key points\\n• Example if applicable\\n• Memory tip 💡","memoryTip":"optional short mnemonic","color":"lavender"}],"unclearSections":[],"sourceNote":"brief note on coverage"}

For color use one of: lavender, blush, blue, mint, cream (rotate for variety).`;
        }

        // Build parts array for Gemini
        const parts = [];

        if (fileData) {
            // PDF or other binary: send as inlineData
            parts.push({
                inlineData: {
                    mimeType: fileMimeType || 'application/pdf',
                    data: fileData
                }
            });
            parts.push({ text: promptText });
        } else {
            // Plain text: combine prompt + text
            parts.push({ text: `${promptText}\n\nContent:\n${text}` });
        }

        const rawResponse = await callGemini(parts, type === 'flashcards' ? 120000 : 45000);

        let parsed;
        try {
            let cleaned = rawResponse.trim();

            // Remove markdown code fences like ```json ... ```
            cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "");

            // Extract only JSON part
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (!match) {
                throw new Error("No valid JSON found in response");
            }
            parsed = JSON.parse(match[0]);
        } catch (err) {
            console.error("RAW RESPONSE:", rawResponse);
            throw new Error('Gemini response was not valid JSON. Please try again.');
        }

        const result = {
            summary: typeof parsed.summary === 'string' ? parsed.summary : '',
            quiz: Array.isArray(parsed.quiz) ? parsed.quiz : [],
            flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
            unclearSections: Array.isArray(parsed.unclearSections) ? parsed.unclearSections : [],
            sourceNote: typeof parsed.sourceNote === 'string' ? parsed.sourceNote : '',
        };

        if (type === 'summary') {
            return res.json({ summary: result.summary, quiz: [] });
        }

        if (type === 'quiz') {
            return res.json({ summary: '', quiz: result.quiz });
        }

        return res.json({
            flashcards: result.flashcards,
            unclearSections: result.unclearSections,
            sourceNote: result.sourceNote,
        });
    } catch (error) {
        console.error("Server error:", error.message);
        return res.status(500).json({ error: error.message || 'Internal server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});