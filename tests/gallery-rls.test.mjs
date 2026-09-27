import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('galeria: SQL real, RLS de anon/comum/admin/editor e Storage existente preservado', async () => {
  const db = new PGlite();
  const admin = '11111111-1111-4111-8111-111111111111';
  const editor = '22222222-2222-4222-8222-222222222222';
  const common = '33333333-3333-4333-8333-333333333333';
  const path = 'gallery/44444444-4444-4444-8444-444444444444.jpg';
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, storage to anon, authenticated;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
      insert into auth.users values ('${admin}'), ('${editor}'), ('${common}');
    `);
    for (const file of ['202609210001_cms_base.sql', '202609210002_editorial_profiles.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
    }
    await db.exec(`insert into public.profiles(id,role) values ('${admin}','admin'), ('${editor}','editor')`);
    const policies = (await db.query("select * from pg_policies where tablename <> 'gallery_items' order by schemaname,tablename,policyname")).rows;
    await db.exec(await readFile(new URL('../supabase/migrations/202609270001_gallery_items.sql', import.meta.url), 'utf8'));
    assert.deepEqual((await db.query("select * from pg_policies where tablename <> 'gallery_items' order by schemaname,tablename,policyname")).rows, policies);
    const bucket = (await db.query('select * from storage.buckets')).rows;
    assert.equal(bucket.length, 1); assert.equal(bucket[0].public, true); assert.equal(Number(bucket[0].file_size_limit), 5242880);
    async function role(name, id = '') {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      await db.exec('set role ' + name);
    }
    const read = () => db.query('select * from public.gallery_items');
    for (const id of [admin, editor]) {
      await role('authenticated', id);
      await db.query('insert into public.gallery_items(image_path) values ($1)', [path]);
      assert.equal((await read()).rows[0].publication_status, 'draft');
      await db.exec("insert into storage.objects(bucket_id,name) values ('central-media','" + path + "')");
      for (const [name, visitor] of [['anon',''], ['authenticated',common]]) {
        await role(name, visitor);
        assert.equal((await read()).rows.length, 0);
        await assert.rejects(db.query('insert into public.gallery_items(image_path) values ($1)', [path]), /permission denied|row-level security/i);
        await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values ('central-media','gallery/forbidden.jpg')"), /row-level security/i);
      }
      await role('authenticated', id);
      await db.exec("update public.gallery_items set publication_status='published', caption='Legenda', image_credit='Foto: Central', alt_text='Retrato', position=2, updated_at='2000-01-01'");
      assert.ok(new Date((await read()).rows[0].updated_at).getUTCFullYear() > 2000);
      await assert.rejects(db.exec("update public.gallery_items set publication_status='hidden'"), /check constraint/i);
      for (const [name, visitor] of [['anon',''], ['authenticated',common]]) {
        await role(name, visitor);
        assert.equal((await read()).rows.length, 1);
        if (name === 'anon') {
          await assert.rejects(db.exec('delete from public.gallery_items'), /permission denied/i);
          await assert.rejects(db.exec("update public.gallery_items set caption='bad'"), /permission denied/i);
        } else {
          assert.equal((await db.query('delete from public.gallery_items returning id')).rows.length, 0);
          assert.equal((await db.query("update public.gallery_items set caption='bad' returning id")).rows.length, 0);
        }
        assert.equal((await db.query('delete from storage.objects returning id')).rows.length, 0);
        assert.equal((await db.query("update storage.objects set name='bad' returning id")).rows.length, 0);
      }
      await role('authenticated', id);
      assert.equal((await read()).rows[0].caption, 'Legenda');
      await db.exec("update storage.objects set name='gallery/changed.jpg'");
      await db.exec('delete from public.gallery_items; delete from storage.objects');
      assert.equal((await read()).rows.length, 0);
    }
  } finally { await db.close(); }
});
