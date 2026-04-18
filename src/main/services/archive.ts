// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createExtractorFromFile } = require('node-unrar-js') as typeof import('node-unrar-js')
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import fs from 'fs-extra'

async function resolveExtractionRoot(outputDirectory: string): Promise<string> {
  const entries = await fs.readdir(outputDirectory)
  if (entries.length !== 1) return outputDirectory
  const single = join(outputDirectory, entries[0])
  return (await fs.stat(single)).isDirectory() ? single : outputDirectory
}

export async function extractArchive(archivePath: string, outputDirectory: string): Promise<string> {
  await mkdir(outputDirectory, { recursive: true })

  const extractor = await createExtractorFromFile({ filepath: archivePath, targetPath: outputDirectory })
  const { files } = extractor.extract()

  for (const file of files) {
    if (file.fileHeader.flags.directory || !file.extraction) continue
    const dest = join(outputDirectory, file.fileHeader.name)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, Buffer.from(file.extraction))
  }

  return resolveExtractionRoot(outputDirectory)
}
