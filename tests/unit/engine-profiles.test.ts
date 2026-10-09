import { describe, expect, it } from 'vitest';
import { createModdle, checkImport } from '../../src/renderer/bpmn/codec';
import { validateModel } from '../../src/renderer/bpmn/diagnostics';
import { diagramTemplate } from '../../src/renderer/bpmn/template';
import type { ModdleElement } from '../../src/renderer/bpmn/types';
import { camundaFieldsFor, camundaNamespace } from '../../src/renderer/camunda/forms';
import { detectEngines } from '../../src/renderer/engines/profiles';
import { translate } from '../../src/shared/i18n';

const diagram = (content: string, declarations = '') => `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:c="${camundaNamespace.uri}" ${declarations} targetNamespace="test"><bpmn:process id="p"><bpmn:startEvent id="start"/>${content}</bpmn:process></bpmn:definitions>`;

describe('Профили движков', () => {
  it.each(['bpmn', 'flowable', 'camunda7'] as const)('профиль %s сохраняется в пустой схеме после roundtrip', async profile => {
    const xml = diagramTemplate((key, parameters) => translate('en', key, parameters), profile);
    expect(xml).toContain('name="New process"');
    expect(detectEngines((await checkImport(xml)).xml)).toEqual(profile === 'bpmn' ? [] : [profile]);
  });

  it('определяет URI атрибутов и расширений, предпочитая их неиспользуемым объявлениям', () => {
    expect(detectEngines(diagram('<bpmn:serviceTask id="task" c:class="org.example.Work"/>', 'xmlns:flowable="http://flowable.org/bpmn"'))).toEqual(['camunda7']);
    expect(detectEngines(diagram('<bpmn:userTask id="task"><bpmn:extensionElements><c:formData/></bpmn:extensionElements></bpmn:userTask>'))).toEqual(['camunda7']);
    expect(detectEngines(diagram('<bpmn:serviceTask id="task" c:type="external" flowable:async="true"/>', 'xmlns:flowable="http://flowable.org/bpmn"'))).toEqual(['flowable', 'camunda7']);
    expect(detectEngines(diagram('').replace(camundaNamespace.uri, 'http://camunda.org/schema/1.0/zeebe'))).toEqual([]);
  });

  it('обычный BPMN и Camunda external task не получают предупреждение Flowable', async () => {
    const moddle = createModdle();
    const { rootElement } = await moddle.fromXML(diagram('<bpmn:serviceTask id="task" c:type="external" c:topic="work"/>'));
    expect(validateModel(rootElement, ['camunda7'])).toEqual([]);
    expect(validateModel(rootElement, [])).toEqual([]);
    const process = rootElement.get<ModdleElement[]>('rootElements')[0]!;
    const task = process.get<ModdleElement[]>('flowElements')[1]!;
    delete task.$attrs['c:topic'];
    expect(validateModel(rootElement, ['camunda7']).map(issue => issue.message)).toEqual(['Внешняя задача Camunda 7: не задана тема.']);
  });

  it('проверяет version bindings и применимость форм с сохранением существующих атрибутов', async () => {
    const { rootElement } = await createModdle().fromXML(diagram('<bpmn:callActivity id="call" calledElement="other" c:calledElementBinding="versionTag"/>'));
    expect(validateModel(rootElement, ['camunda7']).map(issue => issue.message)).toEqual(['Camunda 7: для versionTag укажи calledElementVersionTag.']);
    const process = rootElement.get<ModdleElement[]>('rootElements')[0]!;
    expect(camundaFieldsFor(process).map(field => field.name)).not.toContain('asyncBefore');
    const call = process.get<ModdleElement[]>('flowElements')[1]!;
    expect(camundaFieldsFor(call).map(field => field.name)).toContain('calledElementBinding');
    expect(camundaFieldsFor(call).map(field => field.name)).not.toContain('assignee');
  });
});
