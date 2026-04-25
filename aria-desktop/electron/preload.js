const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ariaDesktop", {
  onPopupData: (cb) => ipcRenderer.on("popup-data", (_event, payload) => cb(payload)),
  showPopup: (payload) => ipcRenderer.send("show-popup", payload)
});
