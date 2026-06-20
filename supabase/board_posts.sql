-- Supabase SQL Editor에서 한 번 실행하세요.
-- 게시판: 로그인한 회원이 글 작성·공유, 전원 열람

create table if not exists public.board_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  title text not null check (char_length(title) between 1 and 100),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

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
