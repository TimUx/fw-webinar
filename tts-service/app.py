#!/usr/bin/env python3
"""
Piper TTS Service for Webinar Platform
Provides text-to-speech synthesis using Piper TTS (https://github.com/rhasspy/piper)
"""
import os
import hashlib
import subprocess
from flask import Flask, request, jsonify, send_file

app = Flask(__name__)

# Configuration
CACHE_DIR = os.environ.get('TTS_CACHE_DIR', '/app/cache')
MODELS_DIR = os.environ.get('MODELS_DIR', '/app/models')
TTS_QUALITY = os.environ.get('TTS_QUALITY', 'medium')  # 'medium' or 'high'
PIPER_BINARY = '/usr/local/bin/piper'

# Ensure cache directory exists
os.makedirs(CACHE_DIR, exist_ok=True)

def get_model_path(quality='medium'):
    """Get the model path for the specified quality"""
    model_name = f'de_DE-thorsten-{quality}.onnx'
    return os.path.join(MODELS_DIR, model_name)

def check_piper_installation():
    """Check if Piper is installed and models are available"""
    try:
        # Check if piper binary exists
        result = subprocess.run([PIPER_BINARY, '--version'], 
                              capture_output=True, 
                              text=True, 
                              timeout=5)
        
        # Check if models exist
        medium_model = get_model_path('medium')
        high_model = get_model_path('high')
        
        models_exist = os.path.exists(medium_model) and os.path.exists(high_model)
        
        return result.returncode == 0 and models_exist
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
    
    # Check if we have cached version
    cache_file = get_cache_filename(text, quality)
    
    if os.path.exists(cache_file):
        print(f"Serving cached audio for text: {text[:50]}... (quality: {quality})")
        return send_file(cache_file, mimetype='audio/wav')
    
    try:
        print(f"Generating audio for text: {text[:50]}... (quality: {quality})")
        
        model_path = get_model_path(quality)
        
        if not os.path.exists(model_path):
            return jsonify({'error': f'Modell nicht gefunden: {quality}'}), 500
        
        # Run Piper TTS to generate speech
        # Use subprocess to call piper binary
        # Note: text is passed via stdin (input parameter), not through shell,
        # so it's safe from command injection. The text parameter with text=True
        # ensures proper encoding handling.
        result = subprocess.run(
            [PIPER_BINARY, '--model', model_path, '--output_file', cache_file],
            input=text,
            text=True,
            capture_output=True,
            timeout=30
        )
        
        if result.returncode != 0:
            error_msg = result.stderr if result.stderr else 'Unknown error'
            print(f"Piper TTS error: {error_msg}")
            return jsonify({'error': f'Sprachsynthese fehlgeschlagen: {error_msg}'}), 500
        
        if not os.path.exists(cache_file):
            return jsonify({'error': 'Audio-Datei wurde nicht generiert'}), 500
        
        print(f"Audio generated and cached: {cache_file}")
        return send_file(cache_file, mimetype='audio/wav')
        
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Timeout bei Sprachsynthese'}), 500
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
    # Check Piper installation on startup
    if not check_piper_installation():
        print("WARNING: Piper TTS is not properly installed or models are missing.")
        print("Service will return errors until Piper is available.")
    else:
        print("Piper TTS initialized successfully")
        print(f"Using quality: {TTS_QUALITY}")
        print(f"Models directory: {MODELS_DIR}")
    
    # Start Flask server
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
