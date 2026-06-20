import { Schema, model, Document } from 'mongoose'
import type { StockStats } from '@stonktube/shared'

export interface IStock extends Document {
  ticker: string
  /**
   * Yahoo Finance symbol to fetch prices with, when it differs from the display
   * `ticker` (e.g. SPX → ^GSPC). Falls back to `ticker` when unset.
   */
  priceSymbol?: string
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
    priceSymbol: { type: String },
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

export const Stock = model<IStock>('Stock', StockSchema)
