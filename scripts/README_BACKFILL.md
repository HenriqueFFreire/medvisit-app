Backfill script: populate doctor `category`

This script populates a default category (`B`) for doctors that do not have the `category` field in Firestore.

Prerequisites
- A Firebase service account JSON key with access to Firestore, or Application Default Credentials configured.
- Node 18+ installed.

Install:

```bash
npm install firebase-admin
```

Usage examples

# Dry run (no writes) using explicit key file
```bash
node scripts/populate_doctor_category.js --key /path/to/serviceAccountKey.json --dry
```

# Real run for all users (uses GOOGLE_APPLICATION_CREDENTIALS env var)
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
node scripts/populate_doctor_category.js
```

# Run for a single user id
```bash
node scripts/populate_doctor_category.js --key /path/to/serviceAccountKey.json --user USER_ID
```

Windows notes

Use PowerShell to set the environment variable for the session:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\serviceAccountKey.json'
node scripts/populate_doctor_category.js
```

Safety
- The script batches updates and is idempotent for doctors that already have `category` set.
