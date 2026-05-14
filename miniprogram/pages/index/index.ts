import { t, onLocaleChange } from '../../i18n/index';

Page({
  data: {
    title: '',
    subtitle: '',
    ctaBook: '',
    ctaMyBookings: '',
    placeholder: '',
  },

  unsubscribe: undefined as (() => void) | undefined,

  onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => this.refreshStrings());
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    this.setData({
      title: t('app_name'),
      subtitle: t('greeting'),
      ctaBook: t('cta_book'),
      ctaMyBookings: t('cta_my_bookings'),
      placeholder: t('placeholder_v01'),
    });
  },

  onBookTap() {
    wx.showToast({ title: t('todo_booking_flow'), icon: 'none' });
  },

  onMyBookingsTap() {
    wx.showToast({ title: t('todo_my_bookings'), icon: 'none' });
  },
});
