/**
 * VisionAssist - Camera Module
 * Camera access, video stream, and frame capture
 */

class CameraManager {
    constructor() {
        this.videoElement = null;
        this.canvasElement = null;
        this.stream = null;
        this.isActive = false;
        this.facingMode = 'environment'; // 'environment' (back) or 'user' (front)

        // Frame capture settings
        this.captureWidth = 640;
        this.captureHeight = 480;
        this.captureQuality = 0.8; // JPEG quality

        // Constraints
        this.constraints = {
            video: {
                facingMode: this.facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            },
            audio: false
        };

        console.log('[Camera] Module initialized');
    }

    /**
     * Initialize camera with DOM elements
     * @param {HTMLVideoElement} videoEl - Video element for preview
     * @param {HTMLCanvasElement} canvasEl - Canvas for frame capture
     */
    async init(videoEl, canvasEl) {
        this.videoElement = videoEl;
        this.canvasElement = canvasEl;

        // Check for camera support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera not supported on this device');
        }

        return this.start();
    }

    /**
     * Start camera stream
     */
    async start() {
        try {
            // Update facing mode in constraints
            this.constraints.video.facingMode = this.facingMode;

            // Get camera stream
            this.stream = await navigator.mediaDevices.getUserMedia(this.constraints);

            // Connect to video element
            if (this.videoElement) {
                this.videoElement.srcObject = this.stream;

                // Wait for video to be ready
                await new Promise((resolve, reject) => {
                    this.videoElement.onloadedmetadata = () => {
                        this.videoElement.play()
                            .then(resolve)
                            .catch(reject);
                    };
                    this.videoElement.onerror = reject;
                });
            }

            this.isActive = true;
            console.log('[Camera] Stream started');

            window.dispatchEvent(new CustomEvent('cameraStart', {
                detail: { facingMode: this.facingMode }
            }));

            return true;

        } catch (error) {
            console.error('[Camera] Failed to start:', error);
            this.isActive = false;

            // Provide user-friendly error messages
            let message = 'Unable to access camera';

            if (error.name === 'NotAllowedError') {
                message = 'Camera access denied. Please enable camera permissions in your browser settings.';
            } else if (error.name === 'NotFoundError') {
                message = 'No camera found on this device.';
            } else if (error.name === 'NotReadableError') {
                message = 'Camera is in use by another application.';
            } else if (error.name === 'OverconstrainedError') {
                // Try again with basic constraints
                console.log('[Camera] Retrying with basic constraints');
                return this.startBasic();
            }

            throw new Error(message);
        }
    }

    /**
     * Start with basic constraints (fallback)
     */
    async startBasic() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });

            if (this.videoElement) {
                this.videoElement.srcObject = this.stream;
                await this.videoElement.play();
            }

            this.isActive = true;
            console.log('[Camera] Stream started (basic mode)');

            return true;

        } catch (error) {
            console.error('[Camera] Basic mode failed:', error);
            throw new Error('Unable to access camera');
        }
    }

    /**
     * Stop camera stream
     */
    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }

        this.isActive = false;
        console.log('[Camera] Stream stopped');

        window.dispatchEvent(new Event('cameraStop'));
    }

    /**
     * Switch between front and back camera
     */
    async switchCamera() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';

        if (this.isActive) {
            this.stop();
            await this.start();
        }

        return this.facingMode;
    }

    /**
     * Capture current frame as base64 JPEG
     * @returns {string} Base64 encoded image data
     */
    captureFrame() {
        if (!this.isActive || !this.videoElement || !this.canvasElement) {
            throw new Error('Camera not active');
        }

        const ctx = this.canvasElement.getContext('2d');

        // Calculate dimensions maintaining aspect ratio
        const videoWidth = this.videoElement.videoWidth;
        const videoHeight = this.videoElement.videoHeight;

        if (videoWidth === 0 || videoHeight === 0) {
            throw new Error('Video not ready');
        }

        // Scale down for efficiency
        const scale = Math.min(
            this.captureWidth / videoWidth,
            this.captureHeight / videoHeight,
            1 // Don't upscale
        );

        const width = Math.round(videoWidth * scale);
        const height = Math.round(videoHeight * scale);

        // Set canvas size
        this.canvasElement.width = width;
        this.canvasElement.height = height;

        // Draw frame to canvas
        ctx.drawImage(this.videoElement, 0, 0, width, height);

        // Convert to base64
        const dataUrl = this.canvasElement.toDataURL('image/jpeg', this.captureQuality);

        // Remove data URL prefix for Gemini API
        const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

        console.log('[Camera] Frame captured:', width, 'x', height);

        return base64;
    }

    /**
     * Capture frame as Blob
     * @returns {Promise<Blob>} Image blob
     */
    async captureBlob() {
        if (!this.isActive || !this.canvasElement) {
            throw new Error('Camera not active');
        }

        this.captureFrame(); // This sets up the canvas

        return new Promise((resolve, reject) => {
            this.canvasElement.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                },
                'image/jpeg',
                this.captureQuality
            );
        });
    }

    /**
     * Check if camera is available
     */
    static async isAvailable() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return false;
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(device => device.kind === 'videoinput');
        } catch (e) {
            return false;
        }
    }

    /**
     * Get available cameras
     */
    static async getCameras() {
        if (!navigator.mediaDevices) {
            return [];
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
        } catch (e) {
            return [];
        }
    }

    /**
     * Check permission status
     */
    static async checkPermission() {
        try {
            const result = await navigator.permissions.query({ name: 'camera' });
            return result.state; // 'granted', 'denied', or 'prompt'
        } catch (e) {
            // Permissions API not supported
            return 'prompt';
        }
    }
}

// Export singleton instance
window.cameraManager = new CameraManager();
