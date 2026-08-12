const API = {
  cache: new Map(),
  pending: new Map(),
  storagePrefix: 'almox:api:',

  ttl(path) {
    if (path.startsWith('/dashboard/')) return 45_000;
    if (path.startsWith('/familias') || path.startsWith('/tipos')) return 300_000;
    if (path.startsWith('/itens/sku/')) return 45_000;
    if (path.startsWith('/itens')) return 45_000;
    if (path.startsWith('/movimentacoes')) return 30_000;
    if (path === '/auth/me') return 60_000;
    if (path === '/health') return 45_000;
    return 0;
  },

  staleTtl(path) {
    if (path.startsWith('/dashboard/') || path.startsWith('/itens') || path.startsWith('/movimentacoes')) return 300_000;
    if (path.startsWith('/familias') || path.startsWith('/tipos')) return 900_000;
    return this.ttl(path);
  },

  storageKey(path) {
    return `${this.storagePrefix}${path}`;
  },

  readStored(path) {
    try {
      const raw = sessionStorage.getItem(this.storageKey(path));
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  },

  writeStored(path, entry) {
    try {
      sessionStorage.setItem(this.storageKey(path), JSON.stringify(entry));
    } catch (_) {}
  },

  invalidate(prefix = '') {
    for (const key of this.cache.keys()) {
      if (!prefix || key.startsWith(prefix)) this.cache.delete(key);
    }
    try {
      for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = sessionStorage.key(index);
        if (!key?.startsWith(this.storagePrefix)) continue;
        const apiPath = key.slice(this.storagePrefix.length);
        if (!prefix || apiPath.startsWith(prefix)) sessionStorage.removeItem(key);
      }
    } catch (_) {}
  },

  invalidateAfterMutation(path) {
    this.invalidate('/dashboard/');
    if (path.startsWith('/itens')) this.invalidate('/itens');
    if (path.startsWith('/familias')) this.invalidate('/familias');
    if (path.startsWith('/tipos')) this.invalidate('/tipos');
    if (path.startsWith('/movimentacoes')) {
      this.invalidate('/movimentacoes');
      this.invalidate('/itens');
    }
    if (path.startsWith('/auth/logout')) this.invalidate();
  },

  async request(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const { cache: cacheOption, headers, refresh, ...fetchOptions } = options;
    const cacheKey = method === 'GET' ? path : '';
    const ttl = method === 'GET' && cacheOption !== false ? this.ttl(path) : 0;

    if (ttl && !refresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.data;
      if (this.pending.has(cacheKey)) return this.pending.get(cacheKey);
      const stored = this.readStored(cacheKey);
      if (stored?.expiresAt > Date.now()) {
        this.cache.set(cacheKey, stored);
        return stored.data;
      }
      if (stored?.staleAt > Date.now()) {
        this.cache.set(cacheKey, stored);
        setTimeout(() => this.request(path, { ...options, refresh: true }).catch(() => {}), 0);
        return stored.data;
      }
    }

    const request = (async () => {
      try {
        const response = await fetch(`/api${path}`, {
          ...fetchOptions,
          headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        });
        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? await response.json() : {};
        if (!response.ok) throw new Error(data.error || `N\u00e3o foi poss\u00edvel concluir a opera\u00e7\u00e3o (erro ${response.status}).`);
        if (ttl) {
          const entry = { data, expiresAt: Date.now() + ttl, staleAt: Date.now() + this.staleTtl(path) };
          this.cache.set(cacheKey, entry);
          this.writeStored(cacheKey, entry);
        }
        if (method !== 'GET') this.invalidateAfterMutation(path);
        return data;
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error('N\u00e3o foi poss\u00edvel acessar o servidor. Inicie o backend e abra o sistema por http://localhost:3000.');
        }
        throw error;
      } finally {
        if (ttl) this.pending.delete(cacheKey);
      }
    })();

    if (ttl) this.pending.set(cacheKey, request);
    return request;
  },

  get(path, options) { return this.request(path, options); },
  post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); },
  put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body) }); },
  delete(path, body) { return this.request(path, { method: 'DELETE', body: JSON.stringify(body) }); },
};

window.API = API;
