import { t, onLocaleChange } from '../../../i18n/index';
import { getOpenid } from '../../../services/openid';
import { petList } from '../../../services/pet';

Page({
  data: {
    title: '',
    pets: [] as PetDaycare.Pet[],
    signedIn: false,
    loading: false,
    emptyText: '',
    loadingText: '',
    authRequiredText: '',
    signinCta: '',
  },

  unsubscribe: undefined as (() => void) | undefined,

  onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => this.refreshStrings());
  },

  onShow() {
    const signedIn = !!getOpenid();
    this.setData({ signedIn });
    if (signedIn) {
      this.load();
    } else {
      this.setData({ pets: [] });
    }
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    this.setData({
      title: t('pets_title'),
      emptyText: t('pets_empty'),
      loadingText: t('loading'),
      authRequiredText: t('auth_required'),
      signinCta: t('login_with_wechat'),
    });
  },

  async load() {
    this.setData({ loading: true });
    const pets = await petList();
    this.setData({ pets, loading: false });
  },

  onAddTap() {
    wx.navigateTo({ url: '/pages/pets/edit/edit' });
  },

  onCardTap(e: WechatMiniprogram.CustomEvent<{ _id?: string }>) {
    const id = e.detail._id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/pets/edit/edit?id=${id}` });
  },

  goToProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },
});
