# `miniprogram/i18n/`

Runtime-switchable Chinese / English locale layer.

## Files

| File | Purpose |
| --- | --- |
| [`index.ts`](index.ts) | Locale store: `initLocale()`, `getLocale()`, `setLocale()`, `onLocaleChange()`, and the `t<K>(key)` lookup. |
| [`zh.ts`](zh.ts) | The Chinese dictionary. **Source of truth** for the dictionary shape: `export type Dict = typeof zh`. |
| [`en.ts`](en.ts) | The English dictionary, typed as `Dict` so adding a key only to `zh.ts` is a TypeScript error. |

## How locale propagation works

1. **Boot**: [`app.ts`](../app.ts) calls `initLocale()` in `onLaunch`. The stored value (or `'zh'` default) becomes `currentLocale`.
2. **Pages**: each page subscribes via `onLocaleChange(...)` in `onLoad` and stores the unsubscriber in an instance field. In the callback, the page re-`setData`s every locale-derived string slot. Unsubscribers fire in `onUnload`.
3. **Components**: same pattern, but the unsubscriber lives in a module-scope `WeakMap` keyed by the component instance, cleaned up in the `detached` lifetime.
4. **Tab bar**: `app.ts` also subscribes and refreshes tab text via `wx.setTabBarItem` on every change.
5. **Persistence**: `setLocale(loc)` writes the choice to `wx.storage` under the key `locale`.

## The `t()` lookup

```ts
export function t<K extends keyof Dict>(key: K): Dict[K];
```

- Generic-keyed: TypeScript will autocomplete on the dictionary and reject misspellings.
- Falls back to the `zh` value when the current locale's value is missing — useful when adding a new key during dev.

## The `Dict` type contract

`en.ts` opens with:

```ts
import type { Dict } from './zh';
const en: Dict = { /* ... */ };
```

Because `Dict = typeof zh`, any key added to `zh.ts` becomes mandatory in `en.ts` — `tsc --noEmit` errors out until you translate it. **Do not** widen `Dict` with `Partial<...>` or `Record<string, string>` — the strictness is the entire point.

## Picking localized fields off DB rows

Many DB rows store both `nameZh` and `nameEn` (services, addons, daycareConfig). Pages typically have a small helper:

```ts
function localized(zh?: string, en?: string): string {
  if (getLocale() === 'en') return en || zh || '';
  return zh || en || '';
}
```

This is intentionally not pulled into the shared layer because the fallback policy can vary (e.g., on the dashboard the owner usually wants whichever is non-empty regardless of locale).

## Adding a new dictionary key

1. Add the new key + value to `zh.ts`.
2. `tsc --noEmit` will now fail because `en.ts` is missing it.
3. Add the English translation to `en.ts`.
4. Reference it via `t('your_new_key')` from any page or component.
