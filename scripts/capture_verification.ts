import puppeteer from 'puppeteer-core'

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })

    // 1. Capture Review Tab Table
    console.log('Navigating to Web Console...')
    await page.goto('http://localhost:3100', { waitUntil: 'networkidle0' })
    await new Promise(r => setTimeout(r, 1200))
    await page.screenshot({ path: 'data/screenshots/01_review_tab_ajaib_sevima.png' })
    console.log('Saved data/screenshots/01_review_tab_ajaib_sevima.png')

    // 2. Open Ajaib (Job 63) Form Fill Preview
    await page.evaluate(() => {
      // @ts-ignore
      if (typeof window.openDetailsModal === 'function') {
        // @ts-ignore
        window.openDetailsModal('63', 1)
      }
    })
    await new Promise(r => setTimeout(r, 1500))
    await page.screenshot({ path: 'data/screenshots/02_ajaib_form_preview.png' })
    console.log('Saved data/screenshots/02_ajaib_form_preview.png')

    // Close modal
    await page.evaluate(() => {
      // @ts-ignore
      if (typeof window.closeModal === 'function') {
        // @ts-ignore
        window.closeModal()
      }
    })
    await new Promise(r => setTimeout(r, 500))

    // 3. Open SEVIMA (Job 67) Form Fill Preview
    await page.evaluate(() => {
      // @ts-ignore
      if (typeof window.openDetailsModal === 'function') {
        // @ts-ignore
        window.openDetailsModal('67', 1)
      }
    })
    await new Promise(r => setTimeout(r, 1500))
    await page.screenshot({ path: 'data/screenshots/03_sevima_form_preview.png' })
    console.log('Saved data/screenshots/03_sevima_form_preview.png')

    // Scroll down in modal to show attached documents
    await page.evaluate(() => {
      const modalContent = document.getElementById('modalContent')
      if (modalContent) modalContent.scrollTop = modalContent.scrollHeight
    })
    await new Promise(r => setTimeout(r, 600))
    await page.screenshot({ path: 'data/screenshots/04_sevima_form_preview_scrolled.png' })
    console.log('Saved data/screenshots/04_sevima_form_preview_scrolled.png')
  } finally {
    await browser.close()
  }
}

capture().catch(err => {
  console.error(err)
  process.exit(1)
})
