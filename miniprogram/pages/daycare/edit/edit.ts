import { t, onLocaleChange } from '../../../i18n/index';
import { getOpenid } from '../../../services/openid';
import { isOwner, refreshCurrentUser } from '../../../services/user';
import { daycareGet, daycareUpsert } from '../../../services/daycare';

Page({
  data: {
    title: '',
    saving: false,
    config: {} as Partial<PetDaycare.DaycareConfig>,
    photoFileID: '',
    labels: {} as Record<string, string>,
    placeholders: {} as Record<string, string>,
    notOwner: false,
    notOwnerText: '',
  },

  unsubscribe: undefined as (() => void) | undefined,

  async onLoad() {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => this.refreshStrings());

    if (getOpenid()) {
      await refreshCurrentUser();
    }
    if (!isOwner()) {
      this.setData({ notOwner: true });
      return;
    }

    const config = await daycareGet();
    if (config) {
      this.setData({
        config,
        photoFileID: config.photoFileIDs?.[0] || '',
      });
    }
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    this.setData({
      title: t('daycare_edit_title'),
      notOwnerText: t('daycare_not_owner'),
      labels: {
        nameZh: t('daycare_field_name_zh'),
        nameEn: t('daycare_field_name_en'),
        address: t('daycare_field_address'),
        phone: t('daycare_field_phone'),
        photo: t('daycare_field_photo'),
        photoChoose: t('pet_photo_choose'),
        hoursOpen: t('daycare_field_hours_open'),
        hoursClose: t('daycare_field_hours_close'),
        cancelZh: t('daycare_field_cancel_zh'),
        cancelEn: t('daycare_field_cancel_en'),
        agreementZh: t('daycare_field_agreement_zh'),
        agreementEn: t('daycare_field_agreement_en'),
        agreementVersion: t('daycare_field_agreement_version'),
        reminderSection: t('reminder_section'),
        reminderDropoff: t('reminder_field_dropoff_tmpl_id'),
        reminderPickup: t('reminder_field_pickup_tmpl_id'),
        save: t('pet_save'),
      },
      placeholders: {
        agreementVersion: t('daycare_field_agreement_version_ph'),
        pickTime: t('pick_time'),
        reminderTmplId: t('reminder_field_tmpl_id_ph'),
      },
    });
  },

  onReminderDropoffInput(e: WechatMiniprogram.Input) {
    this.setData({ 'config.reminderDropoffTmplId': e.detail.value });
  },

  onReminderPickupInput(e: WechatMiniprogram.Input) {
    this.setData({ 'config.reminderPickupTmplId': e.detail.value });
  },

  onNameZhInput(e: WechatMiniprogram.Input) {
    this.setData({ 'config.nameZh': e.detail.value });
  },
  onNameEnInput(e: WechatMiniprogram.Input) {
    this.setData({ 'config.nameEn': e.detail.value });
  },
  onAddressInput(e: WechatMiniprogram.Input) {
    this.setData({ 'config.address': e.detail.value });
  },
  onPhoneInput(e: WechatMiniprogram.Input) {
    this.setData({ 'config.phone': e.detail.value });
  },
  onHoursOpenChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ 'config.hoursOpen': String(e.detail.value) });
  },
  onHoursCloseChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ 'config.hoursClose': String(e.detail.value) });
  },
  onCancelZhInput(e: WechatMiniprogram.Input) {
    this.setData({ 'config.cancelPolicyZh': e.detail.value });
  },
  onCancelEnInput(e: WechatMiniprogram.Input) {
    this.setData({ 'config.cancelPolicyEn': e.detail.value });
  },
  onAgreementZhInput(e: WechatMiniprogram.Input) {
    this.setData({ 'config.agreementZh': e.detail.value });
  },
  onAgreementEnInput(e: WechatMiniprogram.Input) {
    this.setData({ 'config.agreementEn': e.detail.value });
  },
  onAgreementVersionInput(e: WechatMiniprogram.Input) {
    this.setData({ 'config.agreementVersion': e.detail.value });
  },

  async onChoosePhoto() {
    try {
      const chosen = await wx.chooseMedia({ count: 1, mediaType: ['image'] });
      const tempPath = chosen.tempFiles[0].tempFilePath;
      if (!wx.cloud) {
        wx.showToast({ title: 'wx.cloud unavailable', icon: 'none' });
        return;
      }
      wx.showLoading({ title: t('loading'), mask: true });
      const upload = await wx.cloud.uploadFile({
        cloudPath: `daycare/hero-${Date.now()}.jpg`,
        filePath: tempPath,
      });
      wx.hideLoading();
      this.setData({
        photoFileID: upload.fileID,
        'config.photoFileIDs': [upload.fileID],
      });
    } catch (err) {
      wx.hideLoading();
      console.warn('[daycare] upload failed:', err);
    }
  },

  async onSave() {
    const cfg = this.data.config;
    if (!cfg.nameZh && !cfg.nameEn) {
      wx.showToast({ title: t('daycare_required_name'), icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    const res = await daycareUpsert(cfg);
    this.setData({ saving: false });
    if (!res.ok) {
      wx.showToast({ title: res.error || 'Save failed', icon: 'error' });
      return;
    }
    wx.showToast({ title: t('saved'), icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },
});
