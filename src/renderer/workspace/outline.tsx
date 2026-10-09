import { Search, Circle, Diamond, Square, GitBranch } from 'lucide-react';
import { useState } from 'react';
import type { BpmnEditor, EditorSnapshot } from '../bpmn/editor';
import { useI18n } from '../i18n/provider';
export function Outline({ snapshot, editor }: { snapshot: EditorSnapshot; editor: BpmnEditor }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const items = snapshot.items.filter(item => `${item.id} ${item.businessObject.name ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  return <aside className="outline">
    <div className="panel-heading"><GitBranch size={16} />{t("Элементы")}<span className="badge">{snapshot.items.length}</span></div>
    <label className="search"><Search size={15} /><input aria-label={t("Найти элемент")} placeholder={t("Название или ID…")} value={query} onChange={e => setQuery(e.target.value)} /></label>
    <div className="outline-list">{items.map(item => {
      const Icon = item.type.includes('Event') ? Circle : item.type.includes('Gateway') ? Diamond : item.type.includes('Flow') ? GitBranch : Square;
      return <button key={item.id} className={`outline-item ${snapshot.selected?.id === item.id ? 'selected' : ''}`} onClick={() => editor.select(item.id)} title={`${item.type}\n${item.id}`}>
        <Icon size={14} /><span><strong>{item.businessObject.name || item.id}</strong><small>{item.id}</small></span>
      </button>;
    })}{!items.length && <p className="muted empty-search">{t("Нет совпадений")}</p>}</div>
  </aside>;
}
