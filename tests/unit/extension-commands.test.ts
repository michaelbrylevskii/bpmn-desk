import { describe, expect, it } from 'vitest';
import { createModdle } from '../../src/renderer/bpmn/codec';
import { ExtensionCommands } from '../../src/renderer/bpmn/extension-commands';
import { extensionChildren, extensionValues } from '../../src/renderer/bpmn/extensions';
import { namespacedKey, namespacePrefix, namespaceUri } from '../../src/renderer/bpmn/namespaces';
import type { DiagramElement, ModdleElement } from '../../src/renderer/bpmn/types';
import { preservationIssues } from '../../src/renderer/bpmn/xml';

const namespace = { uri: 'http://camunda.org/schema/1.0/bpmn', prefix: 'camunda' };
const source = `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:c="${namespace.uri}" xmlns:flowable="http://flowable.org/bpmn" xmlns:x="urn:custom" targetNamespace="test"><bpmn:process id="p"><bpmn:serviceTask id="task" c:delegateExpression="\${bean}"><bpmn:extensionElements><c:inputOutput><c:inputParameter name="input"><c:map><c:entry key="key">value</c:entry></c:map><x:metadata x:flag="yes"/></c:inputParameter></c:inputOutput><flowable:failedJobRetryTimeCycle>R2/PT1M</flowable:failedJobRetryTimeCycle><c:failedJobRetryTimeCycle>R3/PT2M</c:failedJobRetryTimeCycle></bpmn:extensionElements></bpmn:serviceTask></bpmn:process></bpmn:definitions>`;

async function fixture() {
  const moddle = createModdle();
  const { rootElement } = await moddle.fromXML(source);
  const process = rootElement.get<ModdleElement[]>('rootElements')[0]!;
  const bo = process.get<ModdleElement[]>('flowElements')[0]!;
  const element: DiagramElement = { id: 'task', type: bo.$type, businessObject: bo };
  const old = bo.get<ModdleElement>('extensionElements');
  const commands = new ExtensionCommands(moddle, (_element, values) => {
    const extension = moddle.create('bpmn:ExtensionElements', { values });
    extension.$parent = bo;
    bo.set('extensionElements', extension);
  });
  return { moddle, rootElement, bo, old, element, commands };
}

describe('Общие команды расширений', () => {
  it('изменяет вложенное поле, сохраняет неизвестные данные и исходное дерево для undo', async () => {
    const { moddle, rootElement, bo, old, element, commands } = await fixture();
    commands.edit(element, [0, 0], { name: 'renamed' });
    const xml = (await moddle.toXML(rootElement)).xml;
    expect(xml).toContain('name="renamed"');
    expect(xml).toContain('x:flag="yes"');
    expect(xml).toContain('key="key"');
    expect(extensionChildren(extensionChildren(old.get<ModdleElement[]>('values')[0]!)[0]!)[0]!.$type).toBe('c:map');
    expect(extensionChildren(old.get<ModdleElement[]>('values')[0]!)[0]!.name).toBe('input');
    bo.set('extensionElements', old);
    expect(preservationIssues(source, (await moddle.toXML(rootElement)).xml)).toEqual([]);
  });

  it('добавляет и удаляет вложенное расширение по абсолютному пути', async () => {
    const { bo, element, commands } = await fixture();
    commands.add(element, namespace, 'outputParameter', { name: 'output', $body: '${result}' }, [0]);
    expect(extensionChildren(extensionValues(bo)[0]!)).toHaveLength(2);
    commands.remove(element, [0, 1]);
    expect(extensionChildren(extensionValues(bo)[0]!)).toHaveLength(1);
    const previous = bo.get('extensionElements');
    expect(() => commands.remove(element, [0, 99])).toThrow('больше не существует');
    expect(bo.get('extensionElements')).toBe(previous);
  });

  it('retry одного namespace не меняет retry другого движка', async () => {
    const { moddle, rootElement, element, commands } = await fixture();
    commands.retry(element, namespace, 'R5/PT5M');
    const xml = (await moddle.toXML(rootElement)).xml;
    expect(xml).toContain('<flowable:failedJobRetryTimeCycle>R2/PT1M');
    expect(xml).toContain('<c:failedJobRetryTimeCycle>R5/PT5M');
    expect(xml).not.toContain('R3/PT2M');
  });

  it('учитывает альтернативные префиксы, локальное переопределение и коллизии', async () => {
    const { bo } = await fixture();
    expect(namespacedKey(bo, 'delegateExpression', namespace)).toBe('c:delegateExpression');
    expect(namespaceUri(bo, 'c')).toBe(namespace.uri);
    bo.$attrs['xmlns:c'] = 'urn:other';
    bo.$attrs['xmlns:camunda'] = 'urn:other';
    expect(namespacePrefix(bo, namespace)).toBe('camunda2');
    expect(namespaceUri(bo, 'c')).toBe('urn:other');
  });
});
