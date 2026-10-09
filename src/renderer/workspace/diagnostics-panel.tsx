import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import type { Diagnostic } from '../bpmn/types';
import { useI18n } from '../i18n/provider';
export function DiagnosticsPanel({ diagnostics, onSelect, onArrange }: { diagnostics: Diagnostic[]; onSelect: (id: string) => void; onArrange: (id: string) => void }) {
  const { t, text } = useI18n();
  return <div className="diagnostics-panel">{diagnostics.length ? diagnostics.map((item, index) =>
    <div key={`${index}-${text(item.message)}`} className="diagnostic-row"><button className={`diagnostic ${item.severity}`} onClick={() => item.elementId && onSelect(item.elementId)}>
      <AlertTriangle size={15} /><span>{text(item.message)}</span>{item.elementId && <><code>{item.elementId}</code><ChevronRight size={14} /></>}
    </button>{item.action && item.elementId && <button className="button small" onClick={() => onArrange(item.elementId!)}>{t("Разнести события")}</button>}</div>) : <div className="diagnostics-ok"><CheckCircle2 size={18} />{t("Проблем не обнаружено. Выражения и Java-код проверяются движком процесса.")}</div>}</div>;
}
