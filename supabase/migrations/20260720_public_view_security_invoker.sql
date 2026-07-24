-- Redteam-Haertung: preisbereinigte Public-Views sollen RLS der Basistabellen
-- respektieren. Supabase/Postgres-Views laufen sonst standardmaessig als
-- Security-Definer des View-Erstellers und koennen RLS umgehen.

alter view if exists public.orders_public set (security_invoker = true);
alter view if exists public.inventory_items_public set (security_invoker = true);
alter view if exists public.job_material_calculation_items_public set (security_invoker = true);
alter view if exists public.job_material_requirements_public set (security_invoker = true);

select pg_notify('pgrst', 'reload schema');
