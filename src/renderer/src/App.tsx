import { useEffect, useMemo, useState } from 'react'
import type { ProgressPayload, UpdateResult } from '../../shared/types'

const sourceText = '固定蓝奏源：BongoCat_Mod（提取码已内置）'

export default function App() {
  const [targetDirectory, setTargetDirectory] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ProgressPayload>({ stage: 'idle', message: '请选择要替换的目录。' })
  const [logs, setLogs] = useState<string[]>(['等待开始'])
  const [result, setResult] = useState<UpdateResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!window.electronApi) {
      setErrorMessage('预加载脚本未注入，Electron API 不可用。请重启开发进程后再试。')
      setLogs((previous) => [...previous, '预加载脚本未注入'])
      return
    }

    return window.electronApi.onProgress((payload) => {
      setProgress(payload)
      setLogs((previous) => [...previous, payload.message])
    })
  }, [])

  const canStart = useMemo(() => !busy && targetDirectory.trim().length > 0, [busy, targetDirectory])

  async function handleChooseDirectory() {
    if (!window.electronApi) {
      setErrorMessage('Electron API 不可用。')
      return
    }

    const result = await window.electronApi.chooseTargetDirectory()
    if (!result.canceled && result.path) {
      setTargetDirectory(result.path)
    }
  }

  async function handleStart() {
    if (!window.electronApi) {
      setErrorMessage('Electron API 不可用。')
      return
    }

    setBusy(true)
    setResult(null)
    setErrorMessage('')
    setLogs(['开始执行更新'])

    try {
      const updateResult = await window.electronApi.startUpdate({ targetDirectory })
      setResult(updateResult)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '更新失败。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="card">
        <h1>Cat Updater</h1>
        <p>{sourceText}</p>

        <div className="section">
          <span className="label">目标目录</span>
          <div className="path-row">
            <input className="path-input" readOnly value={targetDirectory} placeholder="请选择要替换的文件夹目录" />
            <button className="button secondary" disabled={busy} onClick={handleChooseDirectory}>
              选择目录
            </button>
          </div>
        </div>

        <div className="section">
          <button className="button" disabled={!canStart} onClick={handleStart}>
            {busy ? '执行中...' : '下载并替换'}
          </button>
        </div>

        <div className="section">
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress.percent ?? 0}%` }} />
          </div>
          <div className="status">{progress.message}</div>
        </div>

        <div className="logs">
          {logs.map((item, index) => (
            <div className="log-item" key={`${item}-${index}`}>
              {item}
            </div>
          ))}
        </div>

        {result ? (
          <div className="result success">
            已完成：覆盖 {result.replacedFiles} 个文件，新增 {result.addedFiles} 个文件。<br />
            目标目录：{result.targetDirectory}
          </div>
        ) : null}

        {errorMessage ? <div className="result error">{errorMessage}</div> : null}
      </div>
    </div>
  )
}
