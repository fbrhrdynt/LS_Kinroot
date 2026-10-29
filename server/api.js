import { validate, uid } from "../src/domain.js";
import {
  ApiError,
  requireIdentity,
  authorize,
  checkOrigin,
  inviteAllowed,
  editableRole,
  hashToken,
  newToken,
} from "./policy.js";
export function createApi(env, getChatGPTUser) {
  const json = (v, status = 200) =>
    Response.json(v, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  const db = () => {
    if (!env.DB) throw new ApiError(503, "Penyimpanan cloud belum tersedia.");
    return env.DB;
  };
  const now = () => new Date().toISOString();
  async function bounded(req, max) {
    if (Number(req.headers.get("content-length")) > max)
      throw new ApiError(413, "Berkas terlalu besar.");
    const reader = req.body?.getReader();
    if (!reader) return new Uint8Array();
    const chunks = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel();
        throw new ApiError(413, "Berkas terlalu besar.");
      }
      chunks.push(value);
    }
    const all = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      all.set(c, offset);
      offset += c.length;
    }
    return all;
  }
  async function body(req) {
    const raw = new TextDecoder().decode(await bounded(req, 1_500_000));
    try {
      return JSON.parse(raw);
    } catch {
      throw new ApiError(400, "JSON tidak valid.");
    }
  }
  async function membership(
    family,
    user,
    roles = ["owner", "editor", "viewer"],
  ) {
    const m = await db()
      .prepare("SELECT * FROM memberships WHERE family_id=? AND user_id=?")
      .bind(family, user.userId)
      .first();
    return authorize(m, roles);
  }
  const snapshot = (row) => ({
    id: row.id,
    name: row.name,
    revision: row.revision,
    role: row.role,
    data: JSON.parse(row.data_json),
    updatedAt: row.updated_at,
  });
  return async function api(req) {
    try {
      checkOrigin(req);
      const url = new URL(req.url),
        p = url.pathname
          .replace(/^\/api\/cloud\/?/, "")
          .split("/")
          .filter(Boolean),
        method = req.method,
        user = await getChatGPTUser();
      if (p[0] === "session" && method === "GET")
        return json({
          user: user
            ? { id: user.userId, name: user.displayName, email: user.email }
            : null,
          auth: "chatgpt",
          directOAuth: false,
        });
      requireIdentity(user);
      if (p[0] === "families" && p.length === 1) {
        if (method === "GET") {
          const r = await db()
            .prepare(
              "SELECT f.id,f.name,f.revision,f.updated_at,m.role FROM families f JOIN memberships m ON m.family_id=f.id WHERE m.user_id=? ORDER BY f.updated_at DESC",
            )
            .bind(user.userId)
            .all();
          return json({ families: r.results });
        }
        if (method === "POST") {
          const b = await body(req),
            name = String(b.name || "")
              .trim()
              .slice(0, 80);
          if (!name) throw new ApiError(400, "Nama keluarga wajib diisi.");
          const count = await db()
            .prepare("SELECT COUNT(*) AS n FROM families WHERE owner_id=?")
            .bind(user.userId)
            .first("n");
          if (Number(count) >= 20)
            throw new ApiError(400, "Maksimum 20 keluarga per pemilik.");
          const id = uid(),
            stamp = now(),
            data = b.data
              ? validate(b.data)
              : {
                  schemaVersion: 3,
                  appVersion: "0.2.1",
                  familyName: name,
                  persons: [],
                  parentChild: [],
                  partnerships: [],
                  activity: [],
                };
          data.familyName = name;
          data.updatedAt = stamp;
          await db().batch([
            db()
              .prepare(
                "INSERT INTO families(id,name,owner_id,data_json,revision,updated_at) VALUES(?,?,?,?,1,?)",
              )
              .bind(id, name, user.userId, JSON.stringify(data), stamp),
            db()
              .prepare(
                "INSERT INTO memberships(family_id,user_id,role,email,display_name,joined_at) VALUES(?,?,?,?,?,?)",
              )
              .bind(
                id,
                user.userId,
                "owner",
                user.email.toLowerCase(),
                user.displayName,
                stamp,
              ),
          ]);
          return json(
            {
              family: {
                id,
                name,
                revision: 1,
                role: "owner",
                data,
                updatedAt: stamp,
              },
            },
            201,
          );
        }
      }
      if (p[0] === "families" && p[1]) {
        const id = p[1];
        if (p.length === 2) {
          const m = await membership(id, user);
          if (method === "GET") {
            const r = await db()
              .prepare("SELECT * FROM families WHERE id=?")
              .bind(id)
              .first();
            return json({ family: snapshot({ ...r, role: m.role }) });
          }
          if (method === "PUT") {
            authorize(m, ["owner", "editor"]);
            const b = await body(req);
            validate(b.data);
            if (!Number.isInteger(b.revision))
              throw new ApiError(400, "Revisi wajib disertakan.");
            const r = await db()
              .prepare(
                "UPDATE families SET name=?,data_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
              )
              .bind(
                String(b.data.familyName || "Keluarga").slice(0, 80),
                JSON.stringify(b.data),
                now(),
                id,
                b.revision,
              )
              .run();
            if (!r.meta.changes)
              throw new ApiError(
                409,
                "Keluarga telah diperbarui anggota lain. Muat versi terbaru sebelum menyimpan ulang.",
              );
            return json({ revision: b.revision + 1 });
          }
        }
        if (p[2] === "members") {
          const m = await membership(id, user);
          if (method === "GET") {
            const r = await db()
              .prepare(
                "SELECT user_id,role,email,display_name,joined_at FROM memberships WHERE family_id=?",
              )
              .bind(id)
              .all();
            return json({ members: r.results });
          }
          authorize(m, ["owner"]);
          if (p[3] && (method === "PATCH" || method === "DELETE")) {
            const target = await db()
              .prepare(
                "SELECT role FROM memberships WHERE family_id=? AND user_id=?",
              )
              .bind(id, p[3])
              .first();
            if (!target || target.role === "owner")
              throw new ApiError(
                403,
                "Pemilik keluarga tidak dapat diubah atau dihapus.",
              );
            if (method === "DELETE")
              await db()
                .prepare(
                  "DELETE FROM memberships WHERE family_id=? AND user_id=? AND role!='owner'",
                )
                .bind(id, p[3])
                .run();
            else {
              const b = await body(req);
              await db()
                .prepare(
                  "UPDATE memberships SET role=? WHERE family_id=? AND user_id=? AND role!='owner'",
                )
                .bind(editableRole(b.role), id, p[3])
                .run();
            }
            return json({ ok: true });
          }
        }
        if (p[2] === "invitations") {
          await membership(id, user, ["owner"]);
          if (method === "GET") {
            const r = await db()
              .prepare(
                "SELECT id,role,email,status,expires_at,created_at FROM invitations WHERE family_id=? ORDER BY created_at DESC",
              )
              .bind(id)
              .all();
            return json({ invitations: r.results });
          }
          if (method === "POST") {
            const b = await body(req),
              role = editableRole(b.role),
              email = String(b.email || "")
                .trim()
                .toLowerCase();
            if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
              throw new ApiError(400, "Email tidak valid.");
            const token = newToken(),
              inviteId = uid(),
              expires = new Date(Date.now() + 7 * 864e5).toISOString();
            await db()
              .prepare(
                "INSERT INTO invitations(id,family_id,token_hash,role,email,status,expires_at,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?)",
              )
              .bind(
                inviteId,
                id,
                await hashToken(token),
                role,
                email,
                "pending",
                expires,
                now(),
                user.userId,
              )
              .run();
            return json(
              {
                id: inviteId,
                url: url.origin + "/?join=" + token,
                expiresAt: expires,
              },
              201,
            );
          }
          if (method === "DELETE" && p[3]) {
            await db()
              .prepare(
                "UPDATE invitations SET status='revoked' WHERE id=? AND family_id=? AND status='pending'",
              )
              .bind(p[3], id)
              .run();
            return json({ ok: true });
          }
        }
        if (p[2] === "photos" && method === "POST") {
          await membership(id, user, ["owner", "editor"]);
          if (!env.BUCKET)
            throw new ApiError(503, "Penyimpanan foto belum tersedia.");
          const type = req.headers.get("content-type") || "",
            bytes = (await bounded(req, 2 * 1024 * 1024)).buffer;
          if (
            bytes.byteLength > 2 * 1024 * 1024 ||
            !["image/png", "image/jpeg", "image/webp"].includes(type)
          )
            throw new ApiError(400, "Gunakan PNG/JPEG/WebP maksimal 2 MB.");
          const a = new Uint8Array(bytes),
            valid =
              type === "image/jpeg"
                ? a[0] === 255 && a[1] === 216
                : type === "image/png"
                  ? a[0] === 137 && a[1] === 80 && a[2] === 78
                  : a[0] === 82 && a[1] === 73 && a[8] === 87 && a[9] === 69;
          if (!valid) throw new ApiError(400, "Isi foto tidak sesuai format.");
          const photoId = uid();
          await env.BUCKET.put(photoId, bytes, {
            httpMetadata: { contentType: type },
            customMetadata: { familyId: id },
          });
          return json({ url: "/api/cloud/photos/" + photoId }, 201);
        }
      }
      if (p[0] === "join" && p[1] && method === "POST") {
        if (!/^[0-9a-f]{64}$/.test(p[1]))
          throw new ApiError(400, "Kode undangan tidak valid.");
        const hash = await hashToken(p[1]),
          invite = await db()
            .prepare("SELECT * FROM invitations WHERE token_hash=?")
            .bind(hash)
            .first();
        inviteAllowed(invite, user);
        const stamp = now();
        const r = await db().batch([
          db()
            .prepare(
              "UPDATE invitations SET status='accepted',accepted_by=? WHERE id=? AND status='pending' AND expires_at>? AND (email='' OR email=?)",
            )
            .bind(user.userId, invite.id, stamp, user.email.toLowerCase()),
          db()
            .prepare(
              "INSERT INTO memberships(family_id,user_id,role,email,display_name,joined_at) SELECT family_id,?,role,?,?,? FROM invitations WHERE id=? AND accepted_by=? AND status='accepted' ON CONFLICT(family_id,user_id) DO NOTHING",
            )
            .bind(
              user.userId,
              user.email.toLowerCase(),
              user.displayName,
              stamp,
              invite.id,
              user.userId,
            ),
        ]);
        if (!r[0].meta.changes)
          throw new ApiError(410, "Undangan sudah digunakan atau dicabut.");
        return json({ familyId: invite.family_id });
      }
      if (p[0] === "photos" && p[1] && method === "GET") {
        const object = await env.BUCKET?.get(p[1]);
        if (!object) throw new ApiError(404, "Foto tidak ditemukan.");
        await membership(object.customMetadata?.familyId || "", user);
        return new Response(object.body, {
          headers: {
            "Content-Type":
              object.httpMetadata?.contentType || "application/octet-stream",
            "Cache-Control": "private,max-age=300",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      throw new ApiError(404, "Endpoint tidak ditemukan.");
    } catch (e) {
      const status =
        e instanceof ApiError
          ? e.status
          : e.message?.includes("berkas") ||
              e.message?.includes("Hubungan") ||
              e.message?.includes("Siklus") ||
              e.message?.includes("ID ")
            ? 400
            : 500;
      return json(
        {
          error:
            status === 500
              ? "Operasi cloud gagal. Coba lagi; perubahan belum dikonfirmasi."
              : e.message,
        },
        status,
      );
    }
  };
}
