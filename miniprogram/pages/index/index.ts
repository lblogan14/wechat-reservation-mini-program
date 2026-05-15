import { t, getLocale, onLocaleChange } from '../../i18n/index';
import { daycareGet } from '../../services/daycare';

function pickLocalized(zh: string | undefined, en: string | undefined, locale: 'zh' | 'en'): string {
  if (locale === 'en') return en || zh || '';
  return zh || en || '';
}

Page({
  data: {
    title: '',
    subtitle: '',
    ctaBook: '',
    ctaMyBookings: '',
    daycareCardTitle: '',
    daycareCardEmpty: '',
    daycareAddressLabel: '',
    daycarePhoneLabel: '',
    daycareHoursLabel: '',
    daycareName: '',
    daycareAddress: '',
    daycarePhone: '',
    daycareHours: '',
    daycarePhoto: '',
    daycareLoaded: false,
  },

  unsubscribe: undefined as (() => void) | undefined,
  config: null as PetDaycare.DaycareConfig | null,

  onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => this.refreshStrings());
  },

  onShow() {
    this.load();
  },

  onUnload() {
    this.unsubscribe?.();
  },

  async load() {
    const config = await daycareGet();
    this.config = config;
    this.refreshStrings();
    this.setData({ daycareLoaded: true });
  },

  refreshStrings() {
    const locale = getLocale();
    const cfg = this.config;
    const hoursLine = cfg && cfg.hoursOpen && cfg.hoursClose ? `${cfg.hoursOpen} – ${cfg.hoursClose}` : '';
    this.setData({
      title: t('app_name'),
      subtitle: t('greeting'),
      ctaBook: t('cta_book'),
      ctaMyBookings: t('cta_my_bookings'),
      daycareCardTitle: t('daycare_card_title'),
      daycareCardEmpty: t('daycare_card_empty'),
      daycareAddressLabel: t('daycare_address'),
      daycarePhoneLabel: t('daycare_phone'),
      daycareHoursLabel: t('daycare_hours'),
      daycareName: cfg ? pickLocalized(cfg.nameZh, cfg.nameEn, locale) : '',
      daycareAddress: cfg?.address || '',
      daycarePhone: cfg?.phone || '',
      daycareHours: hoursLine,
      daycarePhoto: cfg?.photoFileIDs?.[0] || '',
    });
  },

  onBookTap() {
    wx.navigateTo({ url: '/pages/calendar/calendar' });
  },

  onMyBookingsTap() {
    wx.navigateTo({ url: '/pages/bookings/list/list' });
  },

  onCallPhone() {
    if (!this.data.daycarePhone) return;
    wx.makePhoneCall({ phoneNumber: this.data.daycarePhone });
  },
});
