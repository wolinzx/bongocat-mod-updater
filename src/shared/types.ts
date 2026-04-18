export type UpdateStage =
  | 'idle'
  | 'resolving'
  | 'downloading'
  | 'extracting'
  | 'copying'
  | 'completed'
  | 'error'

export interface ProgressPayload {
  stage: UpdateStage
  message: string
  percent?: number
}

export interface UpdateResult {
  replacedFiles: number
  addedFiles: number
  targetDirectory: string
}

export interface UpdateSummary {
  replacedFiles: number
  addedFiles: number
}

export interface StartUpdateInput {
  targetDirectory: string
}

export interface SelectedDirectoryResult {
  canceled: boolean
  path?: string
}

export interface ElectronApi {
  chooseTargetDirectory: () => Promise<SelectedDirectoryResult>
  startUpdate: (input: StartUpdateInput) => Promise<UpdateResult>
  onProgress: (listener: (payload: ProgressPayload) => void) => () => void
}
