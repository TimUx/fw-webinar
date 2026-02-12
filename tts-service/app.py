#!/usr/bin/env python3
"""
Coqui TTS Service for Webinar Platform
Provides text-to-speech synthesis using Coqui AI TTS (Open Source)
"""
import os
import hashlib
from flask import Flask, request, jsonify, send_file
from TTS.api import TTS
import torch

app = Flask(__name__)

# Configuration
CACHE_DIR = os.environ.get('TTS_CACHE_DIR', '/app/cache')
TTS_MODEL = os.environ.get('TTS_MODEL', 'tts_models/de/thorsten/tacotron2-DDC')

# Ensure cache directory exists
os.makedirs(CACHE_DIR, exist_ok=True)

# Initialize TTS model
print(f"Loading TTS model: {TTS_MODEL}")
tts = None

def init_tts():
    """Initialize TTS model"""
    global tts
    try:
        # Check if CUDA is available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {device}")
        
        # Initialize TTS with German model
        tts = TTS(TTS_MODEL).to(device)
        print("TTS model loaded successfully")
        return True
    except Exception as e:
        print(f"Error loading TTS model: {e}")
        return False

def get_cache_filename(text, rate=1.0):
    """
    Generate cache filename based on text and parameters
    Note: MD5 is used for non-cryptographic purposes (cache key generation only)
    """
    # Create hash of text and parameters for caching
    cache_key = f"{text}_{rate}_{TTS_MODEL}"
    hash_obj = hashlib.md5(cache_key.encode('utf-8'))
    return os.path.join(CACHE_DIR, f"{hash_obj.hexdigest()}.wav")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'model': TTS_MODEL,
        'tts_loaded': tts is not None
    })

@app.route('/synthesize', methods=['POST'])
def synthesize():
    """
    Synthesize speech from text
    
    Request JSON:
    {
        "text": "Text to synthesize",
        "rate": 1.0  (optional, speech rate multiplier)
    }
    
    Returns: WAV audio file
    """
    if tts is None:
        return jsonify({'error': 'TTS model not loaded'}), 500
    
    data = request.get_json()
    
    if not data or 'text' not in data:
        return jsonify({'error': 'Missing required field: text'}), 400
    
    text = data['text'].strip()
    rate = float(data.get('rate', 1.0))
    
    if not text:
        return jsonify({'error': 'Text cannot be empty'}), 400
    
    # Check if we have cached version
    cache_file = get_cache_filename(text, rate)
    
    if os.path.exists(cache_file):
        print(f"Serving cached audio for text: {text[:50]}...")
        return send_file(cache_file, mimetype='audio/wav')
    
    try:
        print(f"Generating audio for text: {text[:50]}...")
        
        # Generate speech
        # Note: Coqui TTS Tacotron2-DDC model doesn't support runtime rate adjustment
        # The rate parameter is kept for API consistency but currently not applied
        # Future enhancement: implement post-processing speed adjustment using librosa
        tts.tts_to_file(
            text=text,
            file_path=cache_file
        )
        
        print(f"Audio generated and cached: {cache_file}")
        return send_file(cache_file, mimetype='audio/wav')
        
    except Exception as e:
        print(f"Error generating speech: {e}")
        return jsonify({'error': f'Speech synthesis failed: {str(e)}'}), 500

@app.route('/list-models', methods=['GET'])
def list_models():
    """List available TTS models"""
    try:
        # Get available models
        manager = TTS().list_models()
        return jsonify({'models': manager})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/cache/stats', methods=['GET'])
def cache_stats():
    """Get cache statistics"""
    try:
        cache_files = [f for f in os.listdir(CACHE_DIR) if f.endswith('.wav')]
        total_size = sum(os.path.getsize(os.path.join(CACHE_DIR, f)) for f in cache_files)
        
        return jsonify({
            'cache_dir': CACHE_DIR,
            'total_files': len(cache_files),
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'cache_enabled': True
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/cache/clear', methods=['POST'])
def clear_cache():
    """Clear all cached audio files"""
    try:
        cache_files = [f for f in os.listdir(CACHE_DIR) if f.endswith('.wav')]
        deleted_count = 0
        
        for filename in cache_files:
            try:
                os.remove(os.path.join(CACHE_DIR, filename))
                deleted_count += 1
            except Exception as e:
                print(f"Error deleting {filename}: {e}")
        
        return jsonify({
            'status': 'success',
            'deleted_files': deleted_count,
            'message': f'Cleared {deleted_count} cached audio files'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Initialize TTS on startup
    if not init_tts():
        print("WARNING: TTS model failed to load. Service will return errors.")
    
    # Start Flask server
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
