import { t, onLocaleChange } from '../../i18n/index';
import { signIn } from '../../services/auth';
import { getOpenid, setOpenid } from '../../services/openid';

Page({
  data: {
    title: '',
    languageLabel: '',
    signedIn: false,
    openidDisplay: '',
    notLoggedIn: '',
    signinCta: '',
    signoutCta: '',
  },

  unsubscribe: undefined as (() => void) | undefined,

  onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => this.refreshStrings());
  },

  onShow() {
    this.refreshAuth();
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
    });
  },

  refreshAuth() {
    const openid = getOpenid();
    this.setData({
      signedIn: !!openid,
      openidDisplay: openid ? `${openid.slice(0, 10)}…` : '',
    });
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
    this.refreshAuth();
  },
});
