// reviewRoutes.js
const express = require('express');
const {
  findAssetById,
  listReviewsForAsset,
  findReviewByUserAndAsset,
  createOrUpdateReview,
  deleteReview,
  hasPurchased,
} = require('../db/models');
const { requireAuth, requireOwner } = require('../middleware/auth');

const router = express.Router();

// Liste des avis pour une ressource (public)
router.get('/asset/:assetId', (req, res) => {
  const assetId = Number(req.params.assetId);
  const asset = findAssetById(assetId);
  if (!asset) return res.status(404).json({ error: 'Ressource introuvable.' });

  const reviews = listReviewsForAsset(assetId).map(({ userId, ...rest }) => rest);
  res.json({ reviews });
});

// Poser/mettre a jour son avis (etoiles 1-5)
router.post('/asset/:assetId', requireAuth, (req, res) => {
  const assetId = Number(req.params.assetId);
  const asset = findAssetById(assetId);
  if (!asset) return res.status(404).json({ error: 'Ressource introuvable.' });

  const { stars, comment } = req.body;
  const starsNum = Number(stars);
  if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
    return res.status(400).json({ error: 'La note doit etre un entier entre 1 et 5.' });
  }

  const review = createOrUpdateReview({
    userId: req.user.id,
    assetId,
    stars: starsNum,
    comment: typeof comment === 'string' ? comment.slice(0, 1000) : '',
  });

  res.status(201).json({ review });
});

// Recuperer son propre avis sur une ressource (pour pre-remplir le formulaire)
router.get('/asset/:assetId/mine', requireAuth, (req, res) => {
  const assetId = Number(req.params.assetId);
  const review = findReviewByUserAndAsset(req.user.id, assetId);
  res.json({ review });
});

// Moderation : le proprietaire peut supprimer un avis depuis le dashboard
router.delete('/:reviewId', requireAuth, requireOwner, (req, res) => {
  const ok = deleteReview(Number(req.params.reviewId));
  if (!ok) return res.status(404).json({ error: 'Avis introuvable.' });
  res.json({ ok: true });
});

module.exports = router;
