const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const ALLOWED_FIELDS = [
  'name',
  'species',
  'breed',
  'sex',
  'neutered',
  'birthDate',
  'weightKg',
  'photoFileID',
  'vaccineCertFileID',
  'vaccineExpiry',
  'feedingSchedule',
  'behaviorNotes',
  'medicalConditions',
  'emergencyContact',
];

const ALLOWED_SPECIES = new Set(['dog', 'cat', 'other']);

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const db = cloud.database();
  const pets = db.collection('pets');

  const payload = {};
  for (const k of ALLOWED_FIELDS) {
    if (event[k] !== undefined && event[k] !== null && event[k] !== '') {
      payload[k] = event[k];
    }
  }

  if (!payload.name || !payload.species) {
    return { ok: false, error: 'name and species are required' };
  }
  if (!ALLOWED_SPECIES.has(payload.species)) {
    return { ok: false, error: 'invalid species' };
  }

  if (event._id) {
    const existing = await pets.doc(event._id).get().catch(() => null);
    if (!existing || !existing.data) {
      return { ok: false, error: 'pet not found' };
    }
    if (existing.data.ownerOpenid !== OPENID) {
      return { ok: false, error: 'not owner' };
    }
    await pets.doc(event._id).update({ data: payload });
    return { ok: true, _id: event._id };
  }

  const now = Date.now();
  const newPet = { ...payload, ownerOpenid: OPENID, createdAt: now };
  const insert = await pets.add({ data: newPet });
  return { ok: true, _id: insert._id };
};
