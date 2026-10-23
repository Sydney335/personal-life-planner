-- Apply in Supabase SQL Editor, or with `supabase db push`.
begin;
create table public.planner_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  kind text not null check (kind in ('task','note','habit','settings')),
  day date not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 1048576),
  deleted boolean not null default false,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now(),
  last_mutation uuid not null,
  primary key (user_id,id)
);
create index planner_records_day_idx on public.planner_records(user_id,day);
create table public.planner_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  revision integer not null,
  kind text not null,
  day date not null,
  payload jsonb not null,
  deleted boolean not null,
  updated_at timestamptz not null,
  primary key (user_id,id,revision)
);
alter table public.planner_records enable row level security;
alter table public.planner_history enable row level security;
create policy own_records on public.planner_records for select to authenticated using ((select auth.uid()) = user_id);
create policy own_history on public.planner_history for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.planner_records, public.planner_history from public, anon, authenticated;
grant select on public.planner_records, public.planner_history to authenticated;

-- Atomic compare-and-set. All writes go through this function; callers cannot
-- supply user_id, bypass RLS with a direct write, or blindly replace a revision.
create function public.save_planner_record(
 p_user_id uuid, p_id uuid, p_kind text, p_day date, p_payload jsonb, p_deleted boolean,
 p_expected_revision integer, p_mutation uuid
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
 actor uuid := auth.uid();
 current_row public.planner_records;
 result_row public.planner_records;
begin
 if actor is null or actor is distinct from p_user_id then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_id is null or p_mutation is null or p_day is null or p_kind is null or p_payload is null or p_deleted is null or p_expected_revision is null or p_expected_revision < 0 then
   raise exception 'Invalid record';
 end if;
 -- Serialize creation as well as updates for this account and record.
 perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || p_id::text,0));
 select * into current_row from public.planner_records where user_id=actor and id=p_id for update;
 if found then
   if current_row.last_mutation = p_mutation then
     return jsonb_build_object('accepted',true,'record',to_jsonb(current_row));
   end if;
   if current_row.revision <> p_expected_revision then
     return jsonb_build_object('accepted',false,'record',to_jsonb(current_row));
   end if;
   if current_row.kind <> p_kind then raise exception 'Record kind is immutable'; end if;
   update public.planner_records set day=p_day,payload=p_payload,deleted=p_deleted,
     revision=current_row.revision+1,updated_at=clock_timestamp(),last_mutation=p_mutation
     where user_id=actor and id=p_id returning * into result_row;
 else
   if p_expected_revision <> 0 then raise exception 'Missing base record'; end if;
   insert into public.planner_records(user_id,id,kind,day,payload,deleted,revision,last_mutation)
     values(actor,p_id,p_kind,p_day,p_payload,p_deleted,1,p_mutation) returning * into result_row;
 end if;
 insert into public.planner_history(user_id,id,revision,kind,day,payload,deleted,updated_at)
   values(actor,p_id,result_row.revision,result_row.kind,result_row.day,result_row.payload,result_row.deleted,result_row.updated_at);
 return jsonb_build_object('accepted',true,'record',to_jsonb(result_row));
end;
$$;
revoke all on function public.save_planner_record(uuid,uuid,text,date,jsonb,boolean,integer,uuid) from public,anon;
grant execute on function public.save_planner_record(uuid,uuid,text,date,jsonb,boolean,integer,uuid) to authenticated;
-- Realtime is an optimization. Polling + focus/reconnect sync remain available.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.planner_records;
 end if;
end $$;
commit;
