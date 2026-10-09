import { interfaceMessages } from './interface';
import { propertyMessages } from './properties';
import { noticeMessages } from './notices';

export type Language = 'en' | 'ru';
export const defaultLanguage: Language = 'en';
export const languageKey = 'bpmn-desk:language';
export const isLanguage = (value: unknown): value is Language => value === 'en' || value === 'ru';
const english = { ...interfaceMessages, ...propertyMessages, ...noticeMessages };
export type MessageKey = keyof typeof english;
export type Parameters = Readonly<Record<string, string | number>>;
export type Translator = (key: MessageKey, parameters?: Parameters) => string;

export function translate(language: Language, key: MessageKey, parameters: Parameters = {}): string {
  return (language === 'ru' ? key : english[key]).replace(/\{(\w+)\}/g, (whole, name: string) => parameters[name] === undefined ? whole : String(parameters[name]));
}
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = Object.entries(english).filter(([key]) => /\{\w+\}/.test(key)).flatMap(([key, value]) => [key, value].map(source => {
  const names: string[] = [];
  const pattern = source.split(/(\{\w+\})/).map(part => {
    if (!/^\{\w+\}$/.test(part)) return escape(part);
    names.push(part.slice(1, -1)); return '(.*?)';
  }).join('');
  return { key: key as MessageKey, names, specificity: source.replace(/\{\w+\}/g, '').length, pattern: new RegExp(`^${pattern}$`) };
})).sort((a, b) => b.specificity - a.specificity);
const reverse = new Map<string, MessageKey>(Object.entries(english).map(([key, value]) => [value, key as MessageKey]));

/** Только тексты приложения и диагностические сообщения. XML и имена элементов
 * не переводятся. Неизвестные технические сообщения сохраняются исходными. */
export function translateText(language: Language, text: string): string {
  return text.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '').split('\n').map(line => {
    const key = Object.hasOwn(english, line) ? line as MessageKey : reverse.get(line);
    if (key) return translate(language, key);
    for (const template of templates) {
      const match = template.pattern.exec(line); if (!match) continue;
      return translate(language, template.key, Object.fromEntries(template.names.map((name, index) => [name, match[index + 1] ?? ''])));
    }
    return line;
  }).join('\n');
}
