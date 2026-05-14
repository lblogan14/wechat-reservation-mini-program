import { initLocale, onLocaleChange, t } from './i18n/index';

const OPENID_STORAGE_KEY = 'openid';

App({
  globalData: {
    openid: '' as string,
    locale: 'zh' as PetDaycare.Locale,
  },

  onLaunch() {
    this.initCloud();
    this.globalData.locale = initLocale();
    this.globalData.openid = (wx.getStorageSync(OPENID_STORAGE_KEY) as string) || '';
    this.refreshTabBar();
    onLocaleChange(() => this.refreshTabBar());
  },

  initCloud() {
    if (!wx.cloud) {
      console.warn('[cloud] wx.cloud unavailable — needs base lib ≥ 2.2.3 and a real AppID + 云开发 env.');
      return;
    }
    wx.cloud.init({
      // TODO: replace with your 云开发 env ID after creating it in the IDE.
      // env: 'your-env-id',
      traceUser: true,
    });
  },

  refreshTabBar() {
    const tabs: Array<{ index: number; key: 'tab_home' | 'tab_pets' | 'tab_profile' }> = [
      { index: 0, key: 'tab_home' },
      { index: 1, key: 'tab_pets' },
      { index: 2, key: 'tab_profile' },
    ];
    tabs.forEach(({ index, key }) => {
      wx.setTabBarItem({ index, text: t(key) }).catch(() => {
        // tab bar may not be ready on first onLaunch tick; safe to ignore.
      });
    });
  },
});
