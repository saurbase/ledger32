-- ============================================================================
-- Ledger — Supabase schema for double-entry bookkeeping
-- Run this in your Supabase project's SQL editor:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
-- ============================================================================

create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  type        text not null check (type in ('asset','liability','equity','revenue','expense')),
  subtype     text,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Upgrade path for databases created before account descriptions existed.
alter table public.accounts add column if not exists description text;

create table if not exists public.journal_entries (
  id                 uuid primary key default gen_random_uuid(),
  date               date not null,
  description        text not null,
  reference          text,
  is_reversal        boolean not null default false,
  reversed_entry_id  uuid references public.journal_entries(id) on delete set null,
  created_at         timestamptz not null default now()
);

create table if not exists public.journal_lines (
  id                uuid primary key default gen_random_uuid(),
  journal_entry_id  uuid not null references public.journal_entries(id) on delete cascade,
  account_id        uuid not null references public.accounts(id) on delete restrict,
  debit             numeric(18,2) not null default 0,
  credit            numeric(18,2) not null default 0,
  description       text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_journal_lines_entry on public.journal_lines(journal_entry_id);
create index if not exists idx_journal_lines_account on public.journal_lines(account_id);
create index if not exists idx_journal_entries_date on public.journal_entries(date);
create index if not exists idx_journal_entries_reversal on public.journal_entries(reversed_entry_id);

-- Ensure a line has a non-zero debit XOR credit (both zero or both non-zero rejected).
create or replace function public.check_line_amounts()
returns trigger as $$
begin
  if (coalesce(new.debit,0) < 0) or (coalesce(new.credit,0) < 0) then
    raise exception 'Debit and credit must be non-negative';
  end if;
  if (coalesce(new.debit,0) = 0 and coalesce(new.credit,0) = 0)
     or (coalesce(new.debit,0) > 0 and coalesce(new.credit,0) > 0) then
    raise exception 'A journal line must have a non-zero debit or credit (not both)';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_journal_lines_amounts on public.journal_lines;
create trigger trg_journal_lines_amounts
before insert or update on public.journal_lines
for each row execute function public.check_line_amounts();

-- Optional: keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_accounts_touch on public.accounts;
create trigger trg_accounts_touch
before update on public.accounts
for each row execute function public.touch_updated_at();
