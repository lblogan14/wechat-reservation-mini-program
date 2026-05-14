import { t, onLocaleChange } from '../../../i18n/index';
import { getOpenid } from '../../../services/openid';
import { petUpsert, petDelete, petList } from '../../../services/pet';

interface SpeciesOption {
  value: PetDaycare.Pet['species'];
  label: string;
}

interface SexOption {
  value: 'male' | 'female';
  label: string;
}

function fmtDate(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(s: string): number | undefined {
  if (!s) return undefined;
  const ts = Date.parse(s);
  return isNaN(ts) ? undefined : ts;
}

const SPECIES_VALUES: PetDaycare.Pet['species'][] = ['dog', 'cat', 'other'];

Page({
  data: {
    title: '',
    pet: { species: 'dog' } as Partial<PetDaycare.Pet>,
    weightInput: '',
    saving: false,
    speciesOptions: [] as SpeciesOption[],
    speciesIndex: 0,
    sexOptions: [] as SexOption[],
    sexIndex: 0,
    birthDateStr: '',
    vaccineExpiryStr: '',
    vaccineWarning: '',
    labels: {} as Record<string, string>,
    placeholders: {} as Record<string, string>,
  },

  unsubscribe: undefined as (() => void) | undefined,

  onLoad(opts: Record<string, string | undefined>) {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => this.refreshStrings());
    if (opts.id) {
      this.loadPet(opts.id);
    }
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    const speciesOptions: SpeciesOption[] = [
      { value: 'dog', label: t('pet_species_dog') },
      { value: 'cat', label: t('pet_species_cat') },
      { value: 'other', label: t('pet_species_other') },
    ];
    const sexOptions: SexOption[] = [
      { value: 'male', label: t('pet_sex_male') },
      { value: 'female', label: t('pet_sex_female') },
    ];
    this.setData({
      title: this.data.pet._id ? t('pet_edit_title_edit') : t('pet_edit_title_new'),
      speciesOptions,
      sexOptions,
      labels: {
        photo: t('pet_photo'),
        photoChoose: t('pet_photo_choose'),
        name: t('pet_name'),
        species: t('pet_species'),
        breed: t('pet_breed'),
        sex: t('pet_sex'),
        neutered: t('pet_neutered'),
        birthdate: t('pet_birthdate'),
        weight: t('pet_weight_kg'),
        vaccineCert: t('pet_vaccine_cert'),
        vaccineChoose: t('pet_vaccine_choose'),
        vaccineExpiry: t('pet_vaccine_expiry'),
        feeding: t('pet_feeding'),
        behavior: t('pet_behavior'),
        medical: t('pet_medical'),
        emergency: t('pet_emergency'),
        save: t('pet_save'),
        delete: t('pet_delete'),
      },
      placeholders: {
        name: t('pet_name_ph'),
        breed: t('pet_breed_ph'),
        pickDate: t('pick_date'),
        feeding: t('pet_feeding_ph'),
        behavior: t('pet_behavior_ph'),
        medical: t('pet_medical_ph'),
        emergency: t('pet_emergency_ph'),
      },
    });
    this.refreshDerived();
  },

  async loadPet(_id: string) {
    wx.showLoading({ title: t('loading'), mask: true });
    const pets = await petList();
    wx.hideLoading();
    const found = pets.find((p) => p._id === _id);
    if (!found) {
      wx.showToast({ title: 'Not found', icon: 'error' });
      return;
    }
    const speciesIndex = SPECIES_VALUES.indexOf(found.species);
    const sexIndex = found.sex === 'female' ? 1 : 0;
    this.setData({
      pet: found,
      weightInput: found.weightKg ? String(found.weightKg) : '',
      speciesIndex: speciesIndex < 0 ? 0 : speciesIndex,
      sexIndex,
      title: t('pet_edit_title_edit'),
    });
    this.refreshDerived();
  },

  refreshDerived() {
    const pet = this.data.pet;
    const birthDateStr = fmtDate(pet.birthDate);
    const vaccineExpiryStr = fmtDate(pet.vaccineExpiry);
    let warning = '';
    const now = Date.now();
    if (!pet.vaccineCertFileID || !pet.vaccineExpiry) {
      warning = t('pet_vaccine_warning_missing');
    } else if (pet.vaccineExpiry < now) {
      warning = t('pet_vaccine_warning_expired');
    }
    this.setData({
      birthDateStr,
      vaccineExpiryStr,
      vaccineWarning: warning,
    });
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ 'pet.name': e.detail.value });
  },

  onSpeciesChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    this.setData({
      speciesIndex: idx,
      'pet.species': this.data.speciesOptions[idx].value,
    });
  },

  onBreedInput(e: WechatMiniprogram.Input) {
    this.setData({ 'pet.breed': e.detail.value });
  },

  onSexChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    this.setData({
      sexIndex: idx,
      'pet.sex': this.data.sexOptions[idx].value,
    });
  },

  onNeuteredChange(e: WechatMiniprogram.SwitchChange) {
    this.setData({ 'pet.neutered': e.detail.value });
  },

  onBirthDateChange(e: WechatMiniprogram.PickerChange) {
    const ts = parseDate(String(e.detail.value));
    this.setData({ 'pet.birthDate': ts });
    this.refreshDerived();
  },

  onWeightInput(e: WechatMiniprogram.Input) {
    const raw = e.detail.value;
    const n = parseFloat(raw);
    this.setData({
      weightInput: raw,
      'pet.weightKg': isNaN(n) ? undefined : n,
    });
  },

  onChoosePhoto() {
    this.chooseAndUpload('photoFileID');
  },

  onChooseVaccineCert() {
    this.chooseAndUpload('vaccineCertFileID');
  },

  async chooseAndUpload(field: 'photoFileID' | 'vaccineCertFileID') {
    try {
      const chosen = await wx.chooseMedia({ count: 1, mediaType: ['image'] });
      const tempPath = chosen.tempFiles[0].tempFilePath;
      if (!wx.cloud) {
        wx.showToast({ title: 'wx.cloud unavailable', icon: 'none' });
        return;
      }
      wx.showLoading({ title: t('loading'), mask: true });
      const upload = await wx.cloud.uploadFile({
        cloudPath: `pets/${getOpenid()}/${field}-${Date.now()}.jpg`,
        filePath: tempPath,
      });
      wx.hideLoading();
      this.setData({ [`pet.${field}`]: upload.fileID });
      this.refreshDerived();
    } catch (err) {
      wx.hideLoading();
      console.warn('[upload] failed:', err);
    }
  },

  onVaccineExpiryChange(e: WechatMiniprogram.PickerChange) {
    const ts = parseDate(String(e.detail.value));
    this.setData({ 'pet.vaccineExpiry': ts });
    this.refreshDerived();
  },

  onFeedingInput(e: WechatMiniprogram.Input) {
    this.setData({ 'pet.feedingSchedule': e.detail.value });
  },

  onBehaviorInput(e: WechatMiniprogram.Input) {
    this.setData({ 'pet.behaviorNotes': e.detail.value });
  },

  onMedicalInput(e: WechatMiniprogram.Input) {
    this.setData({ 'pet.medicalConditions': e.detail.value });
  },

  onEmergencyInput(e: WechatMiniprogram.Input) {
    this.setData({ 'pet.emergencyContact': e.detail.value });
  },

  async onSave() {
    const pet = this.data.pet;
    if (!pet.name || !pet.species) {
      wx.showToast({ title: t('pet_validation_required'), icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    const res = await petUpsert(pet);
    this.setData({ saving: false });
    if (!res.ok) {
      wx.showToast({ title: res.error || 'Save failed', icon: 'error' });
      return;
    }
    wx.showToast({ title: t('saved'), icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },

  async onDelete() {
    if (!this.data.pet._id) return;
    const confirm = await wx.showModal({
      title: t('pet_delete'),
      content: t('pet_delete_confirm'),
    });
    if (!confirm.confirm) return;
    const res = await petDelete(this.data.pet._id);
    if (!res.ok) {
      wx.showToast({ title: res.error || 'Delete failed', icon: 'error' });
      return;
    }
    wx.showToast({ title: t('deleted'), icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  },
});
