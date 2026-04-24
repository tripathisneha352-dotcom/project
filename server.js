/**
 * Express backend for Smart Study Assistant
 * Endpoint: POST /generate
 * Body: { text: string, type: "summary" | "quiz" }
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

// Gemini endpoint for summary and quiz generation
app.post('/generate', async (req, res) => {
    try {
        const { text, type } = req.body || {};

        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'text is required and must be a string.' });
        }

        if (type !== 'summary' && type !== 'quiz') {
            return res.status(400).json({ error: 'type must be either "summary" or "quiz".' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Missing GEMINI_API_KEY in environment.' });
        }

        // Latest stable Gemini model requested
        const model = 'gemini-1.5-flash';
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const summaryPrompt =
            'Summarize this in 3–5 lines in simple language:\n\n' + text;

        const quizPrompt = `Generate 5 multiple choice questions with 4 options and correct answers from this text:\n\n${text}\n\nReturn ONLY valid JSON in this structure:\n{\n  "quiz": [\n    {\n      "question": "...",\n      "options": ["A", "B", "C", "D"],\n      "answer": "A"\n    }\n  ]\n}`;

        const prompt = type === 'summary' ? summaryPrompt : quizPrompt;

        const geminiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ]
            })
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            return res.status(500).json({ error: `Gemini API error: ${errorText}` });
        }

        const data = await geminiResponse.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!rawText) {
            return res.status(500).json({ error: 'No response generated from Gemini.' });
        }

        // Always return both keys in response format
        if (type === 'summary') {
            return res.json({
                summary: rawText,
                quiz: []
            });
        }

        // Parse quiz JSON safely (supports markdown wrapped JSON too)
        let quizPayload = rawText;
        if (rawText.startsWith('```')) {
            quizPayload = rawText.replace(/```json\s*/i, '').replace(/```/g, '').trim();
        }

        let parsedQuiz;
        try {
            parsedQuiz = JSON.parse(quizPayload);
        } catch {
            return res.status(500).json({ error: 'Quiz response was not valid JSON.' });
        }

        return res.json({
            summary: '',
            quiz: Array.isArray(parsedQuiz.quiz) ? parsedQuiz.quiz : []
        });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
