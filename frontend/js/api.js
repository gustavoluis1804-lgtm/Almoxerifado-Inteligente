const API = {
  cache: new Map(),
  pending: new Map(),

  ttl(path) {
    if (path.startsWith('/dashboard/')) return 20_000;
    if (path.startsWith('/familias') || path.startsWith('/tipos')) return 60_000;
    if (path.startsWith('/itens/sku/')) return 12_000;
    if (path.startsWith('/itens')) return 20_000;
    if (path.startsWith('/movimentacoes')) return 15_000;
    if (path === '/auth/me') return 60_000;
    if (path === '/health') return 45_000;
    return 0;
  },

  invalidate(prefix = '') {
    for (const key of this.cache.keys()) {
      if (!prefix || key.startsWith(prefix)) this.cache.delete(key);
    }
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
    const { cache: cacheOption, headers, ...fetchOptions } = options;
    const cacheKey = method === 'GET' ? path : '';
    const ttl = method === 'GET' && cacheOption !== false ? this.ttl(path) : 0;

    if (ttl) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.data;
      if (this.pending.has(cacheKey)) return this.pending.get(cacheKey);
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
        if (ttl) this.cache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
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
