const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const blocked = [];
  const requests = [];

  page.on('console', (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to load|gtag|googletagmanager/i.test(t)) blocked.push(t);
  });
  page.on('requestfailed', (r) => {
    if (/google|gtag/i.test(r.url())) requests.push(`FAILED ${r.url()} :: ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    if (/googletagmanager|google-analytics|analytics\.google/i.test(r.url()))
      requests.push(`${r.status()} ${r.url().slice(0, 110)}`);
  });

  await page.goto(process.argv[2] || 'https://visibleshelf.com', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);

  const state = await page.evaluate(() => ({
    dataLayerLen: (window.dataLayer || []).length,
    hasGtag: typeof window.gtag,
    gtmScripts: [...document.querySelectorAll('script[src*="googletagmanager"]')].map((s) => s.src),
  }));

  console.log('--- google requests ---');
  console.log(requests.length ? requests.join('\n') : '(none)');
  console.log('--- console CSP/gtag messages ---');
  console.log(blocked.length ? blocked.join('\n') : '(none)');
  console.log('--- window state ---');
  console.log(JSON.stringify(state, null, 2));

  await browser.close();
})();
