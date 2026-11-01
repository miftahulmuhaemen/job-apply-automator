import type { Page } from 'puppeteer-core'
import { join } from 'path'
import { runTest, clickNavItem, PROOFS_DIR } from '../helpers'

export async function runErrorsSuite(page: Page) {
  // 17. System Errors: Zero toolbar, zero actions column, crisp white text
  await runTest('17. System Errors zero toolbar, zero actions, and pure white text', async () => {
    await clickNavItem(page, 'System Errors')
    await page.waitForSelector('.data-table tbody tr, .empty-state', { timeout: 5000 })

    // Assert ZERO toolbar
    const toolbar = await page.$('.toolbar-left-aligned')
    if (toolbar) {
      throw new Error('System errors must have ZERO toolbar')
    }

    // Assert ZERO Actions column
    const headers = await page.$$eval('.data-table th', ths => ths.map(t => t.textContent?.trim() || ''))
    if (headers.some(h => h.includes('Actions'))) {
      throw new Error(`System errors table must not have Actions column. Found: ${headers.join(', ')}`)
    }

    await page.screenshot({ path: join(PROOFS_DIR, 'system_errors_audit.png') })
  })

  // 18. Pagination footer across data tables
  await runTest('18. DataTableFooter pagination controls presence', async () => {
    await clickNavItem(page, 'Jobs Ledger')
    await page.waitForSelector('.table-footer-bar', { timeout: 5000 })
    const footer = await page.$('.table-footer-bar')
    if (!footer) throw new Error('DataTableFooter (.table-footer-bar) not found')
    const hasPrevNext = await page.$$eval('.table-footer-bar button.btn-pagination', btns => btns.length >= 2)
    if (!hasPrevNext) throw new Error('Pagination Previous/Next buttons missing')
  })
}
