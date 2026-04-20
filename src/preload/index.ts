import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronApi, ProgressPayload, StartUpdateInput } from '../shared/types'

const electronApi: ElectronApi = {
  chooseTargetDirectory: () => ipcRenderer.invoke('choose-target-directory'),
  startUpdate: (input: StartUpdateInput) => ipcRenderer.invoke('start-update', input),
  onProgress: (listener: (payload: ProgressPayload) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: ProgressPayload) => listener(payload)
    ipcRenderer.on('update-progress', wrapped)
    return () => ipcRenderer.removeListener('update-progress', wrapped)
  },
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  getSavedDirectory: () => ipcRenderer.invoke('get-saved-directory'),
  saveDirectory: (dir: string) => ipcRenderer.invoke('save-directory', dir)
}

contextBridge.exposeInMainWorld('electronApi', electronApi)
