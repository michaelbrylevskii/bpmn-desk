import { expect, it } from 'vitest';
import { pngDimensions } from '../../src/renderer/bpmn/image-export';

const svg = (width: string, height: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"/>`;
it('PNG получает двойные размеры с округлением вверх', () => {
  expect(pngDimensions(svg('100.5', '50'))).toEqual({ width: 201, height: 100 });
});
it('PNG отвергает некорректный SVG и превышение пределов canvas', () => {
  expect(() => pngDimensions('<document/>')).toThrow('SVG');
  for (const width of ['0', '-1', 'NaN', '100%', 'Infinity']) expect(() => pngDimensions(svg(width, '20'))).toThrow('размеры');
  expect(() => pngDimensions(svg('9000', '20'))).toThrow('слишком большая');
  expect(() => pngDimensions(svg('4000', '4000'))).toThrow('слишком большая');
});
