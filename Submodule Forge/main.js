const { app, BrowserWindow } = require('electron');

// 既存の server.js を読み込んでサーバーを起動します
// server.js は非同期関数(IIFE)で自動的に起動する構成になっているため、require するだけで動作します
require('./server.js');

const APP_ORIGIN = 'http://127.0.0.1:3000';

function isTrustedAppUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin === APP_ORIGIN;
  } catch (error) {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    title: 'Submodule Forge',
    webPreferences: {
      // セキュリティのため、レンダラープロセスでの Node.js 統合は無効にします
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedAppUrl(url)) {
      event.preventDefault();
    }
  });
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  // server.js がデフォルトでリッスンするポート 3000 を読み込みます
  const startUrl = APP_ORIGIN;
  
  // サーバーが立ち上がるまで少し時間がかかる場合があるため、読み込みに失敗したらリトライする
  win.loadURL(startUrl).catch(err => {
    console.log('Server not ready, retrying in 1s...');
    setTimeout(() => {
      win.loadURL(startUrl);
    }, 1000);
  });

  // win.webContents.openDevTools(); // 開発時にデバッグが必要な場合はコメントアウトを外す
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
