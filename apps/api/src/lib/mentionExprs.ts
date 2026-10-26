import { RELEVANCE_RANK, MENTION_MIN_RELEVANCE, MENTION_MIN_CONFIDENCE } from '@stonktube/shared'

// Aggregation-expression equivalents of mentionQualifies() /
// mentionExpressesView() from @stonktube/shared, built from the same constants
// so filtering can run in MongoDB. `m` is a mention path such as '$m'.

const QUALIFYING_RELEVANCE = Object.entries(RELEVANCE_RANK)
  .filter(([, rank]) => rank >= RELEVANCE_RANK[MENTION_MIN_RELEVANCE])
  .map(([relevance]) => relevance)

export function mentionQualifiesExpr(m: string) {
  return {
    $cond: [
      { $ne: [{ $ifNull: [`${m}.relevance`, null] }, null] },
      { $in: [`${m}.relevance`, QUALIFYING_RELEVANCE] },
      // Legacy mentions without relevance: isPrimary or a confidence floor.
      {
        $or: [
          { $eq: [`${m}.isPrimary`, true] },
          { $gte: [{ $ifNull: [`${m}.confidence`, 0] }, MENTION_MIN_CONFIDENCE] },
        ],
      },
    ],
  }
}

// Missing stance (pre-backfill data) counts as a view, like the JS helper.
export function mentionExpressesViewExpr(m: string) {
  return { $ne: [`${m}.stance`, 'FACTUAL'] }
}
