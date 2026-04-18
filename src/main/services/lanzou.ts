import { BrowserWindow } from 'electron'

const SHARE_URL = 'https://xv40.lanzouu.com/b0fpy9v9e'
const SHARE_PASSWORD = '4qek'

interface FolderFile {
  id: string
  name_all: string
  icon: string
}

interface FolderListResponse {
  zt: number
  info: string
  text: FolderFile[]
}

interface FinalDownloadResponse {
  zt: number
  dom: string
  url: string
  inf: number
}

interface CookieJar {
  header: string
  update(response: Response): void
}

export interface ResolvedDownload {
  fileName: string
  downloadUrl: string
}

export interface ShareConfig {
  shareUrl: string
  password: string
}

export const shareConfig: ShareConfig = {
  shareUrl: SHARE_URL,
  password: SHARE_PASSWORD
}

function createCookieJar(): CookieJar {
  const cookies = new Map<string, string>()

  return {
    get header() {
      return Array.from(cookies.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')
    },
    update(response: Response) {
      const setCookie = response.headers.getSetCookie?.() ?? []
      for (const rawCookie of setCookie) {
        const [pair] = rawCookie.split(';')
        const [name, value] = pair.split('=')
        if (name && value) {
          cookies.set(name.trim(), value.trim())
        }
      }
    }
  }
}

function extract(pattern: RegExp, input: string, errorMessage: string): string {
  const match = input.match(pattern)
  if (!match?.[1]) {
    throw new Error(errorMessage)
  }
  return match[1]
}

async function fetchText(url: string, init: RequestInit, cookieJar: CookieJar): Promise<string> {
  const response = await fetch(url, init)
  cookieJar.update(response)
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status} ${response.statusText}`)
  }
  return response.text()
}

async function fetchJson<T>(url: string, init: RequestInit, cookieJar: CookieJar): Promise<T> {
  const response = await fetch(url, init)
  cookieJar.update(response)
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

function buildHeaders(referer: string, cookieJar: CookieJar, extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  headers.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36')
  headers.set('referer', referer)
  if (cookieJar.header) {
    headers.set('cookie', cookieJar.header)
  }
  return headers
}

async function resolveFolderFile(cookieJar: CookieJar): Promise<{ fileName: string; filePageUrl: string }> {
  const shareHtml = await fetchText(
    SHARE_URL,
    {
      headers: buildHeaders(SHARE_URL, cookieJar)
    },
    cookieJar
  )

  const folderId = extract(/filemoreajax\.php\?file=(\d+)/, shareHtml, '未找到文件夹接口。')
  const uid = extract(/'uid':'(\d+)'/, shareHtml, '未找到 uid。')
  const timestamp = extract(/var \w+ = '(\d{10,})'/, shareHtml, '未找到时间戳。')
  const sign = extract(/var \w+ = '([0-9a-f]{32})'/, shareHtml, '未找到签名。')

  const form = new URLSearchParams({
    lx: '2',
    fid: folderId,
    uid,
    pg: '1',
    rep: '0',
    t: timestamp,
    k: sign,
    up: '1',
    ls: '1',
    pwd: SHARE_PASSWORD
  })

  const listResponse = await fetchJson<FolderListResponse>(
    new URL(`/filemoreajax.php?file=${folderId}`, SHARE_URL).toString(),
    {
      method: 'POST',
      headers: buildHeaders(SHARE_URL, cookieJar, {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest'
      }),
      body: form
    },
    cookieJar
  )

  if (listResponse.zt !== 1 || !listResponse.text?.length) {
    throw new Error('蓝奏文件列表为空或提取码无效。')
  }

  const rarFile = listResponse.text.find((item) => item.icon === 'rar') ?? listResponse.text[0]
  return {
    fileName: rarFile.name_all,
    filePageUrl: new URL(`/${rarFile.id}`, SHARE_URL).toString()
  }
}

async function resolveFileDownload(filePageUrl: string, cookieJar: CookieJar): Promise<string> {
  const fileHtml = await fetchText(
    filePageUrl,
    {
      headers: buildHeaders(SHARE_URL, cookieJar)
    },
    cookieJar
  )

  // fid lives in the file page, not the iframe
  const ajaxFileId = extract(/var fid = (\d+)/, fileHtml, '未找到文件 fid。')

  const iframePath = extract(/<iframe[^>]+src="([^"]+)"/, fileHtml, '未找到文件下载 iframe。')
  const iframeUrl = new URL(iframePath, SHARE_URL).toString()

  const iframeHtml = await fetchText(
    iframeUrl,
    {
      headers: buildHeaders(filePageUrl, cookieJar)
    },
    cookieJar
  )
  const ajaxData = extract(/var ajaxdata = '([^']*)'/, iframeHtml, '未找到 ajaxdata。')
  const websign = extract(/var wp_sign = '([^']+)'/, iframeHtml, '未找到 wp_sign。')
  const kdnsMatch = iframeHtml.match(/var kdns =(\d+)/)
  const kd = kdnsMatch?.[1] ?? '1'

  const finalResponse = await fetchJson<FinalDownloadResponse>(
    new URL(`/ajaxm.php?file=${ajaxFileId}`, SHARE_URL).toString(),
    {
      method: 'POST',
      headers: buildHeaders(iframeUrl, cookieJar, {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest'
      }),
      body: new URLSearchParams({
        action: 'downprocess',
        websignkey: ajaxData,
        signs: ajaxData,
        sign: websign,
        websign: '',
        kd,
        ves: '1'
      })
    },
    cookieJar
  )

  if (finalResponse.zt !== 1 || !finalResponse.dom || !finalResponse.url) {
    throw new Error('未解析出最终下载链接。')
  }

  const intermediatePage = new URL(`/file/${finalResponse.url}`, finalResponse.dom).toString()
  return interceptDownloadUrl(intermediatePage, cookieJar.header)
}

function interceptDownloadUrl(pageUrl: string, cookies: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })

    const timeout = setTimeout(() => {
      win.destroy()
      reject(new Error('拦截下载链接超时。'))
    }, 30000)

    win.webContents.session.once('will-download', (_event, item) => {
      const url = item.getURL()
      item.cancel()
      clearTimeout(timeout)
      win.destroy()
      resolve(url)
    })

    void win.loadURL(pageUrl, { extraHeaders: `Cookie: ${cookies}` })
  })
}

export async function resolveDownload(): Promise<ResolvedDownload> {
  const cookieJar = createCookieJar()
  const { fileName, filePageUrl } = await resolveFolderFile(cookieJar)
  const downloadUrl = await resolveFileDownload(filePageUrl, cookieJar)

  return {
    fileName,
    downloadUrl
  }
}
