/**
 * VisionAssist - Configuration
 * 
 * This file is generated during build from environment variables.
 * DO NOT commit your actual API key to source control.
 * 
 * For local development, copy this file to config.local.js and add your key.
 * For production, set GEMINI_API_KEY in Vercel environment variables.
 */

const CONFIG = {
    // Gemini API Key - injected from environment variable during build
    GEMINI_API_KEY: '%%GEMINI_API_KEY%%',

    // Model configuration - using 2.5 flash lite for better rate limits
    GEMINI_MODEL: 'gemini-2.5-flash-lite',

    // API base URL
    API_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',

    // App settings
    APP_NAME: 'VisionAssist',
    VERSION: '1.0.0'
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);

// Export for use in other modules
window.CONFIG = CONFIG;
