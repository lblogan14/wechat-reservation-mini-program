import { getLocale, setLocale, onLocaleChange } from '../../i18n/index';

const unsubscribers = new WeakMap<object, () => void>();

Component({
  data: {
    locale: 'zh' as PetDaycare.Locale,
  },

  lifetimes: {
    attached() {
      this.setData({ locale: getLocale() });
      const unsub = onLocaleChange((loc) => this.setData({ locale: loc }));
      unsubscribers.set(this, unsub);
    },

    detached() {
      unsubscribers.get(this)?.();
      unsubscribers.delete(this);
    },
  },

  methods: {
    onSelect(e: WechatMiniprogram.BaseEvent) {
      const { locale } = e.currentTarget.dataset as { locale: PetDaycare.Locale };
      setLocale(locale);
    },
  },
});
