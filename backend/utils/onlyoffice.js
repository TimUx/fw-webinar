const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const crypto = require('crypto');

const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL || 'http://onlyoffice';
const BACKEND_URL = process.env.BACKEND_URL || 'http://webinar-backend:3000';

/**
 * Check if OnlyOffice DocumentServer is available
 */
async function isOnlyOfficeAvailable() {
  try {
    const response = await axios.get(`${ONLYOFFICE_URL}/healthcheck`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    console.error('OnlyOffice health check failed:', error.message);
    return false;
  }
}

/**
 * Test if a URL is accessible from this container
 * This helps diagnose network connectivity issues
 */
async function testUrlAccessibility(url) {
  try {
    const response = await axios.head(url, { 
      timeout: 5000,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 500 // Accept any non-server-error
    });
    return { accessible: true, status: response.status };
  } catch (error) {
    return { 
      accessible: false, 
      error: error.message,
      code: error.code 
    };
  }
}

/**
 * Convert document using OnlyOffice DocumentServer conversion API
 * @param {string} inputPath - Path to input file (PPTX, PDF, etc.)
 * @param {string} outputPath - Path where converted file should be saved
 * @param {string} outputFormat - Output format (pdf, png, etc.)
 * @returns {Promise<void>}
 */
async function convertDocument(inputPath, outputPath, outputFormat = 'pdf') {
  const available = await isOnlyOfficeAvailable();
  if (!available) {
    throw new Error('OnlyOffice DocumentServer ist nicht verfügbar. Bitte stellen Sie sicher, dass der OnlyOffice-Container läuft.');
  }

  try {
    // Get the file URL that OnlyOffice can access
    // Files in /app/uploads are served at http://webinar-backend:3000/uploads/
    const fileName = path.basename(inputPath);
    const uploadsDir = process.env.UPLOADS_DIR || '/app/uploads';
    
    // Normalize paths to prevent path traversal attacks
    const normalizedInputPath = path.normalize(path.resolve(inputPath));
    const normalizedUploadsDir = path.normalize(path.resolve(uploadsDir));
    
    // Check if file is in uploads directory (after normalization and resolution)
    if (!normalizedInputPath.startsWith(normalizedUploadsDir + path.sep)) {
      throw new Error(`File must be in uploads directory for OnlyOffice access: ${inputPath}`);
    }
    
    // Create the URL path relative to uploads
    const relativePath = path.relative(normalizedUploadsDir, normalizedInputPath);
    
    // Security: Prevent path traversal - after normalization, relative path should never go up
    if (relativePath.startsWith('..')) {
      throw new Error(`Invalid file path: path traversal detected in ${relativePath}`);
    }
    
    // Encode the path properly for URL
    // Split by system separator, encode each part, join with URL separator
    const pathParts = relativePath.split(path.sep).filter(part => part.length > 0);
    const encodedPath = pathParts.map(encodeURIComponent).join('/');
    const fileUrl = `${BACKEND_URL}/uploads/${encodedPath}`;
    
    console.log(`OnlyOffice conversion: ${fileUrl} -> ${outputFormat}`);
    
    // Test if the file URL is accessible from this container
    // This helps diagnose issues where OnlyOffice cannot reach the backend
    const urlTest = await testUrlAccessibility(fileUrl);
    if (!urlTest.accessible) {
      console.error(`⚠️  File URL is not accessible from backend container:`, urlTest);
      console.error(`   This suggests OnlyOffice will also not be able to download the file.`);
      console.error(`   URL: ${fileUrl}`);
      console.error(`   Error: ${urlTest.error}`);
      console.error(`   BACKEND_URL environment variable: ${BACKEND_URL}`);
      console.error(`   Make sure the file exists and is accessible via HTTP.`);
    } else {
      console.log(`✓ File URL is accessible (HTTP ${urlTest.status})`);
    }
    
    // Build conversion request according to OnlyOffice API spec
    const conversionUrl = `${ONLYOFFICE_URL}/ConvertService.ashx`;
    const requestBody = {
      async: false,
      filetype: getFileExtension(inputPath),
      key: await generateKey(inputPath),
      outputtype: outputFormat,
      title: fileName,
      url: fileUrl
    };
    
    // Make conversion request with JSON body
    const response = await axios.post(
      conversionUrl,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 120000, // 2 minutes timeout
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    console.log('OnlyOffice response:', JSON.stringify(response.data));
    
    if (response.data.error) {
      const errorCode = response.data.error;
      let errorMessage = `OnlyOffice conversion error: ${errorCode}`;
      let troubleshooting = [];
      
      // Provide specific guidance based on error code
      if (errorCode === -4) {
        errorMessage = 'OnlyOffice cannot download the source file (error -4)';
        troubleshooting = [
          `The file URL provided to OnlyOffice: ${fileUrl}`,
          `OnlyOffice container needs to be able to reach this URL over HTTP`,
          `Current BACKEND_URL: ${BACKEND_URL}`,
          `Make sure:`,
          `  1. The BACKEND_URL environment variable matches your backend container name`,
          `  2. Both containers are on the same Docker network`,
          `  3. The file exists and is readable: ${inputPath}`,
          `  4. Check docker-compose.yml container_name matches BACKEND_URL hostname`,
          `Example: If container_name is "fw-webinar-backend", BACKEND_URL should be "http://fw-webinar-backend:3000"`
        ];
      } else if (errorCode === -3) {
        errorMessage = 'OnlyOffice conversion error (error -3)';
        troubleshooting = ['The file format may not be supported or the file is corrupted'];
      } else if (errorCode === -2) {
        errorMessage = 'OnlyOffice conversion timeout (error -2)';
        troubleshooting = ['The file may be too large or complex to convert'];
      } else if (errorCode === -1) {
        errorMessage = 'OnlyOffice unknown conversion error (error -1)';
        troubleshooting = ['Check OnlyOffice DocumentServer logs for more details'];
      }
      
      console.error(`\n❌ ${errorMessage}`);
      if (troubleshooting.length > 0) {
        console.error('\n🔧 Troubleshooting:');
        troubleshooting.forEach(tip => console.error(`   ${tip}`));
      }
      console.error('');
      
      throw new Error(errorMessage);
    }
    
    // Download converted file
    const convertedFileUrl = response.data.fileUrl || response.data.uri;
    if (!convertedFileUrl) {
      throw new Error('OnlyOffice did not return a file URL');
    }
    
    // Handle relative URLs
    const downloadUrl = convertedFileUrl.startsWith('http') 
      ? convertedFileUrl 
      : `${ONLYOFFICE_URL}${convertedFileUrl}`;
    
    console.log(`Downloading converted file from: ${downloadUrl}`);
    
    const fileResponse = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 60000
    });
    
    // Save converted file
    await fs.writeFile(outputPath, fileResponse.data);
    
    console.log(`Successfully converted ${inputPath} to ${outputPath} using OnlyOffice`);
  } catch (error) {
    console.error('OnlyOffice conversion error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw new Error(`OnlyOffice konnte die Datei nicht konvertieren: ${error.message}`);
  }
}

/**
 * Get file extension without dot
 */
function getFileExtension(filePath) {
  return path.extname(filePath).slice(1).toLowerCase();
}

/**
 * Get MIME content type for file
 */
function getContentType(filePath) {
  const ext = getFileExtension(filePath);
  const types = {
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'ppt': 'application/vnd.ms-powerpoint',
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel'
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * Generate a unique key for the conversion request
 */
async function generateKey(filePath) {
  const stats = await fs.stat(filePath);
  const data = `${filePath}-${stats.size}-${stats.mtimeMs}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

module.exports = {
  isOnlyOfficeAvailable,
  convertDocument,
  testUrlAccessibility
};
