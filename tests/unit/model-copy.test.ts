import { expect, it } from 'vitest';
import { createModdle } from '../../src/renderer/bpmn/codec';
import { extensionChildren } from '../../src/renderer/bpmn/extensions';
import { configureModelCopy } from '../../src/renderer/bpmn/model-copy';
import type { ModdleElement } from '../../src/renderer/bpmn/types';

it('адаптер копирования сохраняет attrs и независимо клонирует неизвестное дерево', () => {
  const moddle = createModdle();
  let copyProperties: ((context: { sourceElement: ModdleElement; targetElement: ModdleElement }) => void) | undefined;
  let copyProperty: ((context: { property: unknown; parent: ModdleElement }) => ModdleElement | undefined) | undefined;
  configureModelCopy({ on: (name, _priority, listener) => {
    if (name === 'moddleCopy.canCopyProperties') copyProperties = listener as typeof copyProperties;
    else copyProperty = listener as typeof copyProperty;
  } }, moddle);
  const source = moddle.create('bpmn:ServiceTask');
  source.$attrs['custom:mode'] = 'strict';
  const target = moddle.create('bpmn:SendTask');
  copyProperties!({ sourceElement: source, targetElement: target });
  expect(target.$attrs).toEqual({ 'custom:mode': 'strict' });
  target.$attrs['custom:mode'] = 'edited';
  expect(source.$attrs['custom:mode']).toBe('strict');
  const child = moddle.createAny('custom:child', 'urn:custom', { $body: 'text', 'custom:flag': 'yes' });
  const generic = moddle.createAny('custom:root', 'urn:custom', { $children: [child] });
  const result = copyProperty!({ property: generic, parent: target })!;
  expect(result).not.toBe(generic);
  expect(result.$parent).toBe(target);
  expect(extensionChildren(result)[0]).not.toBe(child);
  extensionChildren(result)[0]!.$body = 'new';
  expect(child.$body).toBe('text');
  expect(copyProperty!({ property: source, parent: target })).toBeUndefined();
});
