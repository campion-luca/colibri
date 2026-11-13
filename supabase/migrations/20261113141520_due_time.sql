-- Orario facoltativo della scadenza (promemoria; il malus resta a mezzanotte).
alter table public.items
  add column due_time time,
  add constraint items_due_time_needs_due check (due_time is null or due is not null);
