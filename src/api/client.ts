// Relative by default: in production the API is served from the same origin
// as this app (see server/src/app.ts), and in dev the Vite server proxies
// /api to the backend (see vite.config.ts). Set VITE_API_URL to override
// (e.g. to point a locally-run frontend at a deployed API).
const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!response.ok)
    throw new ApiError(response.status, body?.error?.message ?? "Unable to reach the API.");
  return body?.data as T;
}
