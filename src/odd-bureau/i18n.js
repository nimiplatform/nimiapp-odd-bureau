import english from './messages.en.json' with { type: 'json' };

/** App locale follows the OS language exposed by the Electron renderer at launch. */
export function resolveLanguage(language) {
  return /^zh(?:-|_|$)/i.test(language ?? '') ? 'zh' : 'en';
}
export const language = resolveLanguage(globalThis.navigator?.language);
export const displayNames = Object.freeze({ zh: '奇物局', en: 'Odd Bureau' });
export const displayName = displayNames[language];
export const outputLanguage = language === 'zh' ? 'Simplified Chinese' : 'English';

/** Chinese source messages are stable keys; interpolation runs after lookup. */
export function t(key, ...values) {
  const message = language === 'zh' ? key : english[key];
  if (message === undefined) throw new Error(`Missing English message: ${key}`);
  return message.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? ''));
}

export function supportsLanguage(supported, requested = language) {
  return supported.length === 0 || supported.some(value => {
    const tag = value.trim().toLowerCase();
    // The public voice catalog can expose language names as well as tags.
    const normalized = ({ chinese: 'zh', english: 'en' })[tag] ?? tag;
    return new RegExp(`^${requested}(?:-|_|$)`, 'i').test(normalized);
  });
}

// The managed carrier supplies English recovery copy. Translate it at the
// App-owned presentation boundary, without changing carrier/auth authority.
export function localizeCarrierMessage(message) {
  if (language !== 'zh') return message;
  const entry = Object.entries(english).find(([, value]) => value === message);
  if (entry) return entry[0];
  return message.replace(/^Offline tier: /, '离线级别：');
}

if (typeof document !== 'undefined') {
  document.title = displayName;
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
}
