import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronApi, ProgressPayload, StartUpdateInput } from '../shared/types'

const electronApi: ElectronApi = {
  chooseTargetDirectory: () => ipcRenderer.invoke('choose-target-directory'),
  startUpdate: (input: StartUpdateInput) => ipcRenderer.invoke('start-update', input),
  onProgress: (listener: (payload: ProgressPayload) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: ProgressPayload) => listener(payload)
    ipcRenderer.on('update-progress', wrapped)
    return () => ipcRenderer.removeListener('update-progress', wrapped)
  }
}

contextBridge.exposeInMainWorld('electronApi', electronApi)
