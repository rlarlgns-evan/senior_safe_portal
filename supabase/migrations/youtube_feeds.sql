-- 유튜브 추천 영상 캐시 (일 1~2회 refresh-youtube-feeds 로 갱신)
-- Supabase SQL Editor에서 실행

create table if not exists public.youtube_feeds (
  category_id text primary key,
  label text not null,
  videos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists youtube_feeds_updated_at_idx
  on public.youtube_feeds (updated_at desc);

alter table public.youtube_feeds enable row level security;

drop policy if exists "youtube_feeds_select_all" on public.youtube_feeds;
create policy "youtube_feeds_select_all"
  on public.youtube_feeds for select
  using (true);

-- insert/update/delete: service role(Edge Function)만 가능, anon/authenticated 차단
