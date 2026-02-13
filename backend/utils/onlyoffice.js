const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL || 'http://onlyoffice';
const BACKEND_URL = process.env.BACKEND_URL || 'http://webinar-backend:3000';

// OnlyOffice JWT Secret configuration
// Priority order:
// 1. ONLYOFFICE_JWT_SECRET from environment (custom secret)
// 2. Fall back to OnlyOffice default secret for compatibility
const ONLYOFFICE_DEFAULT_SECRET = 'verysecretstring'; // OnlyOffice's default JWT secret
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || ONLYOFFICE_DEFAULT_SECRET;

// Warn about JWT configuration at startup
if (!process.env.ONLYOFFICE_JWT_SECRET) {
  console.warn('⚠️  ONLYOFFICE_JWT_SECRET is not configured - using OnlyOffice default secret');
  console.warn('   ⚠️  SECURITY WARNING: The default secret "verysecretstring" is publicly known!');
  console.warn('   For production use, generate a secure JWT secret:');
  console.warn('   ');
  console.warn('   Option 1 - Generate new secret (RECOMMENDED):');
  console.warn('     1. Generate: openssl rand -hex 32');
  console.warn('     2. Add to .env: ONLYOFFICE_JWT_SECRET=<generated-secret>');
  console.warn('     3. Add to .env: ONLYOFFICE_JWT_SECRET=<same-secret> (for OnlyOffice container)');
  console.warn('     4. Restart: docker-compose restart');
  console.warn('   ');
  console.warn('   Option 2 - Use existing OnlyOffice secret:');
  console.warn('     1. Run: ./get-onlyoffice-jwt-secret.sh');
  console.warn('     2. Add to .env: ONLYOFFICE_JWT_SECRET=<retrieved-secret>');
  console.warn('     3. Restart: docker-compose restart backend');
  console.warn('');
} else if (process.env.ONLYOFFICE_JWT_SECRET === ONLYOFFICE_DEFAULT_SECRET) {
  console.warn('⚠️  SECURITY WARNING: Using OnlyOffice default JWT secret "verysecretstring"');
  console.warn('   This secret is publicly known and should not be used in production!');
  console.warn('   Generate a secure secret: openssl rand -hex 32');
  console.warn('   Then add to .env: ONLYOFFICE_JWT_SECRET=<generated-secret>');
  console.warn('');
}

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
      validateStatus: (status) => status >= 200 && status < 500 // Accept 2xx success and 4xx client errors (file exists but may need auth)
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
 * Generate JWT token for OnlyOffice API requests
 * OnlyOffice requires JWT tokens for conversion API even when JWT_ENABLED=false
 * @param {object} payload - The request payload to sign
 * @returns {string|null} JWT token or null if no secret configured
 */
