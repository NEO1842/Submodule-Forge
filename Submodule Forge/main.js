const { app, BrowserWindow } = require('electron');
const path = require('path');

// 既存の server.js を読み込んでサーバーを起動します
// server.js は非同期関数(IIFE)で自動的に起動する構成になっているため、require するだけで動作します
require('./server.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    title: 'Submodule Forge',
    webPreferences: {
      // セキュリティのため、レンダラープロセスでの Node.js 統合は無効にします
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // server.js がデフォルトでリッスンするポート 3000 を読み込みます
  win.loadURL('http://localhost:3000');
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