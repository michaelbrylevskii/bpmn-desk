import { useEffect, useState } from 'react';
import type { Instance } from '../../shared/runtime';
import { runtimeBridge } from '../platform/runtime';
import { useI18n } from '../i18n/provider';

export function RelatedInstance({ role, id, instance, open }: { role: 'parent' | 'child'; id: string; instance?: Instance; open: (id: string, preview?: Instance) => void }) {
  const { t } = useI18n();
  return <button className="related-instance instance-card" aria-label={`${t(role === 'parent' ? 'Родительский экземпляр' : 'Дочерний экземпляр')}: ${id}`} onClick={() => open(id, instance)}>
    <span><strong><span className="related-role">{t(role === 'parent' ? 'Родитель' : 'Дочерний')}</span> {instance?.processDefinitionName || instance?.processDefinitionId.split(':')[0] || t('Название схемы недоступно')}</strong>
      {(instance?.businessKey || instance?.name) && <small>{instance.businessKey || instance.name}</small>}<code>{id}</code>
    </span>
  </button>;
}

export function InstanceRelationships({ connection, parent, children, incomplete, open }: {
  connection: string; parent: string; children: Instance[]; incomplete?: boolean; open: (id: string, preview?: Instance) => void;
}) {
  const { t } = useI18n(); const [metadata, setMetadata] = useState<{ key: string; instance: Instance }>();
  const key = `${connection}\n${parent}`;
  useEffect(() => {
    if (!parent) return;
    let disposed = false;
    void runtimeBridge().instance(connection, parent).then(instance => { if (!disposed) setMetadata({ key, instance }); }).catch(() => undefined);
    return () => { disposed = true; };
  }, [connection, parent, key]);
  if (!parent && !children.length && !incomplete) return null;
  return <details open className="instance-relationships"><summary>{t('Связанные экземпляры')}</summary>
    {parent && <RelatedInstance role="parent" id={parent} instance={metadata?.key === key ? metadata.instance : undefined} open={open} />}
    {children.map(child => <RelatedInstance key={child.id} role="child" id={child.id} instance={child} open={open} />)}
    {incomplete && <p className="runtime-warning">{t('Список дочерних экземпляров неполный.')}</p>}
  </details>;
}
