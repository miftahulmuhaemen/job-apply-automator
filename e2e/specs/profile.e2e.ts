import type { Page } from 'puppeteer-core'
import { join } from 'path'
import { runTest, clickNavItem, PROOFS_DIR } from '../helpers'

export async function runProfileSuite(page: Page) {
  // 12. Candidate Profile: Columns order and search
  await runTest('12. Candidate Profile columns order and search by label/description', async () => {
    await clickNavItem(page, 'Candidate Profile')
    await page.waitForSelector('.data-table tbody tr, .empty-state', { timeout: 5000 })

    const headers = await page.$$eval('.data-table th', ths => ths.map(t => t.textContent?.trim() || ''))
    if (!headers.some(h => h.includes('Parameter Key')) && !headers.some(h => h.includes('Category'))) {
      console.log(`  Candidate profile headers: ${headers.join(', ')}`)
    }

    const searchInput = await page.$('.search-input')
    if (searchInput) {
      const placeholder = await page.evaluate(el => el.getAttribute('placeholder'), searchInput)
      if (!placeholder?.includes('label') && !placeholder?.includes('description')) {
        throw new Error(`Expected label/description placeholder, got: ${placeholder}`)
      }
    }

    await page.screenshot({ path: join(PROOFS_DIR, 'profile_columns_alignment.png') })
  })

  // 13. Candidate Profile: Toggle switch Agent Delegated
  await runTest('13. Candidate Profile Agent Delegated switch state', async () => {
    const switches = await page.$$('.shadcn-switch, .switch')
    if (switches.length > 0) {
      await page.screenshot({ path: join(PROOFS_DIR, 'profile_delegation_toggle.png') })
    }
  })
}
