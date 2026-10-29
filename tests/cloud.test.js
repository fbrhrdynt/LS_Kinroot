import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createApi } from "../server/api.js";
import { promotionDemo } from "./fixtures/promotion.js";
import { demo } from "../src/domain.js";
function setup() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(
      new URL("../drizzle/0000_unusual_alex_power.sql", import.meta.url),
      "utf8",
    ),
  );
  class Stmt {
    constructor(s, args = []) {
      this.s = s;
      this.args = args;
    }
    bind(...args) {
      return new Stmt(this.s, args);
    }
    exec() {
      const stmt = sql.prepare(this.s);
      if (/^SELECT/i.test(this.s))
        return { results: stmt.all(...this.args), meta: { changes: 0 } };
      const r = stmt.run(...this.args);
      return { results: [], meta: { changes: Number(r.changes) } };
    }
    async run() {
      return this.exec();
    }
    async all() {
      return this.exec();
    }
    async first(key) {
      const r = sql.prepare(this.s).get(...this.args);
      return key ? r?.[key] : r || null;
    }
  }
  const DB = {
    prepare: (s) => new Stmt(s),
    async batch(stmts) {
      sql.exec("BEGIN");
      try {
        const r = stmts.map((s) => s.exec());
        sql.exec("COMMIT");
        return r;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const objects = new Map(),
    BUCKET = {
      async put(k, v, meta) {
        objects.set(k, { body: v, ...meta });
      },
      async get(k) {
        return objects.get(k) || null;
      },
    };
  let user = {
    userId: "alice",
    email: "alice@example.com",
    displayName: "Alice",
  };
  const api = createApi({ DB, BUCKET }, async () => user);
  return {
    sql,
    objects,
    api,
    setUser(u) {
      user = u;
    },
    async call(path, method = "GET", body, origin = true) {
      const req = new Request("https://kinroot.test/api/cloud/" + path, {
        method,
        headers: {
          ...(origin ? { Origin: "https://kinroot.test" } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const r = await api(req);
      const type = r.headers.get("content-type");
      return {
        status: r.status,
        data: type?.includes("application/json")
          ? await r.json()
          : await r.arrayBuffer(),
      };
    },
  };
}
const bob = { userId: "bob", email: "bob@example.com", displayName: "Bob" },
  eve = { userId: "eve", email: "eve@example.com", displayName: "Eve" };
async function create(t, data) {
  const r = await t.call("families", "POST", {
    name: "Keluarga Uji",
    ...(data ? { data } : {}),
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.family;
}
async function invite(t, id, role = "editor", email = "") {
  const r = await t.call("families/" + id + "/invitations", "POST", {
    role,
    email,
  });
  assert.equal(r.status, 201);
  return { id: r.data.id, token: new URL(r.data.url).searchParams.get("join") };
}
test("cloud rejects unauthenticated data reads and writes, session reports no account", async () => {
  const t = setup();
  t.setUser(null);
  assert.equal((await t.call("families")).status, 401);
  assert.equal((await t.call("families", "POST", { name: "X" })).status, 401);
  assert.equal((await t.call("session")).data.user, null);
});
test("new family exists in SQL and appears only in owner list", async () => {
  const t = setup(),
    f = await create(t);
  assert.equal((await t.call("families")).data.families.length, 1);
  assert.equal((await t.call("families/" + f.id)).data.family.role, "owner");
  t.setUser(bob);
  assert.equal((await t.call("families")).data.families.length, 0);
  assert.equal((await t.call("families/" + f.id)).status, 403);
});
test("unrelated user cannot read, overwrite, invite, enumerate members or read invitations", async () => {
  const t = setup(),
    f = await create(t);
  t.setUser(eve);
  for (const [p, m, b] of [
    ["", "GET"],
    ["", "PUT", { data: f.data, revision: 1 }],
    ["/invitations", "GET"],
    ["/invitations", "POST", { role: "editor" }],
    ["/members", "GET"],
  ])
    assert.equal((await t.call("families/" + f.id + p, m, b)).status, 403);
});
test("targeted editor invite joins, retains only token hash, and can edit family", async () => {
  const t = setup(),
    f = await create(t),
    i = await invite(t, f.id, "editor", bob.email);
  const row = t.sql.prepare("SELECT * FROM invitations WHERE id=?").get(i.id);
  assert.notEqual(row.token_hash, i.token);
  assert.equal(row.token_hash.length, 64);
  t.setUser(bob);
  assert.equal((await t.call("join/" + i.token, "POST", {})).status, 200);
  const r = await t.call("families/" + f.id);
  assert.equal(r.data.family.role, "editor");
  const d = r.data.family.data;
  d.familyName = "Changed";
  assert.equal(
    (await t.call("families/" + f.id, "PUT", { data: d, revision: 1 })).status,
    200,
  );
  assert.equal((await t.call("families/" + f.id)).data.family.revision, 2);
});
test("invitation cannot be accepted by wrong email", async () => {
  const t = setup(),
    f = await create(t),
    i = await invite(t, f.id, "editor", bob.email);
  t.setUser(eve);
  assert.equal((await t.call("join/" + i.token, "POST", {})).status, 403);
  assert.equal(
    t.sql.prepare("SELECT status FROM invitations WHERE id=?").get(i.id).status,
    "pending",
  );
});
test("viewer can read but cannot mutate, invite or manage roles", async () => {
  const t = setup(),
    f = await create(t),
    i = await invite(t, f.id, "viewer");
  t.setUser(bob);
  await t.call("join/" + i.token, "POST", {});
  assert.equal((await t.call("families/" + f.id)).status, 200);
  assert.equal(
    (await t.call("families/" + f.id, "PUT", { data: f.data, revision: 1 }))
      .status,
    403,
  );
  assert.equal(
    (
      await t.call("families/" + f.id + "/invitations", "POST", {
        role: "editor",
      })
    ).status,
    403,
  );
  assert.equal(
    (await t.call("families/" + f.id + "/members/alice", "DELETE", {})).status,
    403,
  );
});
test("owner can change member role and revoke membership while owner role is protected", async () => {
  const t = setup(),
    f = await create(t),
    i = await invite(t, f.id);
  t.setUser(bob);
  await t.call("join/" + i.token, "POST", {});
  t.setUser({
    userId: "alice",
    email: "alice@example.com",
    displayName: "Alice",
  });
  assert.equal(
    (
      await t.call("families/" + f.id + "/members/bob", "PATCH", {
        role: "viewer",
      })
    ).status,
    200,
  );
  assert.equal(
    (await t.call("families/" + f.id + "/members/alice", "DELETE", {})).status,
    403,
  );
  assert.equal(
    (await t.call("families/" + f.id + "/members/bob", "DELETE", {})).status,
    200,
  );
  t.setUser(bob);
  assert.equal((await t.call("families/" + f.id)).status, 403);
});
test("revoked and expired invites fail without membership creation", async () => {
  for (const expired of [false, true]) {
    const t = setup(),
      f = await create(t),
      i = await invite(t, f.id);
    if (expired)
      t.sql
        .prepare("UPDATE invitations SET expires_at='2000-01-01' WHERE id=?")
        .run(i.id);
    else
      await t.call("families/" + f.id + "/invitations/" + i.id, "DELETE", {});
    t.setUser(bob);
    assert.equal((await t.call("join/" + i.token, "POST", {})).status, 410);
    assert.equal((await t.call("families/" + f.id)).status, 403);
  }
});
test("invitation is single-use, including replay from another user", async () => {
  const t = setup(),
    f = await create(t),
    i = await invite(t, f.id);
  t.setUser(bob);
  assert.equal((await t.call("join/" + i.token, "POST", {})).status, 200);
  t.setUser(eve);
  assert.equal((await t.call("join/" + i.token, "POST", {})).status, 410);
  assert.equal((await t.call("families/" + f.id)).status, 403);
});
test("stale simultaneous edits return conflict without last-writer overwrite", async () => {
  const t = setup(),
    f = await create(t),
    a = { ...f.data, familyName: "First" },
    b = { ...f.data, familyName: "Second" };
  const r = await Promise.all([
    t.call("families/" + f.id, "PUT", { data: a, revision: 1 }),
    t.call("families/" + f.id, "PUT", { data: b, revision: 1 }),
  ]);
  assert.deepEqual(r.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await t.call("families/" + f.id)).data.family.data.familyName,
    "First",
  );
});
test("invalid biological cycles cannot replace valid cloud family", async () => {
  const t = setup(),
    f = await create(t, demo()),
    bad = structuredClone(f.data);
  bad.parentChild.push({
    id: "cycle",
    parentId: "I",
    childId: "A",
    type: "biological",
    status: "confirmed",
  });
  assert.equal(
    (await t.call("families/" + f.id, "PUT", { data: bad, revision: 1 }))
      .status,
    400,
  );
  assert.equal((await t.call("families/" + f.id)).data.family.revision, 1);
});
test("writes reject missing or foreign origin", async () => {
  const t = setup();
  assert.equal(
    (await t.call("families", "POST", { name: "X" }, false)).status,
    403,
  );
});
test("promotional fixture has 16 distinct portraits and complete fictional stories", () => {
  const d = promotionDemo();
  assert.equal(d.persons.length, 16);
  assert.equal(new Set(d.persons.map((p) => p.photoIndex)).size, 16);
  assert(
    d.persons.every(
      (p) => p.photo && p.occupation && p.bio.length > 50 && p.notes,
    ),
  );
  assert(d.parentChild.some((e) => e.type === "adoption"));
  assert(d.parentChild.some((e) => e.type === "guardian"));
  assert(
    !d.parentChild.some(
      (e) => e.parentId === "C" && e.childId === "H" && e.type === "biological",
    ),
  );
});

test("cloud photo uploads persist in bucket and reads enforce family membership", async () => {
  const t = setup(),
    f = await create(t);
  const bytes = new Uint8Array([255, 216, 255, 224, 0, 1, 2, 3]);
  const r = await t.api(
    new Request("https://kinroot.test/api/cloud/families/" + f.id + "/photos", {
      method: "POST",
      headers: { Origin: "https://kinroot.test", "Content-Type": "image/jpeg" },
      body: bytes,
    }),
  );
  assert.equal(r.status, 201);
  const photo = (await r.json()).url;
  assert.equal(t.objects.size, 1);
  const path = photo.replace("/api/cloud/", "");
  assert.equal((await t.call(path)).status, 200);
  t.setUser(eve);
  assert.equal((await t.call(path)).status, 403);
  t.setUser(null);
  assert.equal((await t.call(path)).status, 401);
});
test("fake image content is rejected before writing cloud bucket", async () => {
  const t = setup(),
    f = await create(t);
  const r = await t.api(
    new Request("https://kinroot.test/api/cloud/families/" + f.id + "/photos", {
      method: "POST",
      headers: { Origin: "https://kinroot.test", "Content-Type": "image/jpeg" },
      body: "not an image",
    }),
  );
  assert.equal(r.status, 400);
  assert.equal(t.objects.size, 0);
});
test("oversized cloud JSON is rejected before state mutation", async () => {
  const t = setup();
  const r = await t.call("families", "POST", {
    name: "X",
    padding: "x".repeat(1500001),
  });
  assert.equal(r.status, 413);
  assert.equal((await t.call("families")).data.families.length, 0);
});
