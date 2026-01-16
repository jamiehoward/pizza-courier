const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Listen for console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // Listen for errors
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:8080');

  // Wait a bit to see what happens
  await page.waitForTimeout(5000);

  // Take a screenshot
  await page.screenshot({ path: 'screenshot.png' });

  await browser.close();
})();
