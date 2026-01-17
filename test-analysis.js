const { analyzePresentation, progressTracker } = require('./backend/services/slideAnalyzer');

async function testAnalysis() {
  console.log('Testing PPTX analysis...\n');
  
  const filename = 'test-presentation.pptx';
  const webinarId = 'test-webinar-' + Date.now();
  const sessionId = 'session-' + Date.now();
  
  console.log(`Session ID: ${sessionId}`);
  console.log(`Webinar ID: ${webinarId}`);
  console.log(`File: ${filename}\n`);
  
  // Start analysis
  console.log('Starting analysis...');
  
  try {
    const slides = await analyzePresentation(filename, webinarId, sessionId);
    
    console.log('\n✓ Analysis completed successfully!');
    console.log(`✓ Extracted ${slides.length} slides\n`);
    
    slides.forEach((slide, index) => {
      console.log(`--- Slide ${index + 1} ---`);
      console.log(`Title: ${slide.title}`);
      console.log(`Content length: ${slide.content.length} chars`);
      console.log(`Images: ${slide.images ? slide.images.length : 0}`);
      console.log(`Speaker note length: ${slide.speakerNote.length} chars`);
      console.log('');
    });
    
    // Check progress tracker
    const progress = progressTracker.get(sessionId);
    console.log('Final progress:', progress);
    
  } catch (error) {
    console.error('✗ Analysis failed:', error.message);
    console.error(error.stack);
  }
}

testAnalysis().catch(console.error);
