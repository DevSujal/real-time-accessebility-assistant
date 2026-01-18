/**
 * VisionAssist - Main Application
 * Coordinates all modules and handles core functionality
 */

class VisionAssistApp {
    constructor() {
        this.isInitialized = false;
        this.isReady = false;
        this.autoDescribeInterval = null;
        this.lastCaptureTime = 0;
        this.minCaptureInterval = 2000; // Minimum ms between captures

        // Module references
        this.speech = window.speechManager;
        this.camera = window.cameraManager;
        this.gemini = window.geminiManager;
        this.voice = window.voiceCommandManager;
        this.ui = window.uiManager;
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('[App] Initializing VisionAssist...');

        try {
            // Initialize UI first
            this.ui.init();

            // Register service worker
            this.registerServiceWorker();

            // Initialize camera
            await this.initCamera();

            // Bind events
            this.bindEvents();

            // Check for first run
            this.checkFirstRun();

            this.isInitialized = true;
            this.isReady = true;

            this.ui.setStatus('ready', 'Ready');

            // Welcome message
            if (this.gemini.hasApiKey()) {
                this.speech.speak('VisionAssist ready. Tap the describe button or say a command.', 2);
            }

            console.log('[App] Initialization complete');

        } catch (error) {
            console.error('[App] Initialization failed:', error);
            this.ui.setStatus('error', 'Setup failed');
            this.ui.toast(error.message, 'error');
        }
    }

    /**
     * Register service worker for PWA
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('[App] Service Worker registered:', registration.scope);
            } catch (error) {
                console.warn('[App] Service Worker registration failed:', error);
            }
        }
    }

    /**
     * Initialize camera
     */
    async initCamera() {
        const videoEl = document.getElementById('camera-feed');
        const canvasEl = document.getElementById('capture-canvas');

        if (!videoEl || !canvasEl) {
            throw new Error('Camera elements not found');
        }

        try {
            await this.camera.init(videoEl, canvasEl);
            this.ui.setStatus('ready', 'Camera active');
        } catch (error) {
            console.error('[App] Camera init failed:', error);
            this.ui.setStatus('error', 'No camera');
            this.speech.speak('Camera access required. Please enable camera permissions.', 0, true);
            throw error;
        }
    }

