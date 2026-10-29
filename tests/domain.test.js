import test from "node:test";
import assert from "node:assert/strict";
import { demo, validate, graph, removePerson } from "../src/domain.js";
const add = (d, p, c, type = "biological", status = "confirmed") =>
  d.parentChild.push({
    id: p + c + type,
    parentId: p,
    childId: c,
    type,
    status,
  });
test("canonical demo contains 8 unique people; explicit GH and step CH only", () => {
  const d = validate(demo());
  assert.equal(new Set(d.persons.map((p) => p.id)).size, 8);
  assert(
    d.parentChild.some(
      (e) => e.parentId === "G" && e.childId === "H" && e.type === "biological",
    ),
  );
  assert(
    !d.parentChild.some(
      (e) => e.parentId === "C" && e.childId === "H" && e.type === "biological",
    ),
  );
});
test("both couples occupy same row and adjacent cards", () => {
  const g = graph(demo());
  for (const [a, b] of [
    ["A", "B"],
    ["C", "G"],
  ]) {
    const x = g.nodes.find((n) => n.id === a),
      y = g.nodes.find((n) => n.id === b);
    assert.equal(x.y, y.y);
    assert.equal(y.x - x.x, x.w + 46);
  }
});
test("AB midpoint trunk has precisely C D E", () => {
  const g = graph(demo()),
    e = g.edges.find((e) => e.id === "AB-trunk"),
    a = g.nodes.find((n) => n.id === "A"),
    b = g.nodes.find((n) => n.id === "B");
  assert.deepEqual(e.children, ["C", "D", "E"]);
  assert.equal(e.points[0][0], (a.x + a.w + b.x) / 2);
  assert.equal(
    g.edges.filter((e) => e.kind === "drop" && e.id.startsWith("AB-")).length,
    3,
  );
});
test("CG trunk contains I, never H; step edge originates C", () => {
  const g = graph(demo());
  assert.deepEqual(g.edges.find((e) => e.id === "CG-trunk").children, ["I"]);
  assert(
    !g.edges.some(
      (e) =>
        e.type === "biological" &&
        (e.to === "H" || e.children?.includes("H")) &&
        e.from?.includes("C"),
    ),
  );
  const step = g.edges.find((e) => e.id === "CH");
  assert.equal(step.type, "step");
  assert.deepEqual(step.from, ["C"]);
  assert.equal(step.to, "H");
});
test("all connector segments orthogonal, deterministic, renderer pure", () => {
  const d = demo(),
    before = JSON.stringify(d),
    g = graph(d);
  for (const e of g.edges)
    for (let i = 1; i < e.points.length; i++)
      assert(
        e.points[i - 1][0] === e.points[i][0] ||
          e.points[i - 1][1] === e.points[i][1],
      );
  assert.equal(JSON.stringify(d), before);
  assert.deepEqual(graph(d), g);
});
function crossesInterior(a, b, n) {
  if (a[0] === b[0])
    return (
      a[0] > n.x &&
      a[0] < n.x + n.w &&
      Math.max(a[1], b[1]) > n.y &&
      Math.min(a[1], b[1]) < n.y + n.h
    );
  return (
    a[1] > n.y &&
    a[1] < n.y + n.h &&
    Math.max(a[0], b[0]) > n.x &&
    Math.min(a[0], b[0]) < n.x + n.w
  );
}
test("canonical connector routes never cross any card interior", () => {
  const g = graph(demo());
  for (const e of g.edges)
    for (let i = 1; i < e.points.length; i++)
      for (const n of g.nodes)
        assert(
          !crossesInterior(e.points[i - 1], e.points[i], n),
          e.id + " crosses " + n.id,
        );
});
test("unknown co-parent never invented; one-parent biological starts from parent card", () => {
  const d = demo();
  d.parentChild = d.parentChild.filter((e) => e.id !== "CH");
  const g = graph(d),
    e = g.edges.find((e) => e.id === "GH"),
    p = g.nodes.find((p) => p.id === "G");
  assert.equal(g.nodes.length, 8);
  assert.equal(e.points[0][0], p.x + p.w / 2);
  assert.deepEqual(e.from, ["G"]);
});
test("marriage never infers biological parent", () => {
  const d = demo();
  d.parentChild = d.parentChild.filter((e) => e.parentId !== "C");
  assert(!graph(d).edges.some((e) => e.id === "CG-trunk"));
  assert(!d.parentChild.some((e) => e.parentId === "C"));
});
test("adoption guardian and unknown are distinct routed edges", () => {
  for (const type of ["adoption", "guardian", "unknown"]) {
    const d = demo();
    d.persons.push({ id: "J", name: "J" });
    add(d, "E", "J", type);
    assert.equal(graph(d).edges.find((e) => e.id === "EJ" + type).type, type);
  }
});
test("unconfirmed biological is visibly unknown and excluded from couple trunk", () => {
  const d = demo();
  d.parentChild.find((e) => e.id === "CI").status = "unconfirmed";
  const g = graph(d);
  assert(!g.edges.find((e) => e.id === "CG-trunk"));
  assert.equal(g.edges.find((e) => e.id === "CI").type, "unknown");
});
test("remarriage preserves prior child and unique canonical person", () => {
  const d = demo();
  d.persons.push({ id: "J", name: "J" });
  d.partnerships.push({
    id: "GJ",
    personA: "G",
    personB: "J",
    type: "marriage",
    status: "former",
  });
  const g = graph(d);
  assert.equal(g.nodes.length, 9);
  assert.equal(g.nodes.filter((n) => n.id === "G").length, 1);
  assert(!g.edges.find((e) => e.id === "GJ-trunk"));
  assert(d.parentChild.some((e) => e.id === "GH"));
});
test("cousin marriage is supported without duplicate records or ancestry cycles", () => {
  const d = demo();
  d.persons.push({ id: "J", name: "J" }, { id: "K", name: "K" });
  add(d, "D", "J");
  add(d, "E", "K");
  d.partnerships.push({
    id: "JK",
    personA: "J",
    personB: "K",
    type: "cousin",
    status: "current",
  });
  const g = graph(d);
  assert.equal(g.nodes.length, 10);
  assert(g.edges.some((e) => e.id === "JK" && e.type === "cousin"));
});
test("biological ancestry cycle rejected", () => {
  const d = demo();
  add(d, "I", "A");
  assert.throws(() => validate(d), /Siklus/);
});
test("self-parenting and self-partnership rejected", () => {
  const d = demo();
  add(d, "C", "C");
  assert.throws(() => validate(d), /tidak valid/);
  const e = demo();
  e.partnerships[0].personB = "A";
  assert.throws(() => validate(e), /tidak valid/);
});
test("dangling parent references rejected", () => {
  const d = demo();
  d.parentChild[0].parentId = "missing";
  assert.throws(() => validate(d), /tidak valid/);
});
test("duplicate persons and duplicate facts rejected", () => {
  let d = demo();
  d.persons.push(d.persons[0]);
  assert.throws(() => validate(d), /unik/);
  d = demo();
  add(d, "G", "H");
  assert.throws(() => validate(d), /sudah tercatat/);
});
test("duplicate relationship IDs rejected", () => {
  const d = demo();
  d.parentChild[0].id = "AB";
  assert.throws(() => validate(d), /unik/);
});
test("delete cascades only affected relationships", () => {
  const d = removePerson(demo(), "C");
  validate(d);
  assert.equal(d.persons.length, 7);
  assert(!d.partnerships.some((r) => r.personA === "C" || r.personB === "C"));
  assert(d.parentChild.some((r) => r.id === "GH"));
  assert(d.persons.some((p) => p.id === "H"));
});
test("JSON round trip preserves all profile and relationship fields", () => {
  const d = demo();
  d.persons[0].notes = "A story\nwith lines";
  d.persons[0].customMetadata = { kept: true };
  assert.deepEqual(validate(JSON.parse(JSON.stringify(d))), d);
});
test("empty family is valid and renders finite bounds", () => {
  const d = demo();
  d.persons = [];
  d.partnerships = [];
  d.parentChild = [];
  const g = graph(d);
  assert.equal(g.nodes.length, 0);
  assert(Number.isFinite(g.width) && Number.isFinite(g.height));
});
test("unsafe photo URLs and corrupt metadata rejected", () => {
  const d = demo();
  d.persons[0].photo = "javascript:alert(1)";
  assert.throws(() => validate(d), /Foto/);
  d.persons[0].photo = "";
  d.persons[0].bio = {};
  assert.throws(() => validate(d), /Metadata/);
});
test("unsupported schema and oversized import rejected", () => {
  assert.throws(() => validate({ schemaVersion: 2 }), /Format/);
  const d = demo();
  d.persons = Array.from({ length: 1001 }, (_, i) => ({
    id: String(i),
    name: "p",
  }));
  assert.throws(() => validate(d), /Maksimum/);
});
test("deceased date cannot precede birth", () => {
  const d = demo();
  d.persons[0].death = "1940-01-01";
  assert.throws(() => validate(d), /wafat/);
});
test("multiple spouse crosslinks never pass through the intervening spouse card", () => {
  const d = demo();
  d.persons.push({ id: "J", name: "J" });
  d.partnerships.push({
    id: "CJ",
    personA: "C",
    personB: "J",
    type: "marriage",
    status: "former",
  });
  const g = graph(d);
  for (const e of g.edges)
    for (let i = 1; i < e.points.length; i++)
      for (const n of g.nodes)
        assert(
          !crossesInterior(e.points[i - 1], e.points[i], n),
          e.id + " crosses " + n.id,
        );
  assert(g.edges.find((e) => e.id === "CJ").cross);
});
test("prototype-shaped person IDs remain safe canonical identifiers", () => {
  const d = demo();
  d.persons.push(
    { id: "__proto__", name: "Test" },
    { id: "constructor", name: "Other" },
  );
  add(d, "A", "__proto__");
  add(d, "__proto__", "constructor");
  const g = graph(d);
  assert.equal(g.nodes.length, 10);
  assert(g.nodes.some((n) => n.id === "__proto__"));
});
test("inherited object keys are not accepted as relationship types", () => {
  const d = demo();
  d.parentChild[0].type = "constructor";
  assert.throws(() => validate(d), /tidak valid/);
});
test("nonbiological social cycles do not inflate tree to unbounded generations", () => {
  const d = demo();
  add(d, "H", "I", "guardian");
  add(d, "I", "H", "guardian");
  const g = graph(d);
  assert(g.height < 2000);
});
