-- =========================================================
-- Colibrì · schema iniziale
-- Tabelle, Row Level Security, profilo al primo accesso,
-- RPC apply_xp (idempotente) e commit_rollover (con lucchetto).
-- =========================================================

-- ---------- profili ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  xp int not null default 0 check (xp >= 0),
  last_date date,
  timezone text not null default 'Europe/Rome',
  notif jsonb not null default '{"start":true,"due":true,"evening":true,"eveningAt":"21:30","morning":true}',
  created_at timestamptz not null default now()
);

-- ---------- elementi (ricorrenti, task, da comprare, in sospeso) ----------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('daily', 'todo', 'buy', 'hold')),
  title text not null check (char_length(title) between 1 and 500),
  note text check (note is null or char_length(note) <= 5000),
  effort smallint not null default 1 check (effort between 1 and 4),
  position double precision not null default 0,
  created_on date not null,
  -- ricorrenti
  recur jsonb not null default '{"type":"daily"}',
  times smallint not null default 1 check (times between 1 and 3),
  window_from time,
  window_to time,
  done_on date,
  done_count smallint not null default 0 check (done_count between 0 and 3),
  penalized_on date,
  -- non ricorrenti
  done boolean not null default false,
  gain int,
  promise_date date,
  due date,
  due_penalized date,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((window_from is null) = (window_to is null))
);
create index items_user_live_idx on public.items (user_id) where deleted_at is null;

-- ---------- idee ----------
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null check (char_length(text) between 1 and 5000),
  position double precision not null default 0,
  created_on date not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index ideas_user_live_idx on public.ideas (user_id) where deleted_at is null;

-- ---------- storico eventi (id generato dal client: ripetere una scrittura è sicuro) ----------
create table public.events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ts timestamptz not null default now(),
  day date not null,
  type text not null check (type in (
    'created', 'edited', 'done', 'rep', 'undone', 'deleted', 'restored',
    'promised', 'unpromised', 'penalty', 'pause', 'resume'
  )),
  item_id uuid,
  title text,
  kind text,
  xp int not null default 0,
  meta jsonb
);
create index events_user_day_idx on public.events (user_id, day);

-- ---------- riepilogo per giorno ----------
create table public.day_history (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  gained int not null default 0,
  lost int not null default 0,
  net int not null default 0,
  reps int not null default 0,
  reps_done int not null default 0,
  prom int not null default 0,
  prom_kept int not null default 0,
  done int not null default 0,
  undone int not null default 0,
  deleted int not null default 0,
  created int not null default 0,
  paused boolean not null default false,
  primary key (user_id, day)
);

-- ---------- pause ----------
create table public.pauses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  from_day date not null,
  until_day date,
  reason text not null check (reason in ('Ferie', 'Malattia', 'Altro')),
  check (until_day is null or until_day >= from_day)
);

-- ---------- notifiche push (usate in F6) ----------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.notif_sent (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  key text not null,
  primary key (user_id, day, key)
);

-- =========================================================
-- updated_at automatico
-- =========================================================
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();
create trigger ideas_touch before update on public.ideas
  for each row execute function public.touch_updated_at();

-- =========================================================
-- Profilo creato al primo accesso
-- =========================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- Row Level Security: ogni utente vede e tocca solo i suoi dati
-- =========================================================
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.ideas enable row level security;
alter table public.events enable row level security;
alter table public.day_history enable row level security;
alter table public.pauses enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notif_sent enable row level security;

create policy "profiles: il proprio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: modifica il proprio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "items: i propri" on public.items
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "ideas: le proprie" on public.ideas
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "pauses: le proprie" on public.pauses
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "push_subscriptions: le proprie" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- eventi e riepiloghi: solo lettura per l'utente, si scrivono dalle RPC
create policy "events: lettura dei propri" on public.events
  for select to authenticated using (user_id = (select auth.uid()));
create policy "day_history: lettura dei propri" on public.day_history
  for select to authenticated using (user_id = (select auth.uid()));

-- notif_sent: nessuna policy, la scrive solo la service role (Edge Function)

-- ---------- permessi espliciti (non ci si affida ai default) ----------
revoke all on public.profiles, public.items, public.ideas, public.events, public.day_history,
  public.pauses, public.push_subscriptions, public.notif_sent from anon, authenticated;

grant select, insert, update, delete on public.items, public.ideas, public.pauses,
  public.push_subscriptions to authenticated;
grant select on public.events, public.day_history, public.profiles to authenticated;
-- xp e last_date cambiano solo da apply_xp / commit_rollover
grant update (notif, timezone) on public.profiles to authenticated;

