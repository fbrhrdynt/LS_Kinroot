import { request } from "./cloud.js";
import {emptyFamily,personSubtitle,stepOriginNote} from "./family.js";
import { loadFamily, saveFamily } from "./storage.js";
import {
  VERSION,
  TYPES,
  validate,
  removePerson,
  graph,
  uid,
} from "./domain.js";
const KEY = "kinroot.family.v021",
  BACKUP = KEY + ".previous";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const icons = {
  home: "⌂",
  tree: "♧",
  members: "☷",
  stories: "▤",
  settings: "⚙",
};
let account = null,
  families = [],
  cloudFamily = null,
  cloudMembers = [],
  cloudInvites = [],
  cloudBusy = false,
  cloudSaving = false,
  failedDraft = null,
  lastInvite = "";
let data,
  storageError = "",
  tab = "home",
  selected = null,
  mode = "profile",
  search = "",
  sex = "all",
  view = { x: 0, y: 0, z: 1 },
  showLegend = true,
  undoState = null;
try {
  data = loadFamily(localStorage, KEY, emptyFamily);
} catch (e) {
  storageError =
    "Penyimpanan tidak dapat dibaca. Data lama tidak ditimpa. Ekspor salinan pemulihan di Pengaturan. " +
    e.message;
  data = emptyFamily();
}
function toast(t) {
  $("#notice").textContent = t;
  $("#notice").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#notice").classList.remove("show"), 4200);
}
async function commit(next, action, allowRecovery = false) {
  try {
    validate(next);
    if (cloudSaving) throw Error("Tunggu sampai penyimpanan selesai.");
    if (cloudFamily?.role === "viewer")
      throw Error("Akses Anda hanya baca. Minta pemilik memberi peran editor.");
    if (storageError && !allowRecovery)
      throw Error("Pulihkan penyimpanan di Pengaturan sebelum mengubah data.");
    if (storageError && allowRecovery)
      localStorage.setItem(KEY + ".recovery", localStorage.getItem(KEY) || "");
    const old = JSON.stringify(data);
    next.updatedAt = new Date().toISOString();
    next.activity = [
      { id: uid(), text: action, date: next.updatedAt },
      ...(next.activity || []),
    ].slice(0, 100);
    if (cloudFamily) {
      cloudSaving = true;
      document.body.classList.add("cloud-saving");
      document
        .querySelectorAll('button[type="submit"]')
        .forEach((b) => (b.disabled = true));
      try {
        const payload = structuredClone(next);
        for (const p of payload.persons) {
          if (p.photo?.startsWith("data:image/")) {
            const raw = await fetch(p.photo),
              blob = await raw.blob();
            const up = await request("families/" + cloudFamily.id + "/photos", {
              method: "POST",
              body: blob,
              headers: { "Content-Type": blob.type },
            });
            p.photo = up.url;
          }
        }
        const result = await request("families/" + cloudFamily.id, {
          method: "PUT",
          body: JSON.stringify({
            revision: cloudFamily.revision,
            data: payload,
          }),
        });
        cloudFamily.revision = result.revision;
        next = payload;
        failedDraft = null;
      } catch (error) {
        failedDraft = structuredClone(next);
        throw error;
      } finally {
        cloudSaving = false;
        document.body.classList.remove("cloud-saving");
        document
          .querySelectorAll('button[type="submit"]')
          .forEach((b) => (b.disabled = false));
      }
    } else saveFamily(localStorage, KEY, next, data);
    undoState = old;
    data = next;
    storageError = "";
    render();
    toast(action);
    return true;
  } catch (e) {
    toast(
      e.name === "QuotaExceededError"
        ? "Penyimpanan penuh. Ekspor data, lalu perkecil foto."
        : e.message,
    );
    return false;
  }
}
const copy = () => structuredClone(data),
  person = (id) => data.persons.find((p) => p.id === id),
  name = (id) => person(id)?.name || "Tidak diketahui";
const initials = (p) =>
  p.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
const avatar = (p, size = "") =>
  `<span ${p.photo === "/demo/portraits.png" ? `style="background-image:url(/demo/portraits.png);background-size:400% 400%;background-position:${((p.photoIndex % 4) / 3) * 100}% ${(Math.floor(p.photoIndex / 4) / 3) * 100}%;"` : ""} class="avatar ${p.gender === "female" ? "rose" : "sage"} ${size}">${p.photo && p.photo !== "/demo/portraits.png" ? `<img src="${esc(p.photo)}" alt="">` : p.photo === "/demo/portraits.png" ? "" : esc(initials(p))}</span>`;
const year = (s) => (s ? s.slice(0, 4) : "—"),
  date = (s) =>
    s
      ? new Date(s + "T12:00:00").toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Belum dicatat";
