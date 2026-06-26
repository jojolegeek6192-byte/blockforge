// index.js
// Point d'entree du serveur. Sert l'API (/api/...) et le front statique
// (dossier /public).

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const bcrypt = require('bcryptjs');
const { attachUserIfPresent } = require('./middleware/auth');
const { findUserByEmail, createUser } = require('./db/models');

const authRoutes = require('./routes/authRoutes');
const assetRoutes = require('./routes/assetRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// S'assurer que les dossiers d'upload existent (utile sur un clone frais
// depuis GitHub, ou .gitkeep seul aura ete commite).
const ASSETS_DIR = path.join(__dirname, 'uploads', 'assets');
const THUMBS_DIR = path.join(__dirname, 'uploads', 'thumbnails');
fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(THUMBS_DIR, { recursive: true });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(attachUserIfPresent);

// ---------- API ----------
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Miniatures servies publiquement (les fichiers .rbxm eux-memes ne sont
// JAMAIS servis en statique : ils passent obligatoirement par les routes
// /download controlees, pour verifier l'achat avant tout envoi).
app.use('/uploads/thumbnails', express.static(THUMBS_DIR));

// ---------- Front statique ----------
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

// Toute route non-API renvoie index.html (routing cote client simple).
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), (err) => {
    if (err) res.status(404).send('Page introuvable.');
  });
});

// Cree automatiquement le compte proprietaire au demarrage si besoin.
// Necessaire car certains hebergeurs gratuits (ex. Render free tier) ne
// proposent pas d'acces "Shell" pour lancer manuellement `npm run seed`.
// Si le compte existe deja (meme email), rien ne se passe : aucun risque
// de doublon ni d'ecrasement a chaque redemarrage du serveur.
async function ensureOwnerAccount() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  const displayName = process.env.OWNER_NAME || 'Proprietaire';

  if (!email || !password) {
    console.warn('[seed] OWNER_EMAIL / OWNER_PASSWORD non definis : aucun compte proprietaire cree automatiquement.');
    return;
  }

  const existing = findUserByEmail(email);
  if (existing) {
    console.log(`[seed] Compte proprietaire deja present (${email}).`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser({ email, passwordHash, displayName, isOwner: true });
  console.log(`[seed] Compte proprietaire cree automatiquement : ${user.email}`);
}

app.listen(PORT, async () => {
  console.log(`\n  Boutique de ressources Roblox - serveur demarre`);
  console.log(`  -> http://localhost:${PORT}\n`);
  await ensureOwnerAccount();
});
