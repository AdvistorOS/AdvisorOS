import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("transcripts are private and admin membership cannot be self-assigned", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      create table meetings(id uuid primary key, adviser_id uuid);
      create table transcripts(meeting_id uuid, full_text text);
      create table super_admins(email text primary key);
      grant all on meetings, transcripts, super_admins to anon, authenticated, service_role;
      alter table meetings enable row level security;
      create policy "own meetings" on meetings for all using (adviser_id = auth.uid());
      insert into meetings values ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
      insert into transcripts values ('11111111-1111-4111-8111-111111111111','owner transcript'), ('22222222-2222-4222-8222-222222222222','other transcript');
      insert into super_admins values ('admin@example.test');
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/202609090002_private_transcripts_and_admins.sql", import.meta.url), "utf8"));
    await db.exec("set role anon");
    assert.equal((await db.query("select * from transcripts")).rows.length, 0);
    assert.equal((await db.query("select * from super_admins")).rows.length, 0);
    await assert.rejects(db.query("insert into super_admins values ('intruder@example.test')"));
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false), set_config('request.jwt.claims','{\"email\":\"user@example.test\"}',false)");
    assert.deepEqual((await db.query("select full_text from transcripts")).rows, [{ full_text: "owner transcript" }]);
    assert.equal((await db.query("select * from super_admins")).rows.length, 0);
    await assert.rejects(db.query("insert into super_admins values ('user@example.test')"));
    assert.equal((await db.query("delete from transcripts returning *")).rows.length, 0);
    await db.query("select set_config('request.jwt.claims','{\"email\":\"admin@example.test\"}',false)");
    assert.equal((await db.query("select * from super_admins")).rows.length, 1);
    await db.exec("reset role; set role service_role");
    assert.equal((await db.query("select * from transcripts")).rows.length, 2);
    await db.query("update transcripts set full_text='server update'");
  } finally { await db.close(); }
});
