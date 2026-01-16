const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
const SLIDES_DIR = process.env.SLIDES_DIR || path.join(__dirname, '../../slides');

/**
 * Convert PPTX to HTML using LibreOffice
 */
async function convertPPTXToHTML(pptxFilename, webinarId) {
  const pptxPath = path.join(UPLOADS_DIR, pptxFilename);
  const outputDir = path.join(SLIDES_DIR, webinarId);
  
  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });
  
  // Convert PPTX to HTML using LibreOffice
  // This assumes LibreOffice is available (via Docker or locally)
  try {
    // LibreOffice headless conversion
    const { stdout, stderr } = await execAsync(
      `libreoffice --headless --convert-to html --outdir "${outputDir}" "${pptxPath}"`,
      { timeout: 60000 }
    );
    
    console.log('LibreOffice conversion output:', stdout);
    if (stderr) console.error('LibreOffice conversion stderr:', stderr);
    
    // Find the generated HTML file
    const files = await fs.readdir(outputDir);
    const htmlFile = files.find(f => f.endsWith('.html'));
    
    if (!htmlFile) {
      throw new Error('HTML-Datei wurde nicht generiert');
    }
    
    return htmlFile;
  } catch (error) {
    console.error('PPTX conversion error:', error);
    
    // Fallback: Create a simple placeholder if LibreOffice is not available
    console.log('LibreOffice nicht verfügbar. Erstelle Platzhalter-Slides...');
    await createPlaceholderSlides(pptxFilename, outputDir);
    
    return 'slides.html';
  }
}

/**
 * Create placeholder slides when LibreOffice is not available
 */
async function createPlaceholderSlides(pptxFilename, outputDir) {
  const slidesHtml = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Slides</title>
</head>
<body>
  <div>
    <h1>Platzhalter-Präsentation</h1>
    <p>Die PPTX-Datei "${pptxFilename}" wurde hochgeladen, aber noch nicht konvertiert.</p>
    <p>Bitte konfigurieren Sie LibreOffice für die automatische Konvertierung.</p>
  </div>
</body>
</html>
  `;
  
  await fs.writeFile(path.join(outputDir, 'slides.html'), slidesHtml, 'utf-8');
}

/**
 * Extract slides from HTML and create Reveal.js presentation
 */
async function createRevealPresentation(htmlFilename, webinarId, speakerNotes = []) {
  const outputDir = path.join(SLIDES_DIR, webinarId);
  const htmlPath = path.join(outputDir, htmlFilename);
  
  // Read the converted HTML
  let htmlContent = '';
  try {
    htmlContent = await fs.readFile(htmlPath, 'utf-8');
  } catch (error) {
    console.error('Could not read HTML file:', error);
    htmlContent = '<div><h1>Fehler beim Laden der Slides</h1></div>';
  }
  
  // Create Reveal.js presentation
  const revealHtml = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Webinar Präsentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/theme/white.css">
  <style>
    .reveal {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    .reveal h1, .reveal h2, .reveal h3 {
      color: #2c3e50;
    }
    .slide-content {
      padding: 20px;
    }
    .speaker-note {
      display: none;
    }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides" id="presentation-slides">
      <!-- Slides will be injected here -->
    </div>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.js"></script>
  <script>
    // Speaker notes data
    const speakerNotes = ${JSON.stringify(speakerNotes)};
    
    // Initialize Reveal.js
    Reveal.initialize({
      controls: true,
      progress: true,
      center: true,
      hash: false,
      transition: 'slide',
      autoSlide: 0, // Will be controlled by parent
      loop: false
    });
    
    // Expose functions for parent control
    window.revealControl = {
      next: () => Reveal.next(),
      prev: () => Reveal.prev(),
      getCurrentSlide: () => Reveal.getState().indexh,
      getTotalSlides: () => Reveal.getTotalSlides(),
      getSpeakerNote: (index) => speakerNotes[index] || ''
    };
  </script>
</body>
</html>
  `;
  
  // Write Reveal.js presentation
  const revealPath = path.join(outputDir, 'presentation.html');
  await fs.writeFile(revealPath, revealHtml, 'utf-8');
  
  // Also save the slide content separately
  await fs.writeFile(path.join(outputDir, 'content.html'), htmlContent, 'utf-8');
  
  return 'presentation.html';
}

/**
 * Generate simple slides from PPTX metadata
 */
async function generateSimpleSlides(webinarId, slideData) {
  const outputDir = path.join(SLIDES_DIR, webinarId);
  await fs.mkdir(outputDir, { recursive: true });
  
  const slides = slideData.map((slide, index) => `
    <section>
      <div class="slide-content">
        <h2>${slide.title || `Folie ${index + 1}`}</h2>
        ${slide.content ? `<div>${slide.content}</div>` : ''}
      </div>
      ${slide.speakerNote ? `<aside class="notes">${slide.speakerNote}</aside>` : ''}
    </section>
  `).join('\n');
  
  const revealHtml = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Webinar Präsentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/theme/white.css">
  <style>
    .reveal {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    .reveal h1, .reveal h2, .reveal h3 {
      color: #2c3e50;
    }
    .slide-content {
      padding: 40px;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
      ${slides}
    </div>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.js"></script>
  <script>
    Reveal.initialize({
      controls: true,
      progress: true,
      center: true,
      hash: false,
      transition: 'slide'
    });
    
    // Speaker notes from data
    const speakerNotes = ${JSON.stringify(slideData.map(s => s.speakerNote || ''))};
    
    window.revealControl = {
      next: () => Reveal.next(),
      prev: () => Reveal.prev(),
      getCurrentSlide: () => Reveal.getState().indexh,
      getTotalSlides: () => Reveal.getTotalSlides(),
      getSpeakerNote: (index) => speakerNotes[index] || ''
    };
  </script>
</body>
</html>
  `;
  
  await fs.writeFile(path.join(outputDir, 'presentation.html'), revealHtml, 'utf-8');
  
  return 'presentation.html';
}

module.exports = {
  convertPPTXToHTML,
  createRevealPresentation,
  generateSimpleSlides
};
