import { runtimeChannels as c, type RuntimeBridge } from '../../shared/runtime';

export function runtimeBridge(invoke: (channel: string, ...args: unknown[]) => Promise<unknown>): RuntimeBridge {
  // Main проверяет каждый запрос и декодирует ответы движка в эти контракты.
  const call = <T>(channel: string, ...args: unknown[]): Promise<T> => invoke(channel, ...args) as Promise<T>;
  return {
    connections: () => call(c.connections), saveConnection: input => call(c.save, input), deleteConnection: id => call(c.delete, id), testConnection: id => call(c.test, id),
    definitions: (id, query) => call(c.definitions, id, query), instances: (id, query) => call(c.instances, id, query), deadLetters: (id, query) => call(c.deadLetters, id, query),
    diagram: (id, definition) => call(c.diagram, id, definition), snapshot: (id, instance) => call(c.snapshot, id, instance),
    executionVariables: (id, execution) => call(c.executionVariables, id, execution), stacktrace: (id, job) => call(c.stacktrace, id, job),
  };
}
