import type { Locale } from './config';
import type { Messages } from './messages/uz';
import uz from './messages/uz';
import ru from './messages/ru';

export const MESSAGES: Record<Locale, Messages> = { uz, ru };

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type Vars = Record<string, string | number>;
export type TFn = (key: MessageKey, vars?: Vars) => string;

export function flatten(o: object, prefix = '', out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') out[prefix + k] = v;
    else flatten(v, `${prefix}${k}.`, out);
  }
  return out;
}

export function makeT(dict: Record<string, string>): TFn {
  return (key, vars) => {
    const s = dict[key] ?? key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m)) : s;
  };
}
