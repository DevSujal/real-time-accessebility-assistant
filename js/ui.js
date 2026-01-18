/**
 * VisionAssist - UI Module
 * UI state management and accessibility features
 */

class UIManager {
    constructor() {
        // Cached elements
        this.elements = {};

        // State
        this.currentMode = 'explore';
        this.isProcessing = false;
        this.lastDescription = '';

        // Toast queue
        this.toastQueue = [];
        this.toastTimeout = null;
    }

    /**
     * Initialize UI
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadPreferences();
        this.updateModeUI();

        console.log('[UI] Module initialized');
    }

    cacheElements() {
        // Header
        this.elements.settingsBtn = document.getElementById('settings-btn');

        // Camera
        this.elements.cameraFeed = document.getElementById('camera-feed');
        this.elements.captureCanvas = document.getElementById('capture-canvas');
        this.elements.statusIndicator = document.getElementById('status-indicator');
        this.elements.statusText = this.elements.statusIndicator?.querySelector('.status-text');

        // Description
        this.elements.descriptionContent = document.getElementById('description-content');
        this.elements.repeatBtn = document.getElementById('repeat-btn');

        // Actions
        this.elements.modeExplore = document.getElementById('mode-explore');
        this.elements.modeRead = document.getElementById('mode-read');
        this.elements.modeNavigate = document.getElementById('mode-navigate');
        this.elements.actionBtn = document.getElementById('action-btn');
        this.elements.voiceBtn = document.getElementById('voice-btn');
        this.elements.cameraSwitchBtn = document.getElementById('camera-switch-btn');
        this.elements.pauseBtn = document.getElementById('pause-btn');

        // Modals
        this.elements.settingsModal = document.getElementById('settings-modal');
        this.elements.onboardingModal = document.getElementById('onboarding-modal');
        this.elements.closeSettings = document.getElementById('close-settings');
        this.elements.saveSettings = document.getElementById('save-settings');

        // Settings inputs
        this.elements.speechRate = document.getElementById('speech-rate');
        this.elements.speechPitch = document.getElementById('speech-pitch');
        this.elements.voiceSelect = document.getElementById('voice-select');
        this.elements.autoDescribe = document.getElementById('auto-describe');
        this.elements.hapticFeedback = document.getElementById('haptic-feedback');
        this.elements.highContrast = document.getElementById('high-contrast');

        // Onboarding
        this.elements.onboardingNext = document.getElementById('onboarding-next');

        // Toast
        this.elements.toastContainer = document.getElementById('toast-container');
    }

    bindEvents() {
        // Mode tabs
        this.elements.modeExplore?.addEventListener('click', () => this.setMode('explore'));
        this.elements.modeRead?.addEventListener('click', () => this.setMode('read'));
        this.elements.modeNavigate?.addEventListener('click', () => this.setMode('navigate'));

        // Repeat button
        this.elements.repeatBtn?.addEventListener('click', () => this.repeatLastDescription());

        // Settings
        this.elements.settingsBtn?.addEventListener('click', () => this.openSettings());
        this.elements.closeSettings?.addEventListener('click', () => this.closeSettings());
        this.elements.saveSettings?.addEventListener('click', () => this.saveSettings());
        this.elements.settingsModal?.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeSettings());

        // Speech rate/pitch display
        this.elements.speechRate?.addEventListener('input', (e) => {
            document.getElementById('speech-rate-value').textContent = `${e.target.value}x`;
        });
        this.elements.speechPitch?.addEventListener('input', (e) => {
            document.getElementById('speech-pitch-value').textContent = `${e.target.value}x`;
        });

        // High contrast toggle
        this.elements.highContrast?.addEventListener('change', (e) => {
            document.body.classList.toggle('high-contrast', e.target.checked);
        });

        // Voice events
        window.addEventListener('voiceStart', () => {
            this.elements.voiceBtn?.classList.add('listening');
        });
        window.addEventListener('voiceEnd', () => {
            this.elements.voiceBtn?.classList.remove('listening');
        });

        // Speech events
        window.addEventListener('speechStart', () => {
            this.elements.pauseBtn?.classList.add('active');
        });
        window.addEventListener('speechEnd', () => {
            this.elements.pauseBtn?.classList.remove('active');
        });

        // Load voices for selector
        window.addEventListener('voicesLoaded', (e) => {
            this.populateVoiceSelector(e.detail.voices);
        });

        // Onboarding navigation
        this.elements.onboardingNext?.addEventListener('click', () => this.nextOnboardingSlide());
        this.elements.onboardingModal?.querySelectorAll('.dot').forEach(dot => {
            dot.addEventListener('click', (e) => {
                this.goToOnboardingSlide(parseInt(e.target.dataset.slide));
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    loadPreferences() {
        try {
            const prefs = JSON.parse(localStorage.getItem('visionassist_prefs') || '{}');

            if (prefs.highContrast) {
                document.body.classList.add('high-contrast');
                if (this.elements.highContrast) {
                    this.elements.highContrast.checked = true;
                }
            }

            if (prefs.autoDescribe && this.elements.autoDescribe) {
                this.elements.autoDescribe.checked = true;
            }

            if (prefs.hapticFeedback !== false && this.elements.hapticFeedback) {
                this.elements.hapticFeedback.checked = true;
            }
        } catch (e) {
            console.warn('[UI] Failed to load preferences:', e);
        }
    }

    /**
     * Set current mode
     */
    setMode(mode) {
        this.currentMode = mode;
        this.updateModeUI();

        // Haptic feedback
        this.haptic();

        // Announce mode change
        const modeNames = {
            explore: 'Explore mode. Describe your surroundings.',
            read: 'Read mode. Read text aloud.',
            navigate: 'Navigate mode. Get navigation guidance.'
        };

        window.speechManager?.speak(modeNames[mode], 1);

        window.dispatchEvent(new CustomEvent('modeChange', { detail: { mode } }));
    }

