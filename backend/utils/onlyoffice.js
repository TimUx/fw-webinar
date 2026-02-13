const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const crypto = require('crypto');

const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL || 'http://onlyoffice';

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
    // Read input file
    const fileBuffer = await fs.readFile(inputPath);
    const fileName = path.basename(inputPath);
    
    // Prepare form data
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: getContentType(inputPath)
    });
    
    // Build conversion request
    const conversionUrl = `${ONLYOFFICE_URL}/ConvertService.ashx`;
    const params = {
      async: false,
      filetype: getFileExtension(inputPath),
      outputtype: outputFormat,
      key: await generateKey(inputPath),
      title: fileName
    };
    
    // Add query parameters
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    // Make conversion request
    const response = await axios.post(
      `${conversionUrl}?${queryString}`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 120000, // 2 minutes timeout
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    if (response.data.error) {
      throw new Error(`OnlyOffice conversion error: ${response.data.error}`);
    }
    
    // Download converted file
    const fileUrl = response.data.fileUrl || response.data.uri;
    if (!fileUrl) {
      throw new Error('OnlyOffice did not return a file URL');
    }
    
    // Handle relative URLs
    const downloadUrl = fileUrl.startsWith('http') 
      ? fileUrl 
      : `${ONLYOFFICE_URL}${fileUrl}`;
    
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
