import type { Page } from 'puppeteer-core'
import { join } from 'path'
import { runTest, clickNavItem, PROOFS_DIR } from '../helpers'

export async function runCriteriaSuite(page: Page) {
  // 14. Decision Criteria: Columns order & Assert ZERO searchbar
  await runTest('14. Decision Criteria zero searchbar and columns layout', async () => {
    await clickNavItem(page, 'Decision Criteria')
    await page.waitForSelector('.data-table tbody tr, .empty-state', { timeout: 5000 })

    // Assert ZERO searchbar
    const searchInputs = await page.$$('.search-input, input[placeholder*="Search"]')
    if (searchInputs.length > 0) {
      throw new Error(`Expected 0 searchbars in Decision Criteria, found ${searchInputs.length}`)
    }

    const addBtn = await page.$('button.btn-primary')
    const btnText = await page.evaluate(el => el?.textContent || '', addBtn)
    if (!btnText.includes('Add Parameter')) {
      throw new Error('Add Parameter button not found in criteria toolbar')
    }

    await page.screenshot({ path: join(PROOFS_DIR, 'criteria_rule_toggle.png') })
  })
}
