#!/usr/bin/env python3
"""
Piper TTS Service for Webinar Platform
Provides text-to-speech synthesis using Piper TTS (https://github.com/rhasspy/piper)
"""
import os
import hashlib
import subprocess
import wave
import threading
from flask import Flask, request, jsonify, send_file
from piper import PiperVoice

app = Flask(__name__)

# Configuration
CACHE_DIR = os.environ.get('TTS_CACHE_DIR', '/app/cache')
MODELS_DIR = os.environ.get('MODELS_DIR', '/app/models')
TTS_QUALITY = os.environ.get('TTS_QUALITY', 'medium')  # 'medium' or 'high'

# Voice cache
voice_cache = {}
voice_cache_lock = threading.Lock()

# Model download status
model_download_lock = threading.Lock()
model_download_status = {'in_progress': False, 'completed': False, 'error': None}

# Ensure cache and models directories exist
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

def get_model_path(quality='medium'):
    """Get the model path for the specified quality"""
    model_name = f'de_DE-thorsten-{quality}.onnx'
    return os.path.join(MODELS_DIR, model_name)

def download_model(quality='medium'):
    """
    Download Piper voice model using the official piper download tool
    Returns True if successful, False otherwise
    """
    model_name = f'de_DE-thorsten-{quality}'
    
    try:
        print(f"Downloading {quality} quality model using piper.download...")
        
        from piper.download import ensure_voice_exists, get_voices
        
        # Get voice information
        voices_info = get_voices(MODELS_DIR)
        
        # Download the voice
        ensure_voice_exists(
            name=model_name,
            data_dirs=[MODELS_DIR],
            download_dir=MODELS_DIR,
            voices_info=voices_info
        )
        
        print(f"Successfully downloaded {model_name}")
        return True
            
    except Exception as e:
        print(f"Error downloading {quality} model: {e}")
        import traceback
        traceback.print_exc()
        return False

def ensure_models_available():
    """
    Ensure that required models are available.
    Downloads them if they don't exist and haven't been downloaded yet.
    """
    global model_download_status
    
    with model_download_lock:
        # Check if models already exist
        medium_model = get_model_path('medium')
        high_model = get_model_path('high')
        
        medium_exists = os.path.exists(medium_model) and os.path.exists(medium_model + '.json')
        high_exists = os.path.exists(high_model) and os.path.exists(high_model + '.json')
        
        if medium_exists and high_exists:
            model_download_status['completed'] = True
            return True
        
        # Check if download already in progress or completed
        if model_download_status['in_progress'] or model_download_status['completed']:
            return model_download_status['completed']
        
        # Mark download as in progress
        model_download_status['in_progress'] = True
        
        try:
            # Try to download missing models
            success = True
            
            if not medium_exists:
                print("Medium quality model not found, attempting download...")
                if not download_model('medium'):
                    success = False
                    model_download_status['error'] = "Failed to download medium quality model"
            
            if not high_exists:
                print("High quality model not found, attempting download...")
                if not download_model('high'):
                    # High model is optional, just warn
                    print("Warning: Could not download high quality model, but continuing...")
            
            model_download_status['completed'] = success
            model_download_status['in_progress'] = False
            
            return success
            
        except Exception as e:
            print(f"Error ensuring models available: {e}")
            model_download_status['error'] = str(e)
            model_download_status['in_progress'] = False
            return False

def get_voice(quality='medium'):
    """
    Get a loaded Piper voice model, using cache if available
    """
    with voice_cache_lock:
        if quality in voice_cache:
            return voice_cache[quality]
        
        model_path = get_model_path(quality)
        if not os.path.exists(model_path):
            return None
        
        try:
            print(f"Loading voice model: {model_path}")
            voice = PiperVoice.load(model_path)
            voice_cache[quality] = voice
            return voice
        except Exception as e:
            print(f"Error loading voice model {quality}: {e}")
            return None

def check_piper_installation():
    """Check if Piper is installed and models are available"""
    try:
        # Check if piper module is available
        import piper
        
        # Check if models exist or can be downloaded
        medium_model = get_model_path('medium')
        medium_config = medium_model + '.json'
        
        # Check if medium model exists (minimum requirement)
        models_exist = os.path.exists(medium_model) and os.path.exists(medium_config)
        
        return models_exist
    except ImportError:
        print("Error: piper-tts package not installed")
        return False
    except Exception as e:
        print(f"Error checking Piper installation: {e}")
        return False

def get_cache_filename(text, quality=TTS_QUALITY):
    """
    Generate cache filename based on text and parameters
    Note: MD5 is used for non-cryptographic purposes (cache key generation only)
    """
    # Create hash of text and parameters for caching
    cache_key = f"{text}_{quality}_piper"
    hash_obj = hashlib.md5(cache_key.encode('utf-8'))
    return os.path.join(CACHE_DIR, f"{hash_obj.hexdigest()}.wav")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    piper_installed = check_piper_installation()
    return jsonify({
        'status': 'ok' if piper_installed else 'degraded',
        'engine': 'piper',
        'qualitaet': TTS_QUALITY,
        'piper_installiert': piper_installed,
        'sprache': 'de',
        'stimme': 'thorsten'
    })

