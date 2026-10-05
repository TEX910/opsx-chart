export async function api<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
  const value = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(value.error ?? `Request failed (${response.status})`);
  return value;
}

export const post = <T>(endpoint: string, body: unknown) => api<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });
export const put = <T>(endpoint: string, body: unknown) => api<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) });
export const remove = <T>(endpoint: string, body: unknown) => api<T>(endpoint, { method: 'DELETE', body: JSON.stringify(body) });
