import { Schema, model, Document, Types } from 'mongoose'
import type { StockAnalyst } from '@stonktube/shared'

/**
 * One stock's analyst consensus for one UTC day. Yahoo only returns the current
 * consensus, so these snapshots are the only record of how it changed. Firm
 * actions aren't copied here: Yahoo keeps their history.
 */
export interface IAnalystSnapshot extends Document, Omit<StockAnalyst, 'actions'> {
  stockId: Types.ObjectId
  ticker: string
  /** UTC day as YYYY-MM-DD. */
  day: string
}

const AnalystSnapshotSchema = new Schema<IAnalystSnapshot>({
  stockId: { type: Schema.Types.ObjectId, ref: 'Stock', required: true },
  ticker: { type: String, required: true },
  day: { type: String, required: true },
  targetMean: Number,
  targetHigh: Number,
  targetLow: Number,
  targetAnalysts: Number,
  recommendationKey: String,
  strongBuy: { type: Number, default: 0 },
  buy: { type: Number, default: 0 },
  hold: { type: Number, default: 0 },
  sell: { type: Number, default: 0 },
  strongSell: { type: Number, default: 0 },
  fetchedAt: { type: Date, required: true },
})

AnalystSnapshotSchema.index({ stockId: 1, day: 1 }, { unique: true })

export const AnalystSnapshot = model<IAnalystSnapshot>('AnalystSnapshot', AnalystSnapshotSchema)
