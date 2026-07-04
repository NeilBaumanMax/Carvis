import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("carvis", {
  submitCommand(commandText: string, requestId?: string): void {
    ipcRenderer.invoke("shell:submitCommand", commandText, requestId);
  },

  getState(): Promise<unknown> {
    return ipcRenderer.invoke("shell:getState");
  },

  onStateUpdated(callback: (state: unknown) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown) => {
      callback(state);
    };
    ipcRenderer.on("shell:stateUpdated", handler);
    return () => {
      ipcRenderer.removeListener("shell:stateUpdated", handler);
    };
  },

  openOutput(filePath: string): void {
    ipcRenderer.invoke("shell:openOutput", filePath);
  },
});
