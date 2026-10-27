import Modeler from 'bpmn-js/lib/Modeler';
import { errorMessage } from '../../shared/errors';
import { defaultLanguage, type Language } from '../../shared/i18n';
import { attributeKey, flowableNamespace } from '../flowable/attributes';
import { FLOWABLE_URI } from '../flowable/descriptor';
import { ExtensionCommands } from './extension-commands';
import { namespaceUri, namespacedKey, type Namespace } from './namespaces';
import { AttributeCommand, type AttributeChange } from './attribute-command';
import { boundaryLayoutIssues, BoundaryLayoutCommand, planBoundaryLayout } from './boundary-layout';
import { checkImport, parseExtensions } from './codec';
import { modelElements, validateModel } from './diagnostics';
import { detectEngines, engineExtensionIds } from '../engines/profiles';
import type { EngineId } from '../engines/contracts';
import { normalizeDiagram } from './diagram-normalization';
import { configureDiagramTheme, rendererColors, standaloneSvg } from './diagram-theme';
import { configureModdle } from './generic-xml';
import { configureModelCopy } from './model-copy';
import { DiagramClipboard } from './clipboard';
import { PreservationGuard } from './preservation-guard';
import { configurePropertyPresence } from './property-presence';
import { configureLabelPresence } from './label-presence';
import { createDefinition, requireUnused } from './root-definitions';
import type { Canvas, CommandStack, EventBus, Modeling, Registry, Selection } from './services';
import { translationModule } from './translate';
import type { DiagramElement, Diagnostic, Moddle, ModdleElement } from './types';
export interface EditorSnapshot {
  engines: EngineId[];
  xml: string;
  selected?: DiagramElement;
  items: DiagramElement[];
  diagnostics: Diagnostic[];
  canUndo: boolean;
  canRedo: boolean;
}

/** Единственная граница взаимодействия UI с bpmn-js. Каждый tab имеет свою модель. */
export class BpmnEditor {
  private readonly modeler: Modeler;
  readonly extensions: ExtensionCommands;
  private baseline = '';
  private warnings: Diagnostic[] = [];
  private readonly guard = new PreservationGuard();
  private generation = 0;
  private importing = false;
  private destroyed = false;
  private fitPending = false;

  constructor(private readonly container: HTMLElement, private readonly notify: (snapshot: EditorSnapshot) => void, private readonly language: () => Language = () => defaultLanguage, clipboard = new DiagramClipboard()) {
    this.modeler = new Modeler({ container, bpmnRenderer: rendererColors, additionalModules: [translationModule(language), { clipboard: ['value', clipboard] }] });
    this.extensions = new ExtensionCommands(this.modeler.get<Moddle>('moddle'), (element, values, target) => this.replaceExtensionValues(element, values, target));
    configureDiagramTheme(this.modeler.get('bpmnRenderer'));
    configurePropertyPresence(this.modeler.get('eventBus'));
    configureLabelPresence(this.modeler.get('eventBus'));
    configureModelCopy(this.modeler.get('eventBus'), this.modeler.get<Moddle>('moddle'), engineExtensionIds);
    configureModdle(this.modeler.get<Moddle>('moddle'));
    this.modeler.get<CommandStack>('commandStack').registerHandler('bpmnDesk.attributes', AttributeCommand);
    this.modeler.get<CommandStack>('commandStack').registerHandler('bpmnDesk.boundaryLayout', BoundaryLayoutCommand);
    const events = this.modeler.get<EventBus>('eventBus');
    events.on('commandStack.changed', () => { if (!this.importing) void this.publish(); });
    events.on('selection.changed', () => { if (!this.importing) void this.publish(); });
  }

  languageChanged(): void {
    this.modeler.get<EventBus>('eventBus').fire('i18n.changed');
    this.modeler.get<{ close(): void }>('popupMenu').close();
    const selected = this.modeler.get<Selection>('selection').get();
    if (selected.length) this.modeler.get<{ open(elements: DiagramElement | DiagramElement[], force: boolean): void }>('contextPad').open(selected.length === 1 ? selected[0]! : selected, true);
  }

  async import(xml: string): Promise<void> {
    const checked = await checkImport(xml);
    // Проверка отдельной модели позволяет оставить текущую диаграмму при ошибке XML.
    if (checked.warnings.length) throw new Error(`Импорт XML отклонён: некорректные или неподдерживаемые BPMN-данные.\n${checked.warnings.join('\n')}`);
    const previous = this.baseline ? await this.xml() : undefined;
    this.importing = true;
    try {
      const result = await this.modeler.importXML(normalizeDiagram(xml));
      this.baseline = xml;
      this.guard.reset(xml, this.allModelElements());
      this.warnings = result.warnings.map(w => ({ severity: 'warning', message: errorMessage(w) }));
      this.fit();
    } catch (error) {
      if (previous) {
        await this.modeler.importXML(previous);
        this.baseline = previous;
        this.guard.reset(previous, this.allModelElements());
        await this.publish();
      }
      throw error;
    } finally { this.importing = false; }
    await this.publish();
  }

