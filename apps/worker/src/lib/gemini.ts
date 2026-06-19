import { GoogleGenerativeAI, FunctionCallingMode } from '@google/generative-ai'
import { GoogleAIFileManager } from '@google/generative-ai/server'

// Lazily initialized so dotenv config runs before the key is read
let _flashModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | undefined
let _fileManager: GoogleAIFileManager | undefined

export function getFlashModel() {
  if (!_flashModel) {
    const key = process.env.GEMINI_API_KEY ?? ''
    _flashModel = new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-2.5-flash' })
  }
  return _flashModel
}

export function getFileManager() {
  if (!_fileManager) {
    const key = process.env.GEMINI_API_KEY ?? ''
    _fileManager = new GoogleAIFileManager(key)
  }
  return _fileManager
}

export { FunctionCallingMode }
