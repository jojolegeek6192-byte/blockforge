// authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { findUserByEmail, createUser } = require('../db/models');
const { signToken, setAuthCookie, clearAuthCookie, requireAuth } = require('../middleware/auth');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, mot de passe et nom affiche sont requis.' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caracteres.' });
    }
    if (findUserByEmail(email)) {
      return res.status(409).json({ error: 'Un compte existe deja avec cet email.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser({ email, passwordHash, displayName, isOwner: false });

    const token = signToken(user);
    setAuthCookie(res, token);

    res.status(201).json({
      user: { id: user.id, email: user.email, displayName: user.displayName, isOwner: user.isOwner },
    });
  } catch (err) {
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'Erreur serveur lors de l inscription.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName, isOwner: user.isOwner },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion.' });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const { id, email, displayName, isOwner } = req.user;
  res.json({ user: { id, email, displayName, isOwner } });
});

module.exports = router;
