/**
 * Token bucket for pacing work against a tokens-per-minute (TPM) quota.
 *
 * Unlike a request-rate limiter, this charges each call its estimated token
 * cost, so a few large calls are throttled as hard as many small ones — which
 * is what a TPM quota (e.g. Gemini's 1M input-tokens/min) actually enforces.
 *
 * The bucket refills continuously at `refillPerSec`; `acquire(cost)` waits until
 * that many tokens are available, then deducts them. Sized below the real quota
 * (a safety fraction), it keeps sustained usage under the cap with burst slack.
 */
export class TokenBucket {
  private tokens: number
  private last: number

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity
    this.last = Date.now()
  }

  private refill(): void {
    const now = Date.now()
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSec)
    this.last = now
  }

  /** Wait until `cost` tokens are available, then consume them. */
  async acquire(cost: number): Promise<void> {
    // A single call can't cost more than capacity, or it could never be served.
    const need = Math.min(cost, this.capacity)
    for (;;) {
      this.refill()
      if (this.tokens >= need) {
        this.tokens -= need
        return
      }
      const deficitMs = Math.ceil(((need - this.tokens) / this.refillPerSec) * 1000)
      await new Promise(r => setTimeout(r, Math.max(50, deficitMs)))
    }
  }
}
