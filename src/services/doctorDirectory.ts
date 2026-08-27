import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DirectoryDoctor, DoctorAddressEntry, WorkingHours } from '../types';

export function normalizeDirectoryCrm(crm: string): string {
  return crm.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function findDirectoryDoctor(crm: string): Promise<DirectoryDoctor | null> {
  const id = normalizeDirectoryCrm(crm);
  if (!id) return null;

  const snapshot = await getDoc(doc(db, 'doctor_directory', id));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  const contributionsSnapshot = await getDocs(collection(db, 'doctor_directory', id, 'contributors'));
  const contributionAddresses: DoctorAddressEntry[] = [];
  const contributionHours: WorkingHours[] = [];

  contributionsSnapshot.docs.forEach(contribution => {
    const contributionData = contribution.data();
    const addressIdMap = new Map<string, string>();
    const addresses = Array.isArray(contributionData.addresses)
      ? contributionData.addresses as DoctorAddressEntry[]
      : [];
    addresses.forEach(address => {
      const sharedId = `${contribution.id}-${address.id}`;
      addressIdMap.set(address.id, sharedId);
      contributionAddresses.push({ ...address, id: sharedId, isPrimary: false });
    });
    const hours = Array.isArray(contributionData.workingHours)
      ? contributionData.workingHours as WorkingHours[]
      : [];
    hours.forEach(hour => {
      const addressId = hour.addressId ? addressIdMap.get(hour.addressId) : undefined;
      if (addressId) contributionHours.push({ ...hour, addressId });
    });
  });

  if (contributionAddresses.length > 0) contributionAddresses[0].isPrimary = true;
  const hasContributions = contributionAddresses.length > 0;
  return {
    id: snapshot.id,
    name: String(data.name ?? ''),
    crm: String(data.crm ?? crm),
    specialty: data.specialty ? String(data.specialty) : undefined,
    city: String(data.city ?? ''),
    state: String(data.state ?? ''),
    addresses: hasContributions
      ? contributionAddresses
      : Array.isArray(data.addresses) ? data.addresses as DoctorAddressEntry[] : [],
    workingHours: hasContributions
      ? contributionHours
      : Array.isArray(data.workingHours) ? data.workingHours as WorkingHours[] : [],
    updatedAt: data.updatedAt ? new Date(String(data.updatedAt)) : new Date(0)
  };
}

export async function searchDirectoryDoctors(search: string): Promise<DirectoryDoctor[]> {
  const normalized = normalizeDirectoryCrm(search);
  const digits = search.replace(/\D/g, '');
  if (digits.length < 4) return [];

  // A complete CRM can use the direct document lookup. A number-only search
  // may match the same registration number in more than one state.
  if (/[A-Z]/.test(normalized)) {
    const doctor = await findDirectoryDoctor(normalized);
    if (doctor) return [doctor];
  }

  const snapshot = await getDocs(collection(db, 'doctor_directory'));
  const letters = normalized.replace(/[^A-Z]/g, '');
  const matchingIds = snapshot.docs
    .filter(document => {
      const crm = String(document.data().crm ?? document.id).toUpperCase();
      return crm.replace(/\D/g, '').includes(digits) && (!letters || crm.includes(letters));
    })
    .map(document => document.id)
    .slice(0, 10);
  const results = await Promise.all(matchingIds.map(id => findDirectoryDoctor(id)));
  return results.filter((doctor): doctor is DirectoryDoctor => doctor != null);
}

interface PublishDirectoryDoctorInput {
  userId: string;
  sourceDoctorId: string;
  name: string;
  crm: string;
  specialty?: string;
  city: string;
  state: string;
  addresses: object[];
  workingHours: object[];
}

export async function publishDirectoryDoctor(data: PublishDirectoryDoctorInput): Promise<void> {
  const id = normalizeDirectoryCrm(data.crm);
  if (!id) return;
  const ref = doc(db, 'doctor_directory', id);
  const existing = await getDoc(ref);

  // Remove optional `undefined` values because Firestore rejects them inside arrays/maps.
  const addresses = JSON.parse(JSON.stringify(data.addresses)) as object[];
  const workingHours = JSON.parse(JSON.stringify(data.workingHours)) as object[];

  if (!existing.exists() || existing.data().ownerId === data.userId) {
    await setDoc(ref, {
      name: data.name.trim(),
      crm: data.crm.trim().toUpperCase(),
      specialty: data.specialty?.trim() || null,
      city: data.city.trim(),
      state: data.state.trim().toUpperCase(),
      addresses,
      workingHours,
      ownerId: data.userId,
      sourceDoctorId: data.sourceDoctorId,
      updatedAt: new Date().toISOString()
    });
  }

  await setDoc(doc(db, 'doctor_directory', id, 'contributors', data.userId), {
    userId: data.userId,
    sourceDoctorId: data.sourceDoctorId,
    addresses,
    workingHours,
    updatedAt: new Date().toISOString()
  });
}

export async function unpublishDirectoryDoctor(userId: string, crm: string): Promise<void> {
  const id = normalizeDirectoryCrm(crm);
  if (!id) return;
  await deleteDoc(doc(db, 'doctor_directory', id, 'contributors', userId));
}
