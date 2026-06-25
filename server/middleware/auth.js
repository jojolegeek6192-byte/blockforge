// auth.js
// Middlewares d'authentification bases sur un JWT stocke dans un cookie
// httpOnly (plus sur qu'un stockage cote client en localStorage, evite
// l'exposition au XSS).

const jwt = require('jsonwebtoken');
const { findUserById } = require('../db/models');

const JWT_SECRET = process.env.JWT_SECRET || 'change-moi-dans-le-fichier-env';
const COOKIE_NAME = 'token';

function signToken(user) {
  return jwt.sign(
    { userId: user.id, isOwner: user.isOwner },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    // secure:true necessite du HTTPS ; on l'active uniquement en prod pour
    // ne pas se bloquer soi-meme en developpement local en http.
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

// Renseigne req.user si un token valide est present, sans bloquer la
// requete si ce n'est pas le cas (utile pour des routes publiques qui
// changent legerement de comportement si l'utilisateur est connecte).
function attachUserIfPresent(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findUserById(payload.userId);
    if (user) req.user = user;
  } catch (err) {
    // Token invalide/expire : on ignore simplement, l'utilisateur sera
    // traite comme non connecte.
  }
  next();
}

// Bloque la requete si l'utilisateur n'est pas authentifie.
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  next();
}

// Bloque la requete si l'utilisateur n'est pas le proprietaire de la
// boutique. A utiliser sur toutes les routes du dashboard vendeur.
function requireOwner(req, res, next) {
  if (!req.user || !req.user.isOwner) {
    return res.status(403).json({ error: 'Acces reserve au proprietaire de la boutique.' });
  }
  next();
}

module.exports = {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  attachUserIfPresent,
  requireAuth,
  requireOwner,
  COOKIE_NAME,
};
