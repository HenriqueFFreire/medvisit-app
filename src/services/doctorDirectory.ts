import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DirectoryDoctor } from '../types';

export function normalizeDirectoryCrm(crm: string): string {
  return crm.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function findDirectoryDoctor(crm: string): Promise<DirectoryDoctor | null> {
  const id = normalizeDirectoryCrm(crm);
  if (!id) return null;

  const snapshot = await getDoc(doc(db, 'doctor_directory', id));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: String(data.name ?? ''),
    crm: String(data.crm ?? crm),
    specialty: data.specialty ? String(data.specialty) : undefined,
    city: String(data.city ?? ''),
    state: String(data.state ?? ''),
    updatedAt: data.updatedAt ? new Date(String(data.updatedAt)) : new Date(0)
  };
}

interface PublishDirectoryDoctorInput {
  userId: string;
  sourceDoctorId: string;
  name: string;
  crm: string;
  specialty?: string;
  city: string;
  state: string;
}

export async function publishDirectoryDoctor(data: PublishDirectoryDoctorInput): Promise<void> {
  const id = normalizeDirectoryCrm(data.crm);
  if (!id) return;
  const ref = doc(db, 'doctor_directory', id);
  const existing = await getDoc(ref);

  // A ficha compartilhada pertence a quem a publicou primeiro. Outros usuários
  // podem importá-la, mas não podem sobrescrever os dados do autor.
  if (existing.exists() && existing.data().ownerId !== data.userId) return;

  await setDoc(ref, {
    name: data.name.trim(),
    crm: data.crm.trim().toUpperCase(),
    specialty: data.specialty?.trim() || null,
    city: data.city.trim(),
    state: data.state.trim().toUpperCase(),
    ownerId: data.userId,
    sourceDoctorId: data.sourceDoctorId,
    updatedAt: new Date().toISOString()
  });
}

export async function unpublishDirectoryDoctor(userId: string, crm: string): Promise<void> {
  const id = normalizeDirectoryCrm(crm);
  if (!id) return;
  const ref = doc(db, 'doctor_directory', id);
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data().ownerId === userId) {
    await deleteDoc(ref);
  }
}
