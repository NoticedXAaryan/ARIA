const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, dialog } = require("electron");
const path = require("path");

let tray;
let dashboardWindow;
let panelWindow;

function createDashboard() {
  dashboardWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });
  dashboardWindow.loadURL("http://localhost:5173");
}

function createPanel() {
  const primary = screen.getPrimaryDisplay().workAreaSize;
  panelWindow = new BrowserWindow({
    width: 52,
    height: primary.height,
    x: primary.width - 52,
    y: 0,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });
  panelWindow.loadURL("http://localhost:5173/#/panel");
}

function createTray() {
  const fallbackIcon = nativeImage.createEmpty();
  tray = new Tray(fallbackIcon);
  const menu = Menu.buildFromTemplate([
    { label: "Open Dashboard", click: () => dashboardWindow.show() },
    { label: "Pause for 1 hour", click: () => {} },
    { label: "Quit ARIA", click: () => app.quit() }
  ]);
  tray.setToolTip("ARIA");
  tray.setContextMenu(menu);
  tray.on("click", () => dashboardWindow.show());
}

app.whenReady().then(() => {
  createDashboard();
  createPanel();
  createTray();
});

ipcMain.on("panel:expand", () => {
  const primary = screen.getPrimaryDisplay().workAreaSize;
  panelWindow.setBounds({ x: primary.width - 300, y: 0, width: 300, height: primary.height });
});

ipcMain.on("panel:collapse", () => {
  const primary = screen.getPrimaryDisplay().workAreaSize;
  panelWindow.setBounds({ x: primary.width - 52, y: 0, width: 52, height: primary.height });
});

ipcMain.on("panel:toggle", (_event, isExpanded) => {
  const primary = screen.getPrimaryDisplay().workAreaSize;
  if (isExpanded) {
    panelWindow.setBounds({ x: primary.width - 300, y: 0, width: 300, height: primary.height });
  } else {
    panelWindow.setBounds({ x: primary.width - 52, y: 0, width: 52, height: primary.height });
  }
});

ipcMain.on("nudge:new", (_event, payload) => {
  panelWindow.webContents.send("nudge:new", payload);
});

ipcMain.handle("dialog:selectFolder", async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});
