import { t, onLocaleChange } from '../../../i18n/index';
import { isOwner, refreshCurrentUser } from '../../../services/user';
import { getOpenid } from '../../../services/openid';
import { serviceList, serviceUpsert, serviceDelete } from '../../../services/service';

Page({
  data: {
    title: '',
    service: { active: true, pricePerNight: 0, capacityPerDay: 0, sortOrder: 0 } as Partial<PetDaycare.Service>,
    priceInput: '',
    capacityInput: '',
    sortInput: '',
    saving: false,
    labels: {} as Record<string, string>,
    placeholders: {} as Record<string, string>,
    notOwner: false,
    notOwnerText: '',
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

    if (opts.id) {
      await this.loadService(opts.id);
    }
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    this.setData({
      title: this.data.service._id ? t('service_edit_title_edit') : t('service_edit_title_new'),
      notOwnerText: t('daycare_not_owner'),
      labels: {
        nameZh: t('service_field_name_zh'),
        nameEn: t('service_field_name_en'),
        descZh: t('service_field_desc_zh'),
        descEn: t('service_field_desc_en'),
        price: t('service_field_price'),
        capacity: t('service_field_capacity'),
        sort: t('service_field_sort'),
        active: t('service_field_active'),
        save: t('pet_save'),
        delete: t('pet_delete'),
      },
      placeholders: {
        price: t('service_field_price_ph'),
        capacity: t('service_field_capacity_ph'),
      },
    });
  },

  async loadService(_id: string) {
    wx.showLoading({ title: t('loading'), mask: true });
    const all = await serviceList(true);
    wx.hideLoading();
    const found = all.find((s) => s._id === _id);
    if (!found) {
      wx.showToast({ title: 'Not found', icon: 'error' });
      return;
    }
    this.setData({
      service: found,
      priceInput: String(found.pricePerNight),
      capacityInput: String(found.capacityPerDay),
      sortInput: found.sortOrder !== undefined ? String(found.sortOrder) : '',
      title: t('service_edit_title_edit'),
    });
  },

  onNameZhInput(e: WechatMiniprogram.Input) {
    this.setData({ 'service.nameZh': e.detail.value });
  },
  onNameEnInput(e: WechatMiniprogram.Input) {
    this.setData({ 'service.nameEn': e.detail.value });
  },
  onDescZhInput(e: WechatMiniprogram.Input) {
    this.setData({ 'service.descriptionZh': e.detail.value });
  },
  onDescEnInput(e: WechatMiniprogram.Input) {
    this.setData({ 'service.descriptionEn': e.detail.value });
  },
  onPriceInput(e: WechatMiniprogram.Input) {
    const raw = e.detail.value;
    const n = parseFloat(raw);
    this.setData({ priceInput: raw, 'service.pricePerNight': isNaN(n) ? 0 : n });
  },
  onCapacityInput(e: WechatMiniprogram.Input) {
    const raw = e.detail.value;
    const n = parseInt(raw, 10);
    this.setData({ capacityInput: raw, 'service.capacityPerDay': isNaN(n) ? 0 : n });
  },
  onSortInput(e: WechatMiniprogram.Input) {
    const raw = e.detail.value;
    const n = parseInt(raw, 10);
    this.setData({ sortInput: raw, 'service.sortOrder': isNaN(n) ? undefined : n });
  },
  onActiveChange(e: WechatMiniprogram.SwitchChange) {
    this.setData({ 'service.active': e.detail.value });
  },

  async onSave() {
    const s = this.data.service;
    if ((!s.nameZh && !s.nameEn) || !s.pricePerNight || !s.capacityPerDay) {
      wx.showToast({ title: t('service_required'), icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    const res = await serviceUpsert(s);
    this.setData({ saving: false });
    if (!res.ok) {
      wx.showToast({ title: res.error || 'Save failed', icon: 'error' });
      return;
    }
    wx.showToast({ title: t('saved'), icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },

  async onDelete() {
    if (!this.data.service._id) return;
    const confirm = await wx.showModal({
      title: t('pet_delete'),
      content: t('service_delete_confirm'),
    });
    if (!confirm.confirm) return;
    const res = await serviceDelete(this.data.service._id);
    if (!res.ok) {
      wx.showToast({ title: res.error || 'Delete failed', icon: 'error' });
      return;
    }
    wx.showToast({ title: t('deleted'), icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },
});
