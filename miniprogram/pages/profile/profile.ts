import { t, onLocaleChange } from '../../i18n/index';
import { signIn } from '../../services/auth';
import { getOpenid, setOpenid } from '../../services/openid';
import { getCurrentUser, isOwner, promoteToOwner, refreshCurrentUser, setCurrentUser } from '../../services/user';

Page({
  data: {
    title: '',
    languageLabel: '',
    signedIn: false,
    isOwner: false,
    openidDisplay: '',
    notLoggedIn: '',
    signinCta: '',
    signoutCta: '',
    ownerToolsLabel: '',
    editDaycareLabel: '',
    manageServicesLabel: '',
    manageAvailabilityLabel: '',
    manageWaitlistLabel: '',
    promoteTitle: '',
    promoteHint: '',
    promoteCodeLabel: '',
    promoteCodePlaceholder: '',
    promoteSubmit: '',
    promoteCodeInput: '',
    promoting: false,
  },

  unsubscribe: undefined as (() => void) | undefined,

  onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => this.refreshStrings());
  },

  async onShow() {
    this.refreshAuth();
    if (this.data.signedIn) {
      await refreshCurrentUser();
      this.refreshAuth();
    }
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    this.setData({
      title: t('tab_profile'),
      languageLabel: t('profile_language'),
      notLoggedIn: t('not_logged_in'),
      signinCta: t('login_with_wechat'),
      signoutCta: t('profile_logout'),
      ownerToolsLabel: t('owner_tools'),
      editDaycareLabel: t('owner_edit_daycare'),
      manageServicesLabel: t('owner_manage_services'),
      manageAvailabilityLabel: t('owner_manage_availability'),
      manageWaitlistLabel: t('owner_manage_waitlist'),
      promoteTitle: t('owner_promote_title'),
      promoteHint: t('owner_promote_hint'),
      promoteCodeLabel: t('owner_promote_code'),
      promoteCodePlaceholder: t('owner_promote_code_ph'),
      promoteSubmit: t('owner_promote_submit'),
    });
  },

  refreshAuth() {
    const openid = getOpenid();
    const user = getCurrentUser();
    this.setData({
      signedIn: !!openid,
      isOwner: isOwner(),
      openidDisplay: openid ? `${openid.slice(0, 10)}…` : '',
    });
    if (!openid && user) {
      setCurrentUser(null);
    }
  },

  async onSignInTap() {
    wx.showLoading({ title: t('loading'), mask: true });
    const result = await signIn();
    wx.hideLoading();
    if (!result) {
      wx.showToast({ title: t('auth_signin_failed'), icon: 'error' });
      return;
    }
    setOpenid(result.openid);
    this.refreshAuth();
    wx.showToast({ title: t('auth_signin_success'), icon: 'success' });
  },

  onSignOutTap() {
    setOpenid('');
    setCurrentUser(null);
    this.refreshAuth();
  },

  onPromoteCodeInput(e: WechatMiniprogram.Input) {
    this.setData({ promoteCodeInput: e.detail.value });
  },

  async onPromoteSubmit() {
    if (this.data.promoting || !this.data.promoteCodeInput) return;
    this.setData({ promoting: true });
    const res = await promoteToOwner(this.data.promoteCodeInput);
    this.setData({ promoting: false, promoteCodeInput: '' });
    if (!res.ok) {
      wx.showToast({ title: res.error || t('owner_promote_failed'), icon: 'error' });
      return;
    }
    this.refreshAuth();
    wx.showToast({ title: t('owner_promote_success'), icon: 'success' });
  },

  onEditDaycareTap() {
    wx.navigateTo({ url: '/pages/daycare/edit/edit' });
  },

  onManageServicesTap() {
    wx.navigateTo({ url: '/pages/services/list/list' });
  },

  onManageAvailabilityTap() {
    wx.navigateTo({ url: '/pages/availability/list/list' });
  },

  onManageWaitlistTap() {
    wx.navigateTo({ url: '/pages/waitlist/queue/queue' });
  },
});