function button(text, act, cls = "", extra = "") {
  return `<button class="${cls}" data-action="${act}" ${/type=/.test(extra) ? "" : 'type="button"'} ${extra}>${text}</button>`;
}
function nav() {
  return Object.entries({
    home: "Beranda",
    tree: "Pohon keluarga",
    members: "Anggota",
    stories: "Cerita",
    settings: "Pengaturan",
  })
    .map(
      ([id, label]) =>
        `<button data-tab="${id}" class="nav-item ${tab === id ? "active" : ""}"><span>${icons[id]}</span><b>${label}</b></button>`,
    )
    .join("");
}
function render() {
  const scroll = window.scrollY;
  document.body.classList.toggle("panel-open", !!selected);
  $("#app").innerHTML =
    `<aside class="sidebar" ${selected ? "inert" : ""}><a class="brand" href="#" data-tab="home"><span class="brandmark">♧</span>KinRoot<span class="brand-dot">.</span></a><button class="family-switch" data-action="cloud"><span class="mini-icon">⌂</span><div><small>RUANG KELUARGA</small><strong>${esc(data.familyName || "Keluarga saya")}</strong></div><span>⌄</span></button><nav>${nav()}</nav><div class="sidebar-bottom"><div class="privacy-mark">♧</div><strong>Akar yang menghubungkan.</strong><p>Simpan cerita hari ini untuk generasi esok.</p><small>KinRoot v${VERSION} · Preview</small></div></aside><div class="workspace" ${selected ? "inert" : ""}><header><div class="breadcrumbs">Ruang keluarga <span>/</span> <strong>${{ home: "Beranda", tree: "Pohon keluarga", members: "Anggota", stories: "Cerita keluarga", settings: "Pengaturan" }[tab]}</strong></div><div class="header-right"><span class="saved"><i></i> ${cloudFamily ? "Tersimpan di cloud" : "Tersimpan di perangkat"}</span><button class="owner" data-action="cloud" aria-label="Akun dan ruang keluarga">☁</button></div></header><main>${storageError ? `<div class="warning">${esc(storageError)}</div>` : ""}${{ home: home, tree: tree, members: members, stories: stories, settings: settings }[tab]()}</main><footer><span>Setiap keluarga punya cerita. Ini cerita kita.</span><span>KinRoot by Febro Herdyanto · <b>v${VERSION}</b></span></footer></div><nav class="mobile-nav" ${selected ? "inert" : ""}>${nav()}</nav>${selected ? panel() : ""}`;
  bind();
  if (tab === "tree") setupTree();
  window.scrollTo(0, scroll);
}
function heading(eyebrow, title, desc, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function home() {
  const g = graph(data),
    gens = new Set(g.nodes.map((n) => n.y)).size;
  const recent = [...(data.activity || [])].slice(0, 4);
  return `${heading("KELUARGA, SELALU DEKAT", "Selamat datang di rumah.", "Kenali akar, rawat hubungan, dan teruskan cerita keluarga.", button("+ Tambah anggota", "add", "primary"))}<section class="hero"><div class="hero-copy"><span class="tag light">SEBUAH CERITA LINTAS GENERASI</span><h2>Berakar dalam kasih.<br>Bertumbuh bersama.</h2><p>Nama, kenangan, dan ikatan yang menjadikan kita keluarga. Temukan semuanya dalam satu pohon.</p>${button("Jelajahi pohon keluarga <span>↗</span>", "go-tree", "cream")}</div><div class="hero-art" aria-hidden="true"><svg viewBox="0 0 460 330"><defs><pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#f7f5dc" opacity=".2"/></pattern></defs><rect width="460" height="330" fill="url(#grid)"/><g fill="none" stroke="#b9c9a5" stroke-width="2"><path d="M230 85V155H100V210M230 155H360V210M230 155V252"/><path d="M187 70H273"/></g><g fill="#e8e8c9"><rect x="135" y="40" width="67" height="65" rx="17"/><rect x="258" y="40" width="67" height="65" rx="17"/><rect x="65" y="200" width="72" height="68" rx="17"/><rect x="194" y="238" width="72" height="68" rx="17"/><rect x="325" y="200" width="72" height="68" rx="17"/></g><g fill="#446653"><circle cx="168" cy="64" r="10"/><path d="M150 92Q151 72 168 77Q185 72 187 92"/><circle cx="291" cy="64" r="10"/><path d="M273 92Q274 72 291 77Q308 72 310 92"/><circle cx="101" cy="225" r="10"/><path d="M83 252Q84 232 101 237Q118 232 120 252"/><circle cx="230" cy="263" r="10"/><path d="M212 291Q213 271 230 276Q247 271 249 291"/><circle cx="361" cy="225" r="10"/><path d="M343 252Q344 232 361 237Q378 232 380 252"/></g><circle cx="230" cy="70" r="5" fill="#d8af72"/></svg><span class="art-note">our roots, our stories</span></div></section><div class="stats"><article><span class="stat-symbol">♙</span><div><strong>${data.persons.length}<small>anggota</small></strong><p>Setiap nama, sebuah cerita</p></div></article><article><span class="stat-symbol">♧</span><div><strong>${gens}<small>generasi</small></strong><p>Terhubung lintas waktu</p></div></article><article><span class="stat-symbol">♡</span><div><strong>${data.partnerships.length}<small>pasangan</small></strong><p>Ikatan yang menyatukan</p></div></article><article><span class="stat-symbol">⌁</span><div><strong>${new Set(data.persons.map((p) => p.place).filter(Boolean)).size}<small>tempat</small></strong><p>Jejak perjalanan keluarga</p></div></article></div><div class="dashboard-grid"><section class="box"><div class="section-title"><div><span class="eyebrow">MULAI DARI AKAR</span><h2>Keluarga kita</h2></div>${button("Lihat semua ↗", "go-members", "text")}</div><div class="family-cards">${data.persons
    .slice(0, 4)
    .map((p) => memberCard(p))
    .join(
      "",
    )}</div><div class="soft-note"><span>✧</span><div><strong>Kenangan kecil, arti yang besar.</strong><p>Lengkapi profil dengan tempat lahir, foto, dan kisah hidup.</p></div></div></section><section class="box activity"><div class="section-title"><div><span class="eyebrow">JEJAK TERBARU</span><h2>Kabar keluarga</h2></div><span>◷</span></div>${recent.length ? recent.map((a) => `<div class="activity-row"><span class="activity-dot"></span><div><strong>${esc(a.text)}</strong><small>${new Date(a.date).toLocaleString("id-ID")}</small></div></div>`).join("") : `<div class="activity-row"><span class="activity-dot"></span><div><strong>Pohon pertama, cerita pertama</strong><p>Mulai tambahkan anggota dan cerita keluarga Anda.</p><small>Selamat datang di KinRoot</small></div></div>`}<div class="local-note"><span>⌑</span><p><b>Privasi dimulai di sini.</b><br>${cloudFamily ? "Data tersimpan di cloud keluarga dengan akses terbatas." : "Data di perangkat ini dapat diekspor atau disimpan dalam ruang keluarga cloud."}</p></div>${button("Cadangkan data ↗", "export", "text")}</section></div>`;
}
function memberCard(p) {
  return `<button class="member-card" data-person="${esc(p.id)}">${avatar(p)}<strong>${esc(p.name)}</strong><span>${year(p.birth)}${p.death ? " – " + year(p.death) : ""}</span><small>${esc(p.place || "Lokasi belum dicatat")}</small></button>`;
}
function members() {
  const list = data.persons.filter(
    (p) =>
      (p.name + " " + p.place + " " + p.id)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (sex === "all" || p.gender === sex),
  );
  return `${heading("ORANG-ORANG TERDEKAT", "Setiap nama punya cerita.", "Kenali orang-orang yang membentuk keluarga kita.", button("+ Tambah anggota", "add", "primary"))}<div class="filterbar"><label class="search"><span>⌕</span><input id="member-search" aria-label="Cari anggota" placeholder="Cari nama, kode, atau tempat…" value="${esc(search)}"></label><select id="sex-filter" aria-label="Filter anggota"><option value="all">Semua anggota</option><option value="male" ${sex === "male" ? "selected" : ""}>Laki-laki</option><option value="female" ${sex === "female" ? "selected" : ""}>Perempuan</option><option value="unknown" ${sex === "unknown" ? "selected" : ""}>Tidak dicatat</option></select><span>${list.length} anggota</span></div><div class="members-grid">${list.map(memberCard).join("") || '<div class="empty">Belum ada anggota yang cocok. Coba pencarian lain atau tambahkan anggota.</div>'}</div>`;
}
function legend() {
  return `<div class="legend">${[["marriage", "Pernikahan"], ...Object.entries(TYPES)].map(([t, l]) => `<span><i class="line ${t}"></i>${l}</span>`).join("")}<span><i class="line cousin"></i>Pernikahan sepupu</span><span><i class="line nonmarital"></i>Pasangan nonnikah</span></div>`;
}
function tree() {
  const g = graph(data);
  return `${heading("LIHAT HUBUNGAN, TEMUKAN AKAR", "Pohon keluarga", "Satu pohon. Banyak cerita. Semua terhubung.", button("+ Hubungan", "relationship", "secondary") + button("+ Anggota", "add", "primary"))}<section class="tree-shell"><div class="tree-toolbar"><div><span class="tree-badge">♧</span><strong>${esc(data.familyName)}</strong><small>${data.persons.length} anggota · ${new Set(g.nodes.map((n) => n.y)).size} generasi</small></div><div>${button("☷ Legenda", "legend", "subtle")}${button("↓ SVG", "svg", "subtle")}${button("Cetak", "print", "subtle")}</div></div><div class="tree-viewport" id="viewport" tabindex="0" aria-label="Pohon keluarga interaktif. Tombol panah untuk geser, plus minus untuk zoom."><div class="tree-stage" id="stage" style="width:${g.width}px;height:${g.height}px"><svg class="connections" width="${g.width}" height="${g.height}" role="img" aria-label="Hubungan keluarga">${g.edges.map((e) => `<g><title>${esc(e.label || TYPES[e.type] || "Hubungan")} ${esc((e.from || []).map(name).join(" dan "))}${e.to ? " → " + esc(name(e.to)) : ""}</title><path data-edge="${esc(e.id)}" class="edge ${e.type}" d="${e.points.map((p, i) => (i ? "L" : "M") + p.join(" ")).join(" ")}"/>${e.kind === "partner" ? `<circle cx="${e.mid[0]}" cy="${e.mid[1]}" r="4" fill="${e.type === "cousin" ? "#af5c54" : "#a17a50"}"/>` : ""}${e.cross ? `<text x="${e.mid[0]}" y="${e.mid[1] - 8}" text-anchor="middle" font-size="10" fill="#8c6a4c">${esc((e.from || []).map(name).join(" & "))}</text>` : ""}</g>`).join("")}</svg>${g.nodes.map((p) => `<button data-person="${esc(p.id)}" class="tree-card ${p.death ? "deceased" : ""}" style="left:${p.x}px;top:${p.y}px">${avatar(p, "small")}<div><strong>${esc(p.name)}</strong><span>${year(p.birth)}${p.death ? " – " + year(p.death) : ""}</span><small>${esc(personSubtitle(p))}</small></div></button>${data.parentChild.some(r=>r.childId===p.id&&r.type==="step") ? `<div class="step-note" style="left:${p.x - 10}px;top:${p.y + 100}px">${esc(stepOriginNote(data,p))}</div>` : ""}`).join("")}</div>${!data.persons.length ? '<div class="empty">Pohon masih kosong. Tambahkan anggota pertama Anda.</div>' : ""}<div class="tree-hint">Geser untuk menjelajah · cubit untuk zoom</div><div class="zoom-controls">${button("−", "zoom-out", "", 'aria-label="Perkecil"')}<output id="zoom-label">100%</output>${button("+", "zoom-in", "", 'aria-label="Perbesar"')}${button("⛶", "fit", "", 'aria-label="Sesuaikan pohon"')}</div></div>${showLegend ? legend() : ""}</section><div class="tree-explainer"><span class="round-info">i</span><p><b>Hubungan yang jelas, cerita yang tepat.</b> Garis hijau dari tengah pasangan hanya untuk anak biologis keduanya. Hubungan biologis satu orang tua tetap tercatat di profil.${g.complex ? " Beberapa pasangan atau hubungan sepupu ditampilkan sebagai tautan silang; periksa daftar hubungan untuk rincian." : ""}</p>${button("Kelola hubungan ↗", "relationships", "text")}</div>`;
}
function stories() {
  const list = data.persons.filter((p) => p.bio || p.notes);
  return `${heading("WARISAN YANG HIDUP", "Cerita keluarga", "Hal-hal yang tak tertulis di garis keturunan.", button("Tulis cerita", "story-add", "primary"))}<div class="stories-grid">${list.map((p) => `<article class="box story"><div class="story-author">${avatar(p, "small")}<div><strong>${esc(p.name)}</strong><small>${esc(p.place || "Kisah keluarga")}</small></div></div><h2>${esc(p.name)} dan jejaknya</h2><p>${esc(p.bio || p.notes)}</p>${p.bio && p.notes ? `<p>${esc(p.notes)}</p>` : ""}${button("Buka profil ↗", "open-" + p.id, "text")}</article>`).join("") || '<div class="empty">Belum ada cerita. Tambahkan biografi atau kenangan di profil anggota.</div>'}</div>`;
}
function settings() {
  return (
    cloudSettings() +
    `${heading("RUANG UNTUK MERAWAT", "Pengaturan keluarga", "Kelola identitas keluarga dan jaga salinan cerita Anda.")}<div class="settings-grid"><section class="box"><h2>Identitas keluarga</h2><form id="family-form"><label>Nama keluarga<input name="familyName" value="${esc(data.familyName)}" maxlength="80" required></label>${button("Simpan perubahan", "submit", "primary", 'type="submit"')}</form><div class="divider"></div><h2>Penyimpanan & privasi</h2><p>${cloudFamily ? "Ruang ini tersimpan di cloud. Pemilik mengatur editor dan viewer; perubahan disimpan setelah dikonfirmasi server." : "Data di perangkat ini belum disinkronkan. Buat atau buka ruang keluarga cloud untuk mengakses data lintas perangkat."}</p><p>Terakhir disimpan: <b>${data.updatedAt ? new Date(data.updatedAt).toLocaleString("id-ID") : "—"}</b></p>${button("↶ Batalkan perubahan terakhir", "undo", "secondary", undoState ? "" : "disabled")}<div class="divider"></div><h2>KinRoot <span class="tag">v${VERSION}</span></h2><p>Rilis greenfield pertama. Pohon interaktif, profil, hubungan eksplisit, cerita, dan cadangan data.</p>${button("Baca catatan rilis ↗", "release", "text")}</section><section class="box"><h2>Cadangan & pemulihan</h2><p>Ekspor berkas JSON untuk cadangan lengkap, termasuk foto dan hubungan. Impor memvalidasi ID dan siklus leluhur sebelum mengganti data.</p><div class="stack-actions">${button("↓ Ekspor cadangan JSON", "export", "primary")}${button("↑ Impor cadangan", "import", "secondary")}${button("↓ Ekspor daftar CSV", "csv", "secondary")}${button("↶ Pulihkan cadangan sebelumnya", "restore", "secondary")}${storageError ? button("Unduh data mentah untuk pemulihan", "raw", "secondary") : ""}</div><div class="divider"></div><h2>Mulai dengan keluarga sendiri</h2><p>Mulai dengan catatan kosong. Cadangkan data sebelum memulai.</p>${button("Buat keluarga kosong", "clear", "danger")}</section></div><input type="file" id="import-file" accept=".json,application/json" hidden>`
  );
}
function profile(p) {
  const parents = data.parentChild.filter((r) => r.childId === p.id),
    children = data.parentChild.filter((r) => r.parentId === p.id),
    partners = data.partnerships.filter(
      (r) => r.personA === p.id || r.personB === p.id,
    );
  return `<div class="profile-top">${avatar(p, "large")}<span class="tag">${p.death ? "Dalam kenangan" : "Anggota keluarga"}</span><h2>${esc(p.name)}</h2><p>${esc(p.occupation || p.place || "Setiap nama punya cerita")}</p></div><div class="profile-actions">${button("Edit profil", "edit", "primary")}${button("+ Hubungan", "person-rel", "secondary")}</div><div class="profile-facts"><div><small>TANGGAL LAHIR</small><strong>${date(p.birth)}</strong></div><div><small>TEMPAT LAHIR</small><strong>${esc(p.place || "Belum dicatat")}</strong></div><div><small>JENIS KELAMIN</small><strong>${{ male: "Laki-laki", female: "Perempuan", unknown: "Tidak dicatat" }[p.gender] || "Tidak dicatat"}</strong></div>${p.death ? `<div><small>TANGGAL WAFAT</small><strong>${date(p.death)}</strong></div>` : ""}</div>${p.bio ? `<section><h3>Kisah hidup</h3><p class="preline">${esc(p.bio)}</p></section>` : ""}${p.notes ? `<section><h3>Kenangan & catatan</h3><p class="preline">${esc(p.notes)}</p></section>` : ""}<section><h3>Hubungan keluarga</h3>${partners.map((r) => relRow(r, r.personA === p.id ? r.personB : r.personA, r.type === "cousin" ? "Pasangan · sepupu" : r.type === "nonmarital" ? "Pasangan nonnikah" : "Pasangan", r.status === "former" ? "Hubungan sebelumnya" : r.status === "widowed" ? "Ditinggal wafat" : date(r.date))).join("")}${parents.map((r) => relRow(r, r.parentId, "Orang tua · " + TYPES[r.type], r.status === "unconfirmed" ? "Belum dikonfirmasi" : "Terkonfirmasi")).join("")}${children.map((r) => relRow(r, r.childId, "Anak · " + TYPES[r.type], r.status === "unconfirmed" ? "Belum dikonfirmasi" : "Terkonfirmasi")).join("")}${!partners.length && !parents.length && !children.length ? "<p>Belum ada hubungan. Tambahkan secara eksplisit; pasangan tidak otomatis menjadi orang tua.</p>" : ""}${parents.filter((r) => r.type === "biological" && r.status === "confirmed").length === 1 ? '<div class="soft-note">Orang tua biologis lainnya belum diketahui.</div>' : ""}</section>${button("Hapus anggota", "delete-person", "text danger-text")}`;
}
function relRow(r, id, label, sub) {
  const p = person(id);
  return `<div class="relation-row"><button class="relation-person" data-person="${esc(id)}">${avatar(p, "small")}<span><strong>${esc(p.name)}</strong><small>${esc(label)}<br>${esc(sub)}</small></span></button>${button("✎", "edit-rel-" + r.id, "icon-button", `aria-label="Edit hubungan ${esc(label)}"`)}${button("×", "delete-rel-" + r.id, "icon-button", `aria-label="Hapus hubungan ${esc(label)}"`)}</div>`;
}
let relEdit = null,
  relDefault = null,
  photoDraft = null;
function panel() {
  let title = "Profil anggota",
    content = "";
  if (mode === "cloud") {
    title = "Ruang keluarga & akun";
    content = cloudPanel();
    return `<div class="panel-backdrop" data-action="close"></div><section class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="panel-title"><div class="panel-header"><h2 id="panel-title">${title}</h2>${button("×", "close", "icon-button", 'aria-label="Tutup"')}</div><div class="panel-body">${content}</div></section>`;
  }
  if (mode === "profile") content = profile(person(selected));
  else if (mode === "edit" || mode === "add") {
    title = mode === "add" ? "Tambah anggota" : "Edit anggota";
    content = personForm(mode === "add" ? null : person(selected));
  } else if (mode === "rel") {
    title = relEdit ? "Edit hubungan" : "Tambah hubungan";
    content = relForm();
  } else if (mode === "relationships") {
    title = "Hubungan keluarga";
    content = `<p>Semua hubungan dicatat secara eksplisit. Pernikahan tidak mengasumsikan hubungan biologis.</p>${button("+ Tambah hubungan", "relationship", "primary")}<h3>Pasangan (${data.partnerships.length})</h3>${data.partnerships.map((r) => `<div class="managed-rel"><strong>${esc(name(r.personA))} & ${esc(name(r.personB))}</strong><small>${esc(r.type)} · ${esc(r.status)}</small><div>${button("Edit", "edit-rel-" + r.id, "text")}${button("Hapus", "delete-rel-" + r.id, "text danger-text")}</div></div>`).join("")}<h3>Orang tua–anak (${data.parentChild.length})</h3>${data.parentChild.map((r) => `<div class="managed-rel"><strong>${esc(name(r.parentId))} → ${esc(name(r.childId))}</strong><small>${TYPES[r.type]} · ${r.status === "confirmed" ? "Terkonfirmasi" : "Belum dikonfirmasi"}</small><div>${button("Edit", "edit-rel-" + r.id, "text")}${button("Hapus", "delete-rel-" + r.id, "text danger-text")}</div></div>`).join("")}`;
  } else if (mode === "release") {
    title = "Catatan rilis";
    content = `<span class="tag">v0.2.1 · 29 Oktober 2026</span><h2>Satu keluarga, ruang bersama.</h2><p>Ruang keluarga dengan akun, kolaborasi dan data awal kosong.</p><ul><li>Beranda, anggota, profil, biografi dan foto.</li><li>Pohon SVG interaktif: geser, cubit, zoom dan sesuaikan.</li><li>Hubungan biologis, tiri, adopsi, perwalian dan belum dikonfirmasi.</li><li>Pasangan, hubungan sebelumnya, dan pernikahan sepupu tanpa menduplikasi anggota.</li><li>Validasi siklus biologis dan referensi ID.</li><li>Cadangan JSON, impor tervalidasi, CSV dan ekspor SVG.</li><li>Ruang cloud D1, foto privat R2, peran owner/editor/viewer dan undangan.</li><li>Data awal kosong dan formulir dengan placeholder netral.</li></ul><h3>Batas rilis</h3><p>Ruang cloud mendukung akun ChatGPT, kolaborasi dan undangan. Google/Apple mengikuti autentikasi ChatGPT milik host. Diagram kompleks dapat memiliki garis silang; daftar hubungan dan profil adalah sumber fakta yang lengkap. Pasangan dengan beberapa hubungan ditampilkan sekali dengan tautan silang. Safari iPhone fisik belum diuji; tinjauan Anda diperlukan.</p>`;
  }
  return `<div class="panel-backdrop" data-action="close"></div><section class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="panel-title"><div class="panel-header"><h2 id="panel-title">${title}</h2>${button("×", "close", "icon-button", 'aria-label="Tutup"')}</div><div class="panel-body">${content}</div></section>`;
}
function field(label, name, value = "", type = "text", extra = "") {
  return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function personForm(p) {
  return `<form id="person-form"><div class="form-intro">${p ? avatar(p) : '<span class="avatar large sage">+</span>'}<p>Mulai dengan nama. Cerita lainnya bisa menyusul.</p></div>${field("Nama lengkap *", "name", p?.name || "", "text", 'required maxlength="120"')}<div class="form-row">${field("Tanggal lahir", "birth", p?.birth || "", "date")}${field("Tanggal wafat", "death", p?.death || "", "date")}</div>${field("Tempat lahir", "place", p?.place || "", "text", 'maxlength="150"')}<label>Jenis kelamin<select name="gender">${[
    ["unknown", "Tidak dicatat"],
    ["male", "Laki-laki"],
    ["female", "Perempuan"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${p?.gender === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></label>${field("Pekerjaan", "occupation", p?.occupation || "", "text", 'maxlength="150"')}<label>Foto profil <small>PNG / JPEG / WebP · maks. 2 MB; diperkecil secara lokal</small><input type="file" id="photo-file" accept="image/png,image/jpeg,image/webp"></label>${button("Hapus foto", "remove-photo", "text")}<label>Kisah hidup<textarea name="bio" maxlength="5000" rows="4">${esc(p?.bio || "")}</textarea></label><label>Kenangan & catatan<textarea name="notes" maxlength="5000" rows="3">${esc(p?.notes || "")}</textarea></label><div class="form-error" role="alert"></div><div class="form-actions">${button("Simpan anggota", "submit", "primary", 'type="submit"')}${button("Batal", "close", "secondary", 'type="button"')}</div></form>`;
}
function relForm() {
  const r = relEdit,
    partner = r && "personA" in r;
  return `<form id="rel-form"><p>Hubungan biologis hanya dibuat bila Anda memilihnya secara eksplisit. Pasangan baru tidak otomatis menjadi orang tua.</p><label>Kategori<select name="category" id="rel-category"><option value="parent" ${!partner ? "selected" : ""}>Orang tua → anak</option><option value="partner" ${partner ? "selected" : ""}>Pasangan</option></select></label><div class="form-row"><label><span id="source-label">${partner ? "Anggota pertama" : "Orang tua"}</span><select name="source" required>${personOptions(r?.personA || r?.parentId || relDefault)}</select></label><label><span id="target-label">${partner ? "Anggota kedua" : "Anak"}</span><select name="target" required>${personOptions(r?.personB || r?.childId)}</select></label></div><label>Jenis hubungan<select name="type" id="rel-type">${typeOptions(partner ? "partner" : "parent", r?.type)}</select></label><label>Status<select name="status" id="rel-status">${statusOptions(partner ? "partner" : "parent", r?.status)}</select></label>${field("Tanggal hubungan (opsional)", "date", r?.date || "", "date")}<label>Catatan<textarea name="note" maxlength="2000" rows="3">${esc(r?.note || "")}</textarea></label><div class="form-error" role="alert"></div><div class="form-actions">${button("Simpan hubungan", "submit", "primary", 'type="submit"')}${button("Batal", "close", "secondary", 'type="button"')}</div></form>`;
}
function personOptions(id) {
  return (
    '<option value="">Pilih anggota…</option>' +
    data.persons
      .map(
        (p) =>
          `<option value="${esc(p.id)}" ${p.id === id ? "selected" : ""}>${esc(p.name)}${p.birth?" · "+year(p.birth):""}</option>`,
      )
      .join("")
  );
}
function typeOptions(c, t) {
  return Object.entries(
    c === "partner"
      ? {
          marriage: "Pernikahan",
          nonmarital: "Pasangan nonnikah",
          cousin: "Pernikahan sepupu",
        }
      : TYPES,
  )
    .map(
      ([v, l]) =>
        `<option value="${v}" ${v === t ? "selected" : ""}>${l}</option>`,
    )
    .join("");
}
function statusOptions(c, t) {
  return Object.entries(
    c === "partner"
      ? {
          current: "Saat ini",
          former: "Hubungan sebelumnya",
          widowed: "Ditinggal wafat",
        }
      : { confirmed: "Terkonfirmasi", unconfirmed: "Belum dikonfirmasi" },
  )
    .map(
      ([v, l]) =>
        `<option value="${v}" ${v === t ? "selected" : ""}>${l}</option>`,
    )
    .join("");
}
function openPerson(id) {
  selected = id;
  mode = "profile";
  photoDraft = null;
  render();
  focusPanel();
}
function focusPanel() {
  requestAnimationFrame(() =>
    $(".detail-panel button, .detail-panel input")?.focus(),
  );
}
function download(content, filename, type) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(new Blob([content], { type }));
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function backup() {
  const exported = structuredClone(data);
  try {
    for (const p of exported.persons) {
      if (p.photo?.startsWith("/api/cloud/photos/")) {
        const response = await fetch(p.photo);
        if (!response.ok) throw Error("Foto cloud tidak dapat diekspor.");
        const blob = await response.blob();
        p.photo = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    }
  } catch (e) {
    toast(e.message);
    return;
  }
  download(
    JSON.stringify(exported, null, 2),
    "KinRoot-"+VERSION+"-" + new Date().toISOString().slice(0, 10) + ".json",
    "application/json",
  );
  toast("Cadangan JSON diunduh.");
}
function navigate(t) {
  selected = null;
  tab = t;
  view = { x: 0, y: 0, z: 1 };
  render();
  if (t === "tree") {
    fit();
    const el = $("#viewport");
    if (el.clientWidth < 600) {
      view = { x: -40, y: -40, z: 0.75 };
      applyView();
    }
  }
  window.scrollTo(0, 0);
}
function ask(title, text, yes) {
  const dlg = document.createElement("dialog");
  dlg.className = "confirm-dialog";
  dlg.innerHTML = `<h2>${esc(title)}</h2><p>${esc(text)}</p><div>${button("Batal", "cancel", "secondary")}${button("Lanjutkan", "confirm", "danger")}</div>`;
  document.body.append(dlg);
  dlg.querySelector('[data-action="cancel"]').onclick = () => dlg.close();
  dlg.querySelector('[data-action="confirm"]').onclick = () => {
    dlg.close();
    yes();
  };
  dlg.onclose = () => dlg.remove();
  dlg.showModal();
}
function bind() {
  bindCloud();
  document.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.preventDefault();
        navigate(b.dataset.tab);
      }),
  );
  document.querySelectorAll("[data-person]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!dragMoved) openPerson(b.dataset.person);
      }),
  );
  document.querySelectorAll("[data-action]").forEach((b) => {
    if (["submit", "cancel", "confirm"].includes(b.dataset.action)) return;
    b.onclick = () => act(b.dataset.action);
  });
  $("#member-search")?.addEventListener("input", (e) => {
    const pos = e.target.selectionStart;
    search = e.target.value;
    render();
    $("#member-search").focus();
    $("#member-search").setSelectionRange(pos, pos);
  });
  $("#sex-filter")?.addEventListener("change", (e) => {
    sex = e.target.value;
    render();
  });
  $("#family-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const n = copy();
    n.familyName = new FormData(e.target).get("familyName").trim();
    if (n.familyName) commit(n, "Nama keluarga diperbarui");
  });
  $("#person-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)),
      n = copy();
    const old = mode === "edit" ? person(selected) : null;
    const p = {
      ...old,
      ...f,
      name: f.name.trim(),
      id: old?.id || uid(),
      photo: photoDraft === null ? old?.photo || "" : photoDraft,
    };
    delete p.undefined;
    if (!p.name) {
      $(".form-error").textContent = "Nama wajib diisi.";
      return;
    }
    if (old) n.persons = n.persons.map((x) => (x.id === p.id ? p : x));
    else n.persons.push(p);
    try {
      validate(n);
    } catch (err) {
      $(".form-error").textContent = err.message;
      return;
    }
    if (await commit(n, old ? "Profil diperbarui" : "Anggota baru ditambahkan"))
      openPerson(p.id);
  });
  $("#photo-file")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (
      file.size > 2 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      toast("Pilih foto PNG/JPEG/WebP dengan ukuran maksimal 2 MB.");
      e.target.value = "";
      return;
    }
    try {
      const bitmap = await createImageBitmap(file),
        canvas = document.createElement("canvas"),
        scale = Math.min(1, 400 / Math.max(bitmap.width, bitmap.height));
      canvas.width = bitmap.width * scale;
      canvas.height = bitmap.height * scale;
      canvas
        .getContext("2d")
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      photoDraft = canvas.toDataURL("image/jpeg", 0.8);
      bitmap.close();
      toast("Foto siap disimpan bersama profil.");
    } catch {
      toast("Foto tidak dapat dibaca. Coba berkas lain.");
    }
  });
  $("#rel-category")?.addEventListener("change", (e) => {
    const c = e.target.value;
    $("#rel-type").innerHTML = typeOptions(c);
    $("#rel-status").innerHTML = statusOptions(c);
    $("#source-label").textContent =
      c === "partner" ? "Anggota pertama" : "Orang tua";
    $("#target-label").textContent = c === "partner" ? "Anggota kedua" : "Anak";
  });
  $("#rel-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)),
      n = copy(),
      id = relEdit?.id || uid();
    n.partnerships = n.partnerships.filter((r) => r.id !== id);
    n.parentChild = n.parentChild.filter((r) => r.id !== id);
    if (f.category === "partner")
      n.partnerships.push({
        id,
        personA: f.source,
        personB: f.target,
        type: f.type,
        status: f.status,
        date: f.date,
        note: f.note,
      });
    else
      n.parentChild.push({
        id,
        parentId: f.source,
        childId: f.target,
        type: f.type,
        status: f.status,
        date: f.date,
        note: f.note,
      });
    try {
      validate(n);
    } catch (err) {
      $(".form-error").textContent = err.message;
      return;
    }
    selected = "relationships";
    mode = "relationships";
    commit(n, "Hubungan keluarga disimpan");
  });
  $("#import-file")?.addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast("Maksimum ukuran cadangan 8 MB.");
      return;
    }
    try {
      const n = validate(JSON.parse(await f.text()));
      ask(
        "Impor keluarga?",
        `${n.persons.length} anggota dan ${n.parentChild.length + n.partnerships.length} hubungan akan mengganti keluarga saat ini. Cadangan otomatis disimpan sebelum perubahan.`,
        () => commit(n, "Cadangan keluarga diimpor", true),
      );
    } catch (err) {
      toast("Impor ditolak: " + err.message);
    } finally {
      e.target.value = "";
    }
  });
}
async function act(a) {
  if (await cloudAction(a)) return;
  if (a.startsWith("go-")) return navigate(a.slice(3));
  if (a.startsWith("open-")) return openPerson(a.slice(5));
  if (a.startsWith("edit-rel-")) {
    const id = a.slice(9);
    relEdit = [...data.partnerships, ...data.parentChild].find(
      (r) => r.id === id,
    );
    mode = "rel";
    selected = "relation";
    render();
    focusPanel();
    return;
  }
  if (a.startsWith("delete-rel-")) {
    const id = a.slice(11);
    ask(
      "Hapus hubungan?",
      "Hanya hubungan ini yang dihapus. Catatan anggota tetap ada.",
      () => {
        const n = copy();
        n.partnerships = n.partnerships.filter((r) => r.id !== id);
        n.parentChild = n.parentChild.filter((r) => r.id !== id);
        commit(n, "Hubungan dihapus");
      },
    );
    return;
  }
  switch (a) {
    case "close":
      selected = null;
      render();
      break;
    case "add":
      selected = "new";
      mode = "add";
      photoDraft = null;
      render();
      focusPanel();
      break;
    case "edit":
      mode = "edit";
      photoDraft = null;
      render();
      focusPanel();
      break;
    case "story-add":
      navigate("members");
      toast("Pilih anggota, lalu Edit profil untuk menulis kisah hidup.");
      break;
    case "person-rel":
      relDefault = selected;
      relEdit = null;
      selected = "relation";
      mode = "rel";
      render();
      focusPanel();
      break;
    case "relationship":
      relDefault = null;
      relEdit = null;
      selected = "relation";
      mode = "rel";
      render();
      focusPanel();
      break;
    case "relationships":
      selected = "relationships";
      mode = "relationships";
      render();
      focusPanel();
      break;
    case "remove-photo":
      photoDraft = "";
      toast("Foto akan dihapus saat profil disimpan.");
      break;
    case "delete-person": {
      const id = selected;
      ask(
        "Hapus " + name(id) + "?",
        "Anggota beserta semua hubungan yang melibatkannya akan dihapus. Perubahan terakhir dapat dibatalkan di Pengaturan.",
        () => {
          selected = null;
          commit(removePerson(copy(), id), "Anggota dihapus");
        },
      );
      break;
    }
    case "legend":
      showLegend = !showLegend;
      render();
      break;
    case "fit":
      fit();
      break;
    case "zoom-in":
      zoom(1.2);
      break;
    case "zoom-out":
      zoom(1 / 1.2);
      break;
    case "export":
      backup();
      break;
    case "import":
      $("#import-file").click();
      break;
    case "csv": {
      const rows = [
        [
          "ID",
          "Nama",
          "Lahir",
          "Wafat",
          "Tempat",
          "Jenis kelamin",
          "Pekerjaan",
        ],
        ...data.persons.map((p) => [
          p.id,
          p.name,
          p.birth,
          p.death,
          p.place,
          p.gender,
          p.occupation,
        ]),
      ];
      download(
        "\uFEFF" +
          rows
            .map((r) =>
              r
                .map(
                  (c) =>
                    '"' +
                    String(c ?? "")
                      .replace(/^[=+@-]/, "'$&")
                      .replace(/"/g, '""') +
                    '"',
                )
                .join(","),
            )
            .join("\r\n"),
        "KinRoot-anggota.csv",
        "text/csv;charset=utf-8",
      );
      break;
    }
    case "svg":
      exportSvg();
      break;
    case "print":
      window.print();
      break;
    case "undo":
      if (undoState) {
        const n = JSON.parse(undoState);
        if (await commit(n, "Perubahan terakhir dibatalkan")) undoState = null;
      }
      break;
    case "restore": {
      let raw;
      try {
        if (cloudFamily)
          throw Error(
            "Untuk ruang cloud, gunakan Batalkan perubahan terakhir atau impor cadangan JSON.",
          );
        raw = localStorage.getItem(BACKUP);
        if (!raw) throw Error("Belum ada cadangan sebelumnya.");
        const n = validate(JSON.parse(raw));
        ask(
          "Pulihkan cadangan?",
          `${n.persons.length} anggota akan dipulihkan.`,
          () => {
            storageError = "";
            commit(n, "Cadangan sebelumnya dipulihkan");
          },
        );
      } catch (e) {
        toast(e.message);
      }
      break;
    }
    case "clear":
    case "reset":
      ask(
        a === "clear" ? "Mulai keluarga kosong?" : "Mulai keluarga kosong?",
        "Data saat ini akan diganti. Ekspor cadangan lebih dahulu bila diperlukan.",
        () => {
          const n =
            a === "reset"
              ? emptyFamily()
              : {
                  schemaVersion: 3,
                  appVersion: VERSION,
                  familyName: "Keluarga saya",
                  persons: [],
                  partnerships: [],
                  parentChild: [],
                  activity: [],
                };
          selected = null;
          commit(
            n,
            a === "reset" ? "Keluarga baru dibuat" : "Keluarga baru dibuat",
          );
        },
      );
      break;
    case "raw":
      try {
        download(
          localStorage.getItem(KEY) || "",
          "KinRoot-recovery.txt",
          "text/plain",
        );
      } catch (e) {
        toast(e.message);
      }
      break;
    case "release":
      selected = "release";
      mode = "release";
      render();
      focusPanel();
      break;
  }
}
let dragMoved = false;
function applyView() {
  if (!$("#stage")) return;
  $("#stage").style.transform =
    `translate(${view.x}px,${view.y}px) scale(${view.z})`;
  $("#zoom-label").textContent = Math.round(view.z * 100) + "%";
}
function fit() {
  const el = $("#viewport");
  if (!el) return;
  const g = graph(data),
    z = Math.min(
      1.2,
      (el.clientWidth - 40) / g.width,
      (el.clientHeight - 50) / g.height,
    );
  view = {
    z: Math.max(0.12, z),
    x: (el.clientWidth - g.width * z) / 2,
    y: (el.clientHeight - g.height * z) / 2,
  };
  applyView();
}
function zoom(factor, cx, cy) {
  const el = $("#viewport");
  if (!el) return;
  cx ??= el.clientWidth / 2;
  cy ??= el.clientHeight / 2;
  const z = Math.max(0.12, Math.min(2.5, view.z * factor)),
    r = z / view.z;
  view.x = cx - (cx - view.x) * r;
  view.y = cy - (cy - view.y) * r;
  view.z = z;
  applyView();
}
function setupTree() {
  applyView();
  const el = $("#viewport"),
    pointers = new Map();
  let previous = null;
  function state() {
    const p = [...pointers.values()];
    return {
      x: p.reduce((s, p) => s + p.x, 0) / p.length,
      y: p.reduce((s, p) => s + p.y, 0) / p.length,
      dist: p.length > 1 ? Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) : 0,
    };
  }
  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".zoom-controls")) return;
    dragMoved = false;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    previous = state();
  });
  el.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const next = state(),
      dx = next.x - previous.x,
      dy = next.y - previous.y;
    if (Math.abs(dx) + Math.abs(dy) > 2 || next.dist) {
      dragMoved = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
      view.x += dx;
      view.y += dy;
      if (next.dist && previous.dist) {
        const r = el.getBoundingClientRect();
        zoom(next.dist / previous.dist, next.x - r.left, next.y - r.top);
      }
      applyView();
    }
    previous = next;
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    previous = pointers.size ? state() : null;
    setTimeout(() => {
      dragMoved = false;
    }, 50);
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener(
    "wheel",
    (e) => {
      if (e.target.closest(".zoom-controls")) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoom(Math.exp(-e.deltaY * 0.001), e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );
  el.addEventListener("keydown", (e) => {
    if (e.target !== el) return;
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "-",
        "0",
      ].includes(e.key)
    ) {
      e.preventDefault();
      if (e.key === "+") zoom(1.2);
      else if (e.key === "-") zoom(1 / 1.2);
      else if (e.key === "0") fit();
      else {
        view.x += e.key === "ArrowLeft" ? 40 : e.key === "ArrowRight" ? -40 : 0;
        view.y += e.key === "ArrowUp" ? 40 : e.key === "ArrowDown" ? -40 : 0;
        applyView();
      }
    }
  });
}
function exportSvg() {
  const g = graph(data);
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height + 90}" viewBox="0 0 ${g.width} ${g.height + 90}"><style>text{font-family:Arial,sans-serif;fill:#244c3e}.edge{fill:none;stroke-width:2.5}.biological{stroke:#42876a}.marriage{stroke:#a17a50}.nonmarital{stroke:#92968e}.step{stroke:#d28c3e;stroke-dasharray:7 5}.adoption{stroke:#8eaf64;stroke-dasharray:5 4}.guardian{stroke:#917ab0;stroke-dasharray:2 5}.unknown{stroke:#92968e;stroke-dasharray:2 4}.cousin{stroke:#af5c54;stroke-width:5}</style><rect width="100%" height="100%" fill="#f9f9f2"/>${g.edges.map((e) => `<path class="edge ${e.type}" d="${e.points.map((p, i) => (i ? "L" : "M") + p.join(" ")).join(" ")}"/>`).join("")}${g.nodes.map((n) => `<g><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="white" stroke="#d6dfd5"/><text x="${n.x + 14}" y="${n.y + 34}" font-size="16">${esc(n.name)}</text><text x="${n.x + 14}" y="${n.y + 58}" font-size="12">${year(n.birth)} · ${esc(personSubtitle(n))}</text></g>`).join("")}<text x="30" y="${g.height + 10}" font-size="12">Hijau: biologis · Oranye putus: tiri · Hijau putus: adopsi · Ungu titik: wali</text><text x="30" y="${g.height + 35}" font-size="12">Hubungan lengkap tercatat di profil. KinRoot v${VERSION}</text></svg>`;
  download(xml, "KinRoot-pohon-keluarga.svg", "image/svg+xml");
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && selected) {
    selected = null;
    render();
  }
  if (e.key === "Tab" && selected) {
    const els = [
      ...document.querySelectorAll(
        ".detail-panel button,.detail-panel input,.detail-panel select,.detail-panel textarea",
      ),
    ].filter((e) => !e.disabled);
    if (e.shiftKey && document.activeElement === els[0]) {
      e.preventDefault();
      els.at(-1)?.focus();
    } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
      e.preventDefault();
      els[0]?.focus();
    }
  }
});
window.addEventListener("storage", (e) => {
  if (!cloudFamily && e.key === KEY && e.newValue) {
    try {
      data = validate(JSON.parse(e.newValue));
      selected = null;
      render();
      toast("Data diperbarui dari tab lain.");
    } catch {
      toast("Perubahan tab lain tidak valid. Data saat ini dipertahankan.");
    }
  }
});
render();

