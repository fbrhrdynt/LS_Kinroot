export async function request(path, options = {}) {
  const r = await fetch("/api/cloud/" + path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body && typeof options.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  let v;
  try {
    v = await r.json();
  } catch {
    throw Error("Server tidak dapat dihubungi. Data belum disimpan.");
  }
  if (!r.ok) {
    const e = Error(v.error || "Permintaan gagal.");
    e.status = r.status;
    throw e;
  }
  return v;
}
