do $$
declare
  r record;
begin
  for r in (
    select policyname
    from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
  ) loop
    execute format('drop policy if exists %I on realtime.messages', r.policyname);
  end loop;
end $$;

alter table realtime.messages no force row level security;
alter table realtime.messages disable row level security;

