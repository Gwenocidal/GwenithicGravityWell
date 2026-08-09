const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gravityAPI", {
  getAppInfo: () => ipcRenderer.invoke("app:get-info"),
  setWindowMode: (mode) => ipcRenderer.send("window:set-mode", mode),
  quit: () => ipcRenderer.send("app:quit"),
  openCaptureFolder: () => ipcRenderer.invoke("capture:open-folder"),
  beginCapture: (spec) => ipcRenderer.invoke("capture:begin", spec),
  writeCaptureTile: (payload) => ipcRenderer.invoke("capture:write-tile", payload),
  finishCapture: (payload) => ipcRenderer.invoke("capture:finish", payload),
  cancelCapture: (jobId) => ipcRenderer.invoke("capture:cancel", jobId),
  saveUniverse: (record) => ipcRenderer.invoke("universe:save", record),
  loadUniverse: () => ipcRenderer.invoke("universe:load"),
  chooseRecipe: () => ipcRenderer.invoke("recipe:choose"),
  reportReady: (details) => ipcRenderer.send("renderer:ready", details),
  reportFailure: (message) => ipcRenderer.send("renderer:failure", String(message)),
});
