-- Execute no SQL Editor do Supabase.
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cpf text not null unique,
  email text not null unique,
  phone text not null,
  password_hash text not null,
  approved boolean not null default false,
  active boolean not null default true,
  device_id text,
  device_bound_at timestamptz,
  last_login_at timestamptz,
  last_login_ip text,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  device_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists sessions_expires_idx on public.sessions(expires_at);

-- O acesso ao banco é feito exclusivamente pelas Serverless Functions usando a service role.
-- Não exponha SUPABASE_SERVICE_ROLE_KEY no HTML nem no navegador.
