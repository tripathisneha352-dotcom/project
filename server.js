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
async function callGemini(parts) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Missing GEMINI_API_KEY environment variable.');
    }

    const model = 'gemini-2.5-flash-lite';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: parts
            }],
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
        const { text, fileData, fileMimeType, type } = req.body;

        // Validate type
        if (type !== 'summary' && type !== 'quiz') {
            return res.status(400).json({ error: 'Invalid input: "type" must be "summary" or "quiz".' });
        }

        // Must have either text or fileData
        if ((!text || typeof text !== 'string') && !fileData) {
            return res.status(400).json({ error: 'Invalid input: provide "text" or a file (fileData).' });
        }

        // Build the prompt
        let promptText;
        if (type === 'summary') {
            promptText = `Summarize the following content in 5–8 clear, simple bullet points that a student can easily understand.\n\nReturn ONLY valid JSON with this exact format:\n{"summary":"• Point 1\\n• Point 2\\n...","quiz":[]}`;
        } else {
            promptText = `Generate 5 multiple choice questions with 4 options (A, B, C, D) and the correct answer from the following content.\n\nReturn ONLY valid JSON with this exact format:\n{"summary":"","quiz":[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A. ..."}]}`;
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

        const rawResponse = await callGemini(parts);

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
            quiz: Array.isArray(parsed.quiz) ? parsed.quiz : []
        };

        if (type === 'summary') {
            return res.json({ summary: result.summary, quiz: [] });
        }

        return res.json({ summary: '', quiz: result.quiz });
    } catch (error) {
        console.error("Server error:", error.message);
        return res.status(500).json({ error: error.message || 'Internal server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});