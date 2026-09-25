import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const admin = '11111111-1111-4111-8111-111111111111';
const common = '22222222-2222-4222-8222-222222222222';
test('migration: permissões reais de PostgreSQL para visitante, usuário comum e admin', async () => {
  const db = new PGlite();
  try {
    // Emular somente contratos de Auth/Storage ausentes fora de um projeto Supabase.
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth, storage to anon, authenticated;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
      insert into auth.users values ('${admin}'), ('${common}');
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/202609210001_cms_base.sql', import.meta.url), 'utf8'));
    await db.exec(`insert into private.admin_users(user_id) values ('${admin}')`);
    await db.exec(await readFile(new URL('../supabase/migrations/202609210002_editorial_profiles.sql', import.meta.url), 'utf8'));
    async function role(name, id = '') {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      await db.exec('set role ' + name);
    }
    const count = async table => (await db.query('select count(*)::int as n from public.' + table)).rows[0].n;
    const statements = {
      news: "insert into public.news(title,slug,content,category,author_name) values ('Notícia','noticia','Texto','Música','Central')",
      events: "insert into public.events(title,event_date,city) values ('Evento','2026-09-21','São Paulo')",
      trajectory: "insert into public.trajectory(year,title) values (2026,'Trajetória')",
    };
    await role('authenticated', common);
    await assert.rejects(db.exec(`insert into public.profiles(id,role) values ('${common}','admin')`), /permission denied/i);
    await assert.rejects(db.exec("update public.profiles set role='admin'"), /permission denied/i);
    assert.equal((await db.query('select public.is_admin() as allowed')).rows[0].allowed, false);
    for (const sql of Object.values(statements)) await assert.rejects(db.exec(sql), /row-level security/i);
    await assert.rejects(db.exec(`insert into private.admin_users(user_id) values ('${common}')`), /permission denied/i);
    await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values ('central-media','test.jpg')"), /row-level security/i);

    await role('authenticated', admin);
    for (const sql of Object.values(statements)) await db.exec(sql);
    await assert.rejects(db.exec(statements.news), /duplicate key/i);
    await db.exec('reset role');
    const beforeCredit = (await db.query('select * from public.news')).rows[0];
    const migration = await readFile(new URL('../supabase/migrations/202609250001_news_image_credit.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const afterCredit = (await db.query('select * from public.news')).rows[0];
    assert.equal(afterCredit.image_credit, null);
    delete afterCredit.image_credit;
    assert.deepEqual(afterCredit, beforeCredit, 'Migration preserva notícia antiga');
    await role('authenticated', admin);
    await db.exec("update public.news set image_credit='Foto: Central'");

    assert.equal((await db.query('select role from public.profiles')).rows[0].role, 'admin', 'Admin legado migrado');
    const trajectoryId = (await db.query('select id from public.trajectory')).rows[0].id;
    await db.query("insert into public.trajectory_matches(trajectory_id,competition) values ($1,'Liga')", [trajectoryId]);
    await db.exec("insert into storage.objects(bucket_id,name) values ('central-media','test.jpg')");
    await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values ('other-bucket','test.jpg')"), /row-level security/i);
    await db.exec("update storage.objects set name='changed.jpg' where bucket_id='central-media'");
    assert.equal((await db.query('select name from storage.objects')).rows[0].name, 'changed.jpg');

    for (const [name, id] of [['anon', ''], ['authenticated', common]]) {
      await role(name, id);
      for (const table of ['news', 'events', 'trajectory', 'trajectory_matches']) assert.equal(await count(table), 0, table + ' draft');
      assert.equal((await db.query('select count(*)::int as n from storage.objects')).rows[0].n, 0);
    }
    await role('anon');
    for (const sql of Object.values(statements)) await assert.rejects(db.exec(sql), /permission denied/i);

    await role('authenticated', admin);
    await db.exec("update public.news set status='published', published_at=now()+interval '1 day'; update public.events set status='published'; update public.trajectory set publication_status='published'");
    await role('anon');
    assert.equal(await count('news'), 0, 'Notícia futura deve permanecer privada');
    assert.equal(await count('events'), 1);
    assert.equal(await count('trajectory'), 1);
    assert.equal(await count('trajectory_matches'), 1);
    await role('authenticated', admin);
    await db.exec("update public.news set published_at=now()-interval '1 minute'");
    await role('authenticated', common);
    assert.equal(await count('news'), 1);
    assert.equal((await db.query('select image_credit from public.news')).rows[0].image_credit, 'Foto: Central');
    assert.equal((await db.query("update public.news set title='Invadido' returning id")).rows.length, 0);
    assert.equal((await db.query('delete from public.events returning id')).rows.length, 0);
    assert.equal((await db.query('delete from public.trajectory_matches returning id')).rows.length, 0);
    assert.equal((await db.query("update public.trajectory set title='Invadido' returning id")).rows.length, 0);
    await role('authenticated', admin);
    assert.equal((await db.query('select title from public.news')).rows[0].title, 'Notícia');
    await db.exec("update public.trajectory set publication_status='draft'");
    await role('anon');
    assert.equal(await count('trajectory_matches'), 0, 'Batalha segue a visibilidade do pai');
    await role('authenticated', admin);
    for (const table of ['news', 'events', 'trajectory']) await db.exec('delete from public.' + table);
    assert.equal(await count('trajectory_matches'), 0, 'FK remove batalhas órfãs');
    await db.exec("delete from storage.objects where bucket_id='central-media'");
    await db.exec('reset role');
    await db.exec(`delete from public.profiles where id='${admin}'`);
    await role('authenticated', admin);
    assert.equal((await db.query('select public.is_admin() as allowed')).rows[0].allowed, false);
    await assert.rejects(db.exec(statements.news), /row-level security/i);
    await db.exec('reset role');
    await db.exec(`insert into public.profiles(id,role) values ('${common}','editor')`);
    await role('authenticated', common);
    assert.equal((await db.query('select public.is_admin() as allowed')).rows[0].allowed, true);
    await db.exec(statements.news);
    assert.equal(await count('news'), 1, 'Editor autorizado pode criar rascunhos');
    await assert.rejects(db.exec(`update public.profiles set role='admin' where id='${common}'`), /permission denied/i);
    await assert.rejects(db.exec('delete from public.profiles'), /permission denied/i);
    await db.exec('reset role');
    const seed = await readFile(new URL('../supabase/trajectory-2026.example.sql', import.meta.url), 'utf8');
    await db.exec(seed);
    await db.exec(seed);
    assert.equal(await count('trajectory'), 1, 'Seed não duplica trajetória');
    assert.equal(await count('trajectory_matches'), 4, 'Seed não duplica batalhas');
    assert.deepEqual((await db.query('select opponent_score from public.trajectory_matches order by position')).rows.map(row => row.opponent_score), [1,0,1,1]);
    await role('anon');
    assert.equal(await count('trajectory'), 0);
    assert.equal(await count('trajectory_matches'), 0);
    await db.exec('reset role');
    await db.exec(`delete from auth.users where id='${common}'`);
    assert.equal((await db.query('select count(*)::int n from public.profiles')).rows[0].n, 0, 'Perfil removido junto à conta');
  } finally { await db.close(); }
});

