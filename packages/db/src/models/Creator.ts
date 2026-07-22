import { Schema, model, Document } from 'mongoose'

export interface ICreator extends Document {
  slug: string
  name: string
  handle: string
  youtubeChannelId: string
  channelUrl: string
  avatarUrl?: string
  brandColor: string
  initial: string
  subscriberCount?: number
  bio: string
  bioI18n?: Record<string, string>
  language: string
  aliases: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const CreatorSchema = new Schema<ICreator>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    handle: { type: String, required: true },
    youtubeChannelId: { type: String, required: true, unique: true },
    channelUrl: { type: String, required: true },
    avatarUrl: String,
    brandColor: { type: String, required: true },
    initial: { type: String, required: true },
    subscriberCount: Number,
    bio: { type: String, default: '' },
    bioI18n: { type: Object, default: {} },
    language: { type: String, default: 'en' },
    aliases: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const Creator = model<ICreator>('Creator', CreatorSchema)
