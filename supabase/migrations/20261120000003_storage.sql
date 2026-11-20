-- =====================================================================
-- AM Creators Hub — Buckets privados de Storage y sus permisos
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('brand-kits',  'brand-kits',  false, 52428800),    -- 50 MB
  ('content',     'content',     false, 524288000),   -- 500 MB (reels)
  ('attachments', 'attachments', false, 104857600),   -- 100 MB
  ('documents',   'documents',   false, 20971520),    -- 20 MB (PDFs de finanzas y reportes)
  ('avatars',     'avatars',     false, 5242880)      -- 5 MB
on conflict (id) do nothing;

-- Equipo y admin: brand kits, contenido y adjuntos
create policy "staff lee archivos de trabajo" on storage.objects
  for select to authenticated
  using (bucket_id in ('brand-kits', 'content', 'attachments', 'avatars') and public.is_staff());
create policy "staff sube archivos de trabajo" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('brand-kits', 'content', 'attachments', 'avatars') and public.is_staff());
create policy "staff edita archivos de trabajo" on storage.objects
  for update to authenticated
  using (bucket_id in ('brand-kits', 'content', 'attachments', 'avatars') and public.is_staff());
create policy "staff borra archivos de trabajo" on storage.objects
  for delete to authenticated
  using (bucket_id in ('brand-kits', 'content', 'attachments', 'avatars') and public.is_staff());

-- Documentos (presupuestos, recibos, reportes): solo admin
create policy "admin gestiona documentos" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and public.is_admin())
  with check (bucket_id = 'documents' and public.is_admin());

-- Cliente (portal): lee solo los archivos de su carpeta, ruta <client_id>/...
create policy "cliente lee su brand kit" on storage.objects
  for select to authenticated
  using (bucket_id in ('brand-kits', 'content')
         and (storage.foldername(name))[1] = public.current_client_id()::text);

-- Cualquier usuario puede ver avatares del equipo
create policy "usuarios ven avatares" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');
