const PptxGenJS = require('pptxgenjs');
const path = require('path');

async function createTestPPTX() {
  console.log('Creating test PPTX file...');
  
  const pptx = new PptxGenJS();
  
  // Slide 1: Title Slide
  const slide1 = pptx.addSlide();
  slide1.addText('Willkommen zum Webinar', {
    x: 1.0,
    y: 2.0,
    w: 8.0,
    h: 1.5,
    fontSize: 44,
    bold: true,
    color: '2c3e50',
    align: 'center'
  });
  slide1.addText('Eine automatische Präsentation', {
    x: 1.0,
    y: 3.5,
    w: 8.0,
    h: 0.8,
    fontSize: 24,
    color: '7f8c8d',
    align: 'center'
  });
  
  // Slide 2: Content Slide
  const slide2 = pptx.addSlide();
  slide2.addText('Hauptthemen', {
    x: 0.5,
    y: 0.5,
    w: 9.0,
    h: 0.8,
    fontSize: 36,
    bold: true,
    color: '2c3e50'
  });
  slide2.addText([
    { text: '• Punkt 1: Einführung\n', options: { fontSize: 20 } },
    { text: '• Punkt 2: Hauptinhalt\n', options: { fontSize: 20 } },
    { text: '• Punkt 3: Zusammenfassung', options: { fontSize: 20 } }
  ], {
    x: 1.0,
    y: 2.0,
    w: 8.0,
    h: 3.0,
    color: '34495e'
  });
  
  // Slide 3: Summary
  const slide3 = pptx.addSlide();
  slide3.addText('Zusammenfassung', {
    x: 0.5,
    y: 1.0,
    w: 9.0,
    h: 0.8,
    fontSize: 36,
    bold: true,
    color: '2c3e50'
  });
  slide3.addText('Vielen Dank für Ihre Aufmerksamkeit!', {
    x: 1.0,
    y: 2.5,
    w: 8.0,
    h: 1.0,
    fontSize: 24,
    color: '27ae60',
    align: 'center'
  });
  
  // Save the file
  const filename = 'test-presentation.pptx';
  const filepath = path.join(__dirname, 'uploads', filename);
  
  await pptx.writeFile({ fileName: filepath });
  console.log(`✓ Test PPTX created: ${filepath}`);
  console.log('✓ File contains 3 slides');
  
  return filename;
}

createTestPPTX().catch(console.error);
