// auth.js
// Gestion de l'etat "utilisateur connecte" cote client, et mise a jour de
// l'UI commune (header) en fonction de cet etat.

const AuthState = (() => {
  let currentUser = null;

  async function refresh() {
    try {
      const data = await Api.get('/auth/me');
      currentUser = data.user;
    } catch (err) {
      currentUser = null;
    }
    updateHeaderUI();
    return currentUser;
  }

  function getUser() {
    return currentUser;
  }

  function isLoggedIn() {
    return !!currentUser;
  }

  function isOwner() {
    return !!currentUser && currentUser.isOwner;
  }

  async function login(email, password) {
    const data = await Api.post('/auth/login', { email, password });
    currentUser = data.user;
    updateHeaderUI();
    return currentUser;
  }

  async function register(displayName, email, password) {
    const data = await Api.post('/auth/register', { displayName, email, password });
    currentUser = data.user;
    updateHeaderUI();
    return currentUser;
  }

  async function logout() {
    await Api.post('/auth/logout', {});
    currentUser = null;
    updateHeaderUI();
  }

  function updateHeaderUI() {
    const authOnlyEls = document.querySelectorAll('.auth-only');
    const guestOnlyEls = document.querySelectorAll('.guest-only');
    const ownerOnlyEls = document.querySelectorAll('.owner-only');
    const headerUserName = document.getElementById('headerUserName');

    const loggedIn = isLoggedIn();
    authOnlyEls.forEach((el) => { el.style.display = loggedIn ? '' : 'none'; });
    guestOnlyEls.forEach((el) => { el.style.display = loggedIn ? 'none' : ''; });
    ownerOnlyEls.forEach((el) => { el.style.display = loggedIn && isOwner() ? '' : 'none'; });

    if (headerUserName && currentUser) {
      headerUserName.textContent = currentUser.displayName;
    }
  }

  return { refresh, getUser, isLoggedIn, isOwner, login, register, logout, updateHeaderUI };
})();
