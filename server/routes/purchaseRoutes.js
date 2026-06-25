// purchaseRoutes.js
//
// Systeme d'achat SIMULE.
// Aucun vrai processeur de paiement n'est branche pour le moment (cf.
// echange avec l'utilisateur : "rien pour le moment"). Cette route cree
// directement un enregistrement de "purchase" sans encaissement reel.
//
// Pour brancher un vrai PSP plus tard (ex. Stripe) :
//   1) Remplacer le contenu de la route POST /:assetId par la creation
//      d'une session de paiement (Stripe Checkout Session, par ex.).
//   2) Ajouter une route webhook (ex. POST /webhook/stripe) qui, une fois le
//      paiement confirme par le PSP, appelle models.createPurchase(...).
//   3) Le reste de l'application (deverrouillage de telechargement, listing
//      des achats, dashboard) n'a besoin d'aucune modification : tout repose
//      deja sur l'existence d'une ligne dans la table "purchases".

const express = require('express');
const { findAssetById, hasPurchased, createPurchase, listPurchasesForUser } = require('../db/models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/:assetId', requireAuth, (req, res) => {
  const assetId = Number(req.params.assetId);
  const asset = findAssetById(assetId);

  if (!asset || !asset.published) {
    return res.status(404).json({ error: 'Ressource introuvable.' });
  }
  if (asset.isFree) {
    return res.status(400).json({ error: 'Cette ressource est gratuite, aucun achat necessaire.' });
  }
  if (hasPurchased(req.user.id, assetId)) {
    return res.status(409).json({ error: 'Vous possedez deja cette ressource.', alreadyPurchased: true });
  }

  // --- Emplacement reserve a un futur appel reel a un PSP (Stripe...). ---
  const purchase = createPurchase({
    userId: req.user.id,
    assetId,
    priceCents: asset.priceCents,
  });

  res.status(201).json({
    purchase,
    downloadUrl: `/api/assets/${assetId}/download`,
  });
});

router.get('/me', requireAuth, (req, res) => {
  const purchases = listPurchasesForUser(req.user.id);
  res.json({ purchases });
});

module.exports = router;
