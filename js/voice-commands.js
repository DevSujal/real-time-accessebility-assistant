/**
 * VisionAssist - Voice Commands Module
 * Speech recognition for hands-free control
 */

class VoiceCommandManager {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.isSupported = false;
        this.continuous = false;

        // Command patterns
        this.commands = new Map();

        // Initialize recognition
        this.init();
    }

    init() {
        // Check for support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('[VoiceCommand] Speech recognition not supported');
            this.isSupported = false;
            return;
        }

        this.isSupported = true;
        this.recognition = new SpeechRecognition();

        // Configuration
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 3;
        this.recognition.lang = 'en-US';

        // Event handlers
        this.recognition.onstart = () => {
            this.isListening = true;
            console.log('[VoiceCommand] Listening...');
            window.dispatchEvent(new Event('voiceStart'));
        };

        this.recognition.onend = () => {
            this.isListening = false;
            console.log('[VoiceCommand] Stopped listening');
            window.dispatchEvent(new Event('voiceEnd'));

            // Restart if continuous mode
            if (this.continuous && this.isSupported) {
                setTimeout(() => this.start(), 100);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('[VoiceCommand] Error:', event.error);
            this.isListening = false;

            // Don't dispatch error for 'no-speech' or 'aborted'
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                window.dispatchEvent(new CustomEvent('voiceError', {
                    detail: { error: event.error }
                }));
            }
        };

        this.recognition.onresult = (event) => {
            this.handleResult(event);
        };

        // Register default commands
        this.registerDefaultCommands();

        console.log('[VoiceCommand] Module initialized');
    }

    registerDefaultCommands() {
        // Describe scene
        this.register(['describe', 'describe this', 'what do you see', 'what is in front of me', 'what\'s ahead', 'look'], 'describe');

        // Read text
        this.register(['read', 'read this', 'read text', 'what does it say', 'read aloud'], 'read');

        // Navigate
        this.register(['navigate', 'navigation', 'where can i go', 'path', 'help me navigate'], 'navigate');

        // Identify object
        this.register(['identify', 'what is this', 'what\'s this', 'identify this', 'tell me about this'], 'identify');

        // Repeat last
        this.register(['repeat', 'say again', 'repeat that', 'again'], 'repeat');

        // Stop speech
        this.register(['stop', 'quiet', 'silence', 'shut up', 'be quiet', 'pause'], 'stop');

        // Help
        this.register(['help', 'what can you do', 'commands', 'options'], 'help');

        // Switch camera
        this.register(['switch camera', 'flip camera', 'front camera', 'back camera', 'selfie'], 'switchCamera');
    }

    /**
     * Register a voice command
     * @param {string[]} phrases - Trigger phrases
     * @param {string} action - Action identifier
     */
    register(phrases, action) {
        phrases.forEach(phrase => {
            this.commands.set(phrase.toLowerCase(), action);
        });
    }

    /**
     * Handle recognition result
     */
    handleResult(event) {
        const results = event.results[event.results.length - 1];

        // Check all alternatives
        for (let i = 0; i < results.length; i++) {
            const transcript = results[i].transcript.toLowerCase().trim();
            const confidence = results[i].confidence;

            console.log(`[VoiceCommand] Heard: "${transcript}" (${Math.round(confidence * 100)}%)`);

            // Check for exact match
            if (this.commands.has(transcript)) {
                const action = this.commands.get(transcript);
                this.executeCommand(action, transcript, confidence);
                return;
            }

            // Check for partial match
            for (const [phrase, action] of this.commands) {
                if (transcript.includes(phrase) || phrase.includes(transcript)) {
                    this.executeCommand(action, transcript, confidence);
                    return;
                }
            }
        }

        // No command matched - could be a question
        const transcript = results[0].transcript.trim();
        if (transcript.length > 0) {
            window.dispatchEvent(new CustomEvent('voiceQuestion', {
                detail: { question: transcript }
            }));
        }
    }

    /**
     * Execute recognized command
     */
    executeCommand(action, transcript, confidence) {
        console.log(`[VoiceCommand] Executing: ${action}`);

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        window.dispatchEvent(new CustomEvent('voiceCommand', {
            detail: { action, transcript, confidence }
        }));
    }

    /**
     * Start listening
     */
    start() {
        if (!this.isSupported) {
            console.warn('[VoiceCommand] Not supported');
            return false;
        }

        if (this.isListening) {
            return true;
        }

        try {
            this.recognition.start();
            return true;
        } catch (e) {
            console.error('[VoiceCommand] Failed to start:', e);
            return false;
        }
    }

    /**
     * Stop listening
     */
    stop() {
        if (!this.isSupported || !this.isListening) {
            return;
        }

        this.continuous = false;
        try {
            this.recognition.stop();
        } catch (e) {
            console.warn('[VoiceCommand] Stop error:', e);
        }
    }

    /**
     * Start continuous listening mode
     */
    startContinuous() {
        this.continuous = true;
        this.start();
    }

    /**
     * Stop continuous listening
     */
    stopContinuous() {
        this.continuous = false;
        this.stop();
    }

    /**
     * Toggle listening
     */
    toggle() {
        if (this.isListening) {
            this.stop();
        } else {
            this.start();
        }
        return this.isListening;
    }

    /**
     * Check if available
     */
    checkSupport() {
        return this.isSupported;
    }

    /**
     * Get available commands (for help)
     */
    getCommands() {
        const actions = new Map();

        for (const [phrase, action] of this.commands) {
            if (!actions.has(action)) {
                actions.set(action, []);
            }
            actions.get(action).push(phrase);
        }

        return Object.fromEntries(actions);
    }
}

// Export singleton instance
window.voiceCommandManager = new VoiceCommandManager();
