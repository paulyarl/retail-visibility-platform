const { chromium } = require('@playwright/test');

const SLUGS = [
  'ethiopian-market-llc',
  'arsema-g-food-mart-llc',
  'baraka-market',
  'attari-supermarket',
  'garaya-african-market-llc',
  'janjai-redlight-market-inc',
  'raja-bazaar-milwaukee-2',
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const slug of SLUGS) {
    const logs = [];
    page.on('console', (m) => {
      const t = m.text();
      if (/styled|qr|QR|fail/i.test(t)) logs.push(t.slice(0, 160));
    });
    try {
      await page.goto(`https://www.visibleshelf.com/place/${slug}`, {
        waitUntil: 'networkidle',
        timeout: 60000,
      });
      try {
        await page.getByRole('button', { name: /Market Intel/i }).first().click({ timeout: 3000 });
      } catch {}
      await page.waitForTimeout(6000);
      const res = await page.evaluate(async () => {
        const decode = (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const c = document.createElement('canvas');
              c.width = img.naturalWidth;
              c.height = img.naturalHeight;
              const ctx = c.getContext('2d');
              ctx.drawImage(img, 0, 0);
              const d = ctx.getImageData(0, 0, c.width, c.height).data;
              let nw = 0;
              for (let k = 0; k < d.length; k += 4 * 53) {
                if (!(d[k] > 245 && d[k + 1] > 245 && d[k + 2] > 245) && d[k + 3] > 0) nw++;
              }
              resolve({ w: c.width, nonWhite: nw });
            };
            img.onerror = () => resolve({ error: 'decode-failed' });
            img.src = src;
          });
        const out = [];
        for (const el of Array.from(document.querySelectorAll('img'))) {
          const s = el.src || '';
          if (!s.startsWith('data:image')) continue;
          out.push({ alt: el.alt, len: s.length, ...(await decode(s)) });
        }
        return out;
      });
      console.log(`${slug}: ${JSON.stringify(res)}${logs.length ? ' LOGS=' + logs.join('|') : ''}`);
    } catch (e) {
      console.log(`${slug}: ERROR ${e.message.split('\n')[0]}`);
    }
  }
  await browser.close();
})();
