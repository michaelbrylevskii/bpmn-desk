import { Workflow, FilePlus2, FolderOpen, Save, Undo2, Redo2, CopyPlus, Globe, Settings2 } from 'lucide-react';
import { VersionBadge } from './version-badge';
import { useState } from 'react';
import { AboutDialog } from './about-dialog';
import type { Language } from '../../shared/i18n';
import type { DiagramExport } from '../../shared/contracts';
import { useI18n } from '../i18n/provider';
import { ExportMenu } from './export-menu';
import { ThemePicker } from './theme-picker';
import { Select } from './select';
import type { ThemeMode } from './use-theme';
export function Toolbar({ hasDocument, canUndo, canRedo, theme, onTheme, onAction, onLanguage, onExport, runtimeTools, canExport, onManageConnections }: {
  onManageConnections: () => void;
  runtimeTools?: React.ReactNode; canExport: boolean; onExport: (format: DiagramExport) => void;
  theme: ThemeMode; onTheme: (mode: ThemeMode) => void;
  hasDocument: boolean; canUndo: boolean; canRedo: boolean; onAction: (name: string) => void; onLanguage: (language: Language) => void;
}) {
  const { t, language } = useI18n(); const [about, setAbout] = useState(false);
  return <><header className="toolbar"><div className="brand"><button type="button" className="brand-icon" title={t('О приложении')} onClick={() => setAbout(true)}><Workflow size={21} /></button><strong>BPMN<span>Desk</span></strong><VersionBadge /></div>
    <div className="toolbar-divider" /><button className="icon-button" title={t('Новая вкладка (Ctrl+N)')} onClick={() => onAction('new')}><FilePlus2 size={19} /></button>
    <button className="button ghost" title={t('Открыть (Ctrl+O)')} onClick={() => onAction('open')}><FolderOpen size={18} />{t('Открыть')}</button>
    {runtimeTools ?? <><button className="button primary" disabled={!hasDocument} title={t('Сохранить (Ctrl+S)')} onClick={() => onAction('save')}><Save size={17} />{t('Сохранить')}</button>
      <button className="icon-button" disabled={!hasDocument} title={t('Сохранить как (Ctrl+Shift+S)')} onClick={() => onAction('save-as')}><CopyPlus size={18} /></button>
      <div className="toolbar-divider" /><button className="icon-button" disabled={!canUndo} title={t('Отменить (Ctrl+Z)')} onClick={() => onAction('undo')}><Undo2 size={18} /></button>
      <button className="icon-button" disabled={!canRedo} title={t('Повторить (Ctrl+Shift+Z)')} onClick={() => onAction('redo')}><Redo2 size={18} /></button></>}
    <span className="toolbar-spacer" /><button className="icon-button" title={t('Управление подключениями')} disabled={!window.runtime} onClick={onManageConnections}><Settings2 size={18} /></button>
    <Select className="language-picker" icon={<Globe size={16} />} label={t('Язык')} value={language} onChange={value => onLanguage(value as Language)} options={[{ value: 'en', label: 'EN' }, { value: 'ru', label: 'RU' }]} />
    <ExportMenu disabled={!canExport} exportDiagram={onExport} /><ThemePicker mode={theme} change={onTheme} />
  </header>{about && <AboutDialog close={() => setAbout(false)} />}</>;
}
