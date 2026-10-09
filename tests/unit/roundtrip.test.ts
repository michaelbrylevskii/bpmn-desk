import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkImport, createModdle, parseExtensions } from '../../src/renderer/bpmn/codec';
import provenance from '../../examples/provenance.json';
import { preservationIssues, parseXml } from '../../src/renderer/bpmn/xml';

const names = provenance.map(record => record.file.replace('.bpmn20.xml', ''));
describe('BPMN / профили движков roundtrip', () => {
  it.each(names)('сохраняет атрибуты и extensionElements схемы %s', async name => {
    const xml = readFileSync(join('examples', `${name}.bpmn20.xml`), 'utf8');
    const first = await checkImport(xml);
    expect(first.warnings).toEqual([]);
    const second = await checkImport(first.xml);
    expect(second.warnings).toEqual([]);
    expect(preservationIssues(xml, second.xml)).toEqual([]);
  });

  it('сохраняет неизвестные вложенные расширения и атрибуты с другим prefix', async () => {
    const xml = `<b:definitions xmlns:b="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:custom="urn:custom" targetNamespace="test"><b:process id="p"><b:serviceTask id="task" custom:flag="value"><b:extensionElements><custom:nested custom:kind="x"><custom:child><![CDATA[ expression < 2 ]]></custom:child></custom:nested></b:extensionElements></b:serviceTask></b:process></b:definitions>`;
    expect((await checkImport(xml)).warnings).toEqual([]);
    const extension = await parseExtensions('<bpmn:extensionElements xmlns:custom="urn:custom"><custom:value>new</custom:value></bpmn:extensionElements>', xml);
    expect(extension?.get<unknown[]>('values')).toHaveLength(1);
  });

  it('сохраняет неизвестные теги самого Camunda namespace без descriptor', async () => {
    const xml = `<b:definitions xmlns:b="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:c7="http://camunda.org/schema/1.0/bpmn" targetNamespace="test"><b:process id="p"><b:serviceTask id="task"><b:extensionElements><c7:future c7:mode="strict"><c7:nested c7:flag="yes"><![CDATA[ value < 2 ]]></c7:nested></c7:future></b:extensionElements></b:serviceTask></b:process></b:definitions>`;
    const first = await checkImport(xml);
    expect(first.warnings).toEqual([]);
    expect((await checkImport(first.xml)).warnings).toEqual([]);
    expect(preservationIssues(xml, first.xml)).toEqual([]);
  });

  it('обнаруживает потерянные project extensions', () => {
    const xml = readFileSync(join('examples', 'flowable-showcase.bpmn20.xml'), 'utf8');
    const altered = xml.replace(/demo:outcome="[^"]*"/g, '');
    expect(preservationIssues(xml, altered).length).toBeGreaterThan(0);
  });

  it('отклоняет malformed XML и DTD', () => {
    expect(() => parseXml('<broken>')).toThrow();
    expect(() => parseXml('<!DOCTYPE xml><xml/>')).toThrow('DTD');
  });

  it('позволяет изменить Flowable-атрибут через модель', async () => {
    const xml = readFileSync(join('examples', 'flowable-showcase.bpmn20.xml'), 'utf8');
    const moddle = createModdle();
    const { rootElement } = await moddle.fromXML(xml);
    const process = rootElement.get<import('../../src/renderer/bpmn/types').ModdleElement[]>('rootElements').find(e => e.$type === 'bpmn:Process');
    const task = process?.get<import('../../src/renderer/bpmn/types').ModdleElement[]>('flowElements').find(e => e.$type === 'bpmn:ServiceTask');
    expect(task).toBeDefined();
    if (task) task.$attrs['flowable:delegateExpression'] = '${editedDelegate}';
    expect((await moddle.toXML(rootElement)).xml).toContain('${editedDelegate}');
  });
});