  async xml(): Promise<string> {
    const result = await this.modeler.saveXML({ format: true });
    if (!result.xml) throw new Error('Редактор не вернул XML.');
    return result.xml;
  }

  async checkedXml(): Promise<string> {
    const xml = await this.xml();
    const issues = this.guard.issues(xml, this.allModelElements());
    if (issues.length) throw new Error(`Сохранение остановлено: расширения могли потеряться.\n${issues.join('\n')}\nИспользуй XML-режим для явного изменения этих данных.`);
    const checked = await checkImport(xml);
    if (checked.warnings.length) throw new Error(checked.warnings.join('\n'));
    return xml;
  }

  async svg(): Promise<string> { return standaloneSvg((await this.modeler.saveSVG()).svg); }
  undo(): void { this.modeler.get<CommandStack>('commandStack').undo(); }
  redo(): void { this.modeler.get<CommandStack>('commandStack').redo(); }
  fit(): void {
    this.fitPending = true;
    if (!this.container.clientWidth || !this.container.clientHeight) return;
    this.modeler.get<Canvas>('canvas').zoom('fit-viewport', 'auto');
    this.fitPending = false;
  }
  zoom(delta: number): void {
    const canvas = this.modeler.get<Canvas>('canvas');
    canvas.zoom(Math.max(0.15, Math.min(4, canvas.zoom() * delta)));
  }
  arrangeBoundaries(id: string): void {
    const registry = this.modeler.get<Registry>('elementRegistry');
    const host = registry.get(id); if (!host) return;
    const moves = planBoundaryLayout(host, registry.getAll().filter(element => !element.labelTarget));
    this.modeler.get<CommandStack>('commandStack').execute('bpmnDesk.boundaryLayout', { host, moves, modeling: this.modeler.get<Modeling>('modeling') });
  }
  resize(): void {
    if (!this.container.clientWidth || !this.container.clientHeight) return;
    this.modeler.get<Canvas>('canvas').resized();
    // Первое вписывание скрытой вкладки выполняется после её открытия.
    if (this.fitPending) this.fit();
  }
  destroy(): void { this.destroyed = true; this.modeler.destroy(); }
  root(): ModdleElement { return this.modeler.getDefinitions() as unknown as ModdleElement; }
  allModelElements(): ModdleElement[] { return modelElements(this.root()); }

  definition(type: string, remove?: ModdleElement): void {
    const root = this.root();
    if (remove) requireUnused(root, remove);
    const values = root.get<ModdleElement[]>('rootElements');
    const next = remove ? values.filter(value => value !== remove) : [...values, createDefinition(this.modeler.get<Moddle>('moddle'), type, this.language())];
    for (const value of next) value.$parent = root;
    const element = this.modeler.get<Canvas>('canvas').getRootElement();
    this.update(element, 'rootElements', next, root);
  }

  updateDefinition(target: ModdleElement, key: string, value: string): void {
    this.update(this.modeler.get<Canvas>('canvas').getRootElement(), key, value || undefined, target);
  }

  setDefinitionAttribute(target: ModdleElement, namespace: Namespace, name: string, value: string): void {
    this.setEngineAttribute(this.modeler.get<Canvas>('canvas').getRootElement(), namespace, name, value, target);
  }

  select(id: string): void {
    const element = this.modeler.get<Registry>('elementRegistry').get(id);
    if (!element) return;
    this.modeler.get<Selection>('selection').select(element);
    if (element.parent) this.modeler.get<Canvas>('canvas').scrollToElement(element);
    else void this.publish();
  }

  update(element: DiagramElement, key: string, value: unknown, target = element.businessObject): void {
    if (key === 'id') {
      if (typeof value !== 'string' || !/^[A-Za-z_][\w.-]*$/.test(value)) throw new Error('ID: латинская буква или _, затем буквы, цифры, _, . и -.');
      if (this.allModelElements().some(item => item !== target && item.id === value)) throw new Error('Такой ID уже существует.');
    }
    const modeling = this.modeler.get<Modeling>('modeling');
    if (target === element.businessObject) modeling.updateProperties(element, { [key]: value });
    else modeling.updateModdleProperties(element, target, { [key]: value });
  }

