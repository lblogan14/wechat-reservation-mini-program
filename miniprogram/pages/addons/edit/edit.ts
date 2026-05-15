import { t, onLocaleChange } from '../../../i18n/index';
import { getOpenid } from '../../../services/openid';
import { isOwner, refreshCurrentUser } from '../../../services/user';
import { addonList, addonUpsert, addonDelete } from '../../../services/addon';

type ChargeBasis = 'per_stay' | 'per_night';

Page({
  data: {
    title: '',
    addon: { active: true, chargeBasis: 'per_night' as ChargeBasis, unitPrice: 0 } as Partial<PetDaycare.AddOn>,
    priceInput: '',
    saving: false,
    labels: {} as Record<string, string>,
    placeholders: {} as Record<string, string>,
    basisOptions: [] as Array<{ value: ChargeBasis; label: string }>,
    basisIndex: 0,
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
    if (opts.id) await this.loadAddon(opts.id);
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    this.setData({
      title: this.data.addon._id ? t('addon_edit_title_edit') : t('addon_edit_title_new'),
      notOwnerText: t('daycare_not_owner'),
      labels: {
        nameZh: t('addon_field_name_zh'),
        nameEn: t('addon_field_name_en'),
        descZh: t('addon_field_desc_zh'),
        descEn: t('addon_field_desc_en'),
        price: t('addon_field_price'),
        basis: t('addon_field_basis'),
        active: t('addon_field_active'),
        save: t('pet_save'),
        delete: t('pet_delete'),
      },
      placeholders: { price: t('addon_field_price_ph') },
      basisOptions: [
        { value: 'per_night', label: t('addons_basis_per_night') },
        { value: 'per_stay', label: t('addons_basis_per_stay') },
      ],
    });
  },

  async loadAddon(_id: string) {
    wx.showLoading({ title: t('loading'), mask: true });
    const all = await addonList(true);
    wx.hideLoading();
    const found = all.find((a) => a._id === _id);
    if (!found) {
      wx.showToast({ title: 'Not found', icon: 'error' });
      return;
    }
    this.setData({
      addon: found,
      priceInput: String(found.unitPrice),
      basisIndex: this.data.basisOptions.findIndex((o) => o.value === found.chargeBasis) >= 0
        ? this.data.basisOptions.findIndex((o) => o.value === found.chargeBasis)
        : 0,
      title: t('addon_edit_title_edit'),
    });
  },

  onNameZhInput(e: WechatMiniprogram.Input) { this.setData({ 'addon.nameZh': e.detail.value }); },
  onNameEnInput(e: WechatMiniprogram.Input) { this.setData({ 'addon.nameEn': e.detail.value }); },
  onDescZhInput(e: WechatMiniprogram.Input) { this.setData({ 'addon.descriptionZh': e.detail.value }); },
  onDescEnInput(e: WechatMiniprogram.Input) { this.setData({ 'addon.descriptionEn': e.detail.value }); },
  onPriceInput(e: WechatMiniprogram.Input) {
    const raw = e.detail.value;
    const n = parseFloat(raw);
    this.setData({ priceInput: raw, 'addon.unitPrice': isNaN(n) ? 0 : n });
  },
  onBasisChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    this.setData({ basisIndex: idx, 'addon.chargeBasis': this.data.basisOptions[idx].value });
  },
  onActiveChange(e: WechatMiniprogram.SwitchChange) { this.setData({ 'addon.active': e.detail.value }); },

  async onSave() {
    const a = this.data.addon;
    if ((!a.nameZh && !a.nameEn) || !a.unitPrice || !a.chargeBasis) {
      wx.showToast({ title: t('addon_required'), icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    const res = await addonUpsert(a);
    this.setData({ saving: false });
    if (!res.ok) {
      wx.showToast({ title: res.error || 'Save failed', icon: 'error' });
      return;
    }
    wx.showToast({ title: t('saved'), icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },

  async onDelete() {
    if (!this.data.addon._id) return;
    const confirm = await wx.showModal({ title: t('pet_delete'), content: t('addon_delete_confirm') });
    if (!confirm.confirm) return;
    const res = await addonDelete(this.data.addon._id);
    if (!res.ok) {
      wx.showToast({ title: res.error || 'Delete failed', icon: 'error' });
      return;
    }
    wx.showToast({ title: t('deleted'), icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },
});
