const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('MSDesktop', {
  quit: () => ipcRenderer.send('ms-quit'),
  // true only when launched with --dev (forwarded as --ms-dev via additionalArguments);
  // enables the hidden debug console
  dev: process.argv.includes('--ms-dev') || process.argv.includes('--dev'),
});
