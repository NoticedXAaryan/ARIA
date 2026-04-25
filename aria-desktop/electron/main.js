const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require("electron");
const path = require("path");

let tray;
let dashboardWindow;
let popupWindow;

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

function createPopup() {
  const primary = screen.getPrimaryDisplay().workAreaSize;
  popupWindow = new BrowserWindow({
    width: 360,
    height: 120,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    x: primary.width - 376,
    y: primary.height - 136,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });
  popupWindow.loadURL("http://localhost:5173");
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
  createPopup();
  createTray();
});

ipcMain.on("show-popup", (_event, payload) => {
  popupWindow.show();
  popupWindow.webContents.send("popup-data", payload);
});
