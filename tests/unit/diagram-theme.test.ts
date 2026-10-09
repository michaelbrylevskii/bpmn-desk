import { expect, it } from 'vitest';
import { standaloneSvg } from '../../src/renderer/bpmn/diagram-theme';

it('SVG экспорт заменяет переменные темой для печати и сохраняет явные цвета и контраст', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="var(--diagram-fill)" stroke="var(--diagram-stroke)"/><g style="--diagram-text: #172138"><rect fill="#ffffff"/><text fill="var(--diagram-text)">Явный цвет</text></g><text fill="var(--diagram-text)">По умолчанию</text></svg>';
  const exported = standaloneSvg(svg);
  expect(exported).not.toContain('var(');
  expect(exported).toContain('stroke="#263244"');
  expect(exported).toContain('fill="#ffffff"');
  expect(exported).toContain('fill="#172138"');
});
