import { t, getLocale, onLocaleChange } from '../../i18n/index';
import { serviceList } from '../../services/service';
import { capacityRange, type CapacityDay } from '../../services/capacity';

interface ServiceOption {
  value: string;
  label: string;
}

interface DayCell {
  key: string;
  inMonth: boolean;
  dayLabel: string;
  remaining: number;
  capacityForDay: number;
  isToday: boolean;
  fillClass: 'full' | 'low' | 'open' | 'muted';
  remainingLabel: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function localized(zh: string | undefined, en: string | undefined): string {
  const loc = getLocale();
  if (loc === 'en') return en || zh || '';
  return zh || en || '';
}

function fmtTpl(tpl: string, vars: Record<string, number | string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

function startOfMonthUTC(year: number, month: number): number {
  return Date.UTC(year, month, 1);
}

function startOfDayTodayUTC(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function fillFor(remaining: number, base: number): DayCell['fillClass'] {
  if (remaining <= 0) return 'full';
  if (base <= 0) return 'muted';
  const ratio = remaining / base;
  if (ratio <= 0.34) return 'low';
  return 'open';
}

Page({
  data: {
    titleText: '',
    serviceLabel: '',
    prevLabel: '',
    nextLabel: '',
    monthLabel: '',
    loadingText: '',
    noServicesText: '',
    legendFull: '',
    legendLow: '',
    legendOpen: '',
    tapHint: '',
    dowLabels: [] as string[],
    serviceOptions: [] as ServiceOption[],
    serviceIndex: 0,
    cells: [] as DayCell[],
    loading: false,
  },

  unsubscribe: undefined as (() => void) | undefined,
  year: 0,
  month: 0, // 0-indexed (UTC)
  services: [] as PetDaycare.Service[],
  daysByKey: new Map<string, CapacityDay>(),

  onLoad() {
    const now = new Date();
    this.year = now.getUTCFullYear();
    this.month = now.getUTCMonth();
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => {
      this.refreshStrings();
      this.rebuildServiceLabels();
      this.rebuildGrid();
    });
  },

  async onShow() {
    if (!this.services.length) {
      this.services = await serviceList(false);
      this.rebuildServiceLabels();
    }
    if (!this.services.length) return;
    await this.loadMonth();
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    this.setData({
      titleText: t('calendar_title'),
      serviceLabel: t('calendar_service'),
      prevLabel: t('calendar_prev_month'),
      nextLabel: t('calendar_next_month'),
      loadingText: t('calendar_loading'),
      noServicesText: t('calendar_no_services'),
      legendFull: t('calendar_legend_full'),
      legendLow: t('calendar_legend_low'),
      legendOpen: t('calendar_legend_open'),
      tapHint: t('calendar_tap_hint'),
      dowLabels: [
        t('calendar_dow_mon'),
        t('calendar_dow_tue'),
        t('calendar_dow_wed'),
        t('calendar_dow_thu'),
        t('calendar_dow_fri'),
        t('calendar_dow_sat'),
        t('calendar_dow_sun'),
      ],
      monthLabel: fmtTpl(t('calendar_month_label'), { y: this.year, m: this.month + 1 }),
    });
  },

  rebuildServiceLabels() {
    this.setData({
      serviceOptions: (this.services as PetDaycare.Service[]).map((s) => ({
        value: s._id!,
        label: localized(s.nameZh, s.nameEn),
      })),
    });
  },

  async loadMonth() {
    const svc = this.services[this.data.serviceIndex];
    if (!svc) return;

    // Pad the range to cover the leading days of the previous month and trailing
    // days of the next month that share the same 6-week grid view.
    const monthStart = startOfMonthUTC(this.year, this.month);
    const firstWeekday = (new Date(monthStart).getUTCDay() + 6) % 7; // 0 = Monday
    const gridStart = monthStart - firstWeekday * DAY_MS;
    const gridEnd = gridStart + 41 * DAY_MS; // 6 weeks, inclusive
    this.setData({ loading: true });
    const res = await capacityRange({ serviceId: svc._id!, from: gridStart, to: gridEnd });
    this.setData({ loading: false });

    this.daysByKey.clear();
    if (res.ok) {
      for (const d of res.days) this.daysByKey.set(String(d.date), d);
    }
    this.rebuildGrid();
  },

  rebuildGrid() {
    const monthStart = startOfMonthUTC(this.year, this.month);
    const firstWeekday = (new Date(monthStart).getUTCDay() + 6) % 7;
    const gridStart = monthStart - firstWeekday * DAY_MS;
    const today = startOfDayTodayUTC();
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i += 1) {
      const ts = gridStart + i * DAY_MS;
      const d = new Date(ts);
      const inMonth = d.getUTCMonth() === this.month;
      const data = this.daysByKey.get(String(ts));
      const remaining = data ? data.remaining : 0;
      const capacityForDay = data ? data.capacityForDay : 0;
      const fill = inMonth ? fillFor(remaining, capacityForDay) : 'muted';
      const remainingLabel = !inMonth
        ? ''
        : remaining <= 0
          ? t('calendar_full')
          : fmtTpl(t('calendar_remaining'), { n: remaining });
      cells.push({
        key: String(ts),
        inMonth,
        dayLabel: String(d.getUTCDate()),
        remaining,
        capacityForDay,
        isToday: ts === today,
        fillClass: fill,
        remainingLabel,
      });
    }
    this.setData({
      cells,
      monthLabel: fmtTpl(t('calendar_month_label'), { y: this.year, m: this.month + 1 }),
    });
  },

  async onServiceChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    this.setData({ serviceIndex: idx });
    await this.loadMonth();
  },

  async onPrevMonth() {
    if (this.month === 0) {
      this.month = 11;
      this.year -= 1;
    } else {
      this.month -= 1;
    }
    await this.loadMonth();
  },

  async onNextMonth() {
    if (this.month === 11) {
      this.month = 0;
      this.year += 1;
    } else {
      this.month += 1;
    }
    await this.loadMonth();
  },

  onCellTap(e: WechatMiniprogram.BaseEvent) {
    const { key, inMonth } = e.currentTarget.dataset as { key: string; inMonth: string };
    if (inMonth !== 'true') return;
    const svc = this.services[this.data.serviceIndex];
    if (!svc) return;
    wx.navigateTo({ url: `/pages/booking/new/new?serviceId=${svc._id}&date=${key}` });
  },
});
