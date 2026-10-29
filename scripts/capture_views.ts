import puppeteer from 'puppeteer-core';
import path from 'path';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=new'],
    defaultViewport: { width: 1440, height: 900 }
  });

  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3100', { waitUntil: 'networkidle2' });

    // 1. Capture Jobs view
    await page.evaluate(() => {
      // @ts-ignore
      window.switchView('jobs');
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.resolve('data/screenshots/view_jobs_clean.png') });
    console.log('Saved data/screenshots/view_jobs_clean.png');

    // 2. Capture Schedule view
    await page.evaluate(() => {
      // @ts-ignore
      window.switchView('schedule');
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.resolve('data/screenshots/view_schedule_clean.png') });
    console.log('Saved data/screenshots/view_schedule_clean.png');

    // 3. Capture Settings view
    await page.evaluate(() => {
      // @ts-ignore
      window.switchView('settings');
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.resolve('data/screenshots/view_settings_clean.png') });
    console.log('Saved data/screenshots/view_settings_clean.png');

    // 4. Capture Criteria view
    await page.evaluate(() => {
      // @ts-ignore
      window.switchView('criteria');
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.resolve('data/screenshots/view_criteria_clean.png') });
    console.log('Saved data/screenshots/view_criteria_clean.png');

  } finally {
    await browser.close();
  }
}

capture().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
