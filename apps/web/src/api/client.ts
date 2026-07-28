function getBase(): string {
  if (typeof window === 'undefined') {
    // Server-side SSR: use API_URL env var (set at runtime in Railway)
    return process.env.API_URL ?? 'http://localhost:3000'
  }
  // Client-side: use VITE_API_URL baked in at build time
  return import.meta.env.VITE_API_URL ?? ''
}

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${getBase()}${path}`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json() as Promise<T>
}
