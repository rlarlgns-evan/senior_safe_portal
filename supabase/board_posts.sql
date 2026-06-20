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

-- view_count 열만 UPDATE 허용 (RPC 없이 PostgREST update 사용)
revoke update on public.board_posts from anon, authenticated;
grant update (view_count) on public.board_posts to anon, authenticated;

drop policy if exists "board_posts_update_view_count" on public.board_posts;
create policy "board_posts_update_view_count"
  on public.board_posts for update
  using (true)
  with check (true);

-- 작성자가 아닌 경우 view_count +1 만 허용
create or replace function public.board_posts_update_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is distinct from old.user_id then
    if new.title is distinct from old.title
       or new.content is distinct from old.content
       or new.author_name is distinct from old.author_name
       or coalesce(new.author_id, '') is distinct from coalesce(old.author_id, '')
       or new.user_id is distinct from old.user_id
       or new.created_at is distinct from old.created_at
       or new.view_count is distinct from old.view_count + 1
    then
      raise exception 'not authorized';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists board_posts_update_guard on public.board_posts;
create trigger board_posts_update_guard
  before update on public.board_posts
  for each row
  execute function public.board_posts_update_guard();

-- 예전 SECURITY DEFINER RPC 제거 (Security Advisor 경고 해소)
drop function if exists public.increment_post_view(uuid);
