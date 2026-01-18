/**
 * VisionAssist - Gemini API Module
 * Integration with Google Gemini 3 API for vision analysis
 */

class GeminiManager {
    constructor() {
        this.apiKey = null;
        this.model = window.CONFIG?.GEMINI_MODEL || 'gemini-2.0-flash';
        this.baseUrl = window.CONFIG?.API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';

        // Request configuration for low latency
        this.config = {
            generationConfig: {
                temperature: 0.4,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 300, // Keep responses concise
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
            ]
        };

        // Prompts optimized for accessibility
        this.prompts = {
            explore: `You are an AI assistant helping a visually impaired person understand their surroundings. 
Describe what you see in this image in a clear, helpful way.

Guidelines:
- Start with the most important or prominent elements
- Describe spatial relationships (left, right, ahead, near, far)
- Mention any potential obstacles or hazards first
- Include colors and textures when relevant
- Keep the description concise but informative (2-3 sentences)
- Use natural, conversational language
- Avoid saying "I see" or "In this image" - speak directly

Focus on what would be most useful for someone who cannot see.`,

            read: `You are an AI assistant helping a visually impaired person read text.
Extract and read aloud ALL visible text in this image.

Guidelines:
- Read text in logical order (top to bottom, left to right)
- Include all text: signs, labels, documents, screens
- Pronounce numbers and abbreviations clearly
- If text is partially visible or unclear, mention that
- For documents, describe the general type (letter, receipt, etc.)
- Keep formatting simple and readable

Begin reading the text now:`,

            navigate: `You are an AI navigation assistant helping a visually impaired person move safely.
Analyze this image for navigation guidance.

Focus on:
- The path ahead (is it clear? any obstacles?)
- Upcoming hazards (stairs, curbs, wet floor, construction)
- Doorways, intersections, or turns
- Distance estimates when possible
- Relevant signs or markers

Provide brief, actionable guidance like: "Path clear ahead for about 5 meters. Door on your right."
If there are immediate hazards, say "CAUTION" first.`,

            identify: `Identify and describe the main object or item in the center of this image.

Provide:
- What the object is
- Key identifying features
- Color and approximate size
- Any text or labels on it
- If it's a product, include brand/name if visible

Keep the response brief and clear.`
        };

        this.loadApiKey();
        console.log('[Gemini] Module initialized');
    }

    loadApiKey() {
        // First try to get from CONFIG (pre-configured)
        if (window.CONFIG?.GEMINI_API_KEY && window.CONFIG.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
            this.apiKey = window.CONFIG.GEMINI_API_KEY;
            console.log('[Gemini] API key loaded from config');
            return;
        }

        // Fallback to localStorage for backward compatibility
        try {
            this.apiKey = localStorage.getItem('visionassist_apikey');
        } catch (e) {
            console.warn('[Gemini] Failed to load API key:', e);
        }
    }

    saveApiKey(key) {
        try {
            this.apiKey = key;
            localStorage.setItem('visionassist_apikey', key);
            return true;
        } catch (e) {
            console.error('[Gemini] Failed to save API key:', e);
            return false;
        }
    }

    hasApiKey() {
        return !!this.apiKey && this.apiKey.length > 0;
    }

    /**
     * Analyze image with Gemini Vision
     * @param {string} base64Image - Base64 encoded image
     * @param {string} mode - Analysis mode: 'explore', 'read', 'navigate', 'identify'
     * @param {string} customPrompt - Optional custom prompt
     * @returns {Promise<string>} Analysis result
     */
    async analyzeImage(base64Image, mode = 'explore', customPrompt = null) {
        if (!this.apiKey) {
            throw new Error('API key not configured. Please add your Gemini API key in Settings.');
        }

        if (!base64Image) {
            throw new Error('No image provided');
        }

        const prompt = customPrompt || this.prompts[mode] || this.prompts.explore;

        const startTime = performance.now();

        try {
            const response = await fetch(
                `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: 'image/jpeg',
                                        data: base64Image
                                    }
                                }
                            ]
                        }],
                        ...this.config
                    })
                }
            );

            const latency = Math.round(performance.now() - startTime);
            console.log(`[Gemini] Response received in ${latency}ms`);

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));

                if (response.status === 400) {
                    throw new Error('Invalid request. Please try again.');
                } else if (response.status === 401 || response.status === 403) {
                    throw new Error('Invalid API key. Please check your Gemini API key in Settings.');
                } else if (response.status === 429) {
                    throw new Error('Too many requests. Please wait a moment and try again.');
                } else if (response.status >= 500) {
                    throw new Error('Gemini service temporarily unavailable. Please try again.');
                }

                throw new Error(error.error?.message || 'Failed to analyze image');
            }

            const data = await response.json();

            // Extract text from response
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
                // Check for safety block
                const blockReason = data.candidates?.[0]?.finishReason;
                if (blockReason === 'SAFETY') {
                    return 'I cannot describe this image due to content restrictions.';
                }
                throw new Error('No response from AI');
            }

            // Dispatch latency event for monitoring
            window.dispatchEvent(new CustomEvent('geminiLatency', {
                detail: { latency, mode }
            }));

            return text.trim();

        } catch (error) {
            console.error('[Gemini] Analysis failed:', error);

            // Network error
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error. Please check your internet connection.');
            }

            throw error;
        }
    }

    /**
     * Quick describe - optimized for speed
     */
    async quickDescribe(base64Image) {
        const quickPrompt = `Briefly describe what's in front of the camera in 1-2 sentences. Focus on the main subject and any obstacles.`;
        return this.analyzeImage(base64Image, 'explore', quickPrompt);
    }

    /**
     * Answer a question about the image
     */
    async askAboutImage(base64Image, question) {
        const prompt = `A visually impaired user is looking at something and asks: "${question}"
Please provide a helpful, direct answer based on what you see in the image.`;
        return this.analyzeImage(base64Image, 'explore', prompt);
    }

    /**
     * Validate API key
     */
    async validateApiKey(key) {
        const testUrl = `${this.baseUrl}/models/${this.model}?key=${key}`;

        try {
            const response = await fetch(testUrl);
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    /**
     * Get current model info
     */
    getModelInfo() {
        return {
            model: this.model,
            hasKey: this.hasApiKey()
        };
    }
}

// Export singleton instance
window.geminiManager = new GeminiManager();
