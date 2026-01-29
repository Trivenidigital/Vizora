const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  const preloadPath = path.join(__dirname, 'dist', 'electron', 'preload.js');
  
  console.log('========================================');
  console.log('TEST: Electron Preload Verification');
  console.log('========================================');
  console.log('Current directory:', __dirname);
  console.log('Preload path:', preloadPath);
  console.log('Preload exists:', fs.existsSync(preloadPath));
  console.log('========================================\n');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  // Load test HTML
  const testHtmlPath = path.join(__dirname, 'test-preload.html');
  mainWindow.loadFile(testHtmlPath);
  
  // Open dev tools
  mainWindow.webContents.openDevTools();

  // Listen for console messages from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER] ${message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
