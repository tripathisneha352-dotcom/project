# Smart Study Assistant

## Run locally

1. Install dependencies:
   ```bash
   npm install express
   ```
2. Set your Gemini API key:
   ```bash
   export GEMINI_API_KEY="your_api_key_here"
   ```
3. Start server:
   ```bash
   node server.js
   ```
4. Open:
   `http://localhost:3000`

## Features
- Pomodoro timer
- Gemini-powered summary and quiz generation (`POST /generate`)
- Focus & relax ambient sounds (placeholder audio paths)
- Student burnout check with score and suggestions
