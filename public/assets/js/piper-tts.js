/**
 * Piper TTS Module for Webinar Platform
 * Handles text-to-speech synthesis using Piper TTS backend
 */

class PiperTTSService {
  constructor(apiBase) {
    this.apiBase = apiBase;
    this.audioQueue = [];
    this.isPlaying = false;
    this.currentAudio = null;
    this.onComplete = null;
    this.onError = null;
  }

  /**
   * Check if TTS service is available
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.apiBase}/tts/health`);
      const health = await response.json();
      return health.status === 'ok' || health.status === 'degraded';
    } catch (error) {
      console.error('TTS service health check failed:', error);
      return false;
    }
  }

  /**
   * Synthesize speech from text
   * @param {string} text - Text to synthesize
   * @param {string} quality - Quality level ('medium' or 'high', default: 'medium')
   * @returns {Promise<Blob>} Audio blob
   */
  async synthesize(text, quality = 'medium') {
    try {
      const response = await fetch(`${this.apiBase}/tts/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, quality })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'TTS synthesis failed');
      }

      return await response.blob();
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      throw error;
    }
  }

  /**
   * Play audio from blob
   * @param {Blob} audioBlob - Audio blob to play
   * @returns {Promise} Resolves when audio finishes playing
   */
  playAudio(audioBlob) {
    return new Promise((resolve, reject) => {
      const audioUrl = URL.createObjectURL(audioBlob);
      this.currentAudio = new Audio(audioUrl);

      this.currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };

      this.currentAudio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        reject(error);
      };

      this.currentAudio.play().catch(reject);
    });
  }

  /**
   * Speak text chunks sequentially
   * @param {string[]} chunks - Array of text chunks to speak
   * @param {string} quality - Quality level ('medium' or 'high')
   * @param {Function} onComplete - Callback when all chunks are spoken
   * @param {Function} onError - Callback on error
   */
  async speakChunks(chunks, quality = 'medium', onComplete = null, onError = null) {
    this.audioQueue = chunks;
    this.isPlaying = true;
    this.onComplete = onComplete;
    this.onError = onError;

    try {
      for (const chunk of chunks) {
        if (!this.isPlaying) {
          // Playback was stopped
          break;
        }

        const audioBlob = await this.synthesize(chunk, quality);
        await this.playAudio(audioBlob);

        // Small pause between chunks
        await this.sleep(300);
      }

      // All chunks spoken
      this.isPlaying = false;
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error speaking chunks:', error);
      this.isPlaying = false;
      if (onError) {
        onError(error);
      }
    }
  }

  /**
   * Stop current playback
   */
  stop() {
    this.isPlaying = false;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.audioQueue = [];
  }

  /**
   * Helper function to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use in webinar.js
window.PiperTTSService = PiperTTSService;