export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json() as Promise<T>
}
