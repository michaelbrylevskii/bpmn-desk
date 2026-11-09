import { FilePlus2, Workflow } from 'lucide-react';
import type { DocumentProfile } from '../engines/contracts';
import { useI18n } from '../i18n/provider';
import { MenuButton } from './command-menu';
export function CreateDiagramMenu({ create, examples = [], openExample }: { create: (profile: DocumentProfile) => void; examples?: string[]; openExample?: (name: string) => void }) {
  const { t } = useI18n();
  return <MenuButton label={t('Создать схему')} icon={<FilePlus2 size={18} />} className="create-diagram-button" menuClass="create-diagram-options" items={[
    ...([{ id: 'bpmn', title: 'BPMN 2.0' }, { id: 'flowable', title: 'Flowable' }, { id: 'camunda7', title: 'Camunda 7' }] as const).map(profile => ({ label: profile.title, icon: <Workflow size={16} data-profile={profile.id} />, action: () => create(profile.id) })),
    ...examples.length ? [{ label: '', separator: true }, { label: t('Примеры схем'), children: examples.map(name => ({ label: name.replace('.bpmn20.xml', ''), action: () => openExample?.(name) })) }] : [],
  ]} />;
}
