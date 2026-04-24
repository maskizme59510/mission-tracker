alter table public.mission_reports
add column if not exists consultant_last_edited_at timestamptz;
