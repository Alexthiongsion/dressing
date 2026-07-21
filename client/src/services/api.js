const BASE = import.meta.env.VITE_API_URL || "/api";
export async function api(path, options = {}) {
  const { timeout = 15000, signal: externalSignal, ...fetchOptions } = options;
  const isFormData = options.body instanceof FormData;
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => timeoutController.abort("timeout"), timeout);
  const signal = externalSignal && typeof AbortSignal.any === "function"
    ? AbortSignal.any([externalSignal, timeoutController.signal])
    : timeoutController.signal;
  const abortFromExternal = () => timeoutController.abort("cancelled");
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  try {
    const response = await fetch(`${BASE}${path}`, {
      ...fetchOptions,
      signal,
      headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...options.headers }
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Erreur réseau");
    return data;
  } catch (error) {
    if (externalSignal?.aborted) throw error;
    if (timeoutController.signal.aborted) throw new Error("Le serveur met trop de temps à répondre. Réessayez.");
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}
export async function uploadImage(file) {
  const body = new FormData();
  body.append("image", file);
  return api("/uploads/image", { method: "POST", body });
}