    updateModeUI() {
        // Update tab states
        [this.elements.modeExplore, this.elements.modeRead, this.elements.modeNavigate].forEach(tab => {
            if (tab) {
                const isActive = tab.id === `mode-${this.currentMode}`;
                tab.classList.toggle('active', isActive);
                tab.setAttribute('aria-selected', isActive);
            }
        });

        // Update action button
        const labels = {
            explore: 'Describe',
            read: 'Read',
            navigate: 'Navigate'
        };

        const actionLabel = this.elements.actionBtn?.querySelector('span');
        if (actionLabel) {
            actionLabel.textContent = labels[this.currentMode];
        }

        this.elements.actionBtn?.setAttribute('aria-label', `${labels[this.currentMode]} what's in front of me`);
    }

    /**
     * Update status indicator
     */
    setStatus(status, text) {
        if (!this.elements.statusIndicator) return;

        this.elements.statusIndicator.className = `status-indicator ${status}`;
        if (this.elements.statusText) {
            this.elements.statusText.textContent = text;
        }
    }

    /**
     * Set processing state
     */
    setProcessing(processing) {
        this.isProcessing = processing;
        this.elements.actionBtn?.classList.toggle('processing', processing);

        if (processing) {
            this.setStatus('processing', 'Analyzing...');
        }
    }

    /**
     * Update description panel
     */
    setDescription(text, isError = false) {
        if (!this.elements.descriptionContent) return;

        this.lastDescription = text;

        // Create new paragraph with animation
        const p = document.createElement('p');
        p.textContent = text;
        if (isError) {
            p.style.color = 'var(--color-error)';
        }

        // Clear placeholder and add new content
        this.elements.descriptionContent.innerHTML = '';
        this.elements.descriptionContent.appendChild(p);

        // Scroll to bottom if needed
        this.elements.descriptionContent.scrollTop = this.elements.descriptionContent.scrollHeight;
    }

    /**
     * Repeat last description
     */
    repeatLastDescription() {
        if (this.lastDescription) {
            window.speechManager?.speak(this.lastDescription, 1, true);
            this.haptic();
        }
    }

    /**
     * Open settings modal
     */
    openSettings() {
        if (!this.elements.settingsModal) return;

        if (window.speechManager) {
            const settings = window.speechManager.settings;
            if (this.elements.speechRate) {
                this.elements.speechRate.value = settings.rate;
                document.getElementById('speech-rate-value').textContent = `${settings.rate}x`;
            }
            if (this.elements.speechPitch) {
                this.elements.speechPitch.value = settings.pitch;
                document.getElementById('speech-pitch-value').textContent = `${settings.pitch}x`;
            }

            // Populate voices dropdown
            const voices = window.speechManager.getVoices();
            if (voices && voices.length > 0) {
                this.populateVoiceSelector(voices);
            }
        }

        this.elements.settingsModal.hidden = false;
        this.elements.settingsModal.querySelector('.modal-content')?.focus();

        // Trap focus
        this.trapFocus(this.elements.settingsModal);
    }

    /**
     * Close settings modal
     */
    closeSettings() {
        if (this.elements.settingsModal) {
            this.elements.settingsModal.hidden = true;
        }
    }

