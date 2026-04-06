const { app, Tray, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Disable Hardware Acceleration for background-only app
app.disableHardwareAcceleration();

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

let tray = null;
let serverInstance = null;

app.on('ready', () => {
  // Try to start the express server
  try {
    serverInstance = require('./server');
    console.log("Server started in background on windowless electron");
  } catch (error) {
    console.error("Failed to start server:", error);
  }

  // Set up Tray Icon
  const iconPath = path.join(__dirname, 'assets', 'favicon.ico');
  const fallbackIconPath = path.join(__dirname, 'assets', 'favicon.png');
  
  // Use ico if available, else png
  let selectedIcon = fs.existsSync(iconPath) ? iconPath : fallbackIconPath;
  try {
    tray = new Tray(selectedIcon);
    tray.setToolTip('StreamFlow Server (Running in Background)');
    
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: 'Open StreamFlow in Browser', 
        click: () => {
          shell.openExternal('http://localhost:7676');
        } 
      },
      { type: 'separator' },
      { 
        label: 'Quit StreamFlow', 
        click: () => {
          if (serverInstance) {
            serverInstance.close();
          }
          app.quit();
        } 
      }
    ]);
    
    tray.setContextMenu(contextMenu);
    
    // Double click tray icon to open browser
    tray.on('double-click', () => {
      shell.openExternal('http://localhost:7676');
    });

    // Auto-open browser on first startup or explicitly
    shell.openExternal('http://localhost:7676');
    
  } catch (error) {
    console.error("Failed to generate tray icon:", error);
  }

  // Set the app to open at login (Auto-start)
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe')
  });
});

// Since this is a tray app, we don't want it to quit if there's no windows.
app.on('window-all-closed', () => {
  // Do nothing
});
