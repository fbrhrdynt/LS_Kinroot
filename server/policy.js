export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function requireIdentity(user) {
  if (!user?.userId || !user?.email)
    throw new ApiError(
      401,
      "Masuk melalui ChatGPT untuk menggunakan ruang keluarga cloud.",
    );
  return user;
}
export function authorize(member, roles = ["owner", "editor", "viewer"]) {
  if (!member || !roles.includes(member.role))
    throw new ApiError(403, "Anda tidak memiliki izin untuk tindakan ini.");
  return member;
}
export function checkOrigin(request) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin)
      throw new ApiError(403, "Permintaan lintas situs ditolak.");
  }
}
export function inviteAllowed(invite, user, now = new Date().toISOString()) {
  if (!invite || invite.status !== "pending" || invite.expires_at <= now)
    throw new ApiError(
      410,
      "Undangan sudah kedaluwarsa, dicabut, atau digunakan.",
    );
  if (invite.email && invite.email !== user.email.toLowerCase())
    throw new ApiError(403, "Undangan ini ditujukan ke alamat email lain.");
  return true;
}
export function editableRole(role) {
  if (!["editor", "viewer"].includes(role))
    throw new ApiError(400, "Peran undangan harus editor atau viewer.");
  return role;
}
export async function hashToken(token) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(bytes)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function newToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
