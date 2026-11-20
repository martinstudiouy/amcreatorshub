-- =====================================================================
-- Borra TODOS los datos de ejemplo (IDs 00000000-0000-4000-a...).
-- Correlo en el SQL Editor de Supabase cuando quieras empezar a usar
-- el CRM con datos reales. No toca usuarios ni configuración.
-- =====================================================================
begin;
delete from public.activity_log
  where entity_id::text like '00000000-0000-4000-a%' or client_id::text like '00000000-0000-4000-a%';
delete from public.messages            where id::text like '00000000-0000-4000-a%';
delete from public.conversations       where id::text like '00000000-0000-4000-a%';
delete from public.quick_replies       where id::text like '00000000-0000-4000-a%';
delete from public.invoice_items       where id::text like '00000000-0000-4000-a%';
delete from public.invoices            where id::text like '00000000-0000-4000-a%';
delete from public.recurring_fees      where id::text like '00000000-0000-4000-a%';
delete from public.expenses            where id::text like '00000000-0000-4000-a%';
delete from public.events              where id::text like '00000000-0000-4000-a%';
delete from public.content_posts       where id::text like '00000000-0000-4000-a%';
delete from public.ig_metrics_daily    where social_account_id::text like '00000000-0000-4000-a%';
delete from public.social_accounts     where id::text like '00000000-0000-4000-a%';
delete from public.tasks               where id::text like '00000000-0000-4000-a%';
delete from public.projects            where id::text like '00000000-0000-4000-a%';
delete from public.project_templates   where id::text like '00000000-0000-4000-a%';
delete from public.clients             where id::text like '00000000-0000-4000-a%';
delete from public.exchange_rates      where id::text like '00000000-0000-4000-a%';
commit;
