import { route } from "./routing.js";
export const VERSION = "0.2.1";
export const TYPES = {
  biological: "Biologis",
  step: "Tiri",
  adoption: "Adopsi",
  guardian: "Perwalian",
  unknown: "Belum dikonfirmasi",
};
export const uid = () => {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return (
    h.slice(0, 8) +
    "-" +
    h.slice(8, 12) +
    "-" +
    h.slice(12, 16) +
    "-" +
    h.slice(16, 20) +
    "-" +
    h.slice(20)
  );
};
export function demo() {
  return {
    schemaVersion: 3,
    appVersion: VERSION,
    familyName: "Keluarga Akar",
    persons: [
      ["A", "Arif", "1950-04-12", "male", "Bandung"],
      ["B", "Ratna", "1954-08-21", "female", "Bandung"],
      ["C", "Candra", "1975-03-16", "male", "Jakarta"],
      ["D", "Dimas", "1978-06-04", "male", "Bandung"],
      ["E", "Eka", "1982-11-19", "female", "Yogyakarta"],
      ["G", "Gita", "1980-02-08", "female", "Jakarta"],
      ["H", "Hadi", "2005-07-12", "male", "Jakarta"],
      ["I", "Intan", "2010-09-25", "female", "Jakarta"],
    ].map(([id, name, birth, gender, place]) => ({
      id,
      name,
      birth,
      gender,
      place,
      death: "",
      bio: id === "H" ? "Anak dari hubungan sebelumnya (biologis dari G)" : "",
      photo: "",
      occupation: "",
      notes: "",
    })),
    partnerships: [
      {
        id: "AB",
        personA: "A",
        personB: "B",
        type: "marriage",
        status: "current",
        date: "1973-05-20",
      },
      {
        id: "CG",
        personA: "C",
        personB: "G",
        type: "marriage",
        status: "current",
        date: "2009-06-14",
      },
    ],
    parentChild: [
      ...["C", "D", "E"].flatMap((childId) =>
        ["A", "B"].map((parentId) => ({
          id: parentId + childId,
          parentId,
          childId,
          type: "biological",
          status: "confirmed",
        })),
      ),
      ...["C", "G"].map((parentId) => ({
        id: parentId + "I",
        parentId,
        childId: "I",
        type: "biological",
        status: "confirmed",
      })),
      {
        id: "GH",
        parentId: "G",
        childId: "H",
        type: "biological",
        status: "confirmed",
      },
      {
        id: "CH",
        parentId: "C",
        childId: "H",
        type: "step",
        status: "confirmed",
      },
    ],
    activity: [],
    updatedAt: new Date().toISOString(),
  };
}
export function validate(d) {
  if (
    !d ||
    d.schemaVersion !== 3 ||
    !Array.isArray(d.persons) ||
    !Array.isArray(d.partnerships) ||
    !Array.isArray(d.parentChild)
  )
    throw Error("Format berkas tidak sesuai skema KinRoot 3.");
  if (d.persons.length > 1000 || d.parentChild.length > 5000)
    throw Error("Maksimum 1.000 anggota dan 5.000 hubungan per berkas.");
  if (d.familyName !== undefined && typeof d.familyName !== "string")
    throw Error("Nama keluarga tidak valid.");
  if (
    d.activity !== undefined &&
    (!Array.isArray(d.activity) ||
      d.activity.some(
        (a) => !a || typeof a.text !== "string" || typeof a.date !== "string",
      ))
  )
    throw Error("Riwayat aktivitas tidak valid.");
  const ids = new Set();
  for (const p of d.persons) {
    if (
      typeof p.id !== "string" ||
      !p.id.trim() ||
      ids.has(p.id) ||
      typeof p.name !== "string" ||
      !p.name.trim()
    )
      throw Error("ID anggota harus unik dan nama wajib diisi.");
    ids.add(p.id);
    for (const k of [
      "name",
      "birth",
      "death",
      "place",
      "bio",
      "notes",
      "photo",
      "occupation",
      "gender",
    ])
      if (p[k] !== undefined && typeof p[k] !== "string")
        throw Error("Metadata anggota tidak valid: " + k);
    if (p.birth && !/^\d{4}-\d{2}-\d{2}$/.test(p.birth))
      throw Error("Tanggal lahir tidak valid.");
    if (p.death && !/^\d{4}-\d{2}-\d{2}$/.test(p.death))
      throw Error("Tanggal wafat tidak valid.");
    if (
      p.photo &&
      !/^data:image\/(png|jpeg|webp);base64,/.test(p.photo) &&
      !/^\/api\/cloud\/photos\/[a-f0-9-]{36}$/.test(p.photo) &&
      p.photo !== "/demo/portraits.png"
    )
      throw Error("Foto harus berupa PNG, JPEG, atau WebP.");
    if (p.birth && p.death && p.death < p.birth)
      throw Error("Tanggal wafat mendahului kelahiran.");
  }
  for (const p of d.persons)
    if (
      p.photoIndex !== undefined &&
      (!Number.isInteger(p.photoIndex) || p.photoIndex < 0 || p.photoIndex > 15)
    )
      throw Error("Indeks foto demo tidak valid.");
  const edgeIds = new Set(),
    facts = new Set();
  for (const e of [...d.partnerships, ...d.parentChild]) {
    if (typeof e.id !== "string" || !e.id.trim() || edgeIds.has(e.id))
      throw Error("ID hubungan harus unik.");
    edgeIds.add(e.id);
  }
  for (const r of d.partnerships) {
    if (!ids.has(r.personA) || !ids.has(r.personB) || r.personA === r.personB)
      throw Error("Pasangan tidak valid.");
    if (!["marriage", "nonmarital", "cousin"].includes(r.type))
      throw Error("Jenis pasangan tidak valid.");
    const k = JSON.stringify([r.personA, r.personB].sort());
    if (facts.has(k)) throw Error("Pasangan sudah tercatat.");
    facts.add(k);
  }
  const adj = Object.create(null);
  for (const e of d.parentChild) {
    if (
      !ids.has(e.parentId) ||
      !ids.has(e.childId) ||
      e.parentId === e.childId ||
      !Object.hasOwn(TYPES, e.type)
    )
      throw Error("Hubungan orang tua–anak tidak valid.");
    if (!["confirmed", "unconfirmed"].includes(e.status))
      throw Error("Status hubungan tidak valid.");
    const k = JSON.stringify([e.parentId, e.childId, e.type]);
    if (facts.has(k)) throw Error("Hubungan sudah tercatat.");
    facts.add(k);
    if (e.type === "biological" && e.status === "confirmed")
      (adj[e.parentId] ??= []).push(e.childId);
  }
  const visiting = new Set(),
    done = new Set();
  function walk(id) {
    if (visiting.has(id)) throw Error("Siklus leluhur tidak diizinkan.");
    if (done.has(id)) return;
    visiting.add(id);
    for (const c of adj[id] || []) walk(c);
    visiting.delete(id);
    done.add(id);
  }
  ids.forEach(walk);
  return d;
}
export function removePerson(d, id) {
  return {
    ...d,
    persons: d.persons.filter((p) => p.id !== id),
    partnerships: d.partnerships.filter(
      (r) => r.personA !== id && r.personB !== id,
    ),
    parentChild: d.parentChild.filter(
      (r) => r.parentId !== id && r.childId !== id,
    ),
  };
}
export function graph(d) {
  validate(d);
  const W = 158,
    H = 94,
    GAP = 46,
    ROW = 220;
  const nodes = new Map();
  // Partnership components share a row without duplicating person records.
  const roots = Object.fromEntries(d.persons.map((p) => [p.id, p.id]));
  const find = (x) => (roots[x] === x ? x : (roots[x] = find(roots[x])));
  for (const r of d.partnerships) roots[find(r.personB)] = find(r.personA);
  const groups = [];
  for (const p of d.persons) {
    let g = groups.find((g) => g.key === find(p.id));
    if (!g) groups.push((g = { key: find(p.id), ids: [], level: 0 }));
    g.ids.push(p.id);
  }
  // Rank partnership components once. Cyclic non-biological/social crosslinks
  // are not allowed to inflate generations indefinitely.
  const incoming = new Map(groups.map((g) => [g.key, new Set()]));
  for (const e of d.parentChild.filter(
    (e) => e.status === "confirmed" && !["step", "unknown"].includes(e.type),
  )) {
    const a = find(e.parentId),
      b = find(e.childId);
    if (a !== b) incoming.get(b).add(a);
  }
  const ranks = new Map();
  function rank(key, visiting = new Set()) {
    if (ranks.has(key)) return ranks.get(key);
    visiting.add(key);
    let value = 0;
    for (const parent of incoming.get(key)) {
      if (!visiting.has(parent))
        value = Math.max(value, rank(parent, visiting) + 1);
    }
    visiting.delete(key);
    ranks.set(key, value);
    return value;
  }
  for (const g of groups) g.level = rank(g.key);
  const max = Math.max(0, ...groups.map((g) => g.level));
  for (let l = 0; l <= max; l++) {
    const row = groups.filter((g) => g.level === l);
    let x = 80;
    for (const g of row) {
      for (const id of g.ids) {
        nodes.set(id, {
          ...d.persons.find((p) => p.id === id),
          x,
          y: 80 + l * ROW,
          w: W,
          h: H,
        });
        x += W + GAP;
      }
    }
  }
  const edges = [],
    used = new Set();
  for (const r of d.partnerships) {
    const a = nodes.get(r.personA),
      b = nodes.get(r.personB);
    const left = a.x < b.x ? a : b,
      right = a.x < b.x ? b : a;
    const mid = (left.x + W + right.x) / 2,
      cross = right.x - left.x > W + GAP + 1,
      y = cross ? a.y - 30 : a.y + H / 2;
    edges.push({
      id: r.id,
      type: r.type,
      kind: "partner",
      from: [r.personA, r.personB],
      points: cross
        ? [
            [left.x + W / 2, left.y],
            [left.x + W / 2, y],
            [right.x + W / 2, y],
            [right.x + W / 2, right.y],
          ]
        : [
            [left.x + W, y],
            [right.x, y],
          ],
      cross,
      mid: [mid, y],
      label:
        r.type === "cousin"
          ? "Pernikahan sepupu"
          : r.type === "nonmarital"
            ? "Pasangan"
            : "Pernikahan",
    });
    const shared = d.persons.filter((c) =>
      [r.personA, r.personB].every((p) =>
        d.parentChild.some(
          (e) =>
            e.parentId === p &&
            e.childId === c.id &&
            e.type === "biological" &&
            e.status === "confirmed",
        ),
      ),
    );
    if (shared.length) {
      const cs = shared.map((p) => nodes.get(p.id)),
        bus = Math.min(...cs.map((c) => c.y)) - 48;
      edges.push({
        id: r.id + "-trunk",
        type: "biological",
        kind: "shared-trunk",
        from: [r.personA, r.personB],
        children: shared.map((c) => c.id),
        points: [
          [mid, y],
          [mid, bus],
        ],
      });
      const xs = [mid, ...cs.map((c) => c.x + W / 2)];
      edges.push({
        id: r.id + "-bus",
        type: "biological",
        kind: "bus",
        points: [
          [Math.min(...xs), bus],
          [Math.max(...xs), bus],
        ],
      });
      for (const c of cs) {
        edges.push({
          id: r.id + "-" + c.id,
          type: "biological",
          kind: "drop",
          to: c.id,
          points: [
            [c.x + W / 2, bus],
            [c.x + W / 2, c.y],
          ],
        });
        for (const p of [r.personA, r.personB])
          used.add(JSON.stringify([p, c.id]));
      }
    }
  }
  for (const e of d.parentChild) {
    if (
      used.has(JSON.stringify([e.parentId, e.childId])) &&
      e.type === "biological" &&
      e.status === "confirmed"
    )
      continue;
    // Prior-parent biology remains available in profiles; orange step link is the honest visible link, as in reference.
    if (
      e.type === "biological" &&
      d.parentChild.some(
        (s) =>
          s.childId === e.childId &&
          s.type === "step" &&
          d.partnerships.some(
            (r) =>
              [r.personA, r.personB].includes(s.parentId) &&
              [r.personA, r.personB].includes(e.parentId),
          ),
      )
    )
      continue;
    const a = nodes.get(e.parentId),
      b = nodes.get(e.childId),
      sx = a.x + W / 2,
      tx = b.x + W / 2,
      lane = b.y - 65;
    edges.push({
      id: e.id,
      type: e.status === "unconfirmed" ? "unknown" : e.type,
      kind: "individual",
      from: [e.parentId],
      to: e.childId,
      points: [
        [sx, a.y + H],
        [sx, lane],
        [tx, lane],
        [tx, b.y],
      ],
      label: TYPES[e.type],
    });
  }
  for (const e of edges) e.points = route(e.points, [...nodes.values()]);
  return {
    nodes: [...nodes.values()],
    edges,
    width: Math.max(600, ...[...nodes.values()].map((n) => n.x + W + 80)),
    height: Math.max(400, ...[...nodes.values()].map((n) => n.y + H + 80)),
    complex:
      d.partnerships.some(
        (r) =>
          d.partnerships.filter(
            (s) => s.personA === r.personA || s.personB === r.personA,
          ).length > 1,
      ) || d.partnerships.some((r) => r.type === "cousin"),
  };
}
