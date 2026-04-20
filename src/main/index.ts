import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProgressPayload, StartUpdateInput, UpdateResult } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function getConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

async function readConfig(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(getConfigPath(), 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

async function writeConfig(data: Record<string, string>): Promise<void> {
  const path = getConfigPath()
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, JSON.stringify(data))
}

function sendProgress(payload: ProgressPayload): void {
  mainWindow?.webContents.send('update-progress', payload)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 900,
    minWidth: 760,
    minHeight: 800,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())

ipcMain.handle('get-saved-directory', async () => {
  const config = await readConfig()
  return config.targetDirectory ?? ''
})

ipcMain.handle('save-directory', async (_event, dir: string) => {
  const config = await readConfig()
  await writeConfig({ ...config, targetDirectory: dir })
})

ipcMain.handle('choose-target-directory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || result.filePaths.length === 0) return { canceled: true }
  return { canceled: false, path: result.filePaths[0] }
})

ipcMain.handle('start-update', async (_event, input: StartUpdateInput): Promise<UpdateResult> => {
  if (!input.targetDirectory) throw new Error('请选择目标目录。')

  const temporaryRoot = await mkdtemp(join(app.getPath('temp'), 'cat-updater-'))
  const archivePath = join(temporaryRoot, 'package.rar')
  const extractDirectory = join(temporaryRoot, 'extracted')

  try {
    sendProgress({ stage: 'resolving', message: '正在解析蓝奏下载链接...' })
    const { resolveDownload } = await import('./services/lanzou')
    const resolved = await resolveDownload()

    sendProgress({ stage: 'downloading', message: `正在下载 ${resolved.fileName}...`, percent: 0 })
    const { downloadFile } = await import('./services/download')
    await downloadFile(resolved.downloadUrl, archivePath, (percent, message) => {
      sendProgress({ stage: 'downloading', message, percent: Number.isFinite(percent) ? percent : undefined })
    })

    sendProgress({ stage: 'extracting', message: '正在解压压缩包...' })
    const { extractArchive } = await import('./services/archive')
    const extractedRoot = await extractArchive(archivePath, extractDirectory)

    sendProgress({ stage: 'copying', message: '正在覆盖目标目录...', percent: 0 })
    const { copyIntoTarget } = await import('./services/fileOps')
    const summary = await copyIntoTarget(extractedRoot, input.targetDirectory, (percent, message) => {
      sendProgress({ stage: 'copying', message, percent })
    })

    sendProgress({
      stage: 'completed',
      message: `更新完成，覆盖 ${summary.replacedFiles} 个文件，新增 ${summary.addedFiles} 个文件。`,
      percent: 100
    })

    return { ...summary, targetDirectory: input.targetDirectory }
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新失败。'
    sendProgress({ stage: 'error', message })
    throw error
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
