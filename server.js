/**Express backend for Smart Study Assistant
 * Endpoint: POST /generate
 * Uses Google Gemini API to generate summary or quiz.
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

app.use(express.json({ limit: "50mb" })); // ✅ FIX 413
app.use(cors());
app.use(express.static(path.join(__dirname)));

async function callGemini(promptText) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Missing GEMINI_API_KEY environment variable.');
    }

    const model = 'gemini-2.0-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [{ text: promptText }]
            }],
            generationConfig: {
                responseMimeType: 'application/json'
            }
        })
    });

    const data = await response.json();

    if (!response.ok) {
        const message = data?.error?.message || 'Gemini API request failed.';
        throw new Error(message);
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('Gemini returned an empty response.');
    }

    return text;
}

app.post('/generate', async (req, res) => {
    try {
        const { text, type } = req.body;

        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Invalid input: "text" is required.' });
        }

        if (type !== 'summary' && type !== 'quiz') {
            return res.status(400).json({ error: 'Invalid input: "type" must be "summary" or "quiz".' });
        }

        let prompt;
        if (type === 'summary') {
            prompt = `Summarize this in 3–5 lines in simple language:\n\n${text}\n\nReturn JSON with this format only:\n{"summary":"...","quiz":[]}`;
        } else {
            prompt = `Generate 5 multiple choice questions with 4 options and correct answers from this text:\n\n${text}\n\nReturn JSON with this format only:\n{"summary":"","quiz":[{"question":"...","options":["A","B","C","D"],"answer":"A"}]}`;
        }

        const rawResponse = await callGemini(prompt);
        let parsed;

        try {
            parsed = JSON.parse(rawResponse);
        } catch {
            throw new Error('Gemini response was not valid JSON.');
        }

        const result = {
            summary: typeof parsed.summary === 'string' ? parsed.summary : '',
            quiz: Array.isArray(parsed.quiz) ? parsed.quiz : []
        };

        if (type === 'summary') {
            return res.json({ summary: result.summary, quiz: [] });
        }

        return res.json({ summary: '', quiz: result.quiz });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});