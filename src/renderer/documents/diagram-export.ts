import type { DiagramExport } from '../../shared/contracts';
import { pngFromSvg } from '../bpmn/image-export';
import { bridge } from '../platform/bridge';

export async function saveDiagramExport(svg: string, name: string, format: DiagramExport) {
  return format === 'svg'
    ? bridge.saveFile({ name: `${name}.svg`, content: svg, format: 'svg' })
    : bridge.saveFile({ name: `${name}.png`, content: await pngFromSvg(svg, format === 'png-white'), format: 'png' });
}
