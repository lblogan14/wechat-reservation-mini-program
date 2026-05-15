import { t, getLocale, onLocaleChange } from '../../i18n/index';
import { getOpenid } from '../../services/openid';
import { isOwner, refreshCurrentUser } from '../../services/user';
import { bookingList, bookingStatusUpdate, type EnrichedBooking, type OwnerBookingTransition } from '../../services/booking';

interface DashboardRow {
  _id: string;
  serviceName: string;
  parentLabel: string;
  petsLabel: string;
  dropoffStr: string;
  pickupStr: string;
  statusLabel: string;
  statusClass: string;
  canCheckin: boolean;
  canCheckout: boolean;
  canNoShow: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function localized(zh: string | undefined, en: string | undefined): string {
  const loc = getLocale();
  if (loc === 'en') return en || zh || '';
  return zh || en || '';
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${fmtTime(ts)}`;
}

function fmtTpl(tpl: string, vars: Record<string, number | string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

function startOfDayUTC(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const STATUS_KEY: Record<PetDaycare.BookingStatus, keyof import('../../i18n/zh').Dict> = {
  confirmed: 'bookings_status_confirmed',
  checked_in: 'bookings_status_checked_in',
  checked_out: 'bookings_status_checked_out',
  cancelled: 'bookings_status_cancelled',
  no_show: 'bookings_status_no_show',
};

function rowFor(b: EnrichedBooking, useTime: 'dropoff' | 'pickup'): DashboardRow {
  return {
    _id: b._id!,
    serviceName: localized(b.serviceNameZh, b.serviceNameEn),
    parentLabel: b.parentOpenid.slice(0, 8) + '…',
    petsLabel: (b.petNames || []).join(' · ') || `${b.petIds.length}`,
    dropoffStr: useTime === 'dropoff' ? fmtTime(b.dropoffAt) : fmtDateTime(b.dropoffAt),
    pickupStr: useTime === 'pickup' ? fmtTime(b.pickupAt) : fmtDateTime(b.pickupAt),
    statusLabel: '',
    statusClass: b.bookingStatus,
    canCheckin: b.bookingStatus === 'confirmed',
    canCheckout: b.bookingStatus === 'checked_in',
    canNoShow: b.bookingStatus === 'confirmed',
  };
}

Page({
  data: {
    titleText: '',
    sectionDropoffs: '',
    sectionPickups: '',
    sectionStaying: '',
    emptyDropoffs: '',
    emptyPickups: '',
    emptyStaying: '',
    checkinLabel: '',
    checkoutLabel: '',
    noShowLabel: '',
    openLabel: '',
    notOwner: false,
    notOwnerText: '',
    dropoffs: [] as DashboardRow[],
    pickups: [] as DashboardRow[],
    staying: [] as DashboardRow[],
  },

  unsubscribe: undefined as (() => void) | undefined,
  raw: [] as EnrichedBooking[],

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
      this.setData({ notOwner: true, dropoffs: [], pickups: [], staying: [] });
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
      titleText: t('dashboard_title'),
      sectionDropoffs: t('dashboard_section_dropoffs'),
      sectionPickups: t('dashboard_section_pickups'),
      sectionStaying: t('dashboard_section_staying'),
      emptyDropoffs: t('dashboard_empty_dropoffs'),
      emptyPickups: t('dashboard_empty_pickups'),
      emptyStaying: t('dashboard_empty_staying'),
      checkinLabel: t('dashboard_action_checkin'),
      checkoutLabel: t('dashboard_action_checkout'),
      noShowLabel: t('dashboard_action_no_show'),
      openLabel: t('dashboard_action_open'),
      notOwnerText: t('daycare_not_owner'),
    });
  },

  async load() {
    this.raw = await bookingList({ scope: 'all' });
    this.rebuildRows();
  },

  rebuildRows() {
    const today = startOfDayUTC(Date.now());
    const tomorrow = today + DAY_MS;

    const dropoffs: DashboardRow[] = [];
    const pickups: DashboardRow[] = [];
    const staying: DashboardRow[] = [];

    for (const b of this.raw as EnrichedBooking[]) {
      if (b.bookingStatus === 'cancelled' || b.bookingStatus === 'no_show') continue;
      const dropoffDay = startOfDayUTC(b.dropoffAt);
      const pickupDay = startOfDayUTC(b.pickupAt);

      // Drop-offs: bookings whose dropoff day == today AND not yet checked in
      if (dropoffDay === today && b.bookingStatus === 'confirmed') {
        const row = rowFor(b, 'dropoff');
        row.statusLabel = t(STATUS_KEY[b.bookingStatus]);
        dropoffs.push(row);
      }
      // Pick-ups: bookings whose pickup day == today AND checked_in
      if (pickupDay === today && b.bookingStatus === 'checked_in') {
        const row = rowFor(b, 'pickup');
        row.statusLabel = t(STATUS_KEY[b.bookingStatus]);
        pickups.push(row);
      }
      // Currently staying: checked_in AND today is within [dropoffDay, pickupDay)
      if (b.bookingStatus === 'checked_in' && dropoffDay <= today && today < pickupDay && pickupDay !== today) {
        const row = rowFor(b, 'dropoff');
        row.statusLabel = t(STATUS_KEY[b.bookingStatus]);
        // Show full datetime for pickup so owner knows when this stay ends.
        row.pickupStr = fmtDateTime(b.pickupAt);
        staying.push(row);
      }
      // Edge case: dropoff today AND already checked_in (someone checked in early). Surface in staying.
      if (b.bookingStatus === 'checked_in' && dropoffDay === today && pickupDay > today) {
        // already handled by the prior 'staying' branch when dropoffDay < today; ensure not duplicated
        if (!staying.find((r) => r._id === b._id)) {
          const row = rowFor(b, 'dropoff');
          row.statusLabel = t(STATUS_KEY[b.bookingStatus]);
          row.pickupStr = fmtDateTime(b.pickupAt);
          staying.push(row);
        }
      }
    }

    // Suppress unused variable lint
    void tomorrow;

    this.setData({ dropoffs, pickups, staying });
  },

  async transition(id: string, status: OwnerBookingTransition, successKey: keyof import('../../i18n/zh').Dict) {
    const res = await bookingStatusUpdate({ _id: id, bookingStatus: status });
    if (!res.ok) {
      wx.showToast({ title: res.error || t('dashboard_status_update_failed'), icon: 'error' });
      return;
    }
    wx.showToast({ title: t(successKey), icon: 'success' });
    await this.load();
  },

  onCheckin(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    if (id) this.transition(id, 'checked_in', 'dashboard_checkin_success');
  },

  onCheckout(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    if (id) this.transition(id, 'checked_out', 'dashboard_checkout_success');
  },

  async onNoShow(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    if (!id) return;
    const confirm = await wx.showModal({
      title: t('dashboard_action_no_show'),
      content: t('dashboard_no_show_confirm'),
    });
    if (!confirm.confirm) return;
    this.transition(id, 'no_show', 'dashboard_no_show_success');
  },

  onOpenDetail(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/bookings/detail/detail?id=${id}` });
  },
});