    /**
     * Save settings
     */
    saveSettings() {
        // Save speech settings
        if (window.speechManager) {
            const settings = {
                rate: parseFloat(this.elements.speechRate?.value || 1),
                pitch: parseFloat(this.elements.speechPitch?.value || 1),
                voiceURI: this.elements.voiceSelect?.value || null
            };
            window.speechManager.updateSettings(settings);
        }

        // Save preferences
        const prefs = {
            autoDescribe: this.elements.autoDescribe?.checked || false,
            hapticFeedback: this.elements.hapticFeedback?.checked !== false,
            highContrast: this.elements.highContrast?.checked || false
        };
        localStorage.setItem('visionassist_prefs', JSON.stringify(prefs));

        this.closeSettings();
        this.toast('Settings saved', 'success');
    }

    /**
     * Toggle API key visibility
     */
    toggleApiKeyVisibility() {
        if (!this.elements.apiKeyInput) return;

        const isPassword = this.elements.apiKeyInput.type === 'password';
        this.elements.apiKeyInput.type = isPassword ? 'text' : 'password';
        this.elements.toggleKeyBtn?.setAttribute('aria-label', isPassword ? 'Hide API key' : 'Show API key');
    }

    /**
     * Populate voice selector
     */
    populateVoiceSelector(voices) {
        if (!this.elements.voiceSelect) return;

        this.elements.voiceSelect.innerHTML = '';

        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.voiceURI;
            option.textContent = `${voice.name} (${voice.lang})`;
            this.elements.voiceSelect.appendChild(option);
        });

        // Select current voice
        if (window.speechManager?.settings.voiceURI) {
            this.elements.voiceSelect.value = window.speechManager.settings.voiceURI;
        }
    }

    /**
     * Onboarding
     */
    showOnboarding() {
        if (this.elements.onboardingModal) {
            this.elements.onboardingModal.hidden = false;
        }
    }

    hideOnboarding() {
        if (this.elements.onboardingModal) {
            this.elements.onboardingModal.hidden = true;
            localStorage.setItem('visionassist_onboarded', 'true');
        }
    }

    nextOnboardingSlide() {
        const slides = this.elements.onboardingModal?.querySelectorAll('.slide');
        const dots = this.elements.onboardingModal?.querySelectorAll('.dot');
        if (!slides || !dots) return;

        const currentIndex = Array.from(slides).findIndex(s => s.classList.contains('active'));
        const nextIndex = currentIndex + 1;

        if (nextIndex >= slides.length) {
            this.hideOnboarding();
            return;
        }

        this.goToOnboardingSlide(nextIndex);
    }

    goToOnboardingSlide(index) {
        const slides = this.elements.onboardingModal?.querySelectorAll('.slide');
        const dots = this.elements.onboardingModal?.querySelectorAll('.dot');
        if (!slides || !dots) return;

        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
            dot.setAttribute('aria-selected', i === index);
        });

        // Update button text
        if (this.elements.onboardingNext) {
            this.elements.onboardingNext.textContent = index === slides.length - 1 ? 'Get Started' : 'Next';
        }
    }

    /**
     * Toast notification
     */
    toast(message, type = 'default') {
        if (!this.elements.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');

        this.elements.toastContainer.appendChild(toast);

        // Remove after delay
        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Haptic feedback
     */
    haptic(pattern = 50) {
        try {
            const prefs = JSON.parse(localStorage.getItem('visionassist_prefs') || '{}');
            if (prefs.hapticFeedback !== false && navigator.vibrate) {
                navigator.vibrate(pattern);
            }
        } catch (e) {
            // Ignore
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(e) {
        // Escape to close modals
        if (e.key === 'Escape') {
            this.closeSettings();
            return;
        }

        // Don't handle if in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Space to trigger action
        if (e.key === ' ' || e.key === 'Enter') {
            if (e.target === this.elements.actionBtn) return; // Natural click
            e.preventDefault();
            this.elements.actionBtn?.click();
        }

        // Number keys for modes
        if (e.key === '1') this.setMode('explore');
        if (e.key === '2') this.setMode('read');
        if (e.key === '3') this.setMode('navigate');

        // R to repeat
        if (e.key === 'r' || e.key === 'R') {
            this.repeatLastDescription();
        }
    }

    /**
     * Trap focus in modal
     */
    trapFocus(modal) {
        const focusable = modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });

        first.focus();
    }

    /**
     * Check if auto-describe is enabled
     */
    isAutoDescribeEnabled() {
        return this.elements.autoDescribe?.checked || false;
    }

    /**
     * Get current mode
     */
    getMode() {
        return this.currentMode;
    }
}

// Export singleton instance
window.uiManager = new UIManager();
