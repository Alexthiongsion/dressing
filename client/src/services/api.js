const BASE = import.meta.env.VITE_API_URL || "http://localhost:5050/api";
export async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...options.headers }
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Erreur réseau");
  return data;
}
export async function uploadImage(file) {
  const body = new FormData();
  body.append("image", file);
  return api("/uploads/image", { method: "POST", body });
}