-- =========================================================
-- apply_xp: inserisce gli eventi e aggiorna gli XP (minimo 0) in una transazione.
-- Un evento con un id già visto non fa niente: ripetere la chiamata è sicuro.
-- =========================================================
create function public.apply_xp(evs jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ev jsonb;
  cur_xp int;
  inserted uuid;
begin
  if uid is null then
    raise exception 'non autenticato' using errcode = '42501';
  end if;

  -- blocca il profilo: le chiamate dello stesso utente si mettono in fila
  select xp into cur_xp from public.profiles where id = uid for update;
  if not found then
    raise exception 'profilo mancante' using errcode = 'P0002';
  end if;

  for ev in select value from jsonb_array_elements(coalesce(evs, '[]'::jsonb)) loop
    inserted := null;
    insert into public.events (id, user_id, ts, day, type, item_id, title, kind, xp, meta)
    values (
      (ev ->> 'id')::uuid,
      uid,
      coalesce((ev ->> 'ts')::timestamptz, now()),
      (ev ->> 'day')::date,
      ev ->> 'type',
      (ev ->> 'item_id')::uuid,
      ev ->> 'title',
      ev ->> 'kind',
      coalesce((ev ->> 'xp')::int, 0),
      ev -> 'meta'
    )
    on conflict (id) do nothing
    returning id into inserted;

    if inserted is not null then
      cur_xp := greatest(0, cur_xp + coalesce((ev ->> 'xp')::int, 0));
    end if;
  end loop;

  update public.profiles set xp = cur_xp where id = uid;
  return cur_xp;
end;
$$;

-- =========================================================
-- commit_rollover: la mezzanotte, calcolata dal client e applicata qui in una
-- transazione. Lucchetto: si applica solo se last_date è ancora quella da cui il
-- client ha calcolato, è prima di p_today e p_today non è nel futuro (ora locale
-- del profilo). Altrimenti non scrive niente e restituisce lo stato attuale.
-- =========================================================
create function public.commit_rollover(
  p_from date,
  p_today date,
  p_events jsonb,
  p_items jsonb,
  p_history jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles%rowtype;
  ev jsonb;
  it jsonb;
  h jsonb;
  cur_xp int;
  inserted uuid;
begin
  if uid is null then
    raise exception 'non autenticato' using errcode = '42501';
  end if;

  select * into prof from public.profiles where id = uid for update;
  if not found then
    raise exception 'profilo mancante' using errcode = 'P0002';
  end if;

  if p_today > (now() at time zone prof.timezone)::date
     or prof.last_date is distinct from p_from
     or (prof.last_date is not null and prof.last_date >= p_today) then
    return jsonb_build_object('applied', false, 'xp', prof.xp, 'last_date', prof.last_date);
  end if;

  cur_xp := prof.xp;

  -- penalità (id deterministici: doppia protezione contro i doppioni)
  for ev in select value from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    inserted := null;
    insert into public.events (id, user_id, ts, day, type, item_id, title, kind, xp, meta)
    values (
      (ev ->> 'id')::uuid,
      uid,
      coalesce((ev ->> 'ts')::timestamptz, now()),
      (ev ->> 'day')::date,
      ev ->> 'type',
      (ev ->> 'item_id')::uuid,
      ev ->> 'title',
      ev ->> 'kind',
      coalesce((ev ->> 'xp')::int, 0),
      ev -> 'meta'
    )
    on conflict (id) do nothing
    returning id into inserted;

    if inserted is not null then
      cur_xp := greatest(0, cur_xp + coalesce((ev ->> 'xp')::int, 0));
    end if;
  end loop;

  -- promesse tolte e scadenze segnate
  for it in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    update public.items
       set promise_date = (it ->> 'promise_date')::date,
           due_penalized = (it ->> 'due_penalized')::date
     where id = (it ->> 'id')::uuid
       and user_id = uid;
  end loop;

  -- riepiloghi dei giorni
  for h in select value from jsonb_array_elements(coalesce(p_history, '[]'::jsonb)) loop
    insert into public.day_history (
      user_id, day, gained, lost, net, reps, reps_done, prom, prom_kept,
      done, undone, deleted, created, paused
    )
    values (
      uid,
      (h ->> 'day')::date,
      coalesce((h ->> 'gained')::int, 0),
      coalesce((h ->> 'lost')::int, 0),
      coalesce((h ->> 'net')::int, 0),
      coalesce((h ->> 'reps')::int, 0),
      coalesce((h ->> 'reps_done')::int, 0),
      coalesce((h ->> 'prom')::int, 0),
      coalesce((h ->> 'prom_kept')::int, 0),
      coalesce((h ->> 'done')::int, 0),
      coalesce((h ->> 'undone')::int, 0),
      coalesce((h ->> 'deleted')::int, 0),
      coalesce((h ->> 'created')::int, 0),
      coalesce((h ->> 'paused')::boolean, false)
    )
    on conflict (user_id, day) do update set
      gained = excluded.gained,
      lost = excluded.lost,
      net = excluded.net,
      reps = excluded.reps,
      reps_done = excluded.reps_done,
      prom = excluded.prom,
      prom_kept = excluded.prom_kept,
      done = excluded.done,
      undone = excluded.undone,
      deleted = excluded.deleted,
      created = excluded.created,
      paused = excluded.paused;
  end loop;

  update public.profiles set xp = cur_xp, last_date = p_today where id = uid;
  return jsonb_build_object('applied', true, 'xp', cur_xp, 'last_date', p_today);
end;
$$;

-- le funzioni si chiamano solo da utenti autenticati
revoke execute on function public.apply_xp(jsonb) from public, anon;
revoke execute on function public.commit_rollover(date, date, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.apply_xp(jsonb) to authenticated;
grant execute on function public.commit_rollover(date, date, jsonb, jsonb, jsonb) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
