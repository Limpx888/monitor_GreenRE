import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'test-output');
fs.mkdirSync(outDir, { recursive: true });

const url = process.env.APP_URL || 'http://localhost:5173/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);

const labelCount = await page.locator('.floor-label-item').count();
await page.getByRole('button', { name: /L14–L28/i }).click();
await page.waitForURL('**/floor/l14-28', { timeout: 10000 });
await page.waitForTimeout(400);

const backVisible = await page.locator('.floor-back-btn').isVisible();
const shotBlank = path.join(outDir, 'floor-blank.png');
await page.screenshot({ path: shotBlank, fullPage: false });

await page.locator('.floor-back-btn').click();
await page.waitForURL('**/', { timeout: 10000 });
await page.waitForTimeout(400);

const shotDash = path.join(outDir, 'dashboard-labels.png');
await page.screenshot({ path: shotDash, fullPage: false });

const fatal = errors.filter((e) => !e.includes('Download the React DevTools'));
const result = {
  ok: labelCount >= 11 && backVisible && fatal.length === 0,
  labelCount,
  backVisible,
  errors: fatal,
  screenshots: { blank: shotBlank, dashboard: shotDash },
};

fs.writeFileSync(path.join(outDir, 'smoke-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(result.ok ? 0 : 1);
