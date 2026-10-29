import test from "node:test";
import assert from "node:assert/strict";
import { loadFamily, saveFamily } from "../src/storage.js";
import { demo, uid } from "../src/domain.js";
function memory() {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
    m,
  };
}
test("fresh storage seeds once; refresh preserves new member and explicit relations", () => {
  const s = memory(),
    d = loadFamily(s, "k", demo);
  d.persons.push({ id: "Z", name: "Zara", bio: "Preserve my story" });
  saveFamily(s, "k", d, demo());
  const next = loadFamily(s, "k", () => {
    throw Error("must not seed");
  });
  assert.equal(next.persons.length, 9);
  assert.equal(next.persons.at(-1).bio, "Preserve my story");
  assert.equal(next.parentChild.length, d.parentChild.length);
});
test("malformed saved JSON is not replaced by demo", () => {
  const s = memory();
  s.setItem("k", "broken");
  assert.throws(() => loadFamily(s, "k", demo));
  assert.equal(s.getItem("k"), "broken");
});
test("invalid schema and ambiguous historical data preserved without silent migration", () => {
  const s = memory(),
    raw = JSON.stringify({ schemaVersion: 1, parent: "A", spouse: "B" });
  s.setItem("k", raw);
  assert.throws(() => loadFamily(s, "k", demo));
  assert.equal(s.getItem("k"), raw);
});
test("backup is previous complete state, including metadata", () => {
  const s = memory(),
    old = demo(),
    next = structuredClone(old);
  old.persons[0].notes = "Keep";
  next.persons[0].name = "Changed";
  saveFamily(s, "k", next, old);
  assert.deepEqual(JSON.parse(s.getItem("k.previous")), old);
  assert.equal(JSON.parse(s.getItem("k")).persons[0].name, "Changed");
});
test("invalid candidate never writes storage", () => {
  const s = memory(),
    old = demo(),
    next = structuredClone(old);
  next.parentChild[0].parentId = "absent";
  assert.throws(() => saveFamily(s, "k", next, old));
  assert.equal(s.m.size, 0);
});
test("quota failure preserves committed primary data", () => {
  const s = memory(),
    old = demo();
  s.setItem("k", JSON.stringify(old));
  const normal = s.setItem;
  s.setItem = (k, v) => {
    if (k === "k") throw Error("quota");
    normal(k, v);
  };
  const next = structuredClone(old);
  next.persons = [];
  next.partnerships = [];
  next.parentChild = [];
  assert.throws(() => saveFamily(s, "k", next, old), /quota/);
  assert.deepEqual(JSON.parse(s.getItem("k")), old);
});
test("storage security errors propagate for visible recovery UI", () => {
  assert.throws(
    () =>
      loadFamily(
        {
          getItem() {
            throw Error("blocked");
          },
        },
        "k",
        demo,
      ),
    /blocked/,
  );
});
test("new UUIDs work without randomUUID and have unique stable format", () => {
  const ids = Array.from({ length: 100 }, uid);
  assert.equal(new Set(ids).size, 100);
  assert(
    ids.every((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        id,
      ),
    ),
  );
});
