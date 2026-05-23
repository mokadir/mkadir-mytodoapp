const API_BASE = "/api";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

/**
 * Base fetch wrapper with auth token injection and JSON handling.
 */
export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  // Attach auth token if available
  const token = localStorage.getItem("accessToken");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  // Handle 401 — try refresh
  if (response.status === 401 && !endpoint.includes("/auth/")) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      // Retry with new token
      const newToken = localStorage.getItem("accessToken");
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${newToken}`,
      };
      const retryResponse = await fetch(`${API_BASE}${endpoint}`, config);
      if (!retryResponse.ok) {
        const retryError = await retryResponse.json().catch(() => ({}));
        throw new ApiError(retryResponse.status, retryError.message || "Request failed");
      }
      return retryResponse.json();
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.message || "Request failed");
  }

  return response.json();
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 */
async function attemptRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // Refresh failed — clear everything
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      return false;
    }

    const data = await res.json();
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    return true;
  } catch {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    return false;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    request<{
      message: string;
      user: { id: string; name: string; email: string };
      accessToken: string;
      refreshToken: string;
    }>("/auth/register", { method: "POST", body: data }),

  login: (data: { email: string; password: string }) =>
    request<{
      message: string;
      user: { id: string; name: string; email: string };
      accessToken: string;
      refreshToken: string;
    }>("/auth/login", { method: "POST", body: data }),

  logout: (refreshToken: string) =>
    request<{ message: string }>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
    }),

  me: () =>
    request<{ user: { id: string; name: string; email: string; createdAt: string } }>(
      "/auth/me"
    ),
};
