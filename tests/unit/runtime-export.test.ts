import { expect, it } from 'vitest';
import { runtimeSvg } from '../../src/renderer/bpmn/runtime-export';
import { elements, parseXml } from '../../src/renderer/bpmn/xml';

it('экспорт переносит runtime состояние в самодостаточный SVG с центрированными метками', () => {
  const source = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="100 50 400 200"><g data-element-id="Task"><g class="djs-visual"><rect fill="var(--diagram-fill)" stroke="var(--diagram-stroke)"/></g><rect class="djs-outline"/><path class="djs-hit"/></g><g data-element-id="Scope"><g class="djs-visual"><rect/></g></g></svg>';
  const exported = runtimeSvg(source, [
    { id: 'Task', marker: 'runtime-failed', label: '! 2', x: 192, y: 122 },
    { id: 'Scope', marker: 'runtime-active', label: '', x: 300, y: 150 },
  ]);
  expect(exported).not.toMatch(/var\(|djs-outline|djs-hit/);
  const nodes = elements(parseXml(exported));
  expect(nodes.find(node => node.getAttribute('stroke') === '#b4233a')?.getAttribute('stroke-width')).toBe('3');
  const badge = nodes.find(node => node.getAttribute('data-runtime-badge') === 'Task')!;
  expect(badge.getAttribute('transform')).toBe('translate(192,122)');
  const text = Array.from(badge.childNodes).find(node => node.nodeName === 'text') as Element;
  expect(text.textContent).toBe('! 2'); expect(text.getAttribute('text-anchor')).toBe('middle'); expect(text.getAttribute('y')).toBe('11');
  expect(nodes.find(node => node.nodeName === 'circle')?.getAttribute('cy')).toBe('11');
  expect(parseXml(exported).documentElement.getAttribute('viewBox')).toBe('76 26 448 248');
});

it('экспорт текущей плоскости не добавляет скрытые метки и не обрезает длинный бейдж', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><g data-element-id="Task"><g class="djs-visual"><rect/></g></g></svg>';
  const result = runtimeSvg(svg, [
    { id: 'Task', marker: 'runtime-failed', label: '! 5000', x: 92, y: 92 },
    { id: 'HiddenChild', marker: 'runtime-active', label: '1', x: -5000, y: -5000 },
  ]);
  expect(result).not.toContain('HiddenChild');
  expect(parseXml(result).documentElement.getAttribute('viewBox')).toBe('-24 -24 194 162');
});
