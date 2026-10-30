import { EditorView, runScopeHandlers, type ViewUpdate } from '@codemirror/view';
import { SearchQuery, closeSearchPanel, findNext, findPrevious, getSearchQuery, replaceAll, replaceNext, selectMatches, setSearchQuery } from '@codemirror/search';

/** Компактная панель использует штатные query/commands CodeMirror.
 * DOM остаётся тем же при смене темы/языка: сохраняются фокус и ввод. */
export class XmlSearchPanel {
  readonly top = true;
  readonly dom = document.createElement('div');
  private readonly input = document.createElement('input');
  private readonly replacement = document.createElement('input');
  private readonly counter = document.createElement('span');
  private readonly replaceRow = document.createElement('div');
  private readonly replaceToggle: HTMLButtonElement;
  private readonly translated: { node: HTMLElement; phrase: string; text: boolean }[] = [];
  private readonly flags = new Map<'caseSensitive' | 'regexp' | 'wholeWord', HTMLButtonElement>();
  private matches: { from: number; to: number }[] = [];
  private query?: SearchQuery;
  private capped = false;

  constructor(private readonly view: EditorView) {
    this.dom.className = 'cm-search xml-search-panel';
    this.dom.setAttribute('role', 'search');
    const row = document.createElement('div'); row.className = 'xml-search-row';
    this.input.name = 'search'; this.input.setAttribute('main-field', 'true');
    this.input.type = this.replacement.type = 'text'; this.replacement.name = 'replace';
    this.input.className = this.replacement.className = 'xml-search-input';
    this.input.oninput = this.replacement.oninput = () => this.commit();
    this.counter.className = 'xml-search-count'; this.counter.setAttribute('aria-live', 'polite');
    row.append(this.input, this.button('↑', 'Previous match', () => findPrevious(view)), this.button('↓', 'Next match', () => findNext(view)), this.counter);
    for (const [key, text, phrase] of [['caseSensitive', 'Aa', 'Match case'], ['regexp', '.*', 'Regular expression'], ['wholeWord', 'ab', 'Whole words']] as const) {
      const button = this.button(text, phrase, () => this.commit({ [key]: !getSearchQuery(view.state)[key] }));
      button.classList.add('xml-search-flag'); if (key === 'wholeWord') button.classList.add('whole-word');
      this.flags.set(key, button); row.append(button);
    }
    const toggle = this.button('↳', 'Show replacement', () => {
      this.replaceRow.hidden = !this.replaceRow.hidden;
      toggle.setAttribute('aria-expanded', String(!this.replaceRow.hidden));
      if (!this.replaceRow.hidden) this.replacement.focus();
    });
    this.replaceToggle = toggle;
    toggle.setAttribute('aria-expanded', 'false');
    row.append(toggle, this.button('×', 'Close search', () => { closeSearchPanel(view); view.focus(); }));
    this.replaceRow.className = 'xml-search-row xml-replace-row'; this.replaceRow.hidden = true;
    this.replaceRow.append(this.replacement, this.button('Replace', 'Replace', () => replaceNext(view), true),
      this.button('Replace all', 'Replace all', () => replaceAll(view), true), this.button('Select all', 'Select all', () => selectMatches(view), true));
    this.dom.append(row, this.replaceRow);
    this.dom.onkeydown = event => {
      if (event.key === 'Enter') { event.preventDefault(); if (event.target === this.replacement) replaceNext(view); else (event.shiftKey ? findPrevious : findNext)(view); }
      else if (runScopeHandlers(view, event, 'search-panel')) event.preventDefault();
    };
    this.refresh(true);
  }

  mount(): void { this.input.focus(); this.input.select(); }

  private button(text: string, phrase: string, action: () => void, translatedText = false): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
    button.className = translatedText ? 'xml-search-action' : 'xml-search-icon'; button.onclick = action;
    this.translated.push({ node: button, phrase, text: translatedText }); return button;
  }
  private commit(flags: Partial<Pick<SearchQuery, 'caseSensitive' | 'regexp' | 'wholeWord'>> = {}): void {
    const query = getSearchQuery(this.view.state);
    this.view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: this.input.value, replace: this.replacement.value,
      caseSensitive: query.caseSensitive, regexp: query.regexp, wholeWord: query.wholeWord, ...flags })) });
  }
  update(update: ViewUpdate): void { this.refresh(update.docChanged); }
  private refresh(docChanged: boolean): void {
    const state = this.view.state; const query = getSearchQuery(state);
    this.replaceToggle.hidden = state.readOnly;
    if (state.readOnly) { this.replaceRow.hidden = true; this.replaceToggle.setAttribute('aria-expanded', 'false'); }
    this.dom.setAttribute('aria-label', state.phrase('XML search'));
    for (const input of [this.input, this.replacement]) {
      const phrase = state.phrase(input === this.input ? 'Find' : 'Replace');
      input.placeholder = phrase; input.setAttribute('aria-label', phrase);
    }
    for (const { node, phrase, text } of this.translated) {
      node.title = state.phrase(phrase); node.setAttribute('aria-label', state.phrase(phrase));
      if (text) node.textContent = state.phrase(phrase);
    }
    for (const [key, button] of this.flags) button.setAttribute('aria-pressed', String(query[key]));
    if (this.input.value !== query.search) this.input.value = query.search;
    if (this.replacement.value !== query.replace) this.replacement.value = query.replace;
    if (docChanged || !this.query?.eq(query)) {
      this.matches = []; this.capped = false;
      if (query.valid) {
        const cursor = query.getCursor(state);
        for (let step = cursor.next(); !step.done; step = cursor.next()) {
          if (this.matches.length === 10000) { this.capped = true; break; }
          this.matches.push({ from: step.value.from, to: step.value.to });
        }
      }
      this.query = query;
    }
    const selected = state.selection.main;
    const current = this.matches.findIndex(match => match.from === selected.from && match.to === selected.to);
    this.counter.textContent = !query.search ? '' : !query.valid ? state.phrase('Invalid expression') : `${current + 1}/${this.matches.length}${this.capped ? '+' : ''}`;
    this.counter.title = state.phrase('Matches'); this.input.setAttribute('aria-invalid', String(!!query.search && !query.valid));
  }
}
