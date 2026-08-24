export const CORE_API = import.meta.env.VITE_CORE_API || "http://localhost:8084";
export const COMMONS_API = CORE_API + "/commons";

const request = async (base: string, method: string, path: string, data?: unknown, authed = false) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const jwt = localStorage.getItem("wcJwt");
  if (authed && jwt) headers.Authorization = `Bearer ${jwt}`;
  const response = await fetch(base + path, { method, headers, body: data === undefined ? undefined : JSON.stringify(data) });
  if (!response.ok) {
    if (authed && (response.status === 401 || response.status === 403)) localStorage.removeItem("wcJwt");
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body?.errors?.[0] || body?.error?.message || message;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
};

export const wcGet = (path: string, authed = false) => request(COMMONS_API, "GET", path, undefined, authed);
export const wcPost = (path: string, data?: unknown, authed = false) => request(COMMONS_API, "POST", path, data, authed);
export const wcDelete = (path: string, authed = false) => request(COMMONS_API, "DELETE", path, undefined, authed);
export const corePost = (path: string, data?: unknown) => request(CORE_API, "POST", path, data);
export const wcPut = (path: string, data?: unknown, authed = false) => request(COMMONS_API, "PUT", path, data, authed);

// presigned POST (S3) or the disk-store counterpart — same multipart shape, then record the file on the draft
export const uploadFile = async (submissionId: string, file: File, name: string) => {
  const post = await wcPost(`/submissions/${submissionId}/postUrl`, { name, contentType: file.type || undefined }, true);
  const form = new FormData();
  for (const [key, value] of Object.entries(post.fields || {})) form.append(key, String(value));
  form.append("file", file, name);
  const headers: Record<string, string> = {};
  const jwt = localStorage.getItem("wcJwt");
  if (post.authRequired && jwt) headers.Authorization = `Bearer ${jwt}`;
  const response = await fetch(post.url, { method: "POST", body: form, headers });
  if (!response.ok) throw new Error(`Couldn’t upload ${name} (${response.status})`);
  await wcPost(`/submissions/${submissionId}/files`, { name, sizeBytes: file.size }, true);
};
