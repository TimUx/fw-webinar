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
 * Uses JSZip to parse PPTX and renders slides in browser
 * 
 * @param {string} pptxPath - Path to PPTX file
 * @param {string} outputDir - Directory to save screenshots
 * @returns {Promise<Array>} Array of image metadata
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
    
    // Create a viewer HTML page with embedded PPTX
    const viewerHtml = createPPTXViewerHTML(pptxBase64, pptxFilename);
    
    const page = await context.newPage();
    
    // Set content to the viewer HTML
    await page.setContent(viewerHtml, { waitUntil: 'domcontentloaded' });
    
    // Wait for PPTX to load and parse
    console.log('Waiting for PPTX to load...');
    await page.waitForFunction(() => {
      return window.slideCount !== undefined && window.slideCount > 0;
    }, { timeout: 30000 });
    
    // Get slide count
    const slideCount = await page.evaluate(() => window.slideCount);
    console.log(`Found ${slideCount} slides in PPTX`);
    
    const screenshots = [];
    
    // Take screenshots of each slide
    for (let i = 0; i < slideCount; i++) {
      const screenshotPath = path.join(outputDir, `slide-${String(i + 1).padStart(3, '0')}.png`);
      
      // Navigate to slide
      if (i > 0) {
        await page.evaluate(() => window.nextSlide());
        // Wait for slide transition
        await page.waitForTimeout(500);
      }
      
      // Take screenshot of the slide
      await page.screenshot({
        path: screenshotPath,
        fullPage: false
      });
      
      screenshots.push({
        path: screenshotPath,
        filename: path.basename(screenshotPath),
        slideNumber: i + 1
      });
      
      console.log(`Captured slide ${i + 1}/${slideCount}`);
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
 * Create HTML viewer for PPTX file that properly renders slides with images
 * Extracts images and text from PPTX and displays them as close to the original as possible
 */
function createPPTXViewerHTML(pptxBase64, filename) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PPTX Viewer</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: white;
    }
    #viewer-container {
      width: 100%;
      height: 100%;
      position: relative;
      background: white;
    }
    .slide {
      width: 100%;
      height: 100%;
      display: none;
      position: absolute;
      top: 0;
      left: 0;
      background: white;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    }
    .slide.active {
      display: block;
    }
    .slide-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .slide-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 60px;
      font-family: Arial, sans-serif;
      font-size: 48px;
      text-align: center;
      max-width: 90%;
      word-wrap: break-word;
      color: #000;
      text-shadow: 0 0 10px rgba(255,255,255,0.8);
    }
    #loading {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: Arial, sans-serif;
      font-size: 24px;
      color: #333;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
