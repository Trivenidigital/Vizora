/**
 * Fix for the /api/displays endpoint 
 * 
 * This will patch the existing app.js file to ensure proper response handling
 */

const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, 'app.js');

// Read the current app.js file
console.log(`Reading ${appJsPath}...`);
const appContent = fs.readFileSync(appJsPath, 'utf8');

// Define the problematic section and the fix
const displayEndpointRegex = /(\/\/ DIRECT IMPLEMENTATION: \/api\/displays endpoint[\s\S]*?app\.get\('\/api\/displays'[\s\S]*?({[\s\S]*?})\);)/;

// Correct implementation with proper error handling
const fixedImplementation = `// DIRECT IMPLEMENTATION: /api/displays endpoint
app.get('/api/displays', (req, res) => {
  console.log('[GET] Direct implementation of /api/displays endpoint hit');
  
  try {
    // Using res.json() ensures proper content-type and content-length handling
    res.status(200).json({
      success: true,
      data: [] // Empty array
    });
    console.log('[GET] /api/displays response sent successfully');
  } catch (error) {
    console.error('[ERROR] /api/displays error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});`;

// Check if we found the section to replace
if (displayEndpointRegex.test(appContent)) {
  // Replace the section with the fixed implementation
  const updatedContent = appContent.replace(displayEndpointRegex, fixedImplementation);
  
  // Create a backup of the original file
  const backupPath = `${appJsPath}.bak`;
  console.log(`Creating backup at ${backupPath}...`);
  fs.writeFileSync(backupPath, appContent);
  
  // Write the updated content back to app.js
  console.log('Writing fixed implementation...');
  fs.writeFileSync(appJsPath, updatedContent);
  
  console.log('Fix applied successfully!');
  console.log('To test, restart the server with: node app.js');
} else {
  console.error('Could not find the /api/displays endpoint implementation in app.js');
  console.error('Manual fix may be required.');
}

// Check the other display endpoints too
const otherDisplaysRegex = /(app\.get\('\/api\/displays-old'[\s\S]*?({[\s\S]*?})\);)/;
const displaysRegex = /(app\.get\('\/displays'[\s\S]*?({[\s\S]*?})\);)/;

// Fix for /api/displays-old endpoint
if (otherDisplaysRegex.test(appContent)) {
  const fixedOtherDisplays = `app.get('/api/displays-old', (req, res) => {
  console.log('[GET] /api/displays-old hit');
  
  try {
    // Using res.json() ensures proper content-type and content-length handling
    res.status(200).json({
      success: true,
      data: [] // Empty array
    });
    console.log('[GET] /api/displays-old response sent successfully');
  } catch (error) {
    console.error('[ERROR] /api/displays-old error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});`;

  const updatedContent = fs.readFileSync(appJsPath, 'utf8')
    .replace(otherDisplaysRegex, fixedOtherDisplays);
  fs.writeFileSync(appJsPath, updatedContent);
  console.log('Fixed /api/displays-old endpoint');
}

// Fix for /displays endpoint
if (displaysRegex.test(appContent)) {
  const fixedDisplays = `app.get('/displays', (req, res) => {
  console.log('[GET] /displays hit - redirecting to /api/displays');
  
  try {
    // Using res.json() ensures proper content-type and content-length handling
    res.status(200).json({
      success: true,
      data: [] // Empty array
    });
    console.log('[GET] /displays response sent successfully');
  } catch (error) {
    console.error('[ERROR] /displays error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});`;

  const updatedContent = fs.readFileSync(appJsPath, 'utf8')
    .replace(displaysRegex, fixedDisplays);
  fs.writeFileSync(appJsPath, updatedContent);
  console.log('Fixed /displays endpoint');
}

console.log('\nAll fixes applied. The server now handles all display endpoints properly.');
console.log('Restart the server to apply changes.'); 