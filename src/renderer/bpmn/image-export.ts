import { parseXml } from './xml';

const MAX_SIDE = 16384;
const MAX_PIXELS = 32_000_000;

/** Пиксельные размеры SVG bpmn-js. Масштаб 2× сохраняет читаемость текста. */
export function pngDimensions(svg: string): { width: number; height: number } {
  const root = parseXml(svg).documentElement;
  if (root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('Ожидается SVG схемы.');
  const width = Math.ceil(Number(root.getAttribute('width')) * 2);
  const height = Math.ceil(Number(root.getAttribute('height')) * 2);
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Не удалось определить размеры SVG.');
  if (width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) throw new Error('Схема слишком большая для PNG. Используй SVG.');
  return { width, height };
}

/** Растрируется самодостаточный SVG, без снимка интерфейса или загрузки ресурсов. */
export async function pngFromSvg(svg: string, whiteBackground: boolean): Promise<Uint8Array> {
  const { width, height } = pngDimensions(svg);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Не удалось создать PNG.');
    if (whiteBackground) { context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); }
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Не удалось создать PNG.');
    return new Uint8Array(await blob.arrayBuffer());
  } finally { URL.revokeObjectURL(url); }
}
