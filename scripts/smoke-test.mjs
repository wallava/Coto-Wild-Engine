import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const VITE_PORT = 5173;
const TIMEOUT_MS = 15000;

async function main() {
  const vite = spawn('npm', ['run', 'dev'], { stdio: ['ignore', 'pipe', 'pipe'] });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite no arrancó en 15s')), TIMEOUT_MS);
    vite.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('ready in')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    vite.stderr.on('data', (chunk) => {
      if (chunk.toString().toLowerCase().includes('error')) {
        clearTimeout(timeout);
        reject(new Error('Vite tiró error: ' + chunk.toString()));
      }
    });
  });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  try {
    await page.goto(`http://localhost:${VITE_PORT}`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(3000);
  } catch (err) {
    pageErrors.push(`Page load failed: ${err.message}`);
  }

  await browser.close();
  vite.kill();

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    console.error('SMOKE TEST FAILED');
    if (consoleErrors.length) {
      console.error('Console errors:');
      consoleErrors.forEach((e) => console.error('  -', e));
    }
    if (pageErrors.length) {
      console.error('Page errors:');
      pageErrors.forEach((e) => console.error('  -', e));
    }
    process.exit(1);
  }

  console.log('SMOKE TEST PASSED');
  process.exit(0);
}

main().catch((err) => {
  console.error('SMOKE TEST CRASHED:', err.message);
  process.exit(1);
});
