-- Strandparken Storage: two private buckets, read through short-lived signed URLs only.
-- Objects live under "<household_id>/..."; members can touch only their own household's folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('sp-recipes', 'sp-recipes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('sp-documents', 'sp-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
declare
  b text;
begin
  foreach b in array array['sp-recipes', 'sp-documents'] loop
    execute format($p$create policy %I on storage.objects for select to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] in (select household_id::text from public.household_members where user_id = (select auth.uid())))$p$, b || ' members read', b);
    execute format($p$create policy %I on storage.objects for insert to authenticated
      with check (bucket_id = %L and (storage.foldername(name))[1] in (select household_id::text from public.household_members where user_id = (select auth.uid())))$p$, b || ' members insert', b);
    execute format($p$create policy %I on storage.objects for update to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] in (select household_id::text from public.household_members where user_id = (select auth.uid())))
      with check (bucket_id = %L and (storage.foldername(name))[1] in (select household_id::text from public.household_members where user_id = (select auth.uid())))$p$, b || ' members update', b, b);
    execute format($p$create policy %I on storage.objects for delete to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] in (select household_id::text from public.household_members where user_id = (select auth.uid())))$p$, b || ' members delete', b);
  end loop;
end;
$$;
