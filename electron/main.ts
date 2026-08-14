import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, nativeTheme, shell } from "electron";
import Store from "electron-store";
import { copyFile, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new Store<{ appState?: unknown }>({ name: "leetcode-draw-state" });
type AppearanceMode = "system" | "light" | "dark";

let appearanceMode: AppearanceMode = "light";

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === "system" || value === "light" || value === "dark";
}

function restoredAppearanceMode(): AppearanceMode {
  const saved = store.get("appState", null);
  if (!saved || typeof saved !== "object") return "light";
  const candidate = saved as { theme?: unknown };
  return isAppearanceMode(candidate.theme) ? candidate.theme : "light";
}

function iconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icon.png");
  }
  return path.join(__dirname, "../resources", "icon.png");
}

function exampleLibraryPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "examples", "leetcode-draw-example.json");
  }
  return path.join(__dirname, "../resources/examples/leetcode-draw-example.json");
}

function syncApplicationIcon() {
  const icon = nativeImage.createFromPath(iconPath());
  if (icon.isEmpty()) return;

  if (process.platform === "darwin") {
    app.dock?.setIcon(icon);
  }
  BrowserWindow.getAllWindows().forEach((window) => window.setIcon(icon));
}

function applyAppearanceMode(value: AppearanceMode) {
  appearanceMode = value;
  nativeTheme.themeSource = value;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 940,
    minHeight: 660,
    backgroundColor: "#111722",
    title: "LeetCode Draw",
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.removeMenu();

  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://leetcode.cn/")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  syncApplicationIcon();
}

app.whenReady().then(() => {
  applyAppearanceMode(restoredAppearanceMode());
  ipcMain.handle("app-state:get", () => store.get("appState", null));
  ipcMain.handle("app-state:set", (_event, value: unknown) => {
    store.set("appState", value);
    return true;
  });
  ipcMain.handle("link:open", (_event, url: string) => {
    if (url.startsWith("https://leetcode.cn/")) {
      void shell.openExternal(url);
      return true;
    }
    return false;
  });
  ipcMain.handle("questions:choose-import", async () => {
    const result = await dialog.showOpenDialog({
      title: "导入题库",
      buttonLabel: "导入",
      properties: ["openFile"],
      filters: [
        { name: "LeetCode Draw 题库文件", extensions: ["json"] }
      ]
    });

    if (result.canceled || !result.filePaths[0]) return null;

    const filePath = result.filePaths[0];
    const metadata = await stat(filePath);
    if (metadata.size > 2 * 1024 * 1024) {
      return { error: "导入文件不能超过 2 MB" };
    }

    return {
      name: path.basename(filePath),
      content: await readFile(filePath, "utf8")
    };
  });
  ipcMain.handle("questions:save-example", async () => {
    const result = await dialog.showSaveDialog({
      title: "保存三题示例题库",
      defaultPath: "LeetCode Draw 三题示例题库.json",
      buttonLabel: "保存示例",
      filters: [
        { name: "LeetCode Draw 题库文件", extensions: ["json"] }
      ]
    });

    if (result.canceled || !result.filePath) return null;

    try {
      await copyFile(exampleLibraryPath(), result.filePath);
      return { name: path.basename(result.filePath) };
    } catch {
      return { error: "示例文件保存失败，请稍后重试" };
    }
  });
  ipcMain.handle("clipboard:write", (_event, value: unknown) => {
    if (typeof value !== "string" || value.length > 20_000) return false;
    clipboard.writeText(value);
    return true;
  });
  ipcMain.handle("appearance:set-theme", (_event, value: unknown) => {
    if (!isAppearanceMode(value)) return false;
    applyAppearanceMode(value);
    return true;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
