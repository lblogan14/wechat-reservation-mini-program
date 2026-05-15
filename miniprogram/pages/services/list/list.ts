import { t, getLocale, onLocaleChange } from '../../../i18n/index';
import { isOwner, refreshCurrentUser } from '../../../services/user';
import { getOpenid } from '../../../services/openid';
import { serviceList } from '../../../services/service';

interface ServiceRow extends PetDaycare.Service {
  displayName: string;
  priceLabel: string;
  capacityLabel: string;
  showInactive: boolean;
}

function localized(zh: string | undefined, en: string | undefined): string {
  const loc = getLocale();
  if (loc === 'en') return en || zh || '';
  return zh || en || '';
}

Page({
  data: {
    title: '',
    services: [] as ServiceRow[],
    loading: false,
    emptyText: '',
    loadingText: '',
    inactiveLabel: '',
    notOwner: false,
    notOwnerText: '',
  },

  unsubscribe: undefined as (() => void) | undefined,

  onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => {
      this.refreshStrings();
      this.applyServices();
    });
  },

  async onShow() {
    if (getOpenid()) await refreshCurrentUser();
    if (!isOwner()) {
      this.setData({ notOwner: true, services: [] });
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
      title: t('services_title'),
      emptyText: t('services_empty'),
      loadingText: t('loading'),
      inactiveLabel: t('services_inactive_chip'),
      notOwnerText: t('daycare_not_owner'),
    });
  },

  raw: [] as PetDaycare.Service[],

  applyServices() {
    const services: ServiceRow[] = this.raw.map((s: PetDaycare.Service) => ({
      ...s,
      displayName: localized(s.nameZh, s.nameEn),
      priceLabel: `¥${s.pricePerNight} / 晚`,
      capacityLabel: `${s.capacityPerDay} / 天`,
      showInactive: !s.active,
    }));
    this.setData({ services });
  },

  async load() {
    this.setData({ loading: true });
    this.raw = await serviceList(true);
    this.applyServices();
    this.setData({ loading: false });
  },

  onAddTap() {
    wx.navigateTo({ url: '/pages/services/edit/edit' });
  },

  onCardTap(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/services/edit/edit?id=${id}` });
  },
});
