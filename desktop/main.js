const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULT_SERVER_URL = process.env.CAD_SERVER_URL || 'http://127.0.0.1:3030';

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function readConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    const config = { serverUrl: DEFAULT_SERVER_URL };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return config;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
      serverUrl: parsed.serverUrl || DEFAULT_SERVER_URL,
    };
  } catch (_) {
    return { serverUrl: DEFAULT_SERVER_URL };
  }
}

function showLoadError(win, serverUrl) {
  const configPath = getConfigPath().replace(/\\/g, '/');
  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>VKC CAD - Connection Failed</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 32px; background: #0c1118; color: #e6edf3; }
    code { background: #161b22; padding: 2px 6px; border-radius: 4px; }
    h1 { margin-top: 0; }
    .card { background: #111827; border: 1px solid #2c3a4e; border-radius: 8px; padding: 18px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unable to reach CAD server</h1>
    <p>Tried URL: <code>${serverUrl}</code></p>
    <p>Update the desktop config file and restart the app:</p>
    <p><code>${configPath}</code></p>
  </div>
</body>
</html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function createWindow() {
  const config = readConfig();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.webContents.on('did-fail-load', () => {
    showLoadError(win, config.serverUrl);
  });

  win.loadURL(config.serverUrl).catch(() => {
    showLoadError(win, config.serverUrl);
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
