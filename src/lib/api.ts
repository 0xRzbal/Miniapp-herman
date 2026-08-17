const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  // Only cache GET requests without options
  const isGet = !options || (options.method === undefined || options.method === 'GET');
  const cacheKey = isGet ? path : '';

  if (isGet && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data as T;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    headers: { ...headers, ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }

  const data = await res.json();

  if (isGet) {
    cache.set(cacheKey, { data, timestamp: Date.now() });
  }

  return data;
}

export function clearCache() {
  cache.clear();
}
