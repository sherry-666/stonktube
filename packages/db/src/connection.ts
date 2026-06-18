import mongoose from 'mongoose'

let connected = false

export async function connectDB(uri?: string): Promise<void> {
  if (connected) return
  const mongoUri = uri ?? process.env.MONGODB_URI
  if (!mongoUri) throw new Error('MONGODB_URI is not set')
  await mongoose.connect(mongoUri)
  connected = true
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect()
  connected = false
}
