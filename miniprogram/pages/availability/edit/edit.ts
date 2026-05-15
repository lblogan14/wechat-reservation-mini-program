import { t, getLocale, onLocaleChange } from '../../../i18n/index';
import { isOwner, refreshCurrentUser } from '../../../services/user';
import { getOpenid } from '../../../services/openid';
import { serviceList } from '../../../services/service';
import { availabilityList, availabilityUpsert, availabilityDelete } from '../../../services/availability';

interface ServiceOption {
  value: string;
  label: string;
}

type Mode = 'delta' | 'absolute';

function fmtDate(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateUTC(s: string): number | undefined {
  if (!s) return undefined;
  const ts = Date.parse(`${s}T00:00:00Z`);
  return isNaN(ts) ? undefined : ts;
}

function localized(zh: string | undefined, en: string | undefined): string {
  const loc = getLocale();
  if (loc === 'en') return en || zh || '';
  return zh || en || '';
}

Page({
  data: {
    title: '',
    saving: false,
    mode: 'delta' as Mode,
    dateStr: '',
    deltaInput: '',
    absoluteInput: '',
    override: {} as Partial<PetDaycare.AvailabilityOverride>,
    serviceOptions: [] as ServiceOption[],
    serviceIndex: 0,
    notOwner: false,
    notOwnerText: '',
    noServicesHint: '',
    labels: {} as Record<string, string>,
    placeholders: {} as Record<string, string>,
    modeOptions: [] as ServiceOption[],
    modeIndex: 0,
  },

  unsubscribe: undefined as (() => void) | undefined,

  async onLoad(opts: Record<string, string | undefined>) {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => this.refreshStrings());

    if (getOpenid()) await refreshCurrentUser();
    if (!isOwner()) {
      this.setData({ notOwner: true });
      return;
    }

    const services = await serviceList(true);
    const serviceOptions: ServiceOption[] = services.map((s) => ({
      value: s._id!,
      label: localized(s.nameZh, s.nameEn),
    }));
    this.setData({ serviceOptions });

    if (!services.length) {
      this.setData({ noServicesHint: t('availability_no_services_hint') });
      return;
    }

    if (opts.id) {
      await this.loadOverride(opts.id);
    } else {
      this.setData({
        'override.serviceId': services[0]._id,
        serviceIndex: 0,
      });
    }
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    this.setData({
      title: this.data.override._id ? t('availability_edit_title_edit') : t('availability_edit_title_new'),
      notOwnerText: t('daycare_not_owner'),
      labels: {
        date: t('availability_field_date'),
        service: t('availability_field_service'),
        mode: t('availability_field_mode'),
        delta: t('availability_field_delta'),
        absolute: t('availability_field_absolute'),
        reason: t('availability_field_reason'),
        save: t('pet_save'),
        delete: t('pet_delete'),
      },
      placeholders: {
        date: t('pick_date'),
        reason: t('availability_field_reason_ph'),
      },
      modeOptions: [
        { value: 'delta', label: t('availability_mode_delta') },
        { value: 'absolute', label: t('availability_mode_absolute') },
      ],
    });
  },

  async loadOverride(_id: string) {
    wx.showLoading({ title: t('loading'), mask: true });
    const all = await availabilityList();
    wx.hideLoading();
    const found = all.find((o) => o._id === _id);
    if (!found) {
      wx.showToast({ title: 'Not found', icon: 'error' });
      return;
    }
    const mode: Mode = typeof found.capacityAbsolute === 'number' ? 'absolute' : 'delta';
    const sIdx = (this.data.serviceOptions as ServiceOption[]).findIndex((o) => o.value === found.serviceId);
    this.setData({
      override: found,
      dateStr: fmtDate(found.date),
      mode,
      modeIndex: mode === 'absolute' ? 1 : 0,
      deltaInput: typeof found.capacityDelta === 'number' ? String(found.capacityDelta) : '',
      absoluteInput: typeof found.capacityAbsolute === 'number' ? String(found.capacityAbsolute) : '',
      serviceIndex: sIdx < 0 ? 0 : sIdx,
      title: t('availability_edit_title_edit'),
    });
  },

  onDateChange(e: WechatMiniprogram.PickerChange) {
    const s = String(e.detail.value);
    const ts = parseDateUTC(s);
    this.setData({ dateStr: s, 'override.date': ts });
  },

  onServiceChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    this.setData({
      serviceIndex: idx,
      'override.serviceId': this.data.serviceOptions[idx].value,
    });
  },

  onModeChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    const mode: Mode = idx === 1 ? 'absolute' : 'delta';
    this.setData({ modeIndex: idx, mode });
  },

  onDeltaInput(e: WechatMiniprogram.Input) {
    this.setData({ deltaInput: e.detail.value });
  },

  onAbsoluteInput(e: WechatMiniprogram.Input) {
    this.setData({ absoluteInput: e.detail.value });
  },

  onReasonInput(e: WechatMiniprogram.Input) {
    this.setData({ 'override.reason': e.detail.value });
  },

  async onSave() {
    const { override, mode, deltaInput, absoluteInput } = this.data;
    if (!override.date || !override.serviceId) {
      wx.showToast({ title: t('availability_required'), icon: 'none' });
      return;
    }

    const payload: Partial<PetDaycare.AvailabilityOverride> = {
      _id: override._id,
      date: override.date,
      serviceId: override.serviceId,
      reason: override.reason,
    };
    if (mode === 'delta') {
      const n = parseInt(deltaInput, 10);
      if (isNaN(n)) {
        wx.showToast({ title: t('availability_required'), icon: 'none' });
        return;
      }
      payload.capacityDelta = n;
    } else {
      const n = parseInt(absoluteInput, 10);
      if (isNaN(n) || n < 0) {
        wx.showToast({ title: t('availability_required'), icon: 'none' });
        return;
      }
      payload.capacityAbsolute = n;
    }

    this.setData({ saving: true });
    const res = await availabilityUpsert(payload);
    this.setData({ saving: false });
    if (!res.ok) {
      wx.showToast({ title: res.error || 'Save failed', icon: 'error' });
      return;
    }
    wx.showToast({ title: t('saved'), icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },

  async onDelete() {
    if (!this.data.override._id) return;
    const confirm = await wx.showModal({
      title: t('pet_delete'),
      content: t('availability_delete_confirm'),
    });
    if (!confirm.confirm) return;
    const res = await availabilityDelete(this.data.override._id);
    if (!res.ok) {
      wx.showToast({ title: res.error || 'Delete failed', icon: 'error' });
      return;
    }
    wx.showToast({ title: t('deleted'), icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },
});
