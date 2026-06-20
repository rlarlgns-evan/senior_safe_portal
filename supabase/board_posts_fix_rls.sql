-- Security Advisor: board_posts_update_view_count USING(true)/WITH CHECK(true) 경고 해소
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행하세요.

-- view_count 열만 UPDATE 허용 (PostgREST)
revoke update on public.board_posts from anon, authenticated;
grant update (view_count) on public.board_posts to anon, authenticated;

drop policy if exists "board_posts_update_view_count" on public.board_posts;
create policy "board_posts_update_view_count"
  on public.board_posts for update
  to anon, authenticated
  using (
    view_count >= 0
    and char_length(title) >= 1
    and char_length(content) >= 1
  )
  with check (
    view_count >= 1
    and view_count <= 2147483647
    and char_length(title) >= 1
    and char_length(content) >= 1
    and user_id is not null
  );

-- 모든 사용자(작성자 포함): view_count +1 만 허용, 나머지 컬럼 변경 불가
create or replace function public.board_posts_update_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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
  return new;
end;
$$;

drop trigger if exists board_posts_update_guard on public.board_posts;
create trigger board_posts_update_guard
  before update on public.board_posts
  for each row
  execute function public.board_posts_update_guard();

drop function if exists public.increment_post_view(uuid);
