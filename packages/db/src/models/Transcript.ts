import { Schema, model, Document, Types } from 'mongoose'
import type { TranscriptSource } from '@stonktube/shared'

export interface ITranscriptSegment {
  start: number
  end: number
  text: string
}

export interface ITranscript extends Document {
  videoId: Types.ObjectId
  text: string
  segments?: ITranscriptSegment[]
  source: TranscriptSource
  createdAt: Date
}

const TranscriptSchema = new Schema<ITranscript>(
  {
    videoId: { type: Schema.Types.ObjectId, ref: 'Video', required: true, unique: true },
    text: { type: String, required: true },
    segments: [
      {
        start: Number,
        end: Number,
        text: String,
        _id: false,
      },
    ],
    source: { type: String, enum: ['YOUTUBE_CAPTIONS', 'GEMINI'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

export const Transcript = model<ITranscript>('Transcript', TranscriptSchema)
