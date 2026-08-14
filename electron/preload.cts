import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("leetcodeDraw", {
  getState: () => ipcRenderer.invoke("app-state:get"),
  setState: (value: unknown) => ipcRenderer.invoke("app-state:set", value),
  openLeetCode: (url: string) => ipcRenderer.invoke("link:open", url),
  chooseImportFile: () => ipcRenderer.invoke("questions:choose-import"),
  saveExampleFile: () => ipcRenderer.invoke("questions:save-example"),
  copyText: (value: string) => ipcRenderer.invoke("clipboard:write", value),
  setAppearance: (value: "system" | "light" | "dark") => ipcRenderer.invoke("appearance:set-theme", value)
});
