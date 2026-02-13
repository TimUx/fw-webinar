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
    
    // Check if file is in uploads directory
    if (!inputPath.startsWith(uploadsDir)) {
      throw new Error(`File must be in uploads directory for OnlyOffice access: ${inputPath}`);
    }
    
    // Create the URL path relative to uploads
    const relativePath = path.relative(uploadsDir, inputPath);
    const fileUrl = `${BACKEND_URL}/uploads/${relativePath.replace(/\\/g, '/')}`;
    
    console.log(`OnlyOffice conversion: ${fileUrl} -> ${outputFormat}`);
    
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
      throw new Error(`OnlyOffice conversion error: ${response.data.error}`);
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
  convertDocument
};
