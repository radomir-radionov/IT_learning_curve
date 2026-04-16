create policy "Room members can read presence and broadcasts"
on realtime.messages
for select
to authenticated
using (
  topic like 'room:%:messages'
  and exists (
    select 1
    from public.chat_room_member m
    where m.member_id = (select auth.uid())
      and m.chat_room_id::text = split_part(topic, ':', 2)
  )
);

create policy "Room members can publish presence"
on realtime.messages
for insert
to authenticated
with check (
  topic like 'room:%:messages'
  and exists (
    select 1
    from public.chat_room_member m
    where m.member_id = (select auth.uid())
      and m.chat_room_id::text = split_part(topic, ':', 2)
  )
);

