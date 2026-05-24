const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Token storage for auth
let _accessToken: string | null = null;
let _refreshToken: string | null = null;

// Refresh handler set by AuthContext
let _onRefresh: (() => Promise<boolean>) | null = null;
let _refreshing: Promise<boolean> | null = null;

export function setTokens(access: string | null, refresh: string | null) {
  _accessToken = access;
  _refreshToken = refresh;
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
}

export function setRefreshHandler(handler: () => Promise<boolean>) {
  _onRefresh = handler;
}

async function attemptRefresh(): Promise<boolean> {
  if (_refreshing) return _refreshing;
  if (!_onRefresh) return false;
  _refreshing = _onRefresh();
  const result = await _refreshing;
  _refreshing = null;
  return result;
}

interface ApiFetchOptions {
  method?: string;
  body?: string;
}

export async function apiFetch<T>(
  path: string,
  params?: Record<string, string | number>,
  options?: ApiFetchOptions
): Promise<T> {
  const url = new URL(path, BASE);
  if (params && (!options?.method || options.method === "GET")) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }

  const headers: Record<string, string> = {};
  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }
  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }

  const fetchOptions: RequestInit = {};
  if (options?.method) fetchOptions.method = options.method;
  if (options?.body) fetchOptions.body = options.body;

  let res = await fetch(url.toString(), { ...fetchOptions, headers });

  // Auto-refresh on 401
  if (res.status === 401 && _refreshToken) {
    const refreshed = await attemptRefresh();
    if (refreshed && _accessToken) {
      headers["Authorization"] = `Bearer ${_accessToken}`;
      res = await fetch(url.toString(), { ...fetchOptions, headers });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message ?? res.statusText), {
      status: res.status,
      code: body.code,
    });
  }

  // 204 No Content — no body to parse
  if (res.status === 204) return undefined as T;

  return res.json();
}
