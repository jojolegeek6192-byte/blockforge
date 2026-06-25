// router.js
// Routeur SPA minimal base sur le hash de l'URL (#/chemin).
// Pas de dependance externe : utile pour un site servi en statique simple,
// y compris sans configuration serveur particuliere pour le client-side
// routing.

const Router = (() => {
  const routes = [];

  function register(pattern, handler) {
    // pattern du type "/ressource/:id" -> on construit une regex et la liste
    // des noms de parametres.
    const paramNames = [];
    const regexStr = pattern
      .replace(/\/:[^/]+/g, (match) => {
        paramNames.push(match.slice(2));
        return '/([^/]+)';
      })
      .replace(/\//g, '\\/');
    const regex = new RegExp(`^${regexStr}$`);
    routes.push({ regex, paramNames, handler });
  }

  function parseHash() {
    let hash = window.location.hash || '#/';
    hash = hash.slice(1); // retire le '#'
    const [pathPart, queryPart] = hash.split('?');
    const path = pathPart || '/';
    const query = {};
    if (queryPart) {
      queryPart.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { path, query };
  }

  async function resolve() {
    const { path, query } = parseHash();
    for (const route of routes) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, idx) => { params[name] = match[idx + 1]; });
        updateActiveNav(path);
        window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
        await route.handler(params, query);
        return;
      }
    }
    await notFoundHandler();
  }

  let notFoundHandler = () => {};
  function setNotFound(handler) { notFoundHandler = handler; }

  function updateActiveNav(path) {
    document.querySelectorAll('.main-nav a[data-link]').forEach((a) => {
      const href = a.getAttribute('href').replace('#', '');
      a.classList.toggle('active', href === path);
    });
  }

  function start() {
    window.addEventListener('hashchange', resolve);
    window.addEventListener('DOMContentLoaded', resolve);
    if (!window.location.hash) window.location.hash = '#/';
    resolve();
  }

  function navigate(path) {
    window.location.hash = `#${path}`;
  }

  return { register, start, navigate, setNotFound };
})();

// Delegation de clic globale pour tous les liens internes [data-link],
// pour pouvoir fermer le menu mobile au passage par exemple.
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-link]');
  if (!link) return;
  const nav = document.querySelector('.main-nav');
  if (nav) nav.classList.remove('open');
});
