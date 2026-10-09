import { describe, expect, it } from 'vitest';
import { createModdle } from '../../src/renderer/bpmn/codec';
import { modelElements } from '../../src/renderer/bpmn/diagnostics';
import { PreservationGuard } from '../../src/renderer/bpmn/preservation-guard';

describe('PreservationGuard', () => {
  it('сохраняет защиту расширений при переименовании и undo', async () => {
    const source = '<b:definitions xmlns:b="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:c="urn:custom" targetNamespace="test"><b:process id="p"><b:serviceTask id="task" c:flag="secret"/></b:process></b:definitions>';
    const moddle = createModdle();
    const { rootElement } = await moddle.fromXML(source);
    const items = modelElements(rootElement);
    const task = items.find(item => item.id === 'task')!;
    const guard = new PreservationGuard(); guard.reset(source, items);
    task.id = 'renamed';
    expect(guard.issues((await moddle.toXML(rootElement)).xml, items)).toEqual([]);
    delete task.$attrs['c:flag'];
    expect(guard.issues((await moddle.toXML(rootElement)).xml, items)).toHaveLength(1);
    task.id = 'task';
    expect(guard.issues((await moddle.toXML(rootElement)).xml, items)).toHaveLength(1);
    guard.allow(task, 'attr:{urn:custom}flag');
    expect(guard.issues((await moddle.toXML(rootElement)).xml, items)).toEqual([]);
  });
});