initCloud();
function cloudSettings() {
  return `<section class="box cloud-settings"><h2>Ruang keluarga cloud</h2><p>${account ? "Masuk sebagai " + esc(account.name) + " (" + esc(account.email) + ")." : "Daftar atau masuk melalui ChatGPT. Google dan Apple tersedia di halaman autentikasi ChatGPT, bukan sebagai OAuth mandiri KinRoot."}</p>${button("Kelola akun, keluarga & undangan", "cloud", "primary")}${cloudFamily ? button("Muat versi cloud terbaru", "refresh-cloud", "secondary") : ""}${failedDraft ? button("Unduh perubahan yang gagal disimpan", "failed-draft", "danger") : ""}</section>`;
}
function cloudPanel() {
  return `<div class="account-card"><span class="avatar large sage">☁</span><h2>${account ? esc(account.name) : "Keluarga lebih dekat."}</h2><p>${account ? esc(account.email) : "Satu akun, banyak cerita keluarga. Buat ruang bersama dan ajak orang-orang terdekat."}</p>${account ? '<a class="text" href="/signout-with-chatgpt?return_to=%2F" target="_top">Keluar dari akun ↗</a>' : `<a class="primary" href="/signin-with-chatgpt?return_to=${encodeURIComponent("/" + window.top.location.search)}" target="_top">Daftar / masuk dengan ChatGPT ↗</a><div class="provider-note">Google dan Apple dapat dipilih pada halaman masuk ChatGPT. Autentikasi dikelola oleh host Work.</div>`}</div><h3>Ruang keluarga Anda</h3>${families.map((f) => `<div class="managed-rel"><strong>${esc(f.name)}</strong><small>${esc(f.role)} · revisi ${f.revision}</small>${button("Buka ruang", "open-family-" + f.id, "text")}</div>`).join("") || "<p>Belum ada ruang cloud. Buat keluarga pertama Anda.</p>"}${account ? `<div class="divider"></div><h3>Buat keluarga</h3><form id="create-cloud-form"><label>Nama keluarga<input name="name" placeholder="Ketik Nama Keluarga" maxlength="80" required></label><label>Isi awal<select name="template"><option value="empty">Kosong — mulai dari keluarga sendiri</option><option value="device">Impor data perangkat sebelumnya</option></select></label>${button("Buat ruang cloud", "submit", "primary", 'type="submit"')}</form><h3>Gabung keluarga</h3><p>Tempel tautan atau kode undangan dari pemilik keluarga.</p><form id="join-cloud-form"><label>Undangan<input name="token" value="${esc(new URLSearchParams(window.top.location.search).get("join") || "")}" placeholder="Tautan / kode undangan" required></label>${button("Gabung keluarga", "submit", "primary", 'type="submit"')}</form>` : ""}${cloudFamily ? `<div class="divider"></div><h3>Anggota ruang · ${esc(cloudFamily.name)}</h3><p>Anggota ruang adalah akun yang mendapat akses; berbeda dari orang yang dicatat dalam silsilah.</p>${cloudMembers.map((m) => `<div class="managed-rel"><strong>${esc(m.display_name)}</strong><small>${esc(m.email)} · ${esc(m.role)}</small>${cloudFamily.role === "owner" && m.role !== "owner" ? `<div>${button(m.role === "editor" ? "Jadikan viewer" : "Jadikan editor", "member-role-" + m.user_id, "text")}${button("Keluarkan", "member-remove-" + m.user_id, "text danger-text")}</div>` : ""}</div>`).join("")}${cloudFamily.role === "owner" ? `<h3>Undang anggota</h3><div class="warning">Site masih memiliki gerbang akses ChatGPT. Undangan keluarga tidak otomatis menambah izin hosting. Penerima juga perlu diberi akses Site oleh pemilik.</div><form id="invite-cloud-form"><label>Email penerima (opsional)<input type="email" name="email" placeholder="nama@example.com"></label><label>Peran<select name="role"><option value="editor">Editor — tambah dan ubah data keluarga</option><option value="viewer">Viewer — hanya melihat</option></select></label><p>Link berlaku 7 hari dan dapat dipakai satu kali. Email membatasi akun penerima; kosongkan untuk tautan bebas penerima.</p>${button("Buat tautan undangan", "submit", "primary", 'type="submit"')}</form>${lastInvite ? `<div class="invite-result"><label>Tautan undangan<input value="${esc(lastInvite)}" readonly></label>${button("Salin tautan", "copy-invite", "secondary")}</div>` : ""}<h3>Riwayat undangan</h3>${cloudInvites.map((i) => `<div class="managed-rel"><strong>${esc(i.email || "Tautan undangan")}</strong><small>${esc(i.role)} · ${i.status === "pending" && i.expires_at < new Date().toISOString() ? "expired" : esc(i.status)} · ${date(i.expires_at.slice(0, 10))}</small>${i.status === "pending" ? button("Cabut undangan", "revoke-invite-" + i.id, "text danger-text") : ""}</div>`).join("")}` : ""}` : ""}<div class="provider-note">Bagikan tautan undangan secara pribadi. Tidak ada email yang dikirim otomatis oleh KinRoot.</div>`;
}
async function initCloud() {
  try {
    const result = await request("session");
    account = result.user;
    if (account) {
      await listFamilies();
      const id = sessionStorage.getItem("kinroot.cloud.current");
      if (id && families.some((f) => f.id === id)) await loadCloud(id);
    }
  } catch (e) {
    console.info("KinRoot: cloud session unavailable; local workspace remains available.");
  }
  render();
  if (new URLSearchParams(window.top.location.search).has("join")) {
    selected = "cloud";
    mode = "cloud";
    render();
  }
}
async function listFamilies() {
  families = (await request("families")).families;
}
async function loadCloud(id) {
  if (cloudSaving) throw Error("Tunggu penyimpanan selesai.");
  const r = await request("families/" + encodeURIComponent(id));
  validate(r.family.data);
  cloudFamily = r.family;
  data = r.family.data;
  storageError = "";
  undoState = null;
  selected = null;
  sessionStorage.setItem("kinroot.cloud.current", id);
  await cloudDetails();
  render();
}
async function cloudDetails() {
  if (!cloudFamily) return;
  cloudMembers = (await request("families/" + cloudFamily.id + "/members"))
    .members;
  cloudInvites =
    cloudFamily.role === "owner"
      ? (await request("families/" + cloudFamily.id + "/invitations"))
          .invitations
      : [];
}
function bindCloud() {
  document
    .querySelectorAll("#create-cloud-form,#join-cloud-form,#invite-cloud-form")
    .forEach((form) =>
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (cloudBusy) return;
        cloudBusy = true;
        const f = Object.fromEntries(new FormData(form)),
          submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
          if (form.id === "create-cloud-form") {
            let initial = null;
            if (f.template === "device") {
              const raw = localStorage.getItem("kinroot.greenfield.v010");
              if (!raw)
                throw Error(
                  "Tidak ada keluarga v0.1.0 pada browser ini. Gunakan impor JSON setelah membuat ruang.",
                );
              initial = validate(JSON.parse(raw));
            }
            const result = await request("families", {
              method: "POST",
              body: JSON.stringify({ name: f.name, data: initial }),
            });
            await listFamilies();
            await loadCloud(result.family.id);
            toast("Ruang keluarga cloud dibuat.");
          } else if (form.id === "join-cloud-form") {
            let token = f.token.trim();
            if (token.includes("?"))
              token = new URL(token).searchParams.get("join");
            const result = await request("join/" + encodeURIComponent(token), {
              method: "POST",
              body: "{}",
            });
            await listFamilies();
            await loadCloud(result.familyId);
            window.top.history.replaceState(null, "", "/");
            toast("Anda berhasil bergabung dengan keluarga.");
          } else {
            const result = await request(
              "families/" + cloudFamily.id + "/invitations",
              { method: "POST", body: JSON.stringify(f) },
            );
            lastInvite = result.url;
            await cloudDetails();
            render();
            toast("Tautan undangan dibuat. Bagikan secara pribadi.");
          }
        } catch (error) {
          toast(error.message);
        } finally {
          cloudBusy = false;
          submit.disabled = false;
        }
      }),
    );
}
async function cloudAction(a) {
  try {
    if (a === "cloud") {
      if (account) await listFamilies();
      if (cloudFamily) await cloudDetails();
      selected = "cloud";
      mode = "cloud";
      render();
      focusPanel();
      return true;
    }
    if (a.startsWith("open-family-")) {
      await loadCloud(a.slice(12));
      toast("Ruang keluarga dimuat dari cloud.");
      return true;
    }
    if (a === "local-mode") {
      cloudFamily = null;
      sessionStorage.removeItem("kinroot.cloud.current");
      data = loadFamily(localStorage, KEY, emptyFamily);
      selected = null;
      render();
      return true;
    }
    if (a === "refresh-cloud") {
      if (cloudFamily) await loadCloud(cloudFamily.id);
      toast("Versi cloud terbaru dimuat.");
      return true;
    }
    if (a === "failed-draft") {
      download(
        JSON.stringify(failedDraft, null, 2),
        "KinRoot-unsaved-draft.json",
        "application/json",
      );
      return true;
    }
    if (a === "copy-invite") {
      try {
        await navigator.clipboard.writeText(lastInvite);
        toast("Tautan disalin.");
      } catch {
        toast("Pilih dan salin teks tautan di atas.");
      }
      return true;
    }
    if (a.startsWith("revoke-invite-")) {
      await request(
        "families/" + cloudFamily.id + "/invitations/" + a.slice(14),
        { method: "DELETE" },
      );
      await cloudDetails();
      render();
      toast("Undangan dicabut.");
      return true;
    }
    if (a.startsWith("member-role-") || a.startsWith("member-remove-")) {
      const remove = a.startsWith("member-remove-"),
        id = a.slice(remove ? 14 : 12),
        m = cloudMembers.find((m) => m.user_id === id);
      ask(
        remove ? "Keluarkan anggota ruang?" : "Ubah peran anggota?",
        remove
          ? "Akun ini akan kehilangan akses ke keluarga. Profil silsilah tidak dihapus."
          : "Peran menentukan apakah akun dapat mengubah data keluarga.",
        async () => {
          try {
            await request(
              "families/" +
                cloudFamily.id +
                "/members/" +
                encodeURIComponent(id),
              {
                method: remove ? "DELETE" : "PATCH",
                ...(remove
                  ? {}
                  : {
                      body: JSON.stringify({
                        role: m.role === "editor" ? "viewer" : "editor",
                      }),
                    }),
              },
            );
            await cloudDetails();
            render();
            toast("Akses anggota diperbarui.");
          } catch (e) {
            toast(e.message);
          }
        },
      );
      return true;
    }
  } catch (e) {
    toast(e.message);
    return true;
  }
  return false;
}
setInterval(async () => {
  if (!cloudFamily || cloudSaving || selected || document.hidden) return;
  try {
    const result = await request("families/" + cloudFamily.id);
    if (result.family.revision !== cloudFamily.revision) {
      cloudFamily = result.family;
      data = validate(result.family.data);
      undoState = null;
      render();
      toast("Perubahan anggota keluarga telah disinkronkan.");
    }
  } catch {
    /* Keep current state. Explicit writes still fail closed on removed access. */
  }
}, 15000);

