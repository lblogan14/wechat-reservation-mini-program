import { t, getLocale, onLocaleChange } from '../../../i18n/index';
import { isOwner, refreshCurrentUser } from '../../../services/user';
import { getOpenid } from '../../../services/openid';
import {
  bookingList,
  bookingCancel,
  bookingStatusUpdate,
  bookingPaymentUpdate,
  type EnrichedBooking,
  type OwnerBookingTransition,
} from '../../../services/booking';
import { messageThreadEnsure } from '../../../services/message';

function localized(zh: string | undefined, en: string | undefined): string {
  const loc = getLocale();
  if (loc === 'en') return en || zh || '';
  return zh || en || '';
}

function fmt(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

const STATUS_KEY: Record<PetDaycare.BookingStatus, keyof import('../../../i18n/zh').Dict> = {
  confirmed: 'bookings_status_confirmed',
  checked_in: 'bookings_status_checked_in',
  checked_out: 'bookings_status_checked_out',
  cancelled: 'bookings_status_cancelled',
  no_show: 'bookings_status_no_show',
};

const PAYMENT_KEY: Record<PetDaycare.PaymentStatus, keyof import('../../../i18n/zh').Dict> = {
  pending: 'booking_detail_payment_pending',
  paid: 'booking_detail_payment_paid',
  refunded: 'booking_detail_payment_refunded',
  waived: 'booking_detail_payment_waived',
};

const PAYMENT_VALUES: PetDaycare.PaymentStatus[] = ['pending', 'paid', 'refunded', 'waived'];

Page({
  data: {
    titleText: '',
    labels: {} as Record<string, string>,
    booking: null as EnrichedBooking | null,
    serviceName: '',
    statusLabel: '',
    statusClass: '',
    dropoffStr: '',
    pickupStr: '',
    petsStr: '',
    paymentStr: '',
    recurringNote: '',
    cancelLabel: '',
    cancelSeriesLabel: '',
    cancelBlockedNote: '',
    canCancelSingle: false,
    canCancelSeries: false,
    showRecurringNote: false,
    // Owner panel
    isOwnerView: false,
    ownerPanelTitle: '',
    ownerCheckinLabel: '',
    ownerCheckoutLabel: '',
    ownerNoShowLabel: '',
    ownerCanCheckin: false,
    ownerCanCheckout: false,
    ownerCanNoShow: false,
    ownerPaymentSection: '',
    ownerPaymentOptions: [] as Array<{ value: PetDaycare.PaymentStatus; label: string }>,
    ownerPaymentIndex: 0,
    ownerPaymentNote: '',
    ownerPaymentNoteLabel: '',
    ownerPaymentNotePh: '',
    ownerPaymentSaveLabel: '',
    ownerSavingPayment: false,
    messageLabel: '',
  },

  unsubscribe: undefined as (() => void) | undefined,
  bookingId: '',

  async onLoad(opts: Record<string, string | undefined>) {
    this.bookingId = opts.id || '';
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => {
      this.refreshStrings();
      this.applyBooking(this.data.booking);
    });

    if (getOpenid()) await refreshCurrentUser();
    this.setData({ isOwnerView: isOwner() });

    await this.load();
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    this.setData({
      titleText: t('booking_detail_title'),
      cancelLabel: t('booking_detail_cancel'),
      cancelSeriesLabel: t('booking_detail_cancel_series'),
      cancelBlockedNote: t('booking_detail_cancel_blocked'),
      recurringNote: t('booking_detail_recurring_label'),
      ownerPanelTitle: t('owner_panel_title'),
      ownerCheckinLabel: t('owner_action_checkin'),
      ownerCheckoutLabel: t('owner_action_checkout'),
      ownerNoShowLabel: t('owner_action_no_show'),
      ownerPaymentSection: t('owner_payment_section'),
      ownerPaymentNoteLabel: t('owner_payment_note_label'),
      ownerPaymentNotePh: t('owner_payment_note_ph'),
      ownerPaymentSaveLabel: t('owner_payment_save'),
      ownerPaymentOptions: PAYMENT_VALUES.map((v) => ({ value: v, label: t(PAYMENT_KEY[v]) })),
      messageLabel: isOwner() ? t('owner_message_button') : t('parent_message_button'),
      labels: {
        service: t('booking_detail_service'),
        status: t('booking_detail_status'),
        dates: t('booking_detail_dates'),
        nights: t('booking_detail_nights'),
        pets: t('booking_detail_pets'),
        price: t('booking_detail_price'),
        payment: t('booking_detail_payment'),
        notes: t('booking_detail_notes'),
      },
    });
  },

  async load() {
    // Owner can lookup any booking via scope:'all'; parent looks up only their own.
    const scope = isOwner() ? 'all' : 'mine';
    const bookings = await bookingList({ scope });
    const found = bookings.find((b) => b._id === this.bookingId) || null;
    this.applyBooking(found);
  },

  applyBooking(b: EnrichedBooking | null) {
    if (!b) {
      this.setData({ serviceName: '', statusLabel: '', petsStr: '' });
      return;
    }
    const isRecurringMember = !!(b.recurrence || b.parentBookingId);
    const paymentIndex = Math.max(0, PAYMENT_VALUES.indexOf(b.paymentStatus));
    this.setData({
      booking: b,
      serviceName: localized(b.serviceNameZh, b.serviceNameEn),
      statusLabel: t(STATUS_KEY[b.bookingStatus] || 'bookings_status_confirmed'),
      statusClass: b.bookingStatus,
      dropoffStr: fmt(b.dropoffAt),
      pickupStr: fmt(b.pickupAt),
      petsStr: (b.petNames || []).join(' · '),
      paymentStr: t(PAYMENT_KEY[b.paymentStatus] || 'booking_detail_payment_pending'),
      showRecurringNote: isRecurringMember,
      canCancelSingle: b.bookingStatus === 'confirmed',
      canCancelSeries: b.bookingStatus === 'confirmed' && isRecurringMember,
      ownerCanCheckin: b.bookingStatus === 'confirmed',
      ownerCanCheckout: b.bookingStatus === 'checked_in',
      ownerCanNoShow: b.bookingStatus === 'confirmed',
      ownerPaymentIndex: paymentIndex,
      ownerPaymentNote: b.paymentNote || '',
    });
  },

  async onCancelTap() {
    if (!this.data.booking || !this.data.canCancelSingle) return;
    const confirm = await wx.showModal({
      title: t('booking_detail_cancel'),
      content: t('booking_detail_cancel_confirm'),
    });
    if (!confirm.confirm) return;
    const res = await bookingCancel({ _id: this.data.booking._id! });
    if (!res.ok) {
      wx.showToast({ title: res.error || 'Cancel failed', icon: 'error' });
      return;
    }
    wx.showToast({ title: t('booking_cancelled_toast'), icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },

  async onCancelSeriesTap() {
    if (!this.data.booking || !this.data.canCancelSeries) return;
    const confirm = await wx.showModal({
      title: t('booking_detail_cancel_series'),
      content: t('booking_detail_cancel_series_confirm'),
    });
    if (!confirm.confirm) return;
    const res = await bookingCancel({ _id: this.data.booking._id!, cancelSeries: true });
    if (!res.ok) {
      wx.showToast({ title: res.error || 'Cancel failed', icon: 'error' });
      return;
    }
    wx.showToast({ title: t('booking_cancelled_toast'), icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },

  async ownerTransition(status: OwnerBookingTransition, successKey: keyof import('../../../i18n/zh').Dict) {
    if (!this.data.booking) return;
    const res = await bookingStatusUpdate({ _id: this.data.booking._id!, bookingStatus: status });
    if (!res.ok) {
      wx.showToast({ title: res.error || t('dashboard_status_update_failed'), icon: 'error' });
      return;
    }
    wx.showToast({ title: t(successKey), icon: 'success' });
    await this.load();
  },

  onOwnerCheckin() {
    this.ownerTransition('checked_in', 'dashboard_checkin_success');
  },

  onOwnerCheckout() {
    this.ownerTransition('checked_out', 'dashboard_checkout_success');
  },

  async onOwnerNoShow() {
    const confirm = await wx.showModal({
      title: t('owner_action_no_show'),
      content: t('dashboard_no_show_confirm'),
    });
    if (!confirm.confirm) return;
    this.ownerTransition('no_show', 'dashboard_no_show_success');
  },

  onPaymentStatusChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ ownerPaymentIndex: Number(e.detail.value) });
  },

  onPaymentNoteInput(e: WechatMiniprogram.Input) {
    this.setData({ ownerPaymentNote: e.detail.value });
  },

  async onOpenThread() {
    if (!this.data.booking) return;
    const res = await messageThreadEnsure(this.data.booking._id!);
    if (!res.ok || !res.threadId) {
      wx.showToast({ title: res.error || 'Failed to open thread', icon: 'error' });
      return;
    }
    wx.navigateTo({ url: `/pages/messages/thread/thread?id=${res.threadId}` });
  },

  async onSavePayment() {
    if (!this.data.booking || this.data.ownerSavingPayment) return;
    this.setData({ ownerSavingPayment: true });
    const res = await bookingPaymentUpdate({
      _id: this.data.booking._id!,
      paymentStatus: this.data.ownerPaymentOptions[this.data.ownerPaymentIndex].value,
      paymentNote: this.data.ownerPaymentNote,
    });
    this.setData({ ownerSavingPayment: false });
    if (!res.ok) {
      wx.showToast({ title: res.error || t('owner_payment_save_failed'), icon: 'error' });
      return;
    }
    wx.showToast({ title: t('owner_payment_save_success'), icon: 'success' });
    await this.load();
  },
});
