import { t, getLocale, onLocaleChange } from '../../../i18n/index';
import { getOpenid } from '../../../services/openid';
import { isOwner, refreshCurrentUser } from '../../../services/user';
import { addonList } from '../../../services/addon';

interface AddonRow extends PetDaycare.AddOn {
  displayName: string;
  priceLabel: string;
  basisLabel: string;
  showInactive: boolean;
}

function localized(zh: string | undefined, en: string | undefined): string {
  const loc = getLocale();
  if (loc === 'en') return en || zh || '';
  return zh || en || '';
}

Page({
  data: {
    titleText: '',
    emptyText: '',
    inactiveLabel: '',
    notOwner: false,
    notOwnerText: '',
    addons: [] as AddonRow[],
  },

  unsubscribe: undefined as (() => void) | undefined,
  raw: [] as PetDaycare.AddOn[],

  onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => {
      this.refreshStrings();
      this.applyAddons();
    });
  },

  async onShow() {
    if (getOpenid()) await refreshCurrentUser();
    if (!isOwner()) {
      this.setData({ notOwner: true, addons: [] });
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
      titleText: t('addons_title'),
      emptyText: t('addons_empty'),
      inactiveLabel: t('addons_inactive_chip'),
      notOwnerText: t('daycare_not_owner'),
    });
  },

  applyAddons() {
    const rows: AddonRow[] = this.raw.map((a) => ({
      ...a,
      displayName: localized(a.nameZh, a.nameEn),
      priceLabel: `¥${a.unitPrice}`,
      basisLabel: a.chargeBasis === 'per_night' ? t('addons_basis_per_night') : t('addons_basis_per_stay'),
      showInactive: !a.active,
    }));
    this.setData({ addons: rows });
  },

  async load() {
    this.raw = await addonList(true);
    this.applyAddons();
  },

  onAddTap() {
    wx.navigateTo({ url: '/pages/addons/edit/edit' });
  },

  onRowTap(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/addons/edit/edit?id=${id}` });
  },
});
