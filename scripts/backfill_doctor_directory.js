#!/usr/bin/env node
import fs from 'fs/promises';
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let temporaryCredentialPathForCleanup = null;

function parseArgs() {
  const args = {};
  const raw = process.argv.slice(2);
  for (let index = 0; index < raw.length; index++) {
    const value = raw[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = raw[index + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      index++;
    }
  }
  return args;
}

function normalizeCrm(crm) {
  return String(crm ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function timestamp(value) {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

async function initializeAdmin(keyPath, projectId, useFirebaseCli) {
  if (keyPath) {
    const serviceAccount = JSON.parse(await fs.readFile(keyPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount),
      projectId: projectId || serviceAccount.project_id
    });
    return null;
  }
  if (useFirebaseCli) {
    const globalModules = process.env.APPDATA
      ? path.join(process.env.APPDATA, 'npm', 'node_modules')
      : execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    const require = createRequire(import.meta.url);
    const firebaseAuth = require(path.join(globalModules, 'firebase-tools', 'lib', 'auth.js'));
    const firebaseApi = require(path.join(globalModules, 'firebase-tools', 'lib', 'api.js'));
    const account = firebaseAuth.getGlobalDefaultAccount();
    if (!account?.tokens?.refresh_token) throw new Error('Execute `firebase login` antes da migração.');
    const temporaryCredentialPath = path.join(os.tmpdir(), `medvisit-firebase-${randomUUID()}.json`);
    temporaryCredentialPathForCleanup = temporaryCredentialPath;
    await fs.writeFile(temporaryCredentialPath, JSON.stringify({
        type: 'authorized_user',
        client_id: firebaseApi.clientId(),
        client_secret: firebaseApi.clientSecret(),
        refresh_token: account.tokens.refresh_token
    }), { mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = temporaryCredentialPath;
    initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {})
    });
    return temporaryCredentialPath;
  }
  initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {})
  });
  return null;
}

async function main() {
  const args = parseArgs();
  const keyPath = args.key || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = args.project || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  const dryRun = Boolean(args.dry);

  const temporaryCredentialPath = await initializeAdmin(keyPath, projectId, Boolean(args['firebase-cli']));
  const db = getFirestore();
  const snapshot = await db.collectionGroup('doctors').get();
  const doctors = snapshot.docs
    .map(document => ({ document, data: document.data() }))
    .sort((left, right) => timestamp(left.data.createdAt) - timestamp(right.data.createdAt));

  const existingSnapshot = await db.collection('doctor_directory').get();
  const occupiedCrms = new Set(existingSnapshot.docs.map(document => document.id));
  const pending = [];
  const contributions = [];
  const stats = { scanned: doctors.length, created: 0, contributions: 0, existing: 0, duplicate: 0, invalid: 0 };

  for (const { document, data } of doctors) {
    const crmId = normalizeCrm(data.crm);
    const pathParts = document.ref.path.split('/');
    const ownerId = pathParts[0] === 'users' ? pathParts[1] : '';
    if (!crmId || !ownerId || !String(data.name ?? '').trim()) {
      stats.invalid++;
      continue;
    }
    const fallbackAddressId = `legacy-${document.id}`;
    const addresses = Array.isArray(data.addresses) && data.addresses.length > 0
      ? data.addresses
      : [{
          id: fallbackAddressId,
          label: 'Principal',
          isPrimary: true,
          address: data.address ?? {},
          coordinates: data.coordinates ?? null
        }];
    const primaryAddressId = addresses.find(address => address.isPrimary)?.id ?? addresses[0].id;
    const workingHours = (Array.isArray(data.workingHours) ? data.workingHours : []).map(hour => ({
      ...hour,
      addressId: hour.addressId ?? primaryAddressId
    }));
    contributions.push({
      ref: db.collection('doctor_directory').doc(crmId).collection('contributors').doc(ownerId),
      data: {
        userId: ownerId,
        sourceDoctorId: document.id,
        addresses,
        workingHours,
        updatedAt: new Date().toISOString()
      }
    });
    if (occupiedCrms.has(crmId)) {
      if (existingSnapshot.docs.some(existing => existing.id === crmId)) stats.existing++;
      else stats.duplicate++;
      continue;
    }

    occupiedCrms.add(crmId);
    const address = data.address ?? {};
    pending.push({
      ref: db.collection('doctor_directory').doc(crmId),
      data: {
        name: String(data.name).trim(),
        crm: String(data.crm).trim().toUpperCase(),
        specialty: String(data.specialty ?? '').trim() || null,
        city: String(address.city ?? '').trim(),
        state: String(address.state ?? '').trim().toUpperCase(),
        addresses,
        workingHours,
        ownerId,
        sourceDoctorId: document.id,
        updatedAt: new Date().toISOString()
      }
    });
  }

  stats.created = pending.length;
  stats.contributions = contributions.length;
  if (!dryRun) {
    const writer = db.bulkWriter();
    for (const entry of pending) writer.create(entry.ref, entry.data);
    for (const entry of contributions) writer.set(entry.ref, entry.data);
    await writer.close();
  }

  console.log(JSON.stringify({ dryRun, ...stats }, null, 2));
  if (temporaryCredentialPath) await fs.unlink(temporaryCredentialPath).catch(() => undefined);
  temporaryCredentialPathForCleanup = null;
}

main().catch(async error => {
  if (temporaryCredentialPathForCleanup) {
    await fs.unlink(temporaryCredentialPathForCleanup).catch(() => undefined);
  }
  console.error('Falha na migração do Diretório MedVisit:', error);
  process.exitCode = 1;
});