    /**
     * Check for first run and show onboarding
     */
    checkFirstRun() {
        const hasOnboarded = localStorage.getItem('visionassist_onboarded');

        if (!hasOnboarded) {
            this.ui.showOnboarding();
        }
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // Main action button
        const actionBtn = document.getElementById('action-btn');
        actionBtn?.addEventListener('click', () => this.handleAction());

        // Voice button
        const voiceBtn = document.getElementById('voice-btn');
        voiceBtn?.addEventListener('mousedown', () => this.voice.start());
        voiceBtn?.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.voice.start();
        });
        voiceBtn?.addEventListener('mouseup', () => this.voice.stop());
        voiceBtn?.addEventListener('touchend', () => this.voice.stop());

        // Camera switch
        const cameraSwitchBtn = document.getElementById('camera-switch-btn');
        cameraSwitchBtn?.addEventListener('click', () => this.switchCamera());

        // Pause button
        const pauseBtn = document.getElementById('pause-btn');
        pauseBtn?.addEventListener('click', () => this.togglePause());

        // Voice commands
        window.addEventListener('voiceCommand', (e) => this.handleVoiceCommand(e.detail));

        // Voice questions
        window.addEventListener('voiceQuestion', (e) => this.handleVoiceQuestion(e.detail));

        // Mode change
        window.addEventListener('modeChange', () => {
            // Reset auto-describe when mode changes
            this.stopAutoDescribe();
        });

        // Handle visibility change (app backgrounded)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAutoDescribe();
                this.speech.stop();
            }
        });

        // Handle URL parameters (from shortcuts)
        this.handleUrlParams();
    }

    /**
     * Handle URL parameters (e.g., from PWA shortcuts)
     */
    handleUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');

        if (action) {
            // Delay to allow initialization
            setTimeout(() => {
                if (action === 'describe') {
                    this.ui.setMode('explore');
                    this.handleAction();
                } else if (action === 'read') {
                    this.ui.setMode('read');
                    this.handleAction();
                }
            }, 1500);
        }
    }

    /**
     * Handle main action button
     */
    async handleAction() {
        if (this.ui.isProcessing) {
            return; // Prevent double-tap
        }

        // Rate limiting
        const now = Date.now();
        if (now - this.lastCaptureTime < this.minCaptureInterval) {
            this.ui.toast('Please wait a moment', 'default');
            return;
        }
        this.lastCaptureTime = now;

        // Check API key
        if (!this.gemini.hasApiKey()) {
            this.ui.toast('API key not configured in config.js', 'error');
            this.speech.speak('API key not configured. Please update the config file.', 1, true);
            return;
        }

        // Haptic feedback
        this.ui.haptic();

        // Set processing state
        this.ui.setProcessing(true);
        this.speech.speak('Analyzing...', 2);

        try {
            // Capture frame
            const base64Image = this.camera.captureFrame();

            // Get mode
            const mode = this.ui.getMode();

            // Analyze with Gemini
            const description = await this.gemini.analyzeImage(base64Image, mode);

            // Update UI
            this.ui.setDescription(description);
            this.ui.setStatus('ready', 'Ready');

            // Speak result
            await this.speech.speak(description, 1, true);

            console.log('[App] Analysis complete');

        } catch (error) {
            console.error('[App] Action failed:', error);
            this.ui.setDescription(error.message, true);
            this.ui.setStatus('error', 'Error');
            this.speech.speak(error.message, 0, true);
            this.ui.toast(error.message, 'error');
        } finally {
            this.ui.setProcessing(false);
        }
    }

    /**
     * Handle voice commands
     */
    handleVoiceCommand({ action, transcript }) {
        console.log('[App] Voice command:', action);

        switch (action) {
            case 'describe':
                this.ui.setMode('explore');
                this.handleAction();
                break;

            case 'read':
                this.ui.setMode('read');
                this.handleAction();
                break;

            case 'navigate':
                this.ui.setMode('navigate');
                this.handleAction();
                break;

            case 'identify':
                this.handleIdentify();
                break;

            case 'repeat':
                this.ui.repeatLastDescription();
                break;

            case 'stop':
                this.speech.stop();
                break;

            case 'help':
                this.speakHelp();
                break;

            case 'switchCamera':
                this.switchCamera();
                break;

            default:
                this.speech.speak('Command not recognized. Say help for available commands.', 2);
        }
    }

    /**
     * Handle voice questions about the scene
     */
    async handleVoiceQuestion({ question }) {
        if (!this.gemini.hasApiKey()) {
            this.speech.speak('API key not configured.', 1);
            return;
        }

        this.ui.setProcessing(true);
        this.speech.speak('Let me check...', 2);

        try {
            const base64Image = this.camera.captureFrame();
            const answer = await this.gemini.askAboutImage(base64Image, question);

            this.ui.setDescription(answer);
            await this.speech.speak(answer, 1, true);

        } catch (error) {
            this.speech.speak(error.message, 0, true);
        } finally {
            this.ui.setProcessing(false);
        }
    }

    /**
     * Handle identify command
     */
    async handleIdentify() {
        if (!this.gemini.hasApiKey()) {
            this.speech.speak('API key not configured.', 1);
            return;
        }

        this.ui.setProcessing(true);
        this.speech.speak('Identifying...', 2);

        try {
            const base64Image = this.camera.captureFrame();
            const description = await this.gemini.analyzeImage(base64Image, 'identify');

            this.ui.setDescription(description);
            await this.speech.speak(description, 1, true);

        } catch (error) {
            this.speech.speak(error.message, 0, true);
        } finally {
            this.ui.setProcessing(false);
        }
    }

    /**
     * Switch camera
     */
    async switchCamera() {
        this.ui.haptic();

        try {
            const facingMode = await this.camera.switchCamera();
            const message = facingMode === 'user' ? 'Front camera' : 'Back camera';
            this.speech.speak(message, 2);
            this.ui.toast(message, 'success');
        } catch (error) {
            this.speech.speak('Failed to switch camera', 1);
        }
    }

    /**
     * Toggle pause
     */
    togglePause() {
        const isPaused = this.speech.toggle();
        this.ui.haptic();

        const pauseBtn = document.getElementById('pause-btn');
        pauseBtn?.setAttribute('aria-label', isPaused ? 'Resume speech' : 'Pause speech');
    }

    /**
     * Start auto-describe mode
     */
    startAutoDescribe() {
        if (this.autoDescribeInterval) return;

        this.speech.speak('Auto-describe enabled. Will describe every 5 seconds.', 2);

        this.autoDescribeInterval = setInterval(() => {
            if (!document.hidden && this.isReady && !this.ui.isProcessing) {
                this.handleAction();
            }
        }, 5000);
    }

    /**
     * Stop auto-describe mode
     */
    stopAutoDescribe() {
        if (this.autoDescribeInterval) {
            clearInterval(this.autoDescribeInterval);
            this.autoDescribeInterval = null;
        }
    }

    /**
     * Speak help message
     */
    speakHelp() {
        const helpMessage = `
            Available commands:
            Say "describe" to describe your surroundings.
            Say "read" to read any visible text.
            Say "navigate" for navigation guidance.
            Say "identify" to identify an object.
            Say "repeat" to hear the last description again.
            Say "stop" to stop speaking.
            You can also ask questions about what you see.
        `;

        this.speech.speak(helpMessage, 2, true);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new VisionAssistApp();
    window.app.init();
});
