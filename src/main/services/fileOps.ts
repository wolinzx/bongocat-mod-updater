import { join, resolve, basename } from 'node:path'
import fs from 'fs-extra'
import type { UpdateSummary } from '../../shared/types'

const TARGET_FILE = 'Assembly-CSharp.dll'

async function findFile(rootDirectory: string, fileName: string): Promise<string | null> {
  const entries = await fs.readdir(rootDirectory, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(rootDirectory, entry.name)
    if (entry.isDirectory()) {
      const found = await findFile(fullPath, fileName)
      if (found) return found
    } else if (entry.name === fileName) {
      return fullPath
    }
  }
  return null
}

export async function copyIntoTarget(
  sourceDirectory: string,
  targetDirectory: string,
  onProgress: (percent: number, message: string) => void
): Promise<UpdateSummary> {
  const sourceFile = await findFile(resolve(sourceDirectory), TARGET_FILE)
  if (!sourceFile) {
    throw new Error(`解压包中未找到 ${TARGET_FILE}`)
  }

  const dest = join(resolve(targetDirectory), basename(sourceFile))
  const exists = await fs.pathExists(dest)
  onProgress(50, `正在复制 ${TARGET_FILE}`)
  await fs.copyFile(sourceFile, dest)
  onProgress(100, `复制完成`)

  return { replacedFiles: exists ? 1 : 0, addedFiles: exists ? 0 : 1 }
}
