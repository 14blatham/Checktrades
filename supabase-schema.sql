-- ============================================================
-- EastMidlandsTrade / Guild & Gable — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. PROFILES (extends Supabase Auth users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text check (role in ('homeowner', 'supplier')) default 'homeowner',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'homeowner')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. SUPPLIERS
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  company_name text not null,
  trade_type text not null check (trade_type in (
    'Surveyor', 'Architect', 'Structural Engineer', 'Energy Assessor', 'Electrician'
  )),
  years_in_business int default 0,
  primary_postcode text not null,
  postcode_coverage text[] default '{}',
  description text,
  is_verified boolean default false,
  is_active boolean default true,
  consultation_price numeric(10,2),
  survey_price numeric(10,2),
  project_price numeric(10,2),
  rating_avg numeric(3,2) default 0,
  review_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.suppliers enable row level security;

create policy "Suppliers are publicly readable"
  on public.suppliers for select using (true);

create policy "Suppliers can update their own record"
  on public.suppliers for update using (auth.uid() = user_id);

create policy "Authenticated users can register as supplier"
  on public.suppliers for insert with check (auth.uid() = user_id);


-- 3. PROJECTS (homeowner service requests — the "leads")
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  homeowner_id uuid references public.profiles(id) on delete set null,
  trade_type text not null,
  survey_type text,
  property_postcode text not null,
  property_type text,
  bedrooms int,
  contact_name text not null,
  contact_phone text,
  contact_email text not null,
  scope_notes text,
  budget_range text,
  status text check (status in ('open', 'quoted', 'in_progress', 'completed', 'cancelled')) default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.projects enable row level security;

create policy "Homeowners can view their own projects"
  on public.projects for select using (auth.uid() = homeowner_id);

create policy "Authenticated users can create projects"
  on public.projects for insert with check (auth.uid() is not null);

create policy "Suppliers can view open projects in their trade"
  on public.projects for select using (
    exists (
      select 1 from public.suppliers s
      where s.user_id = auth.uid()
        and s.trade_type = projects.trade_type
        and s.is_active = true
    )
  );


-- 4. LEADS (linking suppliers to projects they can bid on)
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  status text check (status in ('new', 'accepted', 'rejected', 'contacted')) default 'new',
  created_at timestamptz default now(),
  unique(project_id, supplier_id)
);

alter table public.leads enable row level security;

create policy "Suppliers can view their own leads"
  on public.leads for select using (
    exists (
      select 1 from public.suppliers s where s.id = leads.supplier_id and s.user_id = auth.uid()
    )
  );

create policy "Suppliers can update their own leads"
  on public.leads for update using (
    exists (
      select 1 from public.suppliers s where s.id = leads.supplier_id and s.user_id = auth.uid()
    )
  );


-- 5. QUOTES
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  price_min numeric(10,2) not null,
  price_max numeric(10,2) not null,
  message text,
  status text check (status in ('pending', 'accepted', 'rejected')) default 'pending',
  created_at timestamptz default now()
);

alter table public.quotes enable row level security;

create policy "Homeowners can view quotes on their projects"
  on public.quotes for select using (
    exists (
      select 1 from public.projects p where p.id = quotes.project_id and p.homeowner_id = auth.uid()
    )
  );

create policy "Suppliers can insert quotes"
  on public.quotes for insert with check (
    exists (
      select 1 from public.suppliers s where s.id = quotes.supplier_id and s.user_id = auth.uid()
    )
  );

create policy "Suppliers can view their own quotes"
  on public.quotes for select using (
    exists (
      select 1 from public.suppliers s where s.id = quotes.supplier_id and s.user_id = auth.uid()
    )
  );


-- 6. REVIEWS
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  overall_rating int not null check (overall_rating between 1 and 5),
  quality_rating int check (quality_rating between 1 and 5),
  communication_rating int check (communication_rating between 1 and 5),
  value_rating int check (value_rating between 1 and 5),
  narrative text,
  is_verified boolean default false,
  created_at timestamptz default now()
);

alter table public.reviews enable row level security;

create policy "Reviews are publicly readable"
  on public.reviews for select using (true);

create policy "Authenticated users can create reviews"
  on public.reviews for insert with check (auth.uid() = reviewer_id);

-- Function to auto-update supplier rating when a review is added
create or replace function public.update_supplier_rating()
returns trigger as $$
begin
  update public.suppliers
  set
    rating_avg = (select avg(overall_rating) from public.reviews where supplier_id = new.supplier_id),
    review_count = (select count(*) from public.reviews where supplier_id = new.supplier_id),
    updated_at = now()
  where id = new.supplier_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_review_created
  after insert on public.reviews
  for each row execute function public.update_supplier_rating();


-- 7. TRADE REQUIREMENTS (detailed specs from requirement forms)
create table public.trade_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  trade_type text not null,
  service_category text,
  budget_range text,
  scope_notes text,
  postcode text,
  contact_name text,
  contact_number text,
  created_at timestamptz default now()
);

alter table public.trade_requirements enable row level security;

create policy "Requirements are viewable by project owner"
  on public.trade_requirements for select using (
    exists (
      select 1 from public.projects p where p.id = trade_requirements.project_id and p.homeowner_id = auth.uid()
    )
  );

create policy "Authenticated users can create requirements"
  on public.trade_requirements for insert with check (auth.uid() is not null);


-- ============================================================
-- INDEXES for performance
-- ============================================================
create index idx_suppliers_trade on public.suppliers(trade_type);
create index idx_suppliers_postcode on public.suppliers(primary_postcode);
create index idx_suppliers_active on public.suppliers(is_active) where is_active = true;
create index idx_projects_status on public.projects(status);
create index idx_projects_trade on public.projects(trade_type);
create index idx_leads_supplier on public.leads(supplier_id);
create index idx_leads_project on public.leads(project_id);
create index idx_reviews_supplier on public.reviews(supplier_id);
create index idx_quotes_project on public.quotes(project_id);
