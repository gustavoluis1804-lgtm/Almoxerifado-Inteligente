const API = {
  async request(path, options = {}) {
    try {
      const response = await fetch(`/api${path}`, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
      });
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : {};
      if (!response.ok) throw new Error(data.error || `Não foi possível concluir a operação (erro ${response.status}).`);
      return data;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Não foi possível acessar o servidor. Inicie o backend e abra o sistema por http://localhost:3000.');
      }
      throw error;
    }
  },
  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); },
  put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body) }); },
  delete(path, body) { return this.request(path, { method: 'DELETE', body: JSON.stringify(body) }); },
};
window.API = API;
