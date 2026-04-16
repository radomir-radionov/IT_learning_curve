drop policy if exists "room_members_can_read_room_messages" on realtime.messages;
drop policy if exists "room_members_can_write_room_messages" on realtime.messages;

alter table realtime.messages no force row level security;
alter table realtime.messages disable row level security;

