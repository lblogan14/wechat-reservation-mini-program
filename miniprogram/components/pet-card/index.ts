import { t, onLocaleChange } from '../../i18n/index';

const unsubscribers = new WeakMap<object, () => void>();

Component({
  properties: {
    pet: {
      type: Object,
      value: null as PetDaycare.Pet | null,
    },
  },

  data: {
    speciesLabel: '',
    breedSuffix: '',
    weightLabel: '',
    photoUrl: '',
    photoFallback: '🐾',
    vaccineWarning: '',
  },

  lifetimes: {
    attached() {
      this.refresh();
      const unsub = onLocaleChange(() => this.refresh());
      unsubscribers.set(this, unsub);
    },
    detached() {
      unsubscribers.get(this)?.();
      unsubscribers.delete(this);
    },
  },

  observers: {
    pet() {
      this.refresh();
    },
  },

  methods: {
    refresh() {
      const pet = this.data.pet as PetDaycare.Pet | null;
      if (!pet) return;

      const speciesKey = `pet_species_${pet.species}` as
        | 'pet_species_dog'
        | 'pet_species_cat'
        | 'pet_species_other';

      const breedSuffix = pet.breed ? ` · ${pet.breed}` : '';
      const weightLabel = pet.weightKg ? `${pet.weightKg} kg` : '';

      let warning = '';
      const now = Date.now();
      if (!pet.vaccineCertFileID || !pet.vaccineExpiry) {
        warning = t('pet_vaccine_warning_missing');
      } else if (pet.vaccineExpiry < now) {
        warning = t('pet_vaccine_warning_expired');
      }

      this.setData({
        speciesLabel: t(speciesKey),
        breedSuffix,
        weightLabel,
        photoUrl: pet.photoFileID || '',
        vaccineWarning: warning,
      });
    },

    onTap() {
      const pet = this.data.pet as PetDaycare.Pet | null;
      this.triggerEvent('tap', { _id: pet?._id });
    },
  },
});
