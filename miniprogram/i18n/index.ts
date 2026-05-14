import zh, { type Dict } from './zh';
import en from './en';

const dictionaries: Record<PetDaycare.Locale, Dict> = { zh, en };

const STORAGE_KEY = 'locale';

let currentLocale: PetDaycare.Locale = 'zh';
let listeners: Array<(loc: PetDaycare.Locale) => void> = [];

export function initLocale(): PetDaycare.Locale {
  const stored = wx.getStorageSync(STORAGE_KEY) as PetDaycare.Locale | '';
  currentLocale = stored === 'zh' || stored === 'en' ? stored : 'zh';
  return currentLocale;
}

export function getLocale(): PetDaycare.Locale {
  return currentLocale;
}

export function setLocale(loc: PetDaycare.Locale): void {
  if (loc === currentLocale) return;
  currentLocale = loc;
  wx.setStorageSync(STORAGE_KEY, loc);
  listeners.forEach((fn) => fn(loc));
}

export function onLocaleChange(fn: (loc: PetDaycare.Locale) => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function t<K extends keyof Dict>(key: K): Dict[K] {
  return dictionaries[currentLocale][key] ?? dictionaries.zh[key] ?? (key as Dict[K]);
}
