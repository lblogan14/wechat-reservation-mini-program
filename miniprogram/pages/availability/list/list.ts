import { t, getLocale, onLocaleChange } from '../../../i18n/index';
import { isOwner, refreshCurrentUser } from '../../../services/user';
import { getOpenid } from '../../../services/openid';
import { serviceList } from '../../../services/service';
import { availabilityList } from '../../../services/availability';

interface OverrideRow extends PetDaycare.AvailabilityOverride {
  dateLabel: string;
  serviceName: string;
  summary: string;
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localized(zh: string | undefined, en: string | undefined): string {
  const loc = getLocale();
  if (loc === 'en') return en || zh || '';
  return zh || en || '';
}

function fmtTemplate(tpl: string, n: number | string): string {
  return tpl.replace('{n}', String(n));
}

Page({
  data: {
    title: '',
    overrides: [] as OverrideRow[],
    loading: false,
    emptyText: '',
    loadingText: '',
    notOwner: false,
    notOwnerText: '',
  },

  unsubscribe: undefined as (() => void) | undefined,

  onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => {
      this.refreshStrings();
      this.applyOverrides();
    });
  },

  async onShow() {
    if (getOpenid()) await refreshCurrentUser();
    if (!isOwner()) {
      this.setData({ notOwner: true, overrides: [] });
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
      title: t('availability_title'),
      emptyText: t('availability_empty'),
      loadingText: t('loading'),
      notOwnerText: t('daycare_not_owner'),
    });
  },

  rawServices: [] as PetDaycare.Service[],
  rawOverrides: [] as PetDaycare.AvailabilityOverride[],

  applyOverrides() {
    const sMap = new Map<string, PetDaycare.Service>(
      (this.rawServices as PetDaycare.Service[]).map((s) => [s._id!, s]),
    );
    const overrides: OverrideRow[] = (this.rawOverrides as PetDaycare.AvailabilityOverride[]).map((o) => {
      const svc = sMap.get(o.serviceId);
      let summary = '';
      if (typeof o.capacityAbsolute === 'number') {
        summary = fmtTemplate(t('availability_summary_absolute'), o.capacityAbsolute);
      } else if (typeof o.capacityDelta === 'number') {
        const tplKey = o.capacityDelta >= 0 ? 'availability_summary_delta_pos' : 'availability_summary_delta_neg';
        summary = fmtTemplate(t(tplKey), o.capacityDelta);
      }
      return {
        ...o,
        dateLabel: fmtDate(o.date),
        serviceName: svc ? localized(svc.nameZh, svc.nameEn) : '—',
        summary,
      };
    });
    this.setData({ overrides });
  },

  async load() {
    this.setData({ loading: true });
    const [services, overrides] = await Promise.all([
      serviceList(true),
      availabilityList(),
    ]);
    this.rawServices = services;
    this.rawOverrides = overrides;
    this.applyOverrides();
    this.setData({ loading: false });
  },

  onAddTap() {
    wx.navigateTo({ url: '/pages/availability/edit/edit' });
  },

  onRowTap(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/availability/edit/edit?id=${id}` });
  },
});
