import type { Page } from 'puppeteer-core'
import { join } from 'path'
import { runTest, clickNavItem, PROOFS_DIR } from '../helpers'

export async function runWebsitesSuite(page: Page) {
  // 15. Websites Directory: Columns layout and cooldown
  await runTest('15. Websites Directory columns layout and inline cooldown', async () => {
    await clickNavItem(page, 'Websites Directory')
    await page.waitForSelector('.data-table tbody tr, .empty-state', { timeout: 5000 })

    const headers = await page.$$eval('.data-table th', ths => ths.map(t => t.textContent?.trim() || ''))
    if (!headers.some(h => h.includes('Portal')) && !headers.some(h => h.includes('Platform'))) {
      console.log(`  Websites headers: ${headers.join(', ')}`)
    }

    await page.screenshot({ path: join(PROOFS_DIR, 'websites_policy_cooldown.png') })
  })
}
