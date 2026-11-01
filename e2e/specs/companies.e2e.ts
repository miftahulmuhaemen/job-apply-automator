import type { Page } from 'puppeteer-core'
import { join } from 'path'
import { runTest, clickNavItem, PROOFS_DIR } from '../helpers'

export async function runCompaniesSuite(page: Page) {
  // 16. Companies Master: Zero cooldown column and on-demand dossier modal
  await runTest('16. Companies Master zero cooldown column and on-demand dossier modal', async () => {
    await clickNavItem(page, 'Companies')
    await page.waitForSelector('.data-table tbody tr, .empty-state', { timeout: 5000 })

    // Assert ZERO Cooldown in table headers
    const headers = await page.$$eval('.data-table th', ths => ths.map(t => t.textContent?.trim() || ''))
    if (headers.some(h => h.toLowerCase().includes('cooldown'))) {
      throw new Error(`Found unexpected Cooldown column in Companies header: ${headers.join(', ')}`)
    }

    // Check search input placeholder
    const searchInput = await page.$('.search-input')
    if (searchInput) {
      const placeholder = await page.evaluate(el => el.getAttribute('placeholder'), searchInput)
      if (!placeholder?.toLowerCase().includes('company name')) {
        throw new Error(`Expected company name placeholder, got: ${placeholder}`)
      }
    }

    // Click first company link to open dossier
    const compLink = await page.$('.btn-company-link')
    if (compLink) {
      await compLink.click()
      await page.waitForSelector('.modal-panel, .modal-card, .shadcn-dialog-panel', { timeout: 5000 })

      // Assert 3 metric cards (Zero cooldown metric card)
      const metricLabels = await page.$$eval('.metric-label', els => els.map(e => e.textContent?.trim() || ''))
      if (metricLabels.some(l => l.toLowerCase().includes('cooldown'))) {
        throw new Error(`Found unexpected Cooldown card in modal: ${metricLabels.join(', ')}`)
      }
      if (metricLabels.length !== 3) {
        throw new Error(`Expected exactly 3 metric cards in dossier, found ${metricLabels.length} (${metricLabels.join(', ')})`)
      }

      await page.screenshot({ path: join(PROOFS_DIR, 'companies_dossier_modal.png') })
      await page.keyboard.press('Escape')
      await new Promise(r => setTimeout(r, 200))
    }
  })
}
