import { Schema, model, Document, Types } from 'mongoose'
import type { TranscriptStatus, AnalysisStatus } from '@stonktube/shared'

export interface IMention {
  stockId: Types.ObjectId
  ticker: string
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'
  confidence?: number
  note: string
  isPrimary: boolean
  priceAtMention?: number
}

export interface ICreatorSnapshot {
  slug: string
  name: string
  handle: string
  brandColor: string
  initial: string
  avatarUrl?: string
}

export interface IVideo extends Document {
  creatorId: Types.ObjectId
  creator: ICreatorSnapshot
  youtubeVideoId: string
  title: string
  url: string
  thumbnailUrl?: string
  durationSeconds?: number
  publishedAt: Date
  transcriptStatus: TranscriptStatus
  analysisStatus: AnalysisStatus
  summary?: string
  language: string
  mentions: IMention[]
  createdAt: Date
  updatedAt: Date
}

const MentionSchema = new Schema<IMention>(
  {
    stockId: { type: Schema.Types.ObjectId, ref: 'Stock', required: true },
    ticker: { type: String, required: true },
    sentiment: { type: String, enum: ['BULLISH', 'NEUTRAL', 'BEARISH'], required: true },
    confidence: Number,
    note: { type: String, default: '' },
    isPrimary: { type: Boolean, default: false },
    priceAtMention: Number,
  },
  { _id: false },
)

const CreatorSnapshotSchema = new Schema<ICreatorSnapshot>(
  {
    slug: String,
    name: String,
    handle: String,
    brandColor: String,
    initial: String,
    avatarUrl: String,
  },
  { _id: false },
)

const VideoSchema = new Schema<IVideo>(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: 'Creator', required: true },
    creator: { type: CreatorSnapshotSchema, required: true },
    youtubeVideoId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    thumbnailUrl: String,
    durationSeconds: Number,
    publishedAt: { type: Date, required: true, index: -1 },
    transcriptStatus: {
      type: String,
      enum: ['PENDING', 'CAPTIONS', 'TRANSCRIBED', 'FAILED', 'SKIPPED'],
      default: 'PENDING',
    },
    analysisStatus: {
      type: String,
      enum: ['PENDING', 'ANALYZED', 'FAILED', 'NO_MENTIONS'],
      default: 'PENDING',
    },
    summary: String,
    language: { type: String, default: 'en' },
    mentions: { type: [MentionSchema], default: [] },
  },
  { timestamps: true },
)

// multikey index: Stock Detail "all coverage of X" query
VideoSchema.index({ 'mentions.stockId': 1, publishedAt: -1 })
// creator recent calls
VideoSchema.index({ creatorId: 1, publishedAt: -1 })

export const Video = model<IVideo>('Video', VideoSchema)