</head>
<body>
  <div id="viewer-container">
    <div id="loading">Loading presentation...</div>
  </div>
  
  <script>
    // Parse PPTX and render slides with images
    const pptxData = '${pptxBase64}';
    let slides = [];
    let currentSlideIndex = 0;
    let imageCache = {};
    
    async function loadPPTX() {
      try {
        // Decode base64 to binary
        const binaryString = atob(pptxData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Load PPTX as ZIP
        const zip = await JSZip.loadAsync(bytes);
        
        // Extract all images from PPTX
        console.log('Extracting images from PPTX...');
        const imageFiles = Object.keys(zip.files).filter(name => 
          name.startsWith('ppt/media/') && /\\.(png|jpg|jpeg|gif|svg)$/i.test(name)
        );
        
        for (const imagePath of imageFiles) {
          const imageData = await zip.files[imagePath].async('base64');
          const ext = imagePath.match(/\\.(\\w+)$/)[1].toLowerCase();
          const mimeType = ext === 'png' ? 'image/png' : 
                          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                          ext === 'gif' ? 'image/gif' : 'image/svg+xml';
          imageCache[imagePath] = 'data:' + mimeType + ';base64,' + imageData;
          console.log('Extracted image:', imagePath);
        }
        
        // Find all slide files
        const slideFiles = Object.keys(zip.files)
          .filter(name => name.match(/ppt\\/slides\\/slide\\d+\\.xml$/))
          .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\\d+)/)[1]);
            const numB = parseInt(b.match(/slide(\\d+)/)[1]);
            return numA - numB;
          });
        
        console.log('Found', slideFiles.length, 'slides');
        
        // Extract slide content and relationships
        for (let i = 0; i < slideFiles.length; i++) {
          const slideFile = slideFiles[i];
          const slideIndex = i + 1;
          const slideXml = await zip.files[slideFile].async('string');
          
          // Parse slide relationships to map image references
          const relsPath = 'ppt/slides/_rels/slide' + slideIndex + '.xml.rels';
          const relationships = {};
          
          if (zip.files[relsPath]) {
            const relsXml = await zip.files[relsPath].async('string');
            const relMatches = relsXml.match(/<Relationship[^>]*>/g) || [];
            
            relMatches.forEach(match => {
              const idMatch = match.match(/Id="([^"]+)"/);
              const targetMatch = match.match(/Target="([^"]+)"/);
              
              if (idMatch && targetMatch) {
                const id = idMatch[1];
                const target = targetMatch[1].replace(/\\.\\.\\\//g, 'ppt/');
                relationships[id] = target;
              }
            });
          }
          
          // Extract image references from slide
          const imageRefs = [];
          const blipMatches = slideXml.match(/r:embed="([^"]+)"/g) || [];
          
          blipMatches.forEach(match => {
            const refId = match.replace(/r:embed="|"/g, '');
            if (relationships[refId]) {
              const imagePath = relationships[refId];
              if (imageCache[imagePath]) {
                imageRefs.push(imageCache[imagePath]);
              }
            }
          });
          
          // Extract text content from slide XML
          const textMatches = slideXml.match(/<a:t>([^<]*)<\\/a:t>/g) || [];
          const texts = textMatches.map(match => {
            return match.replace(/<a:t>|<\\/a:t>/g, '');
          });
          
          // Extract background color if present
          let bgColor = 'white';
          const bgColorMatch = slideXml.match(/<a:srgbClr val="([^"]+)"/);
          if (bgColorMatch) {
            bgColor = '#' + bgColorMatch[1];
          }
          
          slides.push({
            file: slideFile,
            text: texts.join(' '),
            images: imageRefs,
            backgroundColor: bgColor,
            xml: slideXml
          });
        }
        
        // Create slide elements
        const container = document.getElementById('viewer-container');
        container.innerHTML = '';
        
        slides.forEach((slide, index) => {
          const slideDiv = document.createElement('div');
          slideDiv.className = 'slide' + (index === 0 ? ' active' : '');
          slideDiv.id = 'slide-' + index;
          slideDiv.style.backgroundColor = slide.backgroundColor;
          
          // Add images if present - use first image as main slide image
          if (slide.images && slide.images.length > 0) {
            const img = document.createElement('img');
            img.className = 'slide-image';
            img.src = slide.images[0];
            slideDiv.appendChild(img);
          } else if (slide.text) {
            // Only show text if no images (fallback)
            const textDiv = document.createElement('div');
            textDiv.className = 'slide-text';
            textDiv.textContent = slide.text || 'Slide ' + (index + 1);
            slideDiv.appendChild(textDiv);
          }
          
          container.appendChild(slideDiv);
        });
        
        // Expose API for screenshot capture
        window.slideCount = slides.length;
        window.currentSlide = 0;
        window.slides = slides;
        
        window.goToSlide = function(index) {
          if (index >= 0 && index < slides.length) {
            document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
            document.getElementById('slide-' + index).classList.add('active');
            window.currentSlide = index;
          }
        };
        
        window.nextSlide = function() {
          if (window.currentSlide < slides.length - 1) {
            window.goToSlide(window.currentSlide + 1);
          }
        };
        
        window.prevSlide = function() {
          if (window.currentSlide > 0) {
            window.goToSlide(window.currentSlide - 1);
          }
        };
        
        console.log('PPTX loaded successfully. Total slides:', window.slideCount);
        console.log('Images extracted:', Object.keys(imageCache).length);
        
      } catch (error) {
        console.error('Error loading PPTX:', error);
        document.getElementById('viewer-container').innerHTML = 
          '<div style="padding: 60px; font-family: Arial, sans-serif; font-size: 24px; color: red;">Error loading presentation: ' + error.message + '</div>';
        window.slideCount = 0;
      }
    }
    
    // Load PPTX when page loads
    loadPPTX();
  </script>
</body>
</html>
  `;
}

/**
 * Check if Playwright is available
 */
async function isPlaywrightAvailable() {
  try {
    await getBrowser();
    await closeBrowser();
    return true;
  } catch (error) {
    console.error('Playwright check failed:', error);
    return false;
  }
}

module.exports = {
  convertPPTXToImages,
  isPlaywrightAvailable,
  closeBrowser
};
