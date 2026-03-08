-- ================================================================
-- PhysioAI — Supabase PostgreSQL Schema
-- Run this in your Supabase SQL editor to set up the database
-- ================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────────
-- USERS (extends Supabase Auth)
-- ──────────────────────────────────────────────────────────────
create table public.users (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  full_name   text not null,
  role        text not null check (role in ('therapist', 'patient')),
  created_at  timestamptz default now()
);

alter table public.users enable row level security;
create policy "Users can read own row" on public.users
  for select using (auth.uid() = id);

-- ──────────────────────────────────────────────────────────────
-- THERAPISTS
-- ──────────────────────────────────────────────────────────────
create table public.therapists (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references public.users(id) on delete cascade not null unique,
  license_number   text,
  specialization   text,
  created_at       timestamptz default now()
);

alter table public.therapists enable row level security;
create policy "Therapists can read own profile" on public.therapists
  for select using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- PATIENTS
-- ──────────────────────────────────────────────────────────────
create table public.patients (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.users(id) on delete cascade not null unique,
  therapist_id    uuid references public.therapists(id),
  date_of_birth   date,
  injury_notes    text,
  created_at      timestamptz default now()
);

alter table public.patients enable row level security;
create policy "Patients: own row" on public.patients
  for select using (auth.uid() = user_id);
create policy "Therapist: see their patients" on public.patients
  for select using (
    therapist_id in (
      select id from public.therapists where user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- CATEGORIES (hierarchical — body → injury → subcategory)
-- ──────────────────────────────────────────────────────────────
create table public.categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  parent_id   uuid references public.categories(id),
  created_at  timestamptz default now()
);

-- Seed categories
insert into public.categories (id, name, parent_id) values
  ('10000000-0000-0000-0000-000000000001', 'Body', null),
  ('10000000-0000-0000-0000-000000000002', 'Arm',  '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', 'Leg',  '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'Back', '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', 'Elbow Injury',    '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000006', 'Shoulder Injury', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000007', 'Knee Injury',     '10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000008', 'Lower Back Pain', '10000000-0000-0000-0000-000000000004');

-- ──────────────────────────────────────────────────────────────
-- EXERCISES
-- ──────────────────────────────────────────────────────────────
create table public.exercises (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,
  category_id      uuid references public.categories(id),
  description      text,
  body_part        text,
  injury_category  text,
  focus_joints     text[]   default '{}',
  -- Steps stored as JSONB: [{id, label, start_frame, end_frame, description}]
  steps            jsonb    default '[]',
  video_url        text     default '',
  motion_data_url  text     default '',  -- URL to exercise_motion.json in storage
  thumbnail_url    text,
  created_by       uuid references public.users(id),
  created_at       timestamptz default now()
);

alter table public.exercises enable row level security;
create policy "Anyone authenticated can read exercises" on public.exercises
  for select to authenticated using (true);
create policy "Therapists can create exercises" on public.exercises
  for insert to authenticated
  with check (auth.uid() = created_by);

-- ──────────────────────────────────────────────────────────────
-- PATIENT ASSIGNMENTS
-- ──────────────────────────────────────────────────────────────
create table public.patient_assignments (
  id              uuid primary key default uuid_generate_v4(),
  patient_id      uuid references public.patients(id) on delete cascade not null,
  exercise_id     uuid references public.exercises(id) not null,
  sets_per_day    int  not null default 3,
  reps_per_set    int  not null default 10,
  duration_days   int  not null default 14,
  start_date      timestamptz not null default now(),
  end_date        timestamptz,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

alter table public.patient_assignments enable row level security;
create policy "Patients: see own assignments" on public.patient_assignments
  for select using (
    patient_id in (select id from public.patients where user_id = auth.uid())
  );
create policy "Therapists: manage assignments for their patients" on public.patient_assignments
  for all using (
    patient_id in (
      select p.id from public.patients p
      join public.therapists t on t.id = p.therapist_id
      where t.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- EXERCISE SESSIONS
-- ──────────────────────────────────────────────────────────────
create table public.exercise_sessions (
  id               uuid primary key default uuid_generate_v4(),
  patient_id       uuid references public.patients(id) not null,
  assignment_id    uuid references public.patient_assignments(id),
  exercise_id      uuid references public.exercises(id) not null,
  timestamp        timestamptz default now(),
  duration_seconds int default 0,
  reps_completed   int default 0,
  sets_completed   int default 0,
  accuracy_score   numeric(5,2) default 0,
  avg_rom          numeric(6,2) default 0,
  max_rom          numeric(6,2) default 0,
  -- Per-joint angle errors: {"elbow_right": 8.2, "wrist_right": 14.1, ...}
  joint_errors     jsonb default '{}'
);

alter table public.exercise_sessions enable row level security;
create policy "Patients: own sessions" on public.exercise_sessions
  for select using (
    patient_id in (select id from public.patients where user_id = auth.uid())
  );
create policy "Patients: insert own sessions" on public.exercise_sessions
  for insert with check (
    patient_id in (select id from public.patients where user_id = auth.uid())
  );
create policy "Therapists: read their patients' sessions" on public.exercise_sessions
  for select using (
    patient_id in (
      select p.id from public.patients p
      join public.therapists t on t.id = p.therapist_id
      where t.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- ANALYTICS VIEW (weekly ROM + accuracy aggregation)
-- ──────────────────────────────────────────────────────────────
create or replace view public.weekly_patient_progress as
select
  es.patient_id,
  es.exercise_id,
  date_trunc('week', es.timestamp) as week_start,
  round(avg(es.avg_rom)::numeric, 1) as avg_rom,
  round(avg(es.max_rom)::numeric, 1) as avg_max_rom,
  round(avg(es.accuracy_score)::numeric, 1) as avg_accuracy,
  count(*) as sessions_count,
  sum(es.reps_completed) as total_reps
from public.exercise_sessions es
group by es.patient_id, es.exercise_id, date_trunc('week', es.timestamp)
order by week_start;

-- ──────────────────────────────────────────────────────────────
-- STORAGE BUCKETS (run separately in Supabase dashboard)
-- ──────────────────────────────────────────────────────────────
-- Create two public buckets:
--   1. "exercise-videos"  — for uploaded exercise MP4s
--   2. "motion-data"      — for exercise_motion.json files
--
-- insert into storage.buckets (id, name, public) values
--   ('exercise-videos', 'exercise-videos', true),
--   ('motion-data', 'motion-data', true);
