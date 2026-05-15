import { t, getLocale, onLocaleChange } from '../../../i18n/index';
import { getOpenid } from '../../../services/openid';
import { isOwner, refreshCurrentUser } from '../../../services/user';
import { waitlistList, waitlistCancel, waitlistPromote, type EnrichedWaitlistEntry } from '../../../services/waitlist';

interface QueueRow {
  _id: string;
  serviceName: string;
  dateLabel: string;
  petsLabel: string;
  statusLabel: string;
  statusClass: string;
  cancellable: boolean;
  promotable: boolean;
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

const STATUS_KEY: Record<PetDaycare.WaitlistStatus, keyof import('../../../i18n/zh').Dict> = {
  waiting: 'bookings_waitlist_status_waiting',
  offered: 'bookings_waitlist_status_offered',
  fulfilled: 'bookings_waitlist_status_fulfilled',
  cancelled: 'bookings_waitlist_status_cancelled',
};

Page({
  data: {
    titleText: '',
    emptyText: '',
    promoteLabel: '',
    cancelLabel: '',
    notOwner: false,
    notOwnerText: '',
    queue: [] as QueueRow[],
  },

  unsubscribe: undefined as (() => void) | undefined,
  raw: [] as EnrichedWaitlistEntry[],

  onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => {
      this.refreshStrings();
      this.rebuildRows();
    });
  },

  async onShow() {
    if (getOpenid()) await refreshCurrentUser();
    if (!isOwner()) {
      this.setData({ notOwner: true, queue: [] });
      return;
    }
    this.setData({ notOwner: false });
    await this.load();
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    this.setData({
      titleText: t('waitlist_queue_title'),
      emptyText: t('waitlist_queue_empty'),
      promoteLabel: t('waitlist_queue_promote'),
      cancelLabel: t('waitlist_queue_cancel'),
      notOwnerText: t('daycare_not_owner'),
    });
  },

  async load() {
    this.raw = await waitlistList({ scope: 'all' });
    this.rebuildRows();
  },

  rebuildRows() {
    const queue: QueueRow[] = this.raw
      .filter((e) => e.status === 'waiting' || e.status === 'offered')
      .map((e) => ({
        _id: e._id!,
        serviceName: localized(e.serviceNameZh, e.serviceNameEn),
        dateLabel: fmtTpl(t('bookings_card_dates'), { from: fmtDate(e.dropoffAt), to: fmtDate(e.pickupAt) }),
        petsLabel: fmtTpl(t('bookings_card_pets_count'), { n: (e.petNames?.length ?? e.petIds.length) }),
        statusLabel: t(STATUS_KEY[e.status]),
        statusClass: `waitlist-${e.status}`,
        cancellable: true,
        promotable: e.status === 'waiting' || e.status === 'offered',
      }));
    this.setData({ queue });
  },

  async onPromoteTap(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    if (!id) return;
    const res = await waitlistPromote(id);
    if (!res.ok) {
      const msg = res.error === 'insufficient capacity'
        ? t('waitlist_promote_no_capacity')
        : res.error || t('waitlist_promote_failed');
      wx.showToast({ title: msg, icon: 'error' });
      return;
    }
    wx.showToast({ title: t('waitlist_promote_success'), icon: 'success' });
    await this.load();
  },

  async onCancelTap(e: WechatMiniprogram.BaseEvent) {
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
    await this.load();
  },
});
