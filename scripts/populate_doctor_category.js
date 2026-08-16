#!/usr/bin/env node
import fs from 'fs/promises';
import admin from 'firebase-admin';

function parseArgs() {
  const args = {};
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (v.startsWith('--')) {
      const key = v.slice(2);
      const next = raw[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const keyPath = args.key || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const userOverride = args.user || null;
  const dry = args.dry || false;

  if (keyPath) {
    const content = await fs.readFile(keyPath, 'utf8');
    const serviceAccount = JSON.parse(content);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Use default application credentials if set in environment
    admin.initializeApp();
  }

  const db = admin.firestore();

  // Collect user ids
  let userIds = [];
  if (userOverride) {
    userIds = [userOverride];
  } else {
    const usersCol = db.collection('users');
    const docs = await usersCol.listDocuments();
    userIds = docs.map(d => d.id);
  }

  let totalUpdated = 0;
  let totalScanned = 0;

  for (const uid of userIds) {
    console.log(`Processing user: ${uid}`);
    const doctorsRef = db.collection('users').doc(uid).collection('doctors');
    const snap = await doctorsRef.get();
    console.log(`  found ${snap.size} doctors`);
    totalScanned += snap.size;

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
      const data = doc.data();
      if (!Object.prototype.hasOwnProperty.call(data, 'category') || data.category === null || data.category === undefined) {
        const updateData = { category: 'B', updatedAt: new Date().toISOString() };
        if (dry) {
          console.log(`    dry: would set ${doc.id} ->`, updateData);
        } else {
          batch.update(doc.ref, updateData);
          batchCount++;
        }
        totalUpdated++;
      }
    }

    if (!dry && batchCount > 0) {
      await batch.commit();
      console.log(`  committed ${batchCount} updates for user ${uid}`);
    }
  }

  console.log(`Done. scanned=${totalScanned} updatedCandidates=${totalUpdated} (dry=${dry})`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error running backfill:', err);
  process.exit(1);
});
