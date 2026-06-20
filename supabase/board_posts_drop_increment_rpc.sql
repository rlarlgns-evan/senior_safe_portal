-- Security Advisor: increment_post_view SECURITY DEFINER 경고 해소
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행하세요.

-- 1) 예전 RPC 함수 삭제 (CREATE OR REPLACE로는 security 속성 변경 불가)
drop function if exists public.increment_post_view(uuid);

-- 2) view_count 열만 UPDATE 허용
revoke update on public.board_posts from anon, authenticated;
grant update (view_count) on public.board_posts to anon, authenticated;

drop policy if exists "board_posts_update_view_count" on public.board_posts;
create policy "board_posts_update_view_count"
  on public.board_posts for update
  using (true)
  with check (true);

-- 3) 작성자가 아닌 경우 view_count +1 만 허용
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
