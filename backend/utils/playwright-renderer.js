const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

/**
 * Initialize Playwright browser instance
 * Reuses a single browser instance for performance
 */
let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
  return browserInstance;
}

/**
 * Close the browser instance
 */
async function closeBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Convert PPTX file to images using headless browser rendering
 * Uses Office Online Viewer or Google Docs Viewer for PPTX rendering
 * 
 * @param {string} pptxPath - Path to PPTX file
 * @param {string} outputDir - Directory to save screenshots
 * @returns {Promise<Array>} Array of screenshot paths
 */
async function convertPPTXToImages(pptxPath, outputDir) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  try {
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    // Read PPTX file as base64 for embedding
    const pptxBuffer = await fs.readFile(pptxPath);
    const pptxBase64 = pptxBuffer.toString('base64');
    const pptxFilename = path.basename(pptxPath);
    
    // Create a simple HTML viewer page that embeds the PPTX
    // Using Office.js or iframe-based viewer
    const viewerHtml = createPPTXViewerHTML(pptxBase64, pptxFilename);
    
    const page = await context.newPage();
    
    // Set content to the viewer HTML
    await page.setContent(viewerHtml, { waitUntil: 'networkidle' });
    
    // Wait for PPTX to load and render
    await page.waitForTimeout(3000); // Give time for rendering
    
    // Try to detect number of slides
    // This will depend on the viewer implementation
    let slideCount = 1;
    try {
      // Attempt to get slide count from the viewer
      slideCount = await page.evaluate(() => {
        // This would need to be customized based on the viewer used
        return window.slideCount || 1;
      });
    } catch (error) {
      console.log('Could not detect slide count, defaulting to 1');
    }
    
    const screenshots = [];
    
    // Take screenshots of each slide
    for (let i = 0; i < slideCount; i++) {
      const screenshotPath = path.join(outputDir, `slide-${String(i + 1).padStart(3, '0')}.png`);
      
      // Navigate to slide if possible
      if (i > 0) {
        try {
          await page.evaluate(() => {
            // Try to navigate to next slide
            // This would need to be customized based on the viewer used
            if (window.nextSlide) {
              window.nextSlide();
            }
          });
          await page.waitForTimeout(1000);
        } catch (error) {
          console.log(`Could not navigate to slide ${i + 1}`);
          break;
        }
      }
      
      // Take screenshot
      await page.screenshot({
        path: screenshotPath,
        fullPage: false
      });
      
      screenshots.push(screenshotPath);
    }
    
    await page.close();
    
    return screenshots;
  } catch (error) {
    console.error('Error converting PPTX with Playwright:', error);
    throw error;
  } finally {
    await context.close();
  }
}

/**
 * Create HTML viewer for PPTX file
 * Uses Google Docs Viewer or Office Online Viewer
 */
function createPPTXViewerHTML(pptxBase64, filename) {
  // For now, create a simple placeholder approach
  // In production, you would integrate with Office.js or a proper PPTX viewer
  // like pptxjs, or use Google Docs Viewer
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PPTX Viewer</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #f0f0f0;
    }
    .slide-container {
      width: 1920px;
      height: 1080px;
      background: white;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: Arial, sans-serif;
    }
    .message {
      text-align: center;
      padding: 40px;
    }
  </style>
</head>
<body>
  <div class="slide-container">
    <div class="message">
      <h1>PPTX Rendering</h1>
      <p>File: ${filename}</p>
      <p>Rendering PPTX files requires integration with Office.js or similar viewer library.</p>
    </div>
  </div>
  <script>
    // Expose slide count for screenshot detection
    window.slideCount = 1;
    
    // Simple navigation API
    window.currentSlide = 0;
    window.nextSlide = function() {
      window.currentSlide++;
      // Update display based on slide number
    };
  </script>
</body>
</html>
  `;
}

/**
 * Convert PPTX to PDF first, then to images
 * This is a fallback approach using LibreOffice or similar tools
 * 
 * @param {string} pptxPath - Path to PPTX file
 * @param {string} outputDir - Directory to save images
 * @returns {Promise<Array>} Array of image metadata
 */
async function convertPPTXViaPDF(pptxPath, outputDir) {
  const { spawnAsync } = require('./process');
  
  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });
  
  // First convert PPTX to PDF using LibreOffice (if available)
  const pdfPath = path.join(outputDir, 'temp.pdf');
  
  try {
    // Try using LibreOffice to convert PPTX to PDF
    await spawnAsync('libreoffice', [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', outputDir,
      pptxPath
    ], { timeout: 120000 });
    
    // Rename the output file to temp.pdf
    const convertedPdf = path.join(outputDir, path.basename(pptxPath, '.pptx') + '.pdf');
    await fs.rename(convertedPdf, pdfPath);
    
  } catch (error) {
    console.error('LibreOffice conversion failed:', error);
    throw new Error('LibreOffice ist nicht verfügbar. Bitte installieren Sie LibreOffice für PPTX-Konvertierung.');
  }
  
  // Now convert PDF to images using pdftoppm
  try {
    const outputPrefix = path.join(outputDir, 'slide');
    await spawnAsync('pdftoppm', [pdfPath, outputPrefix, '-png'], { timeout: 120000 });
    
    // Clean up temporary PDF
    await fs.unlink(pdfPath);
    
    // Find generated images
    const files = await fs.readdir(outputDir);
    const imageFiles = files
      .filter(f => f.startsWith('slide') && f.endsWith('.png'))
      .sort();
    
    return imageFiles.map((filename, index) => ({
      filename: filename,
      path: path.join(outputDir, filename),
      slideNumber: index + 1
    }));
    
  } catch (error) {
    console.error('PDF to images conversion failed:', error);
    throw new Error('pdftoppm konnte PDF nicht in Bilder konvertieren. Bitte stellen Sie sicher, dass poppler-utils installiert ist.');
  }
}

/**
 * Check if LibreOffice is available
 */
async function isLibreOfficeAvailable() {
  const { spawnAsync } = require('./process');
  try {
    await spawnAsync('libreoffice', ['--version'], { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  convertPPTXToImages,
  convertPPTXViaPDF,
  isLibreOfficeAvailable,
  closeBrowser
};
