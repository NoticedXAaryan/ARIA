const { app, BrowserWindow } = require("electron");
const path = require("path");

let mainWindow;
const RENDERER_URL = process.env.ELECTRON_RENDERER_URL || "http://localhost:5173";

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 700,
    frame: false,
    alwaysOnTop: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on("did-fail-load", () => {
    const html = `
      <html>
        <body style="margin:0;display:grid;place-items:center;background:#0a0a0a;color:#fff;font-family:Arial,sans-serif;">
          <div style="text-align:center;max-width:420px;padding:24px;">
            <h2 style="margin:0 0 10px;">ARIA Desktop</h2>
            <p style="margin:0 0 12px;color:#a3a3a3;">Renderer failed to load.</p>
            <p style="margin:0;color:#a3a3a3;font-size:13px;">Start the UI dev server and retry. Expected URL: ${RENDERER_URL}</p>
          </div>
        </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });

  mainWindow.loadURL(RENDERER_URL);
  mainWindow.once("ready-to-show", () => mainWindow.show());
}

app.whenReady().then(createMainWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
