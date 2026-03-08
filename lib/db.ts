/**
 * lib/db.ts
 * Local SQLite backend using better-sqlite3.
 * The database file is created at ./physioai.db next to your project root.
 * No configuration needed — just run `npm run dev`.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'physioai.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');   // faster concurrent reads
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  return _db;
}

// ─── Schema + seed ────────────────────────────────────────────────────────────

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      parent_id   TEXT REFERENCES categories(id),
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL UNIQUE,
      full_name   TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('therapist','patient')),
      password    TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS therapists (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      license_number TEXT,
      specialization TEXT,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS patients (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      therapist_id TEXT REFERENCES therapists(id),
      injury_notes TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      category_id      TEXT REFERENCES categories(id),
      description      TEXT,
      body_part        TEXT,
      injury_category  TEXT,
      focus_joints     TEXT DEFAULT '[]',
      steps            TEXT DEFAULT '[]',
      video_url        TEXT DEFAULT '',
      motion_data_url  TEXT DEFAULT '',
      thumbnail_url    TEXT,
      created_by       TEXT REFERENCES users(id),
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS patient_assignments (
      id            TEXT PRIMARY KEY,
      patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      exercise_id   TEXT NOT NULL REFERENCES exercises(id),
      sets_per_day  INTEGER NOT NULL DEFAULT 3,
      reps_per_set  INTEGER NOT NULL DEFAULT 10,
      duration_days INTEGER NOT NULL DEFAULT 14,
      start_date    TEXT NOT NULL,
      end_date      TEXT,
      is_active     INTEGER DEFAULT 1,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercise_sessions (
      id               TEXT PRIMARY KEY,
      patient_id       TEXT NOT NULL REFERENCES patients(id),
      assignment_id    TEXT REFERENCES patient_assignments(id),
      exercise_id      TEXT NOT NULL REFERENCES exercises(id),
      timestamp        TEXT DEFAULT (datetime('now')),
      duration_seconds INTEGER DEFAULT 0,
      reps_completed   INTEGER DEFAULT 0,
      sets_completed   INTEGER DEFAULT 0,
      accuracy_score   REAL DEFAULT 0,
      avg_rom          REAL DEFAULT 0,
      max_rom          REAL DEFAULT 0,
      joint_errors     TEXT DEFAULT '{}'
    );
  `);

  seed(db);
}

function seed(db: Database.Database) {
  // Only seed if empty
  const count = (db.prepare('SELECT COUNT(*) as n FROM categories').get() as any).n;
  if (count > 0) return;

  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (id, name, parent_id) VALUES (?, ?, ?)');
  const cats = [
    ['cat-body',     'Body',             null],
    ['cat-arm',      'Arm',              'cat-body'],
    ['cat-leg',      'Leg',              'cat-body'],
    ['cat-back',     'Back',             'cat-body'],
    ['cat-elbow',    'Elbow Injury',     'cat-arm'],
    ['cat-shoulder', 'Shoulder Injury',  'cat-arm'],
    ['cat-knee',     'Knee Injury',      'cat-leg'],
    ['cat-lbp',      'Lower Back Pain',  'cat-back'],
  ];
  for (const [id, name, parent_id] of cats) insertCat.run(id, name, parent_id);

  // Seed demo exercises
  const insertEx = db.prepare(`
    INSERT OR IGNORE INTO exercises (id, name, category_id, description, body_part, injury_category, focus_joints, steps, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `);

  insertEx.run(
    'ex-wrist', 'Wrist Rotation Rehab', 'cat-elbow',
    'Controlled wrist rotation to restore mobility after elbow injury.',
    'Arm', 'Elbow Injury',
    JSON.stringify(['right_wrist', 'right_elbow']),
    JSON.stringify([
      { id: 1, label: 'Start Position',       start_frame: 0,  end_frame: 25  },
      { id: 2, label: 'Rotate Wrist Outward', start_frame: 26, end_frame: 80  },
      { id: 3, label: 'Return to Neutral',    start_frame: 81, end_frame: 120 },
    ])
  );

  insertEx.run(
    'ex-elbow', 'Elbow Extension', 'cat-elbow',
    'Full range elbow extension for post-surgery recovery.',
    'Arm', 'Elbow Injury',
    JSON.stringify(['right_elbow', 'right_shoulder']),
    JSON.stringify([
      { id: 1, label: 'Bent Position', start_frame: 0,  end_frame: 30  },
      { id: 2, label: 'Extend Elbow', start_frame: 31, end_frame: 90  },
      { id: 3, label: 'Hold & Return',start_frame: 91, end_frame: 130 },
    ])
  );

  insertEx.run(
    'ex-quad', 'Quad Strengthening', 'cat-knee',
    'Seated quad extension for knee rehabilitation.',
    'Leg', 'Knee Injury',
    JSON.stringify(['right_knee', 'right_hip']),
    JSON.stringify([
      { id: 1, label: 'Seated Neutral', start_frame: 0,  end_frame: 25  },
      { id: 2, label: 'Extend Leg',    start_frame: 26, end_frame: 80  },
      { id: 3, label: 'Lower Slowly',  start_frame: 81, end_frame: 120 },
    ])
  );

  // Demo therapist + patient users
  const insertUser = db.prepare(`INSERT OR IGNORE INTO users (id, email, full_name, role, password) VALUES (?, ?, ?, ?, ?)`);
  insertUser.run('user-therapist-1', 'therapist@physioai.dev', 'Dr. Alex Rivera', 'therapist', 'demo');
  insertUser.run('user-patient-1',   'patient@physioai.dev',   'Sarah Chen',      'patient',   'demo');

  db.prepare(`INSERT OR IGNORE INTO therapists (id, user_id) VALUES (?, ?)`).run('t-1', 'user-therapist-1');
  db.prepare(`INSERT OR IGNORE INTO patients (id, user_id, therapist_id, injury_notes) VALUES (?, ?, ?, ?)`).run('p-1', 'user-patient-1', 't-1', 'Elbow Injury');

  // Demo assignment
  const now = new Date();
  const end = new Date(now.getTime() + 14 * 86400000);
  db.prepare(`INSERT OR IGNORE INTO patient_assignments (id, patient_id, exercise_id, sets_per_day, reps_per_set, duration_days, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('assign-1', 'p-1', 'ex-wrist', 3, 10, 14, now.toISOString(), end.toISOString());
}

// ─── Helper to parse JSON columns back to objects ─────────────────────────────

export function parseJsonCols<T extends Record<string, any>>(
  row: T,
  cols: string[]
): T {
  const out: Record<string, unknown> = { ...row };
  for (const col of cols) {
    if (typeof out[col] === 'string') {
      try { out[col] = JSON.parse(out[col]); } catch { /* leave as-is */ }
    }
  }
  return out as T;
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
