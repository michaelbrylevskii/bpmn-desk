import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { xml } from '@codemirror/lang-xml';
import { defaultHighlightStyle, syntaxHighlighting, bracketMatching } from '@codemirror/language';
import { search, searchKeymap, openSearchPanel, closeSearchPanel, searchPanelOpen } from '@codemirror/search';
import { Annotation, Compartment, EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, lineNumbers, keymap, highlightActiveLine, drawSelection } from '@codemirror/view';
import { Search, LocateFixed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/provider';
import { searchPhrases } from '../i18n/search-phrases';
import { XmlSearchPanel } from './xml-search-panel';
import { selectXmlElement, xmlSelection } from './xml-selection';
const externalUpdate = Annotation.define<boolean>();

export function CodeEditor({ value, onChange, dark, selectedId, label = 'XML схемы', readOnly = false }: {
  value: string; onChange?: (value: string) => void; readOnly?: boolean; dark: boolean; selectedId?: string; label?: string;
}) {
  const { t, text, language } = useI18n();
  const locale = useRef(new Compartment());
  const initialLocale = useRef({ language, label });
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const callback = useRef(onChange); callback.current = onChange;
  const initial = useRef(value);
  const theme = useRef(new Compartment());
  const access = useRef(new Compartment());
  const initialReadOnly = useRef(readOnly);
  const initialDark = useRef(dark);
  const [selected, setSelected] = useState<{ id?: string; line?: number }>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const location = selected.id ? selected.line ? t('{id} · строка {line}', { id: selected.id, line: selected.line }) : t('{id} · не найден в XML', { id: selected.id }) : '';

  useEffect(() => {
    if (!container.current) return;
    const view = new EditorView({ parent: container.current, state: EditorState.create({ doc: initial.current, extensions: [
      access.current.of([EditorState.readOnly.of(initialReadOnly.current), EditorView.contentAttributes.of({ 'aria-readonly': String(initialReadOnly.current) })]),
      lineNumbers(), history(), drawSelection(), highlightActiveLine(), bracketMatching(), xml(), syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([indentWithTab, ...searchKeymap, ...defaultKeymap, ...historyKeymap]),
      search({ top: true, createPanel: view => new XmlSearchPanel(view) }), xmlSelection, theme.current.of(initialDark.current ? oneDark : []),
      locale.current.of([EditorState.phrases.of(searchPhrases(initialLocale.current.language)), EditorView.contentAttributes.of({ 'aria-label': initialLocale.current.label })]),
      EditorView.updateListener.of(update => {
        setSearchOpen(searchPanelOpen(update.state));
        if (update.docChanged && !update.transactions.some(transaction => transaction.annotation(externalUpdate))) callback.current?.(update.state.doc.toString());
        const selection = update.state.field(xmlSelection);
        setSelected({ id: selection.id, line: selection.range ? update.state.doc.lineAt(selection.range.from).number : undefined });
      }),
    ] }) });
    editor.current = view;
    return () => { editor.current = null; initial.current = view.state.doc.toString(); view.destroy(); };
  }, []);

  useEffect(() => { editor.current?.dispatch({ effects: locale.current.reconfigure([EditorState.phrases.of(searchPhrases(language)), EditorView.contentAttributes.of({ 'aria-label': text(label) })]) }); }, [language, label, text]);

  useEffect(() => { editor.current?.dispatch({ effects: access.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.contentAttributes.of({ 'aria-readonly': String(readOnly) })]) }); }, [readOnly]);

  useEffect(() => { editor.current?.dispatch({ effects: theme.current.reconfigure(dark ? oneDark : []) }); }, [dark]);

  useEffect(() => {
    const view = editor.current;
    if (view && view.state.doc.toString() !== value) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value }, annotations: externalUpdate.of(true) });
  }, [value]);

  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    view.dispatch({ effects: selectXmlElement.of(selectedId) });
    const range = view.state.field(xmlSelection).range;
    if (range) view.dispatch({ effects: EditorView.scrollIntoView(range.from, { y: 'start', yMargin: 8 }) });
  }, [selectedId]);

  return <div className="code-editor-shell"><div className="code-editor-tools">
    <button className="button small ghost" title={t('Поиск в XML (Ctrl+F)')} aria-pressed={searchOpen} onClick={() => {
      const view = editor.current;
      if (!view) return;
      if (searchPanelOpen(view.state)) { closeSearchPanel(view); view.focus(); }
      else openSearchPanel(view);
    }}><Search size={13} />{t('Поиск')}</button>
    <span className="xml-location" title={location}>{location}</span>
    {selectedId && <button className="icon-button" title={t('Перейти к XML выбранного элемента')} onClick={() => {
      const view = editor.current; const range = view?.state.field(xmlSelection).range;
      if (view && range) view.dispatch({ effects: EditorView.scrollIntoView(range.from, { y: 'start', yMargin: 8 }) });
    }}><LocateFixed size={14} /></button>}
  </div><div className="code-editor" ref={container} /></div>;
}
