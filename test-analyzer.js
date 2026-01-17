const { analyzePresentation, progressTracker } = require('./backend/services/slideAnalyzer');
const path = require('path');
const fs = require('fs');

// Create a minimal PPTX test file (actually, let's just test with a text file for now)
async function testAnalyzer() {
  console.log('Testing slide analyzer...');
  
  const sessionId = 'test-' + Date.now();
  const webinarId = 'webinar-test';
  
  // Create test directory
  const testDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  console.log('✓ Test setup complete');
  console.log('Note: Need actual PPTX/PDF file for full test');
  console.log('Progress tracker initialized:', typeof progressTracker);
}

testAnalyzer().catch(console.error);
