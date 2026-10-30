import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Authentication, Connection, ConnectionInput } from '../../shared/runtime';
import { requestTimeoutSeconds } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';
import { Select } from '../ui/select';
export function ConnectionForm({ connection, secure, busy, save, test, edited, remove }: { connection?: Connection; secure: boolean; busy: boolean; remove?: () => void;
  save: (input: ConnectionInput) => void; test: (input: ConnectionInput) => void; edited: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(connection?.name ?? ''); const [url, setUrl] = useState(connection?.baseUrl ?? '');
  const [auth, setAuth] = useState<Authentication>(connection?.authentication ?? 'basic');
  const [username, setUsername] = useState(connection?.username ?? ''); const [secret, setSecret] = useState('');
  const [remember, setRemember] = useState(secure && !!connection?.secretStored);
  const [timeout, setTimeout] = useState(String(connection?.requestTimeoutSeconds ?? requestTimeoutSeconds.default));
  const input = (): ConnectionInput => ({ id: connection?.id, name, baseUrl: url, engine: 'flowable', authentication: auth, username, secret: secret || undefined, rememberSecret: remember, requestTimeoutSeconds: Number(timeout) });
  return <form className="connection-form" onInput={edited} onSubmit={event => { event.preventDefault(); save(input()); }}>
    <fieldset disabled={busy} className="connection-fields">
      <label>{t('Название подключения')}<input required maxLength={500} value={name} onChange={event => setName(event.target.value)} /></label>
      <label>{t('Движок')}<Select label={t('Движок')} value="flowable" onChange={() => undefined} options={[{ value: 'flowable', label: 'Flowable' }, { value: 'camunda7', label: 'Camunda 7', disabled: true }]} /></label>
      <label>{t('Адрес REST API')}<input required type="url" placeholder="http://localhost:8080/process-api/" maxLength={2000} value={url} onChange={event => setUrl(event.target.value)} /></label>
      <label>{t('Таймаут запроса, секунды')}<input required type="number" min={requestTimeoutSeconds.min} max={requestTimeoutSeconds.max} step={1} value={timeout} onChange={event => setTimeout(event.target.value)} /></label>
      <label>{t('Авторизация')}<Select label={t('Авторизация')} value={auth} onChange={value => { setAuth(value as Authentication); edited(); }} options={[
        { value: 'none', label: t('Без авторизации') }, { value: 'basic', label: 'Basic' }, { value: 'bearer', label: 'Bearer' }]} /></label>
      {auth === 'basic' && <label>{t('Имя пользователя')}<input required autoComplete="off" value={username} onChange={event => setUsername(event.target.value)} /></label>}
      {auth !== 'none' && <><label>{t('Пароль или токен')}<input type="password" autoComplete="new-password" maxLength={8000} value={secret} onChange={event => setSecret(event.target.value)} placeholder={connection?.hasSecret ? '••••••••' : ''} /></label>
        {connection?.hasSecret && <p className="runtime-hint">{t('Оставь пустым, чтобы сохранить текущий секрет.')}</p>}
        <label className="runtime-check"><input type="checkbox" disabled={!secure} checked={remember} onChange={event => setRemember(event.target.checked)} />{t('Запомнить секрет в хранилище ОС')}</label>
        {!secure && <p className="runtime-hint">{t('Хранилище секретов ОС недоступно.')}</p>}
        {!remember && <p className="runtime-hint">{t('Секрет будет доступен только до закрытия приложения.')}</p>}</>}
      <div className="runtime-actions"><button className="button primary" type="submit">{t('Сохранить подключение')}</button>
        <button className="button" type="button" onClick={() => test(input())}>{t('Проверить подключение')}</button>
        {remove && <button className="icon-button danger connection-delete" type="button" title={t('Удалить')} onClick={remove}><Trash2 size={16} /></button>}</div>
    </fieldset>
  </form>;
}