function generateOnlyOfficeJWT(payload) {
  if (!ONLYOFFICE_JWT_SECRET) {
    return null;
  }
  
  try {
    // OnlyOffice expects the token to contain the payload in a specific format
    const token = jwt.sign(payload, ONLYOFFICE_JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '5m' // Token valid for 5 minutes
    });
    return token;
  } catch (error) {
    console.error('Failed to generate OnlyOffice JWT:', error.message);
    return null;
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
    
    // Generate JWT token for OnlyOffice request
    // OnlyOffice requires JWT even when JWT_ENABLED=false is set
    const token = generateOnlyOfficeJWT(requestBody);
    if (token) {
      // Add token to request body as per OnlyOffice API spec
      requestBody.token = token;
      if (process.env.ONLYOFFICE_JWT_SECRET) {
        console.log('✓ JWT token generated for OnlyOffice request (using configured secret)');
      } else {
        console.log('✓ JWT token generated for OnlyOffice request (using default secret)');
      }
    } else {
      // This should not happen since we have a fallback, but keep for safety
      console.error('⚠️  CRITICAL: Failed to generate OnlyOffice JWT token!');
      console.error('   OnlyOffice conversion will likely fail with error -4');
    }
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // OnlyOffice also accepts token in Authorization header (alternative method)
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Make conversion request with JSON body
    const response = await axios.post(
      conversionUrl,
      requestBody,
      {
        headers,
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
        const usingDefaultSecret = !process.env.ONLYOFFICE_JWT_SECRET || process.env.ONLYOFFICE_JWT_SECRET === ONLYOFFICE_DEFAULT_SECRET;
        troubleshooting = [
          `The file URL provided to OnlyOffice: ${fileUrl}`,
          `Current JWT configuration: ${usingDefaultSecret ? 'Using default secret (may be mismatched)' : 'Using configured secret'}`,
          ``,
          `Possible causes:`,
          `  1. OnlyOffice v9+ blocks private IPs: DocumentServer v9.x blocks requests to private IP addresses by default`,
          `     Solution: Ensure DS_ALLOW_PRIVATE_IP_ADDRESS=true is set in docker-compose.yml`,
          `     This allows OnlyOffice to access Docker internal network (172.x.x.x, 10.x.x.x, etc.)`,
          `  2. JWT Secret mismatch: OnlyOffice and backend are using different JWT secrets`,
          `     The backend is ${usingDefaultSecret ? 'using the default secret "verysecretstring"' : 'using a configured secret'}`,
          `     OnlyOffice container may have generated its own random secret if not configured`,
          `  3. Network connectivity: OnlyOffice cannot reach the backend URL`,
          `     Current BACKEND_URL: ${BACKEND_URL}`,
          `     Test: docker exec <onlyoffice-container> wget ${fileUrl}`,
          `  4. Container name mismatch: BACKEND_URL doesn't match actual container name`,
          `     Check: docker-compose ps to see actual container names`,
          ``,
          `Quick fixes:`,
          `  For private IP issue (v9+):`,
          `    1. Check docker-compose.yml has: DS_ALLOW_PRIVATE_IP_ADDRESS=true`,
          `    2. Restart OnlyOffice: docker-compose restart onlyoffice`,
          `  For JWT secret mismatch:`,
          `    Option A - Use same secret for both (RECOMMENDED):`,
          `      1. Generate secure secret: openssl rand -hex 32`,
          `      2. Add to .env: ONLYOFFICE_JWT_SECRET=<generated-secret>`,
          `      3. Restart all: docker-compose restart`,
          `    Option B - Use OnlyOffice's existing secret:`,
          `      1. Run: ./get-onlyoffice-jwt-secret.sh`,
          `      2. Add secret to .env: ONLYOFFICE_JWT_SECRET=<retrieved-secret>`,
          `      3. Restart backend: docker-compose restart backend`
        ];
      } else if (errorCode === -3) {
        errorMessage = 'OnlyOffice conversion error (error -3)';
        troubleshooting = [
          'The file format may not be supported by OnlyOffice',
          'The file may be corrupted or malformed',
          'Try opening the file in PowerPoint/Office to verify it\'s valid'
        ];
      } else if (errorCode === -2) {
        errorMessage = 'OnlyOffice conversion timeout (error -2)';
        troubleshooting = [
          'The file may be too large to convert within the timeout period',
          'The file may contain complex graphics or animations',
          'Try simplifying the presentation or splitting it into smaller files'
        ];
      } else if (errorCode === -1) {
        errorMessage = 'OnlyOffice unknown conversion error (error -1)';
        troubleshooting = [
          'Check OnlyOffice DocumentServer logs for more details: docker-compose logs onlyoffice',
          'The OnlyOffice service may be experiencing issues',
          'Try restarting the OnlyOffice container: docker-compose restart onlyoffice'
        ];
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
    
    // OnlyOffice returns URLs pointing to nginx (port 80) which blocks /cache/files access
    // We need to download from the internal docservice (port 8000) instead
    // Port 80 → nginx (access restricted for /cache/files)
    // Port 8000 → internal docservice (no nginx restrictions)
    
    let downloadUrl;
    if (convertedFileUrl.startsWith('http')) {
      // Replace the host with port 8000 to bypass nginx restrictions
      // Handle various container names: fw-webinar-onlyoffice, webinar-onlyoffice, onlyoffice
      downloadUrl = convertedFileUrl
        .replace('http://fw-webinar-onlyoffice/', 'http://fw-webinar-onlyoffice:8000/')
        .replace('http://webinar-onlyoffice/', 'http://webinar-onlyoffice:8000/')
        .replace('http://onlyoffice/', 'http://onlyoffice:8000/');
    } else {
      // Handle relative URLs
      downloadUrl = `${ONLYOFFICE_URL}:8000${convertedFileUrl}`;
    }
    
    console.log(`Downloading converted file from: ${downloadUrl}`);
    console.log(`(Using port 8000 to bypass nginx restrictions on /cache/files)`);
    
    const fileResponse = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      // No JWT token needed for internal docservice downloads
      // The URL already contains md5 and expires parameters for authentication
      validateStatus: (status) => status >= 200 && status < 300
    });
    
    // Save converted file
    await fs.writeFile(outputPath, fileResponse.data);
    
    console.log(`Successfully converted ${inputPath} to ${outputPath} using OnlyOffice`);
  } catch (error) {
    console.error('OnlyOffice conversion error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      
      // Special handling for 403 errors when downloading converted file
      if (error.response.status === 403 && error.config && error.config.url) {
        console.error('\n❌ 403 Forbidden Error when downloading converted file');
        console.error('   Download URL:', error.config.url);
        console.error('   This error occurs when:');
        console.error('   1. OnlyOffice nginx (port 80) blocks /cache/files access');
        console.error('      Solution: Backend should use port 8000 (internal docservice) - already implemented');
        console.error('   2. The URL signature (md5 parameter) has expired');
        console.error('      Solution: Increase conversion timeout or retry');
        console.error('   3. Network connectivity issue between containers');
        console.error('      Solution: Ensure containers are in the same Docker network');
        console.error('\n   If port 8000 is already being used, check:');
        console.error('   - Container network connectivity: docker exec backend ping onlyoffice');
        console.error('   - OnlyOffice logs: docker-compose logs onlyoffice');
      }
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