@app.route('/synthesize', methods=['POST'])
def synthesize():
    """
    Synthesize speech from text
    
    Request JSON:
    {
        "text": "Text to synthesize",
        "quality": "medium"  (optional: "medium" or "high", default from env)
    }
    
    Returns: WAV audio file
    """
    data = request.get_json()
    
    if not data or 'text' not in data:
        return jsonify({'error': 'Erforderliches Feld fehlt: text'}), 400
    
    text = data['text'].strip()
    quality = data.get('quality', TTS_QUALITY)
    
    # Validate quality parameter
    if quality not in ['medium', 'high']:
        quality = 'medium'
    
    if not text:
        return jsonify({'error': 'Text darf nicht leer sein'}), 400
    
    # Ensure models are available before processing
    if not ensure_models_available():
        return jsonify({
            'error': 'TTS-Modelle nicht verfügbar',
            'details': 'Modelle konnten nicht heruntergeladen werden. Bitte Internetverbindung prüfen oder manuell herunterladen.',
            'download_error': model_download_status.get('error')
        }), 503
    
    # Check if we have cached version
    cache_file = get_cache_filename(text, quality)
    
    if os.path.exists(cache_file):
        print(f"Serving cached audio for text: {text[:50]}... (quality: {quality})")
        return send_file(cache_file, mimetype='audio/wav')
    
    try:
        print(f"Generating audio for text: {text[:50]}... (quality: {quality})")
        
        # Get the voice model
        voice = get_voice(quality)
        
        if voice is None:
            # Try fallback to medium if high quality is not available
            if quality == 'high':
                print(f"High quality model not available, falling back to medium")
                quality = 'medium'
                voice = get_voice(quality)
                cache_file = get_cache_filename(text, quality)  # Update cache file for new quality
            
            if voice is None:
                return jsonify({'error': f'Modell konnte nicht geladen werden: {quality}'}), 500
        
        # Generate speech using Piper Python API
        with wave.open(cache_file, 'wb') as wav_file:
            voice.synthesize_wav(text, wav_file)
        
        if not os.path.exists(cache_file):
            return jsonify({'error': 'Audio-Datei wurde nicht generiert'}), 500
        
        print(f"Audio generated and cached: {cache_file}")
        return send_file(cache_file, mimetype='audio/wav')
        
    except Exception as e:
        print(f"Error generating speech: {e}")
        return jsonify({'error': f'Sprachsynthese fehlgeschlagen: {str(e)}'}), 500

@app.route('/cache/stats', methods=['GET'])
def cache_stats():
    """Get cache statistics"""
    try:
        cache_files = [f for f in os.listdir(CACHE_DIR) if f.endswith('.wav')]
        total_size = sum(os.path.getsize(os.path.join(CACHE_DIR, f)) for f in cache_files)
        
        return jsonify({
            'cache_verzeichnis': CACHE_DIR,
            'anzahl_dateien': len(cache_files),
            'groesse_bytes': total_size,
            'groesse_mb': round(total_size / (1024 * 1024), 2),
            'cache_aktiviert': True
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
            'status': 'erfolg',
            'geloeschte_dateien': deleted_count,
            'nachricht': f'{deleted_count} gecachte Audiodateien gelöscht'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting Piper TTS Service...")
    print(f"Models directory: {MODELS_DIR}")
    print(f"Cache directory: {CACHE_DIR}")
    print(f"Default quality: {TTS_QUALITY}")
    
    # Check if piper-tts is installed
    try:
        import piper
        try:
            from importlib.metadata import version
            piper_version = version('piper-tts')
            print(f"✓ Piper TTS package is installed (version: {piper_version})")
        except Exception:
            print("✓ Piper TTS package is installed")
    except ImportError:
        print("⚠ ERROR: piper-tts package is not installed!")
        print("  Please install with: pip install piper-tts")
        exit(1)
    
    # Try to ensure models are available on startup
    print("\nChecking for Piper TTS models...")
    if ensure_models_available():
        print("✓ Piper TTS models are available")
    else:
        print("⚠ WARNING: Piper TTS models could not be downloaded automatically.")
        print("  Models will be downloaded on first request if internet access is available.")
        print("  Or download models manually using:")
        print("  python3 -c \"from piper.download import ensure_voice_exists, get_voices; voices=get_voices('/app/models'); ensure_voice_exists('de_DE-thorsten-medium', ['/app/models'], '/app/models', voices)\"")
        print("\n  Service will attempt to download models on first request.")
    
    # Start Flask server
    print("\nStarting Flask server...")
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
