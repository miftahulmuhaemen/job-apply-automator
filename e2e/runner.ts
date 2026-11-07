import puppeteer, { Browser } from 'puppeteer-core'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { BASE_URL, PROOFS_DIR, latencyMap, attachNetworkInterceptors } from './helpers'
import { runShellSuite } from './specs/shell.e2e'
import { runJobsSuite } from './specs/jobs.e2e'
import { runProfileSuite } from './specs/profile.e2e'
import { runCriteriaSuite } from './specs/criteria.e2e'
import { runWebsitesSuite } from './specs/websites.e2e'
import { runCompaniesSuite } from './specs/companies.e2e'
import { runErrorsSuite } from './specs/errors.e2e'

async function main() {
  console.log('====================================================')
  console.log(' Starting Full E2E Verification & Latency Profiling ')
  console.log('====================================================')

  let browser: Browser | null = null

  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      headless: true,
      protocolTimeout: 30000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })

    page.on('console', msg => console.log('  [BROWSER CONSOLE]', msg.text()))
    page.on('pageerror', err => console.error('  [BROWSER ERROR]', err.message))
    page.on('dialog', async d => {
      console.log('  [BROWSER DIALOG]', d.type(), d.message())
      await d.dismiss()
    })

    // Attach request/response latency interceptors
    await attachNetworkInterceptors(page)

    // Navigate to Web Console
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' })
    await page.waitForSelector('.triage-table tbody tr', { timeout: 10000 })

    // Execute specs sequentially by test intention
    await runShellSuite(page)
    await runJobsSuite(page)
    await runProfileSuite(page)
    await runCriteriaSuite(page)
    await runWebsitesSuite(page)
    await runCompaniesSuite(page)
    await runErrorsSuite(page)

    console.log('====================================================')
    console.log(' All 18 E2E Scenarios PASSED CLEANLY!              ')
    console.log('====================================================\n')

    // Print & save endpoint latency benchmark
    console.log('--- Network Endpoint Latency Benchmark ---')
    console.log('| Endpoint | Calls | Min (ms) | Avg (ms) | Max / Slowest (ms) |')
    console.log('| :--- | :---: | :---: | :---: | :---: |')
    for (const [ep, stat] of Object.entries(latencyMap)) {
      console.log(`| \`${ep}\` | ${stat.count} | ${stat.min_ms} ms | ${stat.avg_ms} ms | **${stat.max_ms} ms** |`)
    }

    const reportPath = join(PROOFS_DIR, 'endpoint_latency_benchmark.json')
    writeFileSync(reportPath, JSON.stringify(latencyMap, null, 2), 'utf-8')
    console.log(`\nLatency benchmark written to: ${reportPath}`)

  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

main().catch(err => {
  console.error('\nE2E Verification Execution FAILED:', err)
  process.exit(1)
})
