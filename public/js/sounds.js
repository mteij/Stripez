// public/js/sounds.js - Sound effects for the application

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.initialized = false;
    }

    // Initialize the audio context on first user interaction
    init() {
        if (this.initialized) return;
        
        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            this.initialized = true;
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }

    // Create a rattle sound for the spinning wheel
    createWheelRattle(intensity = 1.0) {
        if (!this.audioContext) return null;

        const duration = 0.15; // Slightly longer rattle sound
        const sampleRate = this.audioContext.sampleRate;
        const numSamples = duration * sampleRate;
        
        const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        const channel = buffer.getChannelData(0);
        
        // Generate rattle noise with multiple frequency components
        for (let i = 0; i < numSamples; i++) {
            let sample = 0;
            const t = i / numSamples;
            
            // Add multiple sine waves at different frequencies for a rattle effect
            // Vary frequencies slightly for more natural sound
            const freq1 = 800 + Math.sin(t * Math.PI * 4) * 100;
            const freq2 = 1200 + Math.sin(t * Math.PI * 6) * 150;
            const freq3 = 1600 + Math.sin(t * Math.PI * 8) * 200;
            
            sample += Math.sin(2 * Math.PI * freq1 * i / sampleRate) * 0.1 * intensity;
            sample += Math.sin(2 * Math.PI * freq2 * i / sampleRate) * 0.08 * intensity;
            sample += Math.sin(2 * Math.PI * freq3 * i / sampleRate) * 0.06 * intensity;
            
            // Add some noise with intensity variation
            sample += (Math.random() - 0.5) * 0.2 * intensity;
            
            // Apply envelope to make it sound more natural
            const envelope = Math.exp(-2 * i / numSamples);
            channel[i] = sample * envelope;
        }
        
        return buffer;
    }

    // Play the wheel rattle sound
    playWheelRattle(intensity = 1.0) {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        // Create a new rattle sound with the specified intensity
        const rattleBuffer = this.createWheelRattle(intensity);
        if (!rattleBuffer) return;

        // Create a source and play the sound
        const source = this.audioContext.createBufferSource();
        source.buffer = rattleBuffer;
        
        // Create a gain node to control volume
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0.3 * intensity; // Volume based on intensity
        
        // Connect nodes and play
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start();
    }

    // Play a tick sound for each rotation step
    playWheelTick(intensity = 0.5) {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const duration = 0.05; // Shorter, softer tick
        const sampleRate = this.audioContext.sampleRate;
        const numSamples = duration * sampleRate;
        
        const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        const channel = buffer.getChannelData(0);
        
        // Generate a softer, more subtle tick sound without harsh frequencies
        for (let i = 0; i < numSamples; i++) {
            const t = i / numSamples;
            let sample = 0;
            
            // Use lower frequencies to avoid laser-like sounds
            // Main tick tone - lower frequency, less harsh
            sample += Math.sin(2 * Math.PI * 800 * t) * Math.exp(-15 * t) * intensity * 0.6;
            
            // Subtle harmonic - much lower frequency
            sample += Math.sin(2 * Math.PI * 400 * t) * Math.exp(-12 * t) * intensity * 0.3;
            
            // Very gentle click at the beginning - reduced intensity
            if (i < sampleRate * 0.001) { // First 1ms only
                sample += (Math.random() - 0.5) * 0.2 * intensity;
            }
            
            channel[i] = sample;
        }
        
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0.15 * intensity; // Quieter volume
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start();
    }
}

// Create a global sound manager instance
const soundManager = new SoundManager();

export { soundManager };