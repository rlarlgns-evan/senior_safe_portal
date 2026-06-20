-- Supabase SQL Editor에서 한 번 실행하세요.
-- 게시판: 로그인한 회원이 글 작성·공유, 전원 열람

create table if not exists public.board_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  author_id text,
  title text not null check (char_length(title) between 1 and 100),
  content text not null check (char_length(content) between 1 and 2000),
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.board_posts add column if not exists author_id text;
alter table public.board_posts add column if not exists view_count integer not null default 0;

create index if not exists board_posts_created_at_idx
  on public.board_posts (created_at desc);

alter table public.board_posts enable row level security;

drop policy if exists "board_posts_select_all" on public.board_posts;
create policy "board_posts_select_all"
  on public.board_posts for select
  using (true);

drop policy if exists "board_posts_insert_own" on public.board_posts;
create policy "board_posts_insert_own"
  on public.board_posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "board_posts_delete_own" on public.board_posts;
create policy "board_posts_delete_own"
  on public.board_posts for delete
  using (auth.uid() = user_id);

-- 조회수 증가 (글 열람 시)
create or replace function public.increment_post_view(post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.board_posts
  set view_count = view_count + 1
  where id = post_id;
end;
$$;

grant execute on function public.increment_post_view(uuid) to anon, authenticated;
