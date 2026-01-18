/**
 * VisionAssist - Speech Module
 * Text-to-Speech with priority queue and voice customization
 */

class SpeechManager {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voices = [];
        this.queue = [];
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentUtterance = null;

        // Settings
        this.settings = {
            rate: 1,
            pitch: 1,
            volume: 1,
            voiceURI: null
        };

        // Priority levels
        this.PRIORITY = {
            URGENT: 0,    // Obstacles, warnings
            HIGH: 1,      // User-triggered descriptions
            NORMAL: 2,    // Auto descriptions
            LOW: 3        // Background info
        };

        this.init();
    }

    init() {
        // Load voices - try multiple times because onvoiceschanged is unreliable
        this.loadVoices();

        // Also try on event
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => this.loadVoices();
        }

        // Fallback: retry loading voices multiple times
        setTimeout(() => this.loadVoices(), 100);
        setTimeout(() => this.loadVoices(), 500);
        setTimeout(() => this.loadVoices(), 1000);
        setTimeout(() => this.loadVoices(), 2000);

        // Load saved settings
        this.loadSettings();

        console.log('[Speech] Module initialized');
    }

    loadVoices() {
        const newVoices = this.synth.getVoices();

        // Only update if we got voices
        if (newVoices.length === 0) {
            return;
        }

        // Check if already loaded the same voices
        if (this.voices.length === newVoices.length) {
            return;
        }

        this.voices = newVoices;

        // Prefer English voices
        this.voices.sort((a, b) => {
            const aEn = a.lang.startsWith('en');
            const bEn = b.lang.startsWith('en');
            if (aEn && !bEn) return -1;
            if (!aEn && bEn) return 1;
            return a.name.localeCompare(b.name);
        });

        console.log('[Speech] Loaded', this.voices.length, 'voices');

        // Dispatch event for UI
        window.dispatchEvent(new CustomEvent('voicesLoaded', {
            detail: { voices: this.voices }
        }));
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('visionassist_speech');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.settings = { ...this.settings, ...parsed };
            }
        } catch (e) {
            console.warn('[Speech] Failed to load settings:', e);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('visionassist_speech', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('[Speech] Failed to save settings:', e);
        }
    }

    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        this.saveSettings();
    }

    getVoice() {
        if (this.settings.voiceURI) {
            const voice = this.voices.find(v => v.voiceURI === this.settings.voiceURI);
            if (voice) return voice;
        }

        // Default: prefer local English voice
        const defaultVoice = this.voices.find(v =>
            v.lang.startsWith('en') && v.localService
        ) || this.voices.find(v =>
            v.lang.startsWith('en')
        ) || this.voices[0];

        return defaultVoice;
    }

    /**
     * Speak text with priority queue
     * @param {string} text - Text to speak
     * @param {number} priority - Priority level (0=urgent, 3=low)
     * @param {boolean} interrupt - Interrupt current speech
     */
    speak(text, priority = this.PRIORITY.NORMAL, interrupt = false) {
        if (!this.synth) {
            console.error('[Speech] Speech synthesis not available');
            return Promise.reject(new Error('Speech synthesis not available'));
        }

        if (!text || !text.trim()) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const utterance = new SpeechSynthesisUtterance(text);

            // Apply settings
            utterance.rate = this.settings.rate;
            utterance.pitch = this.settings.pitch;
            utterance.volume = this.settings.volume;

            const voice = this.getVoice();
            if (voice) {
                utterance.voice = voice;
                utterance.lang = voice.lang;
            }

            // Event handlers
            utterance.onstart = () => {
                this.isSpeaking = true;
                this.currentUtterance = utterance;
                window.dispatchEvent(new CustomEvent('speechStart', { detail: { text } }));
            };

            utterance.onend = () => {
                this.isSpeaking = false;
                this.currentUtterance = null;
                window.dispatchEvent(new CustomEvent('speechEnd', { detail: { text } }));
                resolve();
                this.processQueue();
            };

            utterance.onerror = (event) => {
                console.error('[Speech] Error:', event.error);
                this.isSpeaking = false;
                this.currentUtterance = null;

                // Don't reject on 'canceled' - it's intentional
                if (event.error === 'canceled') {
                    resolve();
                } else {
                    reject(new Error(event.error));
                }
                this.processQueue();
            };

            // Add to queue or speak immediately
            if (interrupt && priority <= this.PRIORITY.HIGH) {
                this.stop();
                this.queue = this.queue.filter(item => item.priority < priority);
                this.queue.unshift({ utterance, priority, resolve, reject });
                this.processQueue();
            } else {
                // Insert in priority order
                const index = this.queue.findIndex(item => item.priority > priority);
                if (index === -1) {
                    this.queue.push({ utterance, priority, resolve, reject });
                } else {
                    this.queue.splice(index, 0, { utterance, priority, resolve, reject });
                }

                if (!this.isSpeaking && !this.isPaused) {
                    this.processQueue();
                }
            }
        });
    }

    processQueue() {
        if (this.isPaused || this.isSpeaking || this.queue.length === 0) {
            return;
        }

        const { utterance } = this.queue.shift();
        this.synth.speak(utterance);
    }

    /**
     * Stop current speech and clear queue
     */
    stop() {
        this.synth.cancel();
        this.queue = [];
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentUtterance = null;
    }

    /**
     * Pause speech
     */
    pause() {
        if (this.isSpeaking) {
            this.synth.pause();
            this.isPaused = true;
            window.dispatchEvent(new Event('speechPaused'));
        }
    }

    /**
     * Resume speech
     */
    resume() {
        if (this.isPaused) {
            this.synth.resume();
            this.isPaused = false;
            window.dispatchEvent(new Event('speechResumed'));
        }
    }

    /**
     * Toggle pause/resume
     */
    toggle() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
        return this.isPaused;
    }

    /**
     * Speak urgent message (interrupts everything)
     */
    urgent(text) {
        return this.speak(text, this.PRIORITY.URGENT, true);
    }

    /**
     * Check if speech is available
     */
    isAvailable() {
        return 'speechSynthesis' in window;
    }

    /**
     * Get available voices for UI
     */
    getVoices() {
        return this.voices;
    }
}

// Export singleton instance
window.speechManager = new SpeechManager();
