import { useEffect, useState } from 'react';
import { extensionsXml } from '../bpmn/codec';
import type { BpmnEditor } from '../bpmn/editor';
import type { DiagramElement } from '../bpmn/types';
import { useI18n } from '../i18n/provider';
import { CodeEditor } from '../ui/code-editor';
export function ExtensionsEditor({ element, editor, xml, dark, run }: { element: DiagramElement; editor: BpmnEditor; xml: string; dark: boolean; run: (operation: () => void | Promise<void>) => void }) {
  const { t } = useI18n();
  const [fragment, setFragment] = useState(() => extensionsXml(xml, element.id));
  useEffect(() => { setFragment(extensionsXml(xml, element.id)); }, [xml, element.id]);
  return <>
    <p className="muted">{t("Listeners, поля, in/out mappings и любые вложенные расширения. Неизвестные prefix объявляй в блоке XML.")}</p>
    <div className="extensions-code"><CodeEditor value={fragment} onChange={setFragment} dark={dark} label={t("XML расширений")} /></div>
    <button className="button small" onClick={() => run(() => editor.setExtensions(element, fragment))}>{t("Применить расширения")}</button>
  </>;
}
