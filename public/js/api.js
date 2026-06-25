// api.js
// Petit wrapper autour de fetch pour parler a notre API.
// credentials: 'include' est indispensable pour que le cookie de session
// (JWT httpOnly) soit envoye/recu correctement.

const Api = (() => {
  async function request(path, { method = 'GET', body, isFormData = false } = {}) {
    const options = {
      method,
      credentials: 'include',
      headers: {},
    };

    if (body !== undefined) {
      if (isFormData) {
        options.body = body; // FormData : ne pas fixer Content-Type, le navigateur s'en occupe
      } else {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
    }

    const res = await fetch(`/api${path}`, options);
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : null;

    if (!res.ok) {
      const message = (data && data.error) || `Erreur ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  return {
    get: (path) => request(path),
    post: (path, body, opts = {}) => request(path, { method: 'POST', body, ...opts }),
    put: (path, body, opts = {}) => request(path, { method: 'PUT', body, ...opts }),
    del: (path) => request(path, { method: 'DELETE' }),
  };
})();
