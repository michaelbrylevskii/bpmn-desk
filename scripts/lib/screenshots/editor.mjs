import { expect } from '@playwright/test';

export const viewport = { width: 1600, height: 1000 };
export async function prepareEditor(target, theme) {
  await target.getByTitle(`${theme} theme`, { exact: true }).click();
  await target.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
  await target.getByRole('textbox', { name: 'Find element', exact: true }).fill('prepareDocument');
  await target.locator('.outline-item').first().click();
  await target.getByRole('button', { name: 'XML', exact: true }).click();
  await target.getByLabel('Diagram XML').press('Control+f');
  await target.locator('.xml-panel input[name="search"]').fill('flowable');
  await expect(target.locator('.xml-element-tag').first()).toContainText('prepareDocument');
  await target.locator('html').evaluate(() => globalThis.document.fonts.ready);
}

/** Две живые копии UI с одинаковой геометрией; bitmap-редактирования и дорисовки нет. */
export async function captureHero(browser, origin) {
  const page = await browser.newPage({ viewport });
  try {
    await page.route(`${origin}/__docs_hero`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
      <html lang="en"><head><title>BPMN Desk themes</title><style>
        html,body{margin:0;width:${viewport.width}px}iframe{display:block;width:${viewport.width}px;height:${viewport.height}px;border:0}
        body.ready{height:${viewport.height}px;overflow:hidden}body.ready iframe{position:absolute;inset:0}
        body.ready #light{clip-path:inset(0 50% 0 0)}body.ready #dark{clip-path:inset(0 0 0 50%)}
        body.ready::after{content:'';position:absolute;left:50%;top:0;bottom:0;width:2px;background:#7b8dab;pointer-events:none}
      </style></head><body><iframe id="light" title="Light theme" src="${origin}"></iframe><iframe id="dark" title="Dark theme" src="${origin}"></iframe></body></html>` }));
    await page.goto(`${origin}/__docs_hero`);
    const light = page.frameLocator('#light'); const dark = page.frameLocator('#dark');
    await prepareEditor(light, 'Light'); await prepareEditor(dark, 'Dark');
    await expect(light.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(dark.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.evaluate(() => { globalThis.document.body.classList.add('ready'); globalThis.scrollTo(0, 0); });
    await page.screenshot({ path: 'docs/images/hero.png' });
  } finally { await page.close(); }
}
