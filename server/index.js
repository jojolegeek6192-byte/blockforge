// index.js
// Point d'entree du serveur. Sert l'API (/api/...) et le front statique
// (dossier /public).

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { attachUserIfPresent } = require('./middleware/auth');

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

app.listen(PORT, () => {
  console.log(`\n  Boutique de ressources Roblox - serveur demarre`);
  console.log(`  -> http://localhost:${PORT}\n`);
});
