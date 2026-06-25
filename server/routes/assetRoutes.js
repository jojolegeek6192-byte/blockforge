// assetRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const {
  listAssets,
  findAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  incrementDownloadCount,
  hasPurchased,
} = require('../db/models');
const { requireAuth, requireOwner } = require('../middleware/auth');

const router = express.Router();

const ASSETS_DIR = path.join(__dirname, '..', 'uploads', 'assets');
const THUMBS_DIR = path.join(__dirname, '..', 'uploads', 'thumbnails');

// ---------- Multer (upload) ----------

const ALLOWED_ASSET_EXT = new Set(['.rbxm', '.rbxmx']);
const ALLOWED_THUMB_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function safeStoredName(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const randomId = crypto.randomBytes(12).toString('hex');
  return `${randomId}${ext}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'assetFile') cb(null, ASSETS_DIR);
    else if (file.fieldname === 'thumbnail') cb(null, THUMBS_DIR);
    else cb(new Error('Champ de fichier inattendu.'));
  },
  filename: (req, file, cb) => {
    cb(null, safeStoredName(file.originalname));
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.fieldname === 'assetFile') {
    if (!ALLOWED_ASSET_EXT.has(ext)) {
      return cb(new Error('Le fichier de ressource doit etre au format .rbxm ou .rbxmx.'));
    }
  } else if (file.fieldname === 'thumbnail') {
    if (!ALLOWED_THUMB_EXT.has(ext)) {
      return cb(new Error('La miniature doit etre une image (png, jpg, webp).'));
    }
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 Mo max par fichier
});

// ---------- Routes publiques ----------

// Liste des ressources publiees (catalogue)
router.get('/', (req, res) => {
  const assets = listAssets({ onlyPublished: true });
  // On ne renvoie jamais storedFileName publiquement : c'est le nom interne
  // du fichier sur le disque, il ne doit servir qu'aux routes de telechargement.
  const sanitized = assets.map(({ storedFileName, ...rest }) => rest);
  res.json({ assets: sanitized });
});

// Detail d'une ressource
router.get('/:id', (req, res) => {
  const asset = findAssetById(Number(req.params.id));
  if (!asset || !asset.published) {
    return res.status(404).json({ error: 'Ressource introuvable.' });
  }
  const { storedFileName, ...sanitized } = asset;
  let alreadyPurchased = false;
  if (req.user) {
    alreadyPurchased = asset.isFree || hasPurchased(req.user.id, asset.id);
  } else {
    alreadyPurchased = asset.isFree;
  }
  res.json({ asset: sanitized, alreadyPurchased });
});

// Telechargement d'une ressource gratuite (acces direct, pas besoin d'achat)
router.get('/:id/download-free', (req, res) => {
  const asset = findAssetById(Number(req.params.id));
  if (!asset || !asset.published) {
    return res.status(404).json({ error: 'Ressource introuvable.' });
  }
  if (!asset.isFree) {
    return res.status(403).json({ error: 'Cette ressource est payante, un achat est requis.' });
  }
  const filePath = path.join(ASSETS_DIR, asset.storedFileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier introuvable sur le serveur.' });
  }
  incrementDownloadCount(asset.id);
  res.download(filePath, asset.fileName);
});

// Telechargement d'une ressource payante : reserve a ceux qui l'ont achetee
router.get('/:id/download', requireAuth, (req, res) => {
  const asset = findAssetById(Number(req.params.id));
  if (!asset || !asset.published) {
    return res.status(404).json({ error: 'Ressource introuvable.' });
  }
  if (!asset.isFree && !hasPurchased(req.user.id, asset.id)) {
    return res.status(403).json({ error: 'Vous devez acheter cette ressource avant de la telecharger.' });
  }
  const filePath = path.join(ASSETS_DIR, asset.storedFileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier introuvable sur le serveur.' });
  }
  incrementDownloadCount(asset.id);
  res.download(filePath, asset.fileName);
});

// ---------- Routes vendeur (owner uniquement) ----------

router.post(
  '/',
  requireAuth,
  requireOwner,
  upload.fields([{ name: 'assetFile', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
  (req, res) => {
    try {
      const { title, description, priceEuros, category, published } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: 'Titre et description sont requis.' });
      }
      const assetFile = req.files && req.files.assetFile && req.files.assetFile[0];
      if (!assetFile) {
        return res.status(400).json({ error: 'Le fichier .rbxm/.rbxmx est requis.' });
      }
      const thumbFile = req.files && req.files.thumbnail && req.files.thumbnail[0];

      const priceCents = Math.round(parseFloat(priceEuros || '0') * 100);
      if (Number.isNaN(priceCents) || priceCents < 0) {
        return res.status(400).json({ error: 'Prix invalide.' });
      }

      const asset = createAsset({
        title,
        description,
        priceCents,
        category,
        fileName: assetFile.originalname,
        storedFileName: assetFile.filename,
        thumbnailFileName: thumbFile ? thumbFile.filename : null,
        published: published !== 'false',
      });

      res.status(201).json({ asset });
    } catch (err) {
      console.error('[assets/create]', err);
      res.status(500).json({ error: 'Erreur serveur lors de la creation de la ressource.' });
    }
  }
);

router.put(
  '/:id',
  requireAuth,
  requireOwner,
  upload.fields([{ name: 'assetFile', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
  (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = findAssetById(id);
      if (!existing) return res.status(404).json({ error: 'Ressource introuvable.' });

      const { title, description, priceEuros, category, published } = req.body;
      const updates = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category = category;
      if (published !== undefined) updates.published = published === 'true' || published === true;
      if (priceEuros !== undefined) {
        const priceCents = Math.round(parseFloat(priceEuros) * 100);
        if (Number.isNaN(priceCents) || priceCents < 0) {
          return res.status(400).json({ error: 'Prix invalide.' });
        }
        updates.priceCents = priceCents;
      }

      const assetFile = req.files && req.files.assetFile && req.files.assetFile[0];
      if (assetFile) {
        // On supprime l'ancien fichier pour ne pas accumuler des orphelins.
        const oldPath = path.join(ASSETS_DIR, existing.storedFileName);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        updates.fileName = assetFile.originalname;
        updates.storedFileName = assetFile.filename;
      }

      const thumbFile = req.files && req.files.thumbnail && req.files.thumbnail[0];
      if (thumbFile) {
        if (existing.thumbnailFileName) {
          const oldThumb = path.join(THUMBS_DIR, existing.thumbnailFileName);
          if (fs.existsSync(oldThumb)) fs.unlinkSync(oldThumb);
        }
        updates.thumbnailFileName = thumbFile.filename;
      }

      const updated = updateAsset(id, updates);
      res.json({ asset: updated });
    } catch (err) {
      console.error('[assets/update]', err);
      res.status(500).json({ error: 'Erreur serveur lors de la mise a jour.' });
    }
  }
);

router.delete('/:id', requireAuth, requireOwner, (req, res) => {
  const id = Number(req.params.id);
  const existing = findAssetById(id);
  if (!existing) return res.status(404).json({ error: 'Ressource introuvable.' });

  const filePath = path.join(ASSETS_DIR, existing.storedFileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  if (existing.thumbnailFileName) {
    const thumbPath = path.join(THUMBS_DIR, existing.thumbnailFileName);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }

  deleteAsset(id);
  res.json({ ok: true });
});

// Liste complete (y compris non publiees) pour le dashboard
router.get('/owner/all', requireAuth, requireOwner, (req, res) => {
  const assets = listAssets({ onlyPublished: false });
  res.json({ assets });
});

// Middleware d'erreur specifique a multer (fichier trop gros, type invalide...)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Erreur d upload : ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Erreur lors du traitement du fichier.' });
  }
  next();
});

module.exports = router;
