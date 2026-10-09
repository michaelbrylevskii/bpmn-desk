import { Workflow, FilePlus2, FolderOpen, Save, Undo2, Redo2, Download, Moon, Sun, CopyPlus, Globe } from 'lucide-react';
import { version } from '../../../package.json';
import type { Language } from '../../shared/i18n';
import { useI18n } from '../i18n/provider';
export function Toolbar({ hasDocument, canUndo, canRedo, dark, onAction, onLanguage }: {
  hasDocument: boolean; canUndo: boolean; canRedo: boolean; dark: boolean; onAction: (name: string) => void; onLanguage: (language: Language) => void;
}) {
  const { t, language } = useI18n();
  return <header className="toolbar"><div className="brand"><div className="brand-icon"><Workflow size={21} /></div><strong>BPMN<span>Desk</span></strong><span className="version">{version}</span></div>
    <div className="toolbar-divider" />
    <button className="icon-button" title={t("Новая схема (Ctrl+N)")} onClick={() => onAction('new')}><FilePlus2 size={19} /></button>
    <button className="button ghost" title={t("Открыть (Ctrl+O)")} onClick={() => onAction('open')}><FolderOpen size={18} />{t("Открыть")}</button>
    <button className="button primary" disabled={!hasDocument} title={t("Сохранить (Ctrl+S)")} onClick={() => onAction('save')}><Save size={17} />{t("Сохранить")}</button>
    <button className="icon-button" disabled={!hasDocument} title={t("Сохранить как (Ctrl+Shift+S)")} onClick={() => onAction('save-as')}><CopyPlus size={18} /></button>
    <div className="toolbar-divider" /><button className="icon-button" disabled={!canUndo} title={t("Отменить (Ctrl+Z)")} onClick={() => onAction('undo')}><Undo2 size={18} /></button>
    <button className="icon-button" disabled={!canRedo} title={t("Повторить (Ctrl+Shift+Z)")} onClick={() => onAction('redo')}><Redo2 size={18} /></button>
    <span className="toolbar-spacer" /><label className="language-picker" title={t('Язык')}><Globe size={16} /><select aria-label={t('Язык')} value={language} onChange={event => onLanguage(event.target.value as Language)}><option value="en">EN</option><option value="ru">RU</option></select></label><span className="offline"><i />{t("Локально")}</span>
    <button className="button ghost" disabled={!hasDocument} title={t("Экспорт SVG")} onClick={() => onAction('export')}><Download size={16} />SVG</button>
    <button className="icon-button" title={dark ? t("Светлая тема") : t("Тёмная тема")} onClick={() => onAction('theme')}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
  </header>;
}
