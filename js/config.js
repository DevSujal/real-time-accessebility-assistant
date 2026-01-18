/**
 * VisionAssist - Configuration
 * 
 * IMPORTANT: Replace 'YOUR_GEMINI_API_KEY_HERE' with your actual Gemini API key
 * Get your free API key at: https://aistudio.google.com/apikey
 */

const CONFIG = {
    // Gemini API Key - Replace with your actual key
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
