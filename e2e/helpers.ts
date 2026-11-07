import type { Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { join } from 'path'

export const BASE_URL = 'http://localhost:3100'
export const PROOFS_DIR = join(process.cwd(), 'tests', 'proofs')

mkdirSync(PROOFS_DIR, { recursive: true })

export interface LatencyStat {
  count: number
  min_ms: number
  max_ms: number
  total_ms: number
  avg_ms: number
}

export const latencyMap: Record<string, LatencyStat> = {}
const inFlightRequests = new Map<string, number>()

export function recordLatency(urlStr: string, durationMs: number) {
  try {
    const url = new URL(urlStr)
    if (!url.pathname.startsWith('/api/')) return
    const endpoint = url.pathname

    if (!latencyMap[endpoint]) {
      latencyMap[endpoint] = {
        count: 0,
        min_ms: durationMs,
        max_ms: durationMs,
        total_ms: 0,
        avg_ms: 0
      }
    }

    const stat = latencyMap[endpoint]
    stat.count += 1
    stat.total_ms += durationMs
    stat.min_ms = Math.min(stat.min_ms, durationMs)
    stat.max_ms = Math.max(stat.max_ms, durationMs)
    stat.avg_ms = Number((stat.total_ms / stat.count).toFixed(2))
  } catch {
    // Ignore invalid URLs
  }
}

export async function runTest(name: string, fn: () => Promise<void>) {
  const start = performance.now()
  try {
    await fn()
    const dur = Math.round(performance.now() - start)
    console.log(`  [PASS] ${name} (${dur}ms)`)
  } catch (err: any) {
    const dur = Math.round(performance.now() - start)
    console.error(`  [FAIL] ${name} (${dur}ms):`, err.message)
    throw err
  }
}

export async function clickNavItem(page: Page, title: string) {
  const navBtn = await page.$(`button.menu-button[title="${title}"]`)
  if (!navBtn) throw new Error(`Navigation item "${title}" not found`)
  await navBtn.click()
  await new Promise(r => setTimeout(r, 400))
}

export async function attachNetworkInterceptors(page: Page) {
  await page.setRequestInterception(true)
  page.on('request', req => {
    inFlightRequests.set(req.url(), performance.now())
    req.continue()
  })
  page.on('response', resp => {
    const start = inFlightRequests.get(resp.url())
    if (start) {
      const duration = Math.round(performance.now() - start)
      inFlightRequests.delete(resp.url())
      recordLatency(resp.url(), duration)
    }
  })
}
