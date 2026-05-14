declare namespace PetDaycare {
  type Locale = 'zh' | 'en';

  type UserRole = 'parent' | 'owner' | 'staff';

  type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'waived';

  type BookingStatus = 'confirmed' | 'cancelled' | 'checked_in' | 'checked_out' | 'no_show';

  type MessageSenderRole = 'parent' | 'owner' | 'staff' | 'system';

  type WaitlistStatus = 'waiting' | 'offered' | 'cancelled' | 'fulfilled';

  interface User {
    _id?: string;
    openid: string;
    role: UserRole;
    nickname?: string;
    phone?: string;
    createdAt: number;
  }

  interface Pet {
    _id?: string;
    ownerOpenid: string;
    name: string;
    species: 'dog' | 'cat' | 'other';
    breed?: string;
    sex?: 'male' | 'female';
    neutered?: boolean;
    birthDate?: number;
    weightKg?: number;
    photoFileID?: string;
    vaccineCertFileID?: string;
    vaccineExpiry?: number;
    feedingSchedule?: string;
    behaviorNotes?: string;
    medicalConditions?: string;
    emergencyContact?: string;
    createdAt: number;
  }

  // A Service row IS a tier — owner-configurable (no fixed enum).
  // Renamed previous `ServiceTier` to `serviceId` everywhere it was referenced.
  interface Service {
    _id?: string;
    nameZh: string;
    nameEn: string;
    descriptionZh?: string;
    descriptionEn?: string;
    pricePerNight: number;
    capacityPerDay: number;
    sortOrder?: number;
    active: boolean;
    createdAt: number;
  }

  interface AvailabilityOverride {
    _id?: string;
    date: number;
    serviceId: string;
    capacityDelta?: number;
    capacityAbsolute?: number;
    reason?: string;
  }

  // Embedded sub-doc on Booking. Catalog of add-on templates lives in `addons`.
  interface BookingAddOn {
    addonId: string;
    nameZh: string;
    nameEn: string;
    unitPrice: number;
    quantity: number;
    chargeBasis: 'per_stay' | 'per_night';
  }

  interface AddOn {
    _id?: string;
    nameZh: string;
    nameEn: string;
    descriptionZh?: string;
    descriptionEn?: string;
    unitPrice: number;
    chargeBasis: 'per_stay' | 'per_night';
    active: boolean;
  }

  interface BookingRecurrence {
    pattern: 'weekly' | 'daily';
    daysOfWeek?: number[]; // 0 = Sunday … 6 = Saturday, used when pattern === 'weekly'
    endsAt: number; // recurrence ends on or before this timestamp
  }

  interface Booking {
    _id?: string;
    parentOpenid: string;
    petIds: string[];
    serviceId: string;
    dropoffAt: number;
    pickupAt: number;
    nights: number;
    pricePerNight: number;
    addOns?: BookingAddOn[];
    totalPrice: number;
    paymentStatus: PaymentStatus;
    paymentNote?: string;
    bookingStatus: BookingStatus;
    parentNotes?: string;
    // Waiver / 寄养协议 acceptance — captured at booking confirmation.
    agreementVersion?: string;
    agreementAcceptedAt?: number;
    // Recurring stays: if set, this row is the template; per-instance rows reference it.
    recurrence?: BookingRecurrence;
    parentBookingId?: string;
    createdAt: number;
    updatedAt: number;
  }

  // Singleton: one DaycareConfig row per Mini Program (v1 = single home).
  interface DaycareConfig {
    _id?: string;
    nameZh: string;
    nameEn: string;
    address?: string;
    phone?: string;
    photoFileIDs?: string[];
    hoursOpen?: string; // 'HH:mm'
    hoursClose?: string;
    cancelPolicyZh?: string;
    cancelPolicyEn?: string;
    agreementZh?: string;
    agreementEn?: string;
    agreementVersion?: string;
    updatedAt: number;
  }

  // One thread per booking (or stand-alone for pre-booking inquiry — bookingId optional).
  interface MessageThread {
    _id?: string;
    bookingId?: string;
    parentOpenid: string;
    lastMessageAt: number;
    lastMessagePreview?: string;
    unreadForParent: number;
    unreadForOwner: number;
    createdAt: number;
  }

  interface Message {
    _id?: string;
    threadId: string;
    fromOpenid: string;
    fromRole: MessageSenderRole;
    body: string;
    attachmentFileID?: string;
    createdAt: number;
    readByParentAt?: number;
    readByOwnerAt?: number;
  }

  interface WaitlistEntry {
    _id?: string;
    parentOpenid: string;
    petIds: string[];
    serviceId: string;
    dropoffAt: number;
    pickupAt: number;
    status: WaitlistStatus;
    parentNotes?: string;
    createdAt: number;
    updatedAt: number;
  }
}
