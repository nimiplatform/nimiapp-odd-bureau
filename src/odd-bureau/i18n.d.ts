export type Language = 'zh' | 'en';
export function resolveLanguage(language?: string): Language;
export const language: Language;
export const displayNames: Readonly<Record<Language, string>>;
export const displayName: string;
export const outputLanguage: string;
export function t(key: keyof typeof import('./messages.en.json'), ...values: unknown[]): string;
export function supportsLanguage(supported: readonly string[], requested?: Language): boolean;
export function localizeCarrierMessage(message: string): string;
