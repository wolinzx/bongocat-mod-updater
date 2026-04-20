import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProgressPayload, UpdateResult } from '../../shared/types'

export default function App() {
  const [targetDirectory, setTargetDirectory] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ProgressPayload>({ stage: 'idle', message: '' })
  const [logs, setLogs] = useState<string[]>([])
  const [result, setResult] = useState<UpdateResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.electronApi) return
    window.electronApi.getSavedDirectory().then((dir) => {
      if (dir) setTargetDirectory(dir)
    })
    return window.electronApi.onProgress((payload) => {
      setProgress(payload)
      setLogs((prev) => [...prev, payload.message])
    })
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const canStart = useMemo(() => !busy && targetDirectory.trim().length > 0, [busy, targetDirectory])

  async function handleChooseDirectory() {
    if (!window.electronApi) return
    const res = await window.electronApi.chooseTargetDirectory()
    if (!res.canceled && res.path) {
      setTargetDirectory(res.path)
      void window.electronApi.saveDirectory(res.path)
    }
  }

  async function handleStart() {
    if (!window.electronApi) return
    setBusy(true)
    setResult(null)
    setErrorMessage('')
    setLogs([])
    try {
      const updateResult = await window.electronApi.startUpdate({ targetDirectory })
      setResult(updateResult)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '更新失败。')
    } finally {
      setBusy(false)
    }
  }

  const showProgress = busy || progress.stage !== 'idle'

  return (
    <div className="app">
      <div className="titlebar">
        <div className="titlebar-drag" />
        <div className="titlebar-controls">
          <button className="tb-btn tb-min" onClick={() => window.electronApi?.windowMinimize()} title="最小化">─</button>
          <button className="tb-btn tb-max" onClick={() => window.electronApi?.windowMaximize()} title="最大化">□</button>
          <button className="tb-btn tb-close" onClick={() => window.electronApi?.windowClose()} title="关闭">✕</button>
        </div>
      </div>

      <div className="header">
        <div className="header-icon">🐱</div>
        <h1>Bongo Cat Mod 更新器</h1>
        <p>自动下载并替换 Assembly-CSharp.dll</p>
      </div>

      <div className="card">
        <div className="field-label">目标目录</div>
        <div className="path-row">
          <input
            className="path-input"
            readOnly
            value={targetDirectory}
            placeholder="选择 BongoCat 安装目录"
          />
          <button className="btn btn-secondary" disabled={busy} onClick={handleChooseDirectory}>
            浏览
          </button>
        </div>

        <button className="btn btn-primary" disabled={!canStart} onClick={handleStart}>
          {busy ? '更新中...' : '开始更新'}
        </button>

        {showProgress && (
          <>
            <div className="divider" />
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress.percent ?? 0}%` }} />
            </div>
            <div className="status-text">{progress.message}</div>
            {logs.length > 0 && (
              <div className="logs">
                {logs.map((item, i) => (
                  <div className="log-item" key={i}>{item}</div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </>
        )}

        {result && (
          <div className="result success">
            更新完成 — 已替换 {result.replacedFiles} 个文件，新增 {result.addedFiles} 个文件
          </div>
        )}
        {errorMessage && <div className="result error">{errorMessage}</div>}
      </div>
    </div>
  )
}
