import { t, getLocale, onLocaleChange } from '../../../i18n/index';
import { getOpenid } from '../../../services/openid';
import { bookingList, type EnrichedBooking } from '../../../services/booking';
import { waitlistList, waitlistCancel, type EnrichedWaitlistEntry } from '../../../services/waitlist';

interface BookingRow {
  _id: string;
  serviceName: string;
  dateLabel: string;
  petsLabel: string;
  statusLabel: string;
  statusClass: string;
  priceLabel: string;
  recurring: boolean;
}

interface WaitlistRow {
  _id: string;
  serviceName: string;
  dateLabel: string;
  petsLabel: string;
  statusLabel: string;
  statusClass: string;
  cancellable: boolean;
}

function localized(zh: string | undefined, en: string | undefined): string {
  const loc = getLocale();
  if (loc === 'en') return en || zh || '';
  return zh || en || '';
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function fmtTpl(tpl: string, vars: Record<string, number | string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

const STATUS_KEY_BY_BOOKING: Record<PetDaycare.BookingStatus, keyof import('../../../i18n/zh').Dict> = {
  confirmed: 'bookings_status_confirmed',
  checked_in: 'bookings_status_checked_in',
  checked_out: 'bookings_status_checked_out',
  cancelled: 'bookings_status_cancelled',
  no_show: 'bookings_status_no_show',
};

const STATUS_KEY_BY_WAITLIST: Record<PetDaycare.WaitlistStatus, keyof import('../../../i18n/zh').Dict> = {
  waiting: 'bookings_waitlist_status_waiting',
  offered: 'bookings_waitlist_status_offered',
  fulfilled: 'bookings_waitlist_status_fulfilled',
  cancelled: 'bookings_waitlist_status_cancelled',
};

Page({
  data: {
    titleText: '',
    emptyText: '',
    sectionUpcoming: '',
    sectionPast: '',
    sectionCancelled: '',
    sectionWaitlist: '',
    cancelWaitlistConfirm: '',
    notSignedIn: false,
    loginRequiredText: '',
    loginCta: '',
    upcoming: [] as BookingRow[],
    past: [] as BookingRow[],
    cancelled: [] as BookingRow[],
    waitlist: [] as WaitlistRow[],
  },

  unsubscribe: undefined as (() => void) | undefined,
  rawBookings: [] as EnrichedBooking[],
  rawWaitlist: [] as EnrichedWaitlistEntry[],

  onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => {
      this.refreshStrings();
      this.rebuildRows();
    });
  },

  async onShow() {
    if (!getOpenid()) {
      this.setData({ notSignedIn: true });
      return;
    }
    this.setData({ notSignedIn: false });
    await this.load();
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    this.setData({
      titleText: t('bookings_title'),
      emptyText: t('bookings_empty'),
      sectionUpcoming: t('bookings_section_upcoming'),
      sectionPast: t('bookings_section_past'),
      sectionCancelled: t('bookings_section_cancelled'),
      sectionWaitlist: t('bookings_section_waitlist'),
      cancelWaitlistConfirm: t('waitlist_cancel_confirm'),
      loginRequiredText: t('booking_login_required'),
      loginCta: t('booking_required_login_cta'),
    });
  },

  async load() {
    const [bookings, entries] = await Promise.all([bookingList(), waitlistList()]);
    this.rawBookings = bookings;
    this.rawWaitlist = entries;
    this.rebuildRows();
  },

  rebuildRows() {
    const now = Date.now();
    const upcoming: BookingRow[] = [];
    const past: BookingRow[] = [];
    const cancelled: BookingRow[] = [];

    // Show child instances of a recurring series alongside the parent — useful for review.
    for (const b of this.rawBookings) {
      const row: BookingRow = {
        _id: b._id!,
        serviceName: localized(b.serviceNameZh, b.serviceNameEn),
        dateLabel: fmtTpl(t('bookings_card_dates'), { from: fmtDate(b.dropoffAt), to: fmtDate(b.pickupAt) }),
        petsLabel: fmtTpl(t('bookings_card_pets_count'), { n: (b.petNames?.length ?? b.petIds.length) }),
        statusLabel: t(STATUS_KEY_BY_BOOKING[b.bookingStatus] || 'bookings_status_confirmed'),
        statusClass: b.bookingStatus,
        priceLabel: fmtTpl(t('bookings_card_price'), { n: b.totalPrice }),
        recurring: !!(b.recurrence || b.parentBookingId),
      };
      if (b.bookingStatus === 'cancelled') {
        cancelled.push(row);
      } else if (b.pickupAt < now) {
        past.push(row);
      } else {
        upcoming.push(row);
      }
    }

    const waitlist: WaitlistRow[] = this.rawWaitlist
      .filter((e) => e.status === 'waiting' || e.status === 'offered')
      .map((e) => ({
        _id: e._id!,
        serviceName: localized(e.serviceNameZh, e.serviceNameEn),
        dateLabel: fmtTpl(t('bookings_card_dates'), { from: fmtDate(e.dropoffAt), to: fmtDate(e.pickupAt) }),
        petsLabel: fmtTpl(t('bookings_card_pets_count'), { n: (e.petNames?.length ?? e.petIds.length) }),
        statusLabel: t(STATUS_KEY_BY_WAITLIST[e.status]),
        statusClass: `waitlist-${e.status}`,
        cancellable: e.status === 'waiting' || e.status === 'offered',
      }));

    this.setData({ upcoming, past, cancelled, waitlist });
  },

  goSignIn() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  onRowTap(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    wx.navigateTo({ url: `/pages/bookings/detail/detail?id=${id}` });
  },

  async onWaitlistCancel(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    if (!id) return;
    const confirm = await wx.showModal({
      title: t('cancel'),
      content: t('waitlist_cancel_confirm'),
    });
    if (!confirm.confirm) return;
    const res = await waitlistCancel(id);
    if (!res.ok) {
      wx.showToast({ title: res.error || 'Cancel failed', icon: 'error' });
      return;
    }
    wx.showToast({ title: t('booking_cancelled_toast'), icon: 'success' });
    this.load();
  },
});
