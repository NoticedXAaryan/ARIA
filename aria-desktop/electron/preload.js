const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ariaDesktop", {
  expandPanel: () => ipcRenderer.send("panel:expand"),
  collapsePanel: () => ipcRenderer.send("panel:collapse"),
  togglePanel: (isExpanded) => ipcRenderer.send("panel:toggle", isExpanded),
  selectFolder: () => ipcRenderer.invoke("dialog:selectFolder"),
  onNewNudge: (cb) => ipcRenderer.on("nudge:new", (_event, payload) => cb(payload)),
  // Keep older popup methods just in case they are still used temporarily
  onPopupData: (cb) => ipcRenderer.on("popup-data", (_event, payload) => cb(payload)),
  showPopup: (payload) => ipcRenderer.send("show-popup", payload),
  
  // Toast specific
  showToast: (nudge) => ipcRenderer.send("toast:show", nudge),
  hideToast: () => ipcRenderer.send("toast:hide"),
  resizeToast: (height) => ipcRenderer.send("toast:resize", height),
  onToastData: (cb) => {
    ipcRenderer.removeAllListeners("toast:data");
    ipcRenderer.on("toast:data", (_event, payload) => cb(payload));
  }
});
