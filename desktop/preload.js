const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('MSDesktop', {
  quit: () => ipcRenderer.send('ms-quit'),
});
