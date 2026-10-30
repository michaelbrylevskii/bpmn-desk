import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch, close } from './runtime-fixture';
import { historyServer } from './history-server';

// Original BPMN Desk test diagram. License: MIT. Dense boundary events reproduce badge collisions.
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" targetNamespace="https://bpmndesk.org/test">
<process id="deskHistory" isExecutable="true">
  <userTask id="HistoryReview" name="Create invoice"/>
  <boundaryEvent id="BoundaryA" attachedToRef="HistoryReview"><messageEventDefinition/></boundaryEvent>
  <boundaryEvent id="BoundaryB" attachedToRef="HistoryReview"><messageEventDefinition/></boundaryEvent>
</process>
<bpmndi:BPMNDiagram id="Diagram"><bpmndi:BPMNPlane id="Plane" bpmnElement="deskHistory">
  <bpmndi:BPMNShape id="Task_di" bpmnElement="HistoryReview"><dc:Bounds x="200" y="100" width="130" height="80"/></bpmndi:BPMNShape>
  <bpmndi:BPMNShape id="A_di" bpmnElement="BoundaryA"><dc:Bounds x="210" y="162" width="36" height="36"/></bpmndi:BPMNShape>
  <bpmndi:BPMNShape id="B_di" bpmnElement="BoundaryB"><dc:Bounds x="246" y="162" width="36" height="36"/></bpmndi:BPMNShape>
</bpmndi:BPMNPlane></bpmndi:BPMNDiagram></definitions>`;

test('соседние boundary events и задача получают непересекающиеся бейджи с линиями привязки и теми же позициями в SVG', async () => {
  const api = await historyServer(xml); api.activityIds.push('BoundaryA', 'BoundaryB');
  Object.assign(api.state, { summaryCount: 6, summaryTotal: 6, summaryHistoryCount: 6, summaryHistoryTotal: 6, summaryJobCount: 3 });
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await page.locator('.runtime-row').click();
    const badges = page.locator('.runtime-badge'); await expect(badges).toHaveCount(3);
    const overlap = async () => page.evaluate(() => {
      const badges = [...document.querySelectorAll('.runtime-badge')].map(element => element.getBoundingClientRect());
      const shapes = [...document.querySelectorAll('.runtime-canvas .djs-shape .djs-visual')].map(element => element.getBoundingClientRect());
      const intersects = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      return badges.some((badge, index) => badges.slice(index + 1).some(other => intersects(badge, other)) || shapes.some(shape => intersects(badge, shape)));
    });
    for (const theme of ['Light theme', 'Dark theme']) {
      await page.getByTitle(theme, { exact: true }).click();
      await page.getByTitle('Fit diagram', { exact: true }).click();
      expect(await overlap()).toBe(false);
      await expect(page.locator('.runtime-badge-overlay > svg line')).toHaveCount(3);
      await page.locator('.runtime-canvas').screenshot({ path: `test-results/badge-layout-${theme.startsWith('Light') ? 'light' : 'dark'}.png` });
    }
    const badge = badges.first(); const handle = await badge.elementHandle();
    await page.getByTitle('Refresh state', { exact: true }).click();
    await expect.poll(() => api.state.requests.filter(url => url.pathname.endsWith('/runtime/executions')).length).toBeGreaterThan(1);
    expect(await handle!.evaluate(element => element.isConnected)).toBe(true); expect(await overlap()).toBe(false);
    Object.assign(api.state, { summaryCount: 90, summaryTotal: 90 });
    await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(badges.first()).toContainText('● 30'); expect(await overlap()).toBe(false);
    const filePath = resolve(directory, 'badge-layout.svg');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, filePath);
    await page.getByTitle('Export SVG', { exact: true }).click();
    await expect(async () => expect(await readFile(filePath, 'utf8')).toContain('data-runtime-leader')).toPass();
    const positions = await page.evaluate(svg => {
      const exported = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const matrix = document.querySelector<SVGGElement>('.runtime-canvas .viewport')!.getScreenCTM()!;
      return [...exported.querySelectorAll('[data-runtime-badge]')].map(element => {
        const [x, y] = element.getAttribute('transform')!.match(/-?[\d.]+/g)!.map(Number);
        const point = new DOMPoint(x, y).matrixTransform(matrix);
        const badge = document.querySelector<HTMLElement>(`.runtime-badge[data-activity-id="${element.getAttribute('data-runtime-badge')}"]`)!.getBoundingClientRect();
        return [Math.abs(point.x - badge.x), Math.abs(point.y - badge.y)];
      });
    }, await readFile(filePath, 'utf8'));
    expect(positions).toHaveLength(3); expect(positions.flat().every(delta => delta < 1)).toBe(true);
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
