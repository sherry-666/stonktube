import { Schema, model, Document } from 'mongoose'
import type { StockStats } from '@stonktube/shared'

export interface IStock extends Document {
  ticker: string
  name: string
  sector: string
  aliases: string[]
  isPrivate: boolean
  brandColor: string
  logoBg: string
  initials: string
  logoUrl?: string
  stats: StockStats
  createdAt: Date
  updatedAt: Date
}

const StockStatsSchema = new Schema<StockStats>(
  {
    mentions30d: { type: Number, default: 0 },
    distinctCreators: { type: Number, default: 0 },
    bullCount: { type: Number, default: 0 },
    neutralCount: { type: Number, default: 0 },
    bearCount: { type: Number, default: 0 },
    bullishPct: { type: Number, default: 0 },
    latestClose: Number,
    dayChangePct: Number,
    change30dPct: Number,
    sparkline: { type: [Number], default: [] },
    computedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const StockSchema = new Schema<IStock>(
  {
    ticker: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    sector: { type: String, default: '' },
    aliases: { type: [String], default: [] },
    isPrivate: { type: Boolean, default: false },
    brandColor: { type: String, required: true },
    logoBg: { type: String, required: true },
    initials: { type: String, required: true },
    logoUrl: String,
    stats: { type: StockStatsSchema, default: () => ({}) },
  },
  { timestamps: true },
)

StockSchema.index({ ticker: 1 })

export const Stock = model<IStock>('Stock', StockSchema)
