import { useState } from 'react';
import type { Authentication, Connection, ConnectionInput } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';

export function ConnectionForm({ connection, secure, busy, save }: { connection?: Connection; secure: boolean; busy: boolean; save: (input: ConnectionInput) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(connection?.name ?? ''); const [url, setUrl] = useState(connection?.baseUrl ?? '');
  const [auth, setAuth] = useState<Authentication>(connection?.authentication ?? 'basic');
  const [username, setUsername] = useState(connection?.username ?? ''); const [secret, setSecret] = useState('');
  const [remember, setRemember] = useState(secure && !!connection?.secretStored);
  return <form className="connection-form" onSubmit={event => {
    event.preventDefault(); save({ id: connection?.id, name, baseUrl: url, engine: 'flowable', authentication: auth, username, secret: secret || undefined, rememberSecret: remember });
  }}>
    <label>{t('Название подключения')}<input required maxLength={500} value={name} onChange={event => setName(event.target.value)} /></label>
    <label>{t('Движок')}<select aria-label={t('Движок')} defaultValue="flowable"><option value="flowable">Flowable</option><option value="camunda7" disabled>Camunda 7</option></select></label>
    <label>{t('Адрес REST API')}<input required type="url" placeholder="http://localhost:8080/process-api/" maxLength={2000} value={url} onChange={event => setUrl(event.target.value)} /></label>
    <label>{t('Авторизация')}<select aria-label={t('Авторизация')} value={auth} onChange={event => setAuth(event.target.value as Authentication)}>
      <option value="none">{t('Без авторизации')}</option><option value="basic">Basic</option><option value="bearer">Bearer</option></select></label>
    {auth === 'basic' && <label>{t('Имя пользователя')}<input required autoComplete="off" value={username} onChange={event => setUsername(event.target.value)} /></label>}
    {auth !== 'none' && <><label>{t('Пароль или токен')}<input type="password" autoComplete="new-password" maxLength={8000} value={secret} onChange={event => setSecret(event.target.value)} placeholder={connection?.hasSecret ? '••••••••' : ''} /></label>
      {connection?.hasSecret && <p className="runtime-hint">{t('Оставь пустым, чтобы сохранить текущий секрет.')}</p>}
      <label className="runtime-check"><input type="checkbox" disabled={!secure} checked={remember} onChange={event => setRemember(event.target.checked)} />{t('Запомнить секрет в хранилище ОС')}</label>
      {!secure && <p className="runtime-hint">{t('Хранилище секретов ОС недоступно.')}</p>}
      {!remember && <p className="runtime-hint">{t('Секрет будет доступен только до закрытия приложения.')}</p>}</>}
    <button className="button primary" disabled={busy} type="submit">{t('Сохранить подключение')}</button>
  </form>;
}
