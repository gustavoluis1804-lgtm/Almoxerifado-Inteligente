const responseCache = new Map();

function cacheKey(req) {
  return `${req.method}:${req.originalUrl}`;
}

export function clearApiCache(prefix = '') {
  for (const key of responseCache.keys()) {
    if (!prefix || key.includes(prefix)) responseCache.delete(key);
  }
}

export function cacheJson(ttlMs) {
  return (req, res, next) => {
    if (req.method !== 'GET' || req.query.refresh === 'true') return next();

    const key = cacheKey(req);
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('X-Almox-Cache', 'HIT');
      return res.json(cached.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        responseCache.set(key, { body, expiresAt: Date.now() + ttlMs });
        res.setHeader('X-Almox-Cache', 'MISS');
      }
      return originalJson(body);
    };
    return next();
  };
}

export function clearCacheAfterMutation(req, res, next) {
  if (req.method !== 'GET') clearApiCache();
  next();
}
