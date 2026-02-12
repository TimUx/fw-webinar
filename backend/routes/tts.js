const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || 'http://localhost:5000';

/**
 * Synthesize speech from text using Coqui TTS
 * POST /api/tts/synthesize
 * Body: { text: string, rate: number (optional) }
 */
router.post('/synthesize', async (req, res) => {
  try {
    const { text, rate } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Prepare request to TTS service
    const url = new URL(`${TTS_SERVICE_URL}/synthesize`);
    const protocol = url.protocol === 'https:' ? https : http;

    const postData = JSON.stringify({
      text,
      rate: rate || 1.0
    });

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: '/synthesize',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    // Forward request to TTS service
    const ttsRequest = protocol.request(options, (ttsResponse) => {
      if (ttsResponse.statusCode === 200) {
        // Stream audio response back to client
        res.setHeader('Content-Type', 'audio/wav');
        ttsResponse.pipe(res);
      } else {
        // Handle error response
        let errorData = '';
        ttsResponse.on('data', (chunk) => {
          errorData += chunk;
        });
        ttsResponse.on('end', () => {
          try {
            const error = JSON.parse(errorData);
            res.status(ttsResponse.statusCode).json(error);
          } catch {
            res.status(ttsResponse.statusCode).json({ 
              error: 'TTS service error',
              details: errorData
            });
          }
        });
      }
    });

    ttsRequest.on('error', (error) => {
      console.error('Error connecting to TTS service:', error);
      res.status(503).json({ 
        error: 'TTS service unavailable',
        message: error.message
      });
    });

    ttsRequest.write(postData);
    ttsRequest.end();

  } catch (error) {
    console.error('Error in TTS synthesis:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Health check for TTS service
 * GET /api/tts/health
 */
router.get('/health', async (req, res) => {
  try {
    const url = new URL(`${TTS_SERVICE_URL}/health`);
    const protocol = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: '/health',
      method: 'GET'
    };

    const ttsRequest = protocol.request(options, (ttsResponse) => {
      let data = '';
      ttsResponse.on('data', (chunk) => {
        data += chunk;
      });
      ttsResponse.on('end', () => {
        try {
          const health = JSON.parse(data);
          res.json(health);
        } catch {
          res.status(500).json({ error: 'Invalid response from TTS service' });
        }
      });
    });

    ttsRequest.on('error', (error) => {
      res.status(503).json({ 
        status: 'unavailable',
        error: error.message
      });
    });

    ttsRequest.end();

  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: error.message
    });
  }
});

/**
 * Get cache statistics
 * GET /api/tts/cache/stats
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const url = new URL(`${TTS_SERVICE_URL}/cache/stats`);
    const protocol = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: '/cache/stats',
      method: 'GET'
    };

    const ttsRequest = protocol.request(options, (ttsResponse) => {
      let data = '';
      ttsResponse.on('data', (chunk) => {
        data += chunk;
      });
      ttsResponse.on('end', () => {
        try {
          const stats = JSON.parse(data);
          res.json(stats);
        } catch {
          res.status(500).json({ error: 'Invalid response from TTS service' });
        }
      });
    });

    ttsRequest.on('error', (error) => {
      res.status(503).json({ 
        error: 'TTS service unavailable',
        message: error.message
      });
    });

    ttsRequest.end();

  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Clear TTS cache
 * POST /api/tts/cache/clear
 */
router.post('/cache/clear', async (req, res) => {
  try {
    const url = new URL(`${TTS_SERVICE_URL}/cache/clear`);
    const protocol = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: '/cache/clear',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': 0
      }
    };

    const ttsRequest = protocol.request(options, (ttsResponse) => {
      let data = '';
      ttsResponse.on('data', (chunk) => {
        data += chunk;
      });
      ttsResponse.on('end', () => {
        try {
          const result = JSON.parse(data);
          res.json(result);
        } catch {
          res.status(500).json({ error: 'Invalid response from TTS service' });
        }
      });
    });

    ttsRequest.on('error', (error) => {
      res.status(503).json({ 
        error: 'TTS service unavailable',
        message: error.message
      });
    });

    ttsRequest.end();

  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;