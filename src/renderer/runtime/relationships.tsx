import { ArrowUpRight, CornerDownRight } from 'lucide-react';
import type { InstanceSnapshot } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';
export function InstanceRelationships({ snapshot, open }: { snapshot: InstanceSnapshot; open: (id: string) => void }) {
  const { t } = useI18n(); const parent = snapshot.instance.superProcessInstanceId;
  if (!parent && !snapshot.children.length) return null;
  return <details open className="instance-relationships"><summary>{t('Связанные экземпляры')}</summary>
    {parent && <button className="related-instance" aria-label={`${t('Родительский экземпляр')}: ${parent}`} onClick={() => open(parent)}><ArrowUpRight size={15} /><span><strong>{t('Родительский экземпляр')}</strong><code>{parent}</code></span></button>}
    {!!snapshot.children.length && <><h4>{t('Дочерние экземпляры')} ({snapshot.children.length})</h4>{snapshot.children.map(child => <button key={child.id} className="related-instance" aria-label={t('Дочерний экземпляр: {id}', { id: child.id })} onClick={() => open(child.id)}>
      <CornerDownRight size={15} /><span><strong>{child.processDefinitionName || child.name || child.id}</strong><code>{child.id}</code></span></button>)}</>}
  </details>;
}