  setAttribute(element: DiagramElement, key: string, value: string, uri?: string, target = element.businessObject): void {
    if (!/^[A-Za-z_][\w.-]*:[A-Za-z_][\w.-]*$/.test(key) || key.startsWith('xmlns:')) throw new Error('Атрибут: prefix:name. Объявления xmlns задаются полем URI.');
    const prefix = key.split(':')[0] ?? '';
    const bo = target;
    const binding = namespaceUri(bo, prefix);
    if (uri && binding && uri !== binding) throw new Error('Этот prefix уже связан с другим URI.');
    if (!binding && !uri) throw new Error('Для нового namespace укажи URI.');
    const changes: AttributeChange[] = [];
    if (!binding) {
      changes.push({ target: this.root(), attributes: { ...this.root().$attrs, [`xmlns:${prefix}`]: uri ?? binding ?? '' } });
    }
    const attrs = { ...bo.$attrs };
    if (value === '') delete attrs[key]; else attrs[key] = value;
    this.guard.allow(bo, `attr:{${uri ?? binding}}${key.split(':')[1]}`);
    changes.push({ target: bo, attributes: attrs });
    this.modeler.get<CommandStack>('commandStack').execute('bpmnDesk.attributes', { element, changes });
  }

  setFlowable(element: DiagramElement, name: string, value: string): void {
    this.setAttribute(element, attributeKey(element.businessObject, name), value, FLOWABLE_URI);
  }

  async setExtensions(element: DiagramElement, fragment: string): Promise<void> {
    const extension = await parseExtensions(fragment, await this.xml());
    if (extension) extension.$parent = element.businessObject;
    this.guard.allow(element.businessObject, 'extensions');
    this.update(element, 'extensionElements', extension);
  }

  setExpression(element: DiagramElement, key: string, body: string, target = element.businessObject): void {
    const moddle = this.modeler.get<Moddle>('moddle');
    const value = body.trim() ? moddle.create('bpmn:FormalExpression', { body }) : undefined;
    if (value) value.$parent = target;
    this.update(element, key, value, target);
  }

  setDocumentation(element: DiagramElement, text: string): void {
    const moddle = this.modeler.get<Moddle>('moddle');
    const documentation = moddle.create('bpmn:Documentation', { text });
    documentation.$parent = element.businessObject;
    this.update(element, 'documentation', [documentation]);
  }

  setEngineAttribute(element: DiagramElement, namespace: Namespace, name: string, value: string, target = element.businessObject): void {
    this.setAttribute(element, namespacedKey(target, name, namespace), value, namespace.uri, target);
  }

  setRetry(element: DiagramElement, body: string, namespace: Namespace = flowableNamespace, target = element.businessObject): void { this.extensions.retry(element, namespace, body, target); }
  addExtension(element: DiagramElement, name: string, attributes: Record<string, string>): void { this.extensions.add(element, flowableNamespace, name, attributes); }
  editExtension(element: DiagramElement, index: number, attributes: Record<string, string>): void { this.extensions.edit(element, [index], attributes); }
  removeExtension(element: DiagramElement, index: number): void { this.extensions.remove(element, [index]); }
  editFieldBody(element: DiagramElement, index: number, kind: string, body: string): void { this.extensions.fieldBody(element, [index], flowableNamespace, kind, body); }

  private replaceExtensionValues(element: DiagramElement, values: ModdleElement[], target = element.businessObject): void {
    const extension = values.length ? this.modeler.get<Moddle>('moddle').create('bpmn:ExtensionElements', { values }) : undefined;
    if (extension) { extension.$parent = target; for (const value of values) value.$parent = extension; }
    this.guard.allow(target, 'extensions');
    this.update(element, 'extensionElements', extension, target);
  }

  private async publish(): Promise<void> {
    const generation = ++this.generation;
    const xml = await this.xml();
    if (this.destroyed || generation !== this.generation) return;
    const registry = this.modeler.get<Registry>('elementRegistry');
    const stack = this.modeler.get<CommandStack>('commandStack');
    const selected = this.modeler.get<Selection>('selection').get()[0];
    const issues = this.guard.issues(xml, this.allModelElements());
    const engines = detectEngines(xml);
    this.notify({ xml, engines, selected: selected?.labelTarget ?? selected ?? this.modeler.get<Canvas>('canvas').getRootElement(),
      items: registry.getAll().filter(element => !element.labelTarget),
      diagnostics: [...this.warnings, ...validateModel(this.root(), engines), ...boundaryLayoutIssues(registry.getAll().filter(element => !element.labelTarget)), ...issues.map(message => ({ severity: 'error' as const, message }))],
      canUndo: stack.canUndo(), canRedo: stack.canRedo(),
    });
  }
}
