import { Workflow, FilePlus2, FolderOpen, Save, Undo2, Redo2, CopyPlus, Globe } from 'lucide-react';
import { version } from '../../../package.json';
import type { Language } from '../../shared/i18n';
import type { DiagramExport } from '../../shared/contracts';
import { useI18n } from '../i18n/provider';
import { ExportMenu } from './export-menu';
import { ThemePicker } from './theme-picker';
import { Select } from './select';
import type { ThemeMode } from './use-theme';
export function Toolbar({ hasDocument, canUndo, canRedo, theme, onTheme, onAction, onLanguage, onExport, runtimeTools, canExport }: {
  runtimeTools?: React.ReactNode; canExport: boolean; onExport: (format: DiagramExport) => void;
  theme: ThemeMode; onTheme: (mode: ThemeMode) => void;
  hasDocument: boolean; canUndo: boolean; canRedo: boolean; onAction: (name: string) => void; onLanguage: (language: Language) => void;
}) {
  const { t, language } = useI18n();
  return <header className="toolbar"><div className="brand"><div className="brand-icon"><Workflow size={21} /></div><strong>BPMN<span>Desk</span></strong><span className="version">{version}</span></div>
    <div className="toolbar-divider" /><button className="icon-button" title={t('Новая вкладка (Ctrl+N)')} onClick={() => onAction('new')}><FilePlus2 size={19} /></button>
    <button className="button ghost" title={t('Открыть (Ctrl+O)')} onClick={() => onAction('open')}><FolderOpen size={18} />{t('Открыть')}</button>
    {runtimeTools ?? <><button className="button primary" disabled={!hasDocument} title={t('Сохранить (Ctrl+S)')} onClick={() => onAction('save')}><Save size={17} />{t('Сохранить')}</button>
      <button className="icon-button" disabled={!hasDocument} title={t('Сохранить как (Ctrl+Shift+S)')} onClick={() => onAction('save-as')}><CopyPlus size={18} /></button>
      <div className="toolbar-divider" /><button className="icon-button" disabled={!canUndo} title={t('Отменить (Ctrl+Z)')} onClick={() => onAction('undo')}><Undo2 size={18} /></button>
      <button className="icon-button" disabled={!canRedo} title={t('Повторить (Ctrl+Shift+Z)')} onClick={() => onAction('redo')}><Redo2 size={18} /></button></>}
    <span className="toolbar-spacer" /><Select className="language-picker" icon={<Globe size={16} />} label={t('Язык')} value={language} onChange={value => onLanguage(value as Language)} options={[{ value: 'en', label: 'EN' }, { value: 'ru', label: 'RU' }]} />
    <ExportMenu disabled={!canExport} exportDiagram={onExport} /><ThemePicker mode={theme} change={onTheme} />
  </header>;
}
