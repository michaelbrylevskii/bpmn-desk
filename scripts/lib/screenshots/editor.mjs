import { expect } from '@playwright/test';
import process from 'node:process';

export const viewport = { width: 1600, height: 1000 };
export async function openExample(page, name) {
  await page.getByRole('button', { name: 'Create diagram', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Sample diagrams', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
export async function prepareEditor(target, theme) {
  process.stdout.write(`Editor: ${theme}\n`);
  await target.getByTitle(`${theme} theme`, { exact: true }).click();
  await openExample(target, 'flowable-showcase');
  await target.locator('.new-tab').click(); await openExample(target, 'camunda7-showcase');
  await target.getByRole('tab', { name: 'flowable-showcase.bpmn20.xml', exact: true }).click();
  await target.getByRole('textbox', { name: 'Find element', exact: true }).fill('prepareDocument');
  await target.locator('.outline-item').first().click();
  await target.locator('.properties details').first().locator('summary').click();
  await target.getByRole('button', { name: 'XML', exact: true }).click();
  await target.getByLabel('Diagram XML').press('Control+f');
  await target.locator('.xml-panel input[name="search"]').fill('flowable');
  await expect(target.locator('.xml-element-tag').first()).toContainText('prepareDocument');
  await target.locator('html').evaluate(() => globalThis.document.fonts.ready);
}

/** Две живые копии UI с одинаковой геометрией; bitmap-редактирования и дорисовки нет. */
export async function captureHero(browser, origin, darkOrigin) {
  // Разные origin изолируют сохраняемую тему двух живых копий приложения.
  const page = await browser.newPage({ viewport });
  await page.context().grantPermissions(['local-network-access']);
  page.on('pageerror', error => process.stdout.write(`Hero page error: ${error.message}\n`));
  page.on('requestfailed', request => process.stdout.write(`Hero request failed: ${request.url()} ${request.failure()?.errorText}\n`));
  try {
    page.setDefaultTimeout(15000);
    await page.route(`${origin}/__docs_hero`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
      <html lang="en"><head><title>BPMN Desk themes</title><style>
        html,body{margin:0;width:${viewport.width}px;height:${viewport.height}px;overflow:hidden}iframe{position:absolute;inset:0;width:${viewport.width}px;height:${viewport.height}px;border:0}
        #light{z-index:1}#dark{z-index:0}body.dark-preparing #dark{z-index:2}
        body.ready #light{clip-path:inset(0 50% 0 0)}body.ready #dark{clip-path:inset(0 0 0 50%)}
        body.ready::after{content:'';position:absolute;left:50%;top:0;bottom:0;width:2px;background:#7b8dab;pointer-events:none;z-index:3}
      </style></head><body><iframe id="light" title="Light theme" src="${origin}"></iframe><iframe id="dark" title="Dark theme" src="${darkOrigin}"></iframe></body></html>` }));
    await page.goto(`${origin}/__docs_hero`);
    const light = page.frameLocator('#light'); const dark = page.frameLocator('#dark');
    await prepareEditor(light, 'Light');
    await page.evaluate(() => globalThis.document.body.classList.add('dark-preparing'));
    await prepareEditor(dark, 'Dark');
    await expect(light.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(dark.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.evaluate(() => { globalThis.document.body.classList.add('ready'); globalThis.scrollTo(0, 0); });
    await page.screenshot({ path: 'docs/images/hero.png' });
  } finally { await page.close(); }
}
