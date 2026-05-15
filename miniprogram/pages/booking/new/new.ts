import { t, getLocale, onLocaleChange } from '../../../i18n/index';
import { getOpenid } from '../../../services/openid';
import { serviceList } from '../../../services/service';
import { petList } from '../../../services/pet';
import { daycareGet } from '../../../services/daycare';
import { bookingCreate } from '../../../services/booking';

interface ServiceOption {
  value: string;
  label: string;
  pricePerNight: number;
}

interface PetRow {
  _id: string;
  name: string;
  speciesLabel: string;
  selected: boolean;
}

interface DowChip {
  value: number; // 0 = Sun … 6 = Sat
  label: string;
  selected: boolean;
}

type RecurrencePattern = 'weekly' | 'daily';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OCCURRENCES = 60;

function fmtDate(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function parseDateUTC(s: string): number {
  return Date.parse(`${s}T00:00:00Z`);
}

function combine(dateStr: string, timeStr: string): number {
  if (!dateStr || !timeStr) return 0;
  return Date.parse(`${dateStr}T${timeStr}:00Z`);
}

function localized(zh: string | undefined, en: string | undefined): string {
  const loc = getLocale();
  if (loc === 'en') return en || zh || '';
  return zh || en || '';
}

function fmtTpl(tpl: string, vars: Record<string, number | string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

function countOccurrences(
  pattern: RecurrencePattern,
  daysOfWeek: number[],
  startDay: number,
  endDay: number,
): number {
  if (endDay < startDay) return 0;
  if (pattern === 'daily') {
    return Math.min(MAX_OCCURRENCES + 1, Math.floor((endDay - startDay) / DAY_MS) + 1);
  }
  const set = new Set(daysOfWeek.length ? daysOfWeek : [new Date(startDay).getUTCDay()]);
  let n = 0;
  for (let d = startDay; d <= endDay && n <= MAX_OCCURRENCES; d += DAY_MS) {
    if (set.has(new Date(d).getUTCDay())) n += 1;
  }
  return n;
}

Page({
  data: {
    titleText: '',
    sectionService: '',
    sectionDates: '',
    sectionPets: '',
    sectionNotes: '',
    sectionWaiver: '',
    sectionSummary: '',
    sectionRecurrence: '',
    fieldDropoffDate: '',
    fieldDropoffTime: '',
    fieldPickupDate: '',
    fieldPickupTime: '',
    fieldNotesPh: '',
    fieldWaiverAgree: '',
    fieldWaiverEmpty: '',
    fieldNoPets: '',
    fieldNoServices: '',
    fieldHoursHint: '',
    totalNightsLabel: '',
    totalPetsLabel: '',
    totalPriceLabel: '',
    nightsUnit: '',
    petsUnit: '',
    priceUnit: '',
    warningHours: '',
    submitLabel: '',
    submittingLabel: '',
    cancelLabel: '',
    loginRequiredText: '',
    loginCta: '',
    recurEnableLabel: '',
    recurPatternLabel: '',
    recurDowLabel: '',
    recurEndsAtLabel: '',
    recurPatternOptions: [] as Array<{ value: RecurrencePattern; label: string }>,
    recurPatternIndex: 0,
    recurEnabled: false,
    recurEndsAtStr: '',
    recurDowChips: [] as DowChip[],
    recurSummary: '',
    recurInvalid: false,
    serviceOptions: [] as ServiceOption[],
    serviceIndex: 0,
    pets: [] as PetRow[],
    dropoffDateStr: '',
    dropoffTimeStr: '09:00',
    pickupDateStr: '',
    pickupTimeStr: '18:00',
    parentNotes: '',
    agreementText: '',
    agreementVersion: '',
    hasAgreement: false,
    agreed: false,
    nights: 0,
    selectedPets: 0,
    totalPrice: 0,
    submitting: false,
    showHoursWarning: false,
    notSignedIn: false,
  },

  unsubscribe: undefined as (() => void) | undefined,
  services: [] as PetDaycare.Service[],
  config: null as PetDaycare.DaycareConfig | null,

  async onLoad(opts: Record<string, string | undefined>) {
    this.refreshStrings();
    this.unsubscribe = onLocaleChange(() => {
      this.refreshStrings();
      this.rebuildServiceOptions();
      this.rebuildDowChips();
      this.applyAgreement();
      this.recomputeRecurrence();
    });

    if (!getOpenid()) {
      this.setData({ notSignedIn: true });
      return;
    }

    const [services, pets, config] = await Promise.all([
      serviceList(false),
      petList(),
      daycareGet(),
    ]);
    this.services = services;
    this.config = config;

    const presetServiceId = opts.serviceId;
    const presetDateTs = opts.date ? parseInt(opts.date, 10) : NaN;
    const presetDateStr = !isNaN(presetDateTs) ? fmtDate(presetDateTs) : '';

    const serviceIndex = presetServiceId
      ? Math.max(0, services.findIndex((s) => s._id === presetServiceId))
      : 0;
    const dropoff = presetDateStr || fmtDate(Date.now());
    const pickup = fmtDate((!isNaN(presetDateTs) ? presetDateTs : Date.now()) + DAY_MS);

    this.setData({
      pets: pets.map((p) => ({
        _id: p._id!,
        name: p.name,
        speciesLabel: t(`pet_species_${p.species}` as 'pet_species_dog'),
        selected: false,
      })),
      dropoffDateStr: dropoff,
      pickupDateStr: pickup,
      serviceIndex,
    });
    this.rebuildServiceOptions();
    this.rebuildDowChips();
    this.applyAgreement();
    this.recompute();
  },

  onUnload() {
    this.unsubscribe?.();
  },

  refreshStrings() {
    const cfg = this.config;
    const hoursHint = cfg && cfg.hoursOpen && cfg.hoursClose
      ? fmtTpl(t('booking_field_hours_hint'), { open: cfg.hoursOpen, close: cfg.hoursClose })
      : '';
    this.setData({
      titleText: t('booking_new_title'),
      sectionService: t('booking_section_service'),
      sectionDates: t('booking_section_dates'),
      sectionPets: t('booking_section_pets'),
      sectionNotes: t('booking_section_notes'),
      sectionWaiver: t('booking_section_waiver'),
      sectionSummary: t('booking_section_summary'),
      sectionRecurrence: t('recurrence_section'),
      fieldDropoffDate: t('booking_field_dropoff_date'),
      fieldDropoffTime: t('booking_field_dropoff_time'),
      fieldPickupDate: t('booking_field_pickup_date'),
      fieldPickupTime: t('booking_field_pickup_time'),
      fieldNotesPh: t('booking_field_notes_ph'),
      fieldWaiverAgree: t('booking_field_waiver_agree'),
      fieldWaiverEmpty: t('booking_field_waiver_empty'),
      fieldNoPets: t('booking_field_no_pets'),
      fieldNoServices: t('booking_field_no_services'),
      fieldHoursHint: hoursHint,
      totalNightsLabel: t('booking_total_nights'),
      totalPetsLabel: t('booking_total_pets'),
      totalPriceLabel: t('booking_total_price'),
      nightsUnit: t('booking_total_nights_unit'),
      petsUnit: t('booking_total_pets_unit'),
      priceUnit: t('booking_total_unit'),
      warningHours: t('booking_total_warning_hours'),
      submitLabel: t('booking_submit'),
      submittingLabel: t('booking_submitting'),
      cancelLabel: t('cancel'),
      loginRequiredText: t('booking_login_required'),
      loginCta: t('booking_required_login_cta'),
      recurEnableLabel: t('recurrence_enable'),
      recurPatternLabel: t('recurrence_pattern'),
      recurDowLabel: t('recurrence_days_of_week'),
      recurEndsAtLabel: t('recurrence_ends_at'),
      recurPatternOptions: [
        { value: 'weekly', label: t('recurrence_pattern_weekly') },
        { value: 'daily', label: t('recurrence_pattern_daily') },
      ],
    });
  },

  rebuildServiceOptions() {
    const serviceOptions: ServiceOption[] = this.services.map((s) => ({
      value: s._id!,
      label: localized(s.nameZh, s.nameEn),
      pricePerNight: s.pricePerNight,
    }));
    this.setData({ serviceOptions });
  },

  rebuildDowChips() {
    const labelKeys: Array<keyof import('../../../i18n/zh').Dict> = [
      'recurrence_dow_sun',
      'recurrence_dow_mon',
      'recurrence_dow_tue',
      'recurrence_dow_wed',
      'recurrence_dow_thu',
      'recurrence_dow_fri',
      'recurrence_dow_sat',
    ];
    const prev = new Map(this.data.recurDowChips.map((c) => [c.value, c.selected]));
    const recurDowChips: DowChip[] = labelKeys.map((k, idx) => ({
      value: idx,
      label: t(k),
      selected: prev.get(idx) ?? false,
    }));
    this.setData({ recurDowChips });
  },

  applyAgreement() {
    const cfg = this.config;
    const loc = getLocale();
    const text = cfg ? (loc === 'en' ? cfg.agreementEn || cfg.agreementZh : cfg.agreementZh || cfg.agreementEn) : '';
    this.setData({
      agreementText: text || '',
      agreementVersion: cfg?.agreementVersion || '',
      hasAgreement: !!(text && cfg?.agreementVersion),
    });
  },

  onServiceChange(e: WechatMiniprogram.PickerChange) {
    const idx = Number(e.detail.value);
    this.setData({ serviceIndex: idx });
    this.recompute();
  },

  onDropoffDateChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ dropoffDateStr: String(e.detail.value) });
    this.recompute();
  },

  onDropoffTimeChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ dropoffTimeStr: String(e.detail.value) });
    this.recompute();
  },

  onPickupDateChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ pickupDateStr: String(e.detail.value) });
    this.recompute();
  },

  onPickupTimeChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ pickupTimeStr: String(e.detail.value) });
    this.recompute();
  },

  onPetToggle(e: WechatMiniprogram.BaseEvent) {
    const id = (e.currentTarget.dataset as { id: string }).id;
    const pets = this.data.pets.map((p) => (p._id === id ? { ...p, selected: !p.selected } : p));
    this.setData({ pets });
    this.recompute();
  },

  onNotesInput(e: WechatMiniprogram.Input) {
    this.setData({ parentNotes: e.detail.value });
  },

  onAgreedChange(e: WechatMiniprogram.SwitchChange) {
    this.setData({ agreed: e.detail.value });
  },

  onRecurEnabledChange(e: WechatMiniprogram.SwitchChange) {
    this.setData({ recurEnabled: e.detail.value });
    this.recomputeRecurrence();
  },

  onRecurPatternChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ recurPatternIndex: Number(e.detail.value) });
    this.recomputeRecurrence();
  },

  onRecurEndsAtChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ recurEndsAtStr: String(e.detail.value) });
    this.recomputeRecurrence();
  },

  onDowChipTap(e: WechatMiniprogram.BaseEvent) {
    const value = Number((e.currentTarget.dataset as { value: string }).value);
    const recurDowChips = this.data.recurDowChips.map((c) =>
      c.value === value ? { ...c, selected: !c.selected } : c,
    );
    this.setData({ recurDowChips });
    this.recomputeRecurrence();
  },

  recompute() {
    const { dropoffDateStr, pickupDateStr, dropoffTimeStr, pickupTimeStr, pets, serviceIndex, serviceOptions } = this.data;
    const cfg = this.config;
    const dropoffDay = parseDateUTC(dropoffDateStr);
    const pickupDay = parseDateUTC(pickupDateStr);
    const nights = Math.max(0, Math.round((pickupDay - dropoffDay) / DAY_MS));
    const selectedPets = pets.filter((p) => p.selected).length;
    const service = serviceOptions[serviceIndex];
    const totalPrice = service ? nights * service.pricePerNight * selectedPets : 0;

    let showHoursWarning = false;
    if (cfg && cfg.hoursOpen && cfg.hoursClose && dropoffTimeStr && pickupTimeStr) {
      const o = cfg.hoursOpen;
      const c = cfg.hoursClose;
      if (dropoffTimeStr < o || dropoffTimeStr > c || pickupTimeStr < o || pickupTimeStr > c) {
        showHoursWarning = true;
      }
    }

    this.setData({ nights, selectedPets, totalPrice, showHoursWarning });
    this.recomputeRecurrence();
  },

  recomputeRecurrence() {
    const { recurEnabled, recurPatternOptions, recurPatternIndex, recurDowChips, recurEndsAtStr, dropoffDateStr } = this.data;
    if (!recurEnabled) {
      this.setData({ recurSummary: '', recurInvalid: false });
      return;
    }
    if (!recurEndsAtStr) {
      this.setData({ recurSummary: t('recurrence_validation_ends_at'), recurInvalid: true });
      return;
    }
    const startDay = parseDateUTC(dropoffDateStr);
    const endDay = parseDateUTC(recurEndsAtStr);
    const pattern = recurPatternOptions[recurPatternIndex].value;
    const dow = recurDowChips.filter((c) => c.selected).map((c) => c.value);
    const n = countOccurrences(pattern, dow, startDay, endDay);
    if (n === 0) {
      this.setData({ recurSummary: t('recurrence_summary_zero'), recurInvalid: true });
    } else if (n > MAX_OCCURRENCES) {
      this.setData({ recurSummary: fmtTpl(t('recurrence_summary_too_many'), { max: MAX_OCCURRENCES }), recurInvalid: true });
    } else {
      this.setData({ recurSummary: fmtTpl(t('recurrence_summary_count'), { n }), recurInvalid: false });
    }
  },

  goSignIn() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  async onSubmit() {
    if (this.data.submitting) return;

    const { dropoffDateStr, dropoffTimeStr, pickupDateStr, pickupTimeStr, pets, serviceIndex, serviceOptions, parentNotes, agreed, hasAgreement, agreementVersion, recurEnabled, recurPatternOptions, recurPatternIndex, recurDowChips, recurEndsAtStr, recurInvalid } = this.data;
    const dropoffAt = combine(dropoffDateStr, dropoffTimeStr);
    const pickupAt = combine(pickupDateStr, pickupTimeStr);
    if (!dropoffAt || !pickupAt || pickupAt <= dropoffAt) {
      wx.showToast({ title: t('booking_validation_dates'), icon: 'none' });
      return;
    }

    const petIds = pets.filter((p) => p.selected).map((p) => p._id);
    if (!petIds.length) {
      wx.showToast({ title: t('booking_validation_pets'), icon: 'none' });
      return;
    }

    if (hasAgreement && !agreed) {
      wx.showToast({ title: t('booking_validation_waiver'), icon: 'none' });
      return;
    }

    const service = serviceOptions[serviceIndex];
    if (!service) {
      wx.showToast({ title: t('booking_field_no_services'), icon: 'none' });
      return;
    }

    let recurrence: PetDaycare.BookingRecurrence | undefined;
    if (recurEnabled) {
      if (recurInvalid) {
        wx.showToast({ title: t('recurrence_validation_ends_at'), icon: 'none' });
        return;
      }
      const pattern = recurPatternOptions[recurPatternIndex].value;
      const dow = recurDowChips.filter((c) => c.selected).map((c) => c.value);
      recurrence = {
        pattern,
        endsAt: parseDateUTC(recurEndsAtStr),
      };
      if (pattern === 'weekly' && dow.length) {
        recurrence.daysOfWeek = dow;
      }
    }

    this.setData({ submitting: true });
    const res = await bookingCreate({
      serviceId: service.value,
      petIds,
      dropoffAt,
      pickupAt,
      parentNotes,
      agreementVersion: hasAgreement ? agreementVersion : 'no-agreement-v0',
      agreementAcceptedAt: Date.now(),
      recurrence,
    });
    this.setData({ submitting: false });

    if (!res.ok) {
      const msg = res.error === 'insufficient capacity'
        ? t('booking_capacity_blocked')
        : res.error || t('booking_create_failed');
      wx.showToast({ title: msg, icon: 'error' });
      return;
    }

    const successMsg = recurrence && (res.occurrences ?? 0) > 1
      ? fmtTpl(t('recurrence_create_success'), { n: res.occurrences! })
      : t('booking_create_success');
    wx.showToast({ title: successMsg, icon: 'success' });
    setTimeout(() => wx.navigateBack(), 800);
  },
});
