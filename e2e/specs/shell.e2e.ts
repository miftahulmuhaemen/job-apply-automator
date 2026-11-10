import type { Page } from 'puppeteer-core'
import { join } from 'path'
import { runTest, PROOFS_DIR } from '../helpers'

export async function runShellSuite(page: Page) {
  // 1. Shell: Sidenavbar expanded/collapsed width assertion
  await runTest('1. Sidenavbar expanded and collapsed width assertion', async () => {
    const sidebar = await page.$('aside.shadcn-sidebar')
    if (!sidebar) throw new Error('Sidebar (aside.shadcn-sidebar) not found')
    const initialBox = await sidebar.boundingBox()
    if (!initialBox || initialBox.width < 180) {
      throw new Error(`Expected expanded width >= 180px, got ${initialBox?.width}px`)
    }

    // Click collapse toggle button in Topbar
    const collapseBtn = await page.$('.sidebar-trigger')
    if (collapseBtn) {
      await collapseBtn.click()
      await new Promise(r => setTimeout(r, 200))
      const collapsedBox = await sidebar.boundingBox()
      if (!collapsedBox || collapsedBox.width > 80) {
        throw new Error(`Expected collapsed width <= 80px, got ${collapsedBox?.width}px`)
      }
      // Expand back
      await collapseBtn.click()
      await new Promise(r => setTimeout(r, 200))
    }
    await page.screenshot({ path: join(PROOFS_DIR, 'shell_sidenavbar_expanded.png') })
  })

  // 2. Shell: Sidebar footer settings gear popover interaction
  await runTest('2. Sidebar footer settings gear popover interaction', async () => {
    const gearBtn = await page.$('.btn-settings-trigger')
    if (!gearBtn) throw new Error('Settings gear button not found')
    await gearBtn.click()
    await page.waitForSelector('.settings-popover', { timeout: 3000 })

    await page.screenshot({ path: join(PROOFS_DIR, 'shell_settings_popover.png') })

    await page.keyboard.press('Escape')
    await page.waitForSelector('.settings-popover', { hidden: true, timeout: 3000 })
  })

  // 3. Shell: Modals - Daily Scheduler modal open/close
  await runTest('3. Daily Scheduler modal open/close', async () => {
    const gearBtn = await page.$('.btn-settings-trigger')
    await gearBtn?.click()
    await page.waitForSelector('.settings-popover', { timeout: 3000 })

    const items = await page.$$('.settings-popover-item')
    let clicked = false
    for (const item of items) {
      const text = await page.evaluate(el => el.textContent, item)
      if (text?.includes('Daily Scheduler')) {
        await item.click()
        clicked = true
        break
      }
    }
    if (!clicked) throw new Error('Daily Scheduler item not found in settings popover')

    await page.waitForSelector('.modal-card, .shadcn-dialog-panel', { timeout: 3000 })
    await page.screenshot({ path: join(PROOFS_DIR, 'modal_daily_scheduler.png') })

    await page.keyboard.press('Escape')
    await page.waitForSelector('.modal-card, .shadcn-dialog-panel', { hidden: true, timeout: 3000 })
  })

  // 4. Shell: Modals - Agent Diagnostic modal open/close
  await runTest('4. Agent Diagnostic modal open/close', async () => {
    const gearBtn = await page.$('.btn-settings-trigger')
    await gearBtn?.click()
    await page.waitForSelector('.settings-popover', { timeout: 3000 })

    const items = await page.$$('.settings-popover-item')
    let clicked = false
    for (const item of items) {
      const text = await page.evaluate(el => el.textContent, item)
      if (text?.trim() === 'Agent' || text?.includes('Agent')) {
        await item.click()
        clicked = true
        break
      }
    }
    if (!clicked) throw new Error('Agent item not found in settings popover')

    await page.waitForSelector('.modal-card, .shadcn-dialog-panel', { timeout: 3000 })
    await page.screenshot({ path: join(PROOFS_DIR, 'modal_agent_settings.png') })

    await page.keyboard.press('Escape')
    await page.waitForSelector('.modal-card, .shadcn-dialog-panel', { hidden: true, timeout: 3000 })
  })

  // 5. Shell: Modals - Connections telemetry modal open/close
  await runTest('5. Connections telemetry modal open/close', async () => {
    const gearBtn = await page.$('.btn-settings-trigger')
    await gearBtn?.click()
    await page.waitForSelector('.settings-popover', { timeout: 3000 })

    const items = await page.$$('.settings-popover-item')
    let clicked = false
    for (const item of items) {
      const text = await page.evaluate(el => el.textContent, item)
      if (text?.includes('Connections')) {
        await item.click()
        clicked = true
        break
      }
    }
    if (!clicked) throw new Error('Connections item not found in settings popover')

    await page.waitForSelector('.modal-card, .shadcn-dialog-panel', { timeout: 3000 })
    await page.screenshot({ path: join(PROOFS_DIR, 'modal_connections_telemetry.png') })

    await page.keyboard.press('Escape')
    await page.waitForSelector('.modal-card, .shadcn-dialog-panel', { hidden: true, timeout: 3000 })
  })
}
