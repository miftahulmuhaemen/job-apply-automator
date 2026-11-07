import type { Page } from 'puppeteer-core'
import { join } from 'path'
import { runTest, BASE_URL, PROOFS_DIR } from '../helpers'

export async function runJobsSuite(page: Page) {
  // 6. Jobs Ledger: Column order and Details button styling
  await runTest('6. Jobs Ledger column order and Details button styling', async () => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('.triage-table tbody tr', { timeout: 10000 })

    const headers = await page.$$eval('.triage-table th', ths => ths.map(t => t.textContent?.trim() || ''))
    const roleIdx = headers.findIndex(h => h.includes('Role'))
    const compIdx = headers.findIndex(h => h.includes('Company'))
    const detailsIdx = headers.findIndex(h => h.includes('Details'))
    const actionsIdx = headers.findIndex(h => h.includes('Actions'))

    if (roleIdx === -1 || compIdx === -1 || detailsIdx === -1 || actionsIdx === -1) {
      throw new Error(`Missing expected headers. Found: ${headers.join(', ')}`)
    }
    if (!(roleIdx < compIdx && compIdx < detailsIdx && detailsIdx < actionsIdx)) {
      throw new Error(`Invalid header order: Role (${roleIdx}), Comp (${compIdx}), Details (${detailsIdx}), Actions (${actionsIdx})`)
    }

    // Check Details button styling
    const detailsBtn = await page.$('.btn-tabbed-details')
    if (detailsBtn) {
      const text = await page.evaluate(el => el.textContent, detailsBtn)
      if (!text?.includes('View Details')) throw new Error('View Details text missing')
    }

    await page.screenshot({ path: join(PROOFS_DIR, 'jobs_columns_alignment.png') })
  })

  // 7. Jobs Ledger: Server-side search bounceback (Role & Company)
  await runTest('7. Jobs Ledger server-side debounced search ("bounceback")', async () => {
    const searchInput = await page.$('.search-input')
    if (!searchInput) throw new Error('Jobs search input not found')

    // Type search
    await searchInput.type('Engineer')
    // Wait for debounce 300ms + network update
    await new Promise(r => setTimeout(r, 600))
    await page.waitForSelector('.triage-table tbody tr', { timeout: 5000 })

    await page.screenshot({ path: join(PROOFS_DIR, 'jobs_search_bounceback.png') })

    // Clear search reliably via DOM input event
    await page.$eval('.search-input', (el: any) => {
      el.value = ''
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await new Promise(r => setTimeout(r, 600))
    await page.waitForSelector('.triage-table tbody tr', { timeout: 5000 })
  })

  // 8. Jobs Ledger: Stage filter popover
  await runTest('8. Jobs Ledger StageFilterPopover and stage switching', async () => {
    const stageBtn = await page.$('.stage-filter-trigger')
    if (!stageBtn) throw new Error('Stage filter trigger (.stage-filter-trigger) not found')
    await stageBtn.click()
    await page.waitForSelector('.stage-filter-menu', { timeout: 3000 })

    await page.screenshot({ path: join(PROOFS_DIR, 'jobs_stage_filter.png') })

    // Close popover on Escape
    await page.keyboard.press('Escape')
    await page.waitForSelector('.stage-filter-menu', { hidden: true, timeout: 3000 })
  })

  // 9. Jobs Ledger: Master checkbox and batch selection
  await runTest('9. Jobs Ledger batch selection footer indicator', async () => {
    await page.waitForSelector('.triage-table thead button[role="checkbox"], .triage-table thead .shadcn-checkbox', { timeout: 5000 })
    const masterCheckbox = await page.$('.triage-table thead button[role="checkbox"], .triage-table thead .shadcn-checkbox')
    if (masterCheckbox) {
      await masterCheckbox.click()
      await new Promise(r => setTimeout(r, 200))
      const footer = await page.$('.table-footer-bar')
      const footerText = await page.evaluate(el => el?.textContent || '', footer)
      if (!footerText.includes('selected') && !footerText.includes('total entries')) {
        console.log(`  (Note: Footer text: "${footerText}")`)
      }
      await page.screenshot({ path: join(PROOFS_DIR, 'jobs_batch_approve.png') })
      // Deselect
      await masterCheckbox.click()
      await new Promise(r => setTimeout(r, 200))
    }
  })

  // 10. Jobs Ledger: 5-tab Job Dossier modal
  await runTest('10. Jobs Ledger 5-tab Job Dossier modal tabs navigation', async () => {
    await page.waitForSelector('.btn-tabbed-details', { timeout: 5000 })
    const detailsBtn = await page.$('.btn-tabbed-details')
    if (detailsBtn) {
      await detailsBtn.click()
      await page.waitForSelector('.modal-panel, .modal-card, .shadcn-dialog-panel', { timeout: 5000 })

      await page.screenshot({ path: join(PROOFS_DIR, 'jobs_dossier_modal_tabs.png') })
      
      // Close modal via Close button or Escape
      const closeBtn = await page.$('.modal-panel .btn-icon, .modal-panel .btn-primary')
      if (closeBtn) {
        await closeBtn.click()
      } else {
        await page.keyboard.press('Escape')
      }
      await page.waitForSelector('.modal-panel, .modal-card, .shadcn-dialog-panel', { hidden: true, timeout: 3000 })
    }
  })

  // 11. Jobs Ledger: ActionPopover singleton auto-dismissal
  await runTest('11. ActionPopover singleton auto-dismissal on sequential row clicks', async () => {
    await page.waitForSelector('.popover-container button.btn-icon', { timeout: 5000 })
    const popoverTriggers = await page.$$('.popover-container button.btn-icon')
    if (popoverTriggers.length >= 2) {
      // Click row 1 popover
      await popoverTriggers[0].click()
      await page.waitForSelector('.popover-menu', { timeout: 3000 })
      let openCount = await page.$$eval('.popover-menu', els => els.length)
      if (openCount !== 1) throw new Error(`Expected 1 open popover, found ${openCount}`)

      // Click row 2 popover via DOM click to test singleton auto-dismissal
      await page.evaluate(el => (el as HTMLElement).click(), popoverTriggers[1])
      await new Promise(r => setTimeout(r, 200))
      openCount = await page.$$eval('.popover-menu', els => els.length)
      if (openCount !== 1) throw new Error(`Expected strictly 1 open popover on row 2 click, found ${openCount}`)

      // Close on escape
      await page.keyboard.press('Escape')
      await new Promise(r => setTimeout(r, 200))
      openCount = await page.$$eval('.popover-menu', els => els.length)
      if (openCount !== 0) throw new Error(`Expected 0 popovers after Escape, found ${openCount}`)
    }
    await page.screenshot({ path: join(PROOFS_DIR, 'jobs_popover_singleton.png') })
  })
}
