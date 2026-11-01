// Idempotent schema. The app applies it once per server instance before its first query,
// and `npm run db:migrate` applies it by hand. Money is stored in whole cents.
export const SCHEMA_SQL = /* sql */ `
create table if not exists cashouts (
  id           uuid primary key,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  shift_date   date not null,          -- the restaurant's local date for the shift
  time_zone    text not null,          -- IANA zone of the device that saved it
  cash_cents   integer not null check (cash_cents >= 0),
  card_cents   integer not null check (card_cents >= 0),
  total_cents  integer not null check (total_cents = cash_cents + card_cents),
  boh_cents    integer not null check (boh_cents >= 0),
  foh_cents    integer not null check (foh_cents = total_cents - boh_cents),
  boh_share    numeric(4, 3) not null,
  total_hours  numeric(7, 2) not null
);

create index if not exists cashouts_shift_date_idx on cashouts (shift_date desc, created_at desc);

create table if not exists cashout_staff (
  cashout_id    uuid not null references cashouts (id) on delete cascade,
  position      smallint not null,
  name          text not null,
  hours         numeric(5, 2) not null check (hours > 0),
  amount_cents  integer not null check (amount_cents >= 0),
  primary key (cashout_id, position)
);

-- Failed manager-PIN attempts, for lockout after repeated wrong guesses.
create table if not exists login_attempts (
  ip            text not null,
  attempted_at  timestamptz not null default now()
);

create index if not exists login_attempts_ip_idx on login_attempts (ip, attempted_at);

-- A pay week (Mon–Sun, keyed by its Monday) that has been paid out. Its shifts are locked.
create table if not exists pay_periods (
  week_start   date primary key check (extract(isodow from week_start) = 1),
  paid_at      timestamptz not null default now(),
  total_cents  integer not null     -- what the week added up to when it was marked paid
);

-- Emails already sent, so a retried cron job never sends the same one twice.
create table if not exists email_log (
  kind     text not null,
  key      text not null,
  sent_at  timestamptz not null default now(),
  primary key (kind, key)
);
-- The FOH roster shown on the calculator. People are archived, never deleted, so history stays readable.
create table if not exists staff (
  id          serial primary key,
  name        text not null check (length(trim(name)) between 1 and 40),
  email       text,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists staff_name_key on staff (lower(trim(name)));

-- Small key/value settings, e.g. the kitchen (BOH) share.
create table if not exists settings (
  key    text primary key,
  value  jsonb not null
);

-- Every change that matters for money: saves, edits, deletes, paid/unpaid, settings, roster.
create table if not exists audit_log (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  actor   text not null,              -- 'calculator' or 'manager'
  action  text not null,
  detail  jsonb not null default '{}',
  ip      text
);
create index if not exists audit_log_at_idx on audit_log (at desc);
`;
