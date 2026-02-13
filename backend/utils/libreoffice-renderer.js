const fs = require('fs').promises;
const path = require('path');
const { spawnAsync } = require('./process');

/**
 * Check if LibreOffice is available in the system
 * @returns {Promise<boolean>}
 */
async function isLibreOfficeAvailable() {
  try {
    // Try to run soffice --version
    await spawnAsync('soffice', ['--version'], { timeout: 5000 });
    return true;
  } catch (error) {
    console.error('LibreOffice check failed:', error);
    return false;
  }
}

/**
 * Convert PPTX file to images using LibreOffice
 * Uses LibreOffice headless mode to export slides as PNG images
 * 
 * @param {string} pptxPath - Path to PPTX file
 * @param {string} outputDir - Directory to save screenshots
 * @returns {Promise<Array>} Array of image metadata
 */
async function convertPPTXToImages(pptxPath, outputDir) {
  try {
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    console.log(`Converting PPTX to images: ${pptxPath}`);
    console.log(`Output directory: ${outputDir}`);
    
    // Create a temporary directory for LibreOffice conversion
    const tempDir = path.join(outputDir, '.tmp');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Convert PPTX to PDF first (more reliable)
    const pdfPath = path.join(tempDir, 'presentation.pdf');
    console.log('Step 1: Converting PPTX to PDF...');
    
    await spawnAsync('soffice', [
      '--headless',
      '--invisible',
      '--nocrashreport',
      '--nodefault',
      '--nofirststartwizard',
      '--nolockcheck',
      '--nologo',
      '--norestore',
      '--convert-to', 'pdf',
      '--outdir', tempDir,
      pptxPath
    ], { timeout: 120000 });
    
    // Check if PDF was created
    const pdfFiles = await fs.readdir(tempDir);
    const generatedPdf = pdfFiles.find(f => f.endsWith('.pdf'));
    
    if (!generatedPdf) {
      throw new Error('LibreOffice konnte keine PDF-Datei erstellen');
    }
    
    const actualPdfPath = path.join(tempDir, generatedPdf);
    console.log(`PDF created: ${actualPdfPath}`);
    
    // Convert PDF to images using pdftoppm
    console.log('Step 2: Converting PDF to images...');
    const outputPrefix = path.join(outputDir, 'slide-');
    
    await spawnAsync('pdftoppm', [
      '-png',
      '-r', '300',  // 300 DPI for good quality
      actualPdfPath,
      outputPrefix
    ], { timeout: 120000 });
    
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    
    // Find generated images
    const files = await fs.readdir(outputDir);
    const imageFiles = files
      .filter(f => f.startsWith('slide-') && f.endsWith('.png'))
      .sort((a, b) => {
        // Extract numbers from filenames for proper sorting
        const numA = parseInt(a.match(/slide-(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/slide-(\d+)/)?.[1] || '0');
        return numA - numB;
      });
    
    console.log(`Generated ${imageFiles.length} slide images`);
    
    // Rename files to have consistent naming (001, 002, etc.)
    const screenshots = [];
    for (let i = 0; i < imageFiles.length; i++) {
      const oldPath = path.join(outputDir, imageFiles[i]);
      const newFilename = `slide-${String(i + 1).padStart(3, '0')}.png`;
      const newPath = path.join(outputDir, newFilename);
      
      if (oldPath !== newPath) {
        await fs.rename(oldPath, newPath);
      }
      
      screenshots.push({
        path: newPath,
        filename: newFilename,
        slideNumber: i + 1
      });
      
      console.log(`Captured slide ${i + 1}/${imageFiles.length}`);
    }
    
    return screenshots;
  } catch (error) {
    console.error('Error converting PPTX with LibreOffice:', error);
    throw error;
  }
}

module.exports = {
  convertPPTXToImages,
  isLibreOfficeAvailable
};
