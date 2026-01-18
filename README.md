# VisionAssist - Real-Time Accessibility Assistant

AI-powered vision assistant for visually impaired users. Uses Gemini 3 to describe surroundings, read text, and provide navigation guidance.

## Setup

### Local Development
1. Copy `js/config.template.js` to `js/config.js`
2. Add your Gemini API key to `config.js`
3. Run `npx serve -l 3000`

### Deployment (Vercel)
1. Push to GitHub
2. Import to Vercel
3. Add environment variable: `GEMINI_API_KEY=your_key_here`
4. Deploy!

## Features
- 🎯 Scene Description
- 📖 Text Reading (OCR)
- 🧭 Navigation Assistance
- 🎤 Voice Commands
- 📱 PWA (Install on mobile)

## Tech Stack
- Vanilla JS (no framework for max performance)
- Gemini 2.5 Flash Lite API
- Web Speech API (TTS)
- PWA with Service Worker
