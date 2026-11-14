const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
export const API_BASE_URL = configuredUrl?.replace(/\/+$/, "")
  || (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

export class ApiError extends Error {
  constructor(message: string, public status: number, public details: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string;
};

/** Paths are relative to the Express API, e.g. /product or /auth/login.
 * Pass tokens explicitly; authentication persistence will be added with login.
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error("Set NEXT_PUBLIC_API_BASE_URL before building the frontend.");
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("API paths must start with a single slash.");
  }
  const { body, token, headers: suppliedHeaders, ...request } = options;
  const headers = new Headers(suppliedHeaders);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...request,
    headers,
    cache: request.cache ?? "no-store",
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = text; }
  }
  if (!response.ok) {
    const error = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const message = error.msgError ?? error.message;
    throw new ApiError(typeof message === "string" ? message : `Request failed (${response.status})`, response.status, data);
  }
  return data as T;
}

