/**
 * Post-build: fetch the sitemap from the live API and write it to dist/
 * so that `serve -s dist` serves it at stonktube.app/sitemap.xml.
 *
 * The API URL is read from VITE_API_URL (set in the Railway web service env).
 */
import { writeFileSync } from 'fs'

const apiBase = process.env.VITE_API_URL ?? 'https://api-production-a02bd.up.railway.app'
const url = `${apiBase}/sitemap.xml`

console.log(`Fetching sitemap from ${url}`)
const res = await fetch(url)
if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status} ${res.statusText}`)
const xml = await res.text()
writeFileSync('dist/sitemap.xml', xml)
console.log(`sitemap.xml written (${xml.length} bytes)`)
