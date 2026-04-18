import { createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { finished } from 'node:stream/promises'

export async function downloadFile(
  url: string,
  destinationPath: string,
  onProgress: (percent: number | undefined, message: string) => void
): Promise<void> {
  await mkdir(dirname(destinationPath), { recursive: true })

  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      referer: 'https://xv40.lanzouu.com/'
    },
    redirect: 'follow'
  })

  console.log('[download] url:', url)
  console.log('[download] status:', response.status, 'content-type:', response.headers.get('content-type'))
  console.log('[download] content-length:', response.headers.get('content-length'))

  if (!response.ok || !response.body) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('text/html')) {
    throw new Error('下载结果不是压缩包，可能是链接失效或页面结构已变化。')
  }

  const total = Number(response.headers.get('content-length') ?? 0)
  const reader = response.body.getReader()
  const output = createWriteStream(destinationPath)

  let received = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (!value) {
        continue
      }
      output.write(Buffer.from(value))
      received += value.length
      if (total > 0) {
        const percent = Math.min(100, Math.round((received / total) * 100))
        onProgress(percent, `已下载 ${percent}%`)
      } else {
        onProgress(undefined, `已下载 ${Math.round(received / 1024)} KB`)
      }
    }
  } finally {
    output.end()
    await finished(output)
    const fileInfo = await stat(destinationPath)
    console.log('[download] written:', received, 'bytes, file size:', fileInfo.size)
  }
}
