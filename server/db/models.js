// models.js
// Couche d'acces aux donnees : toutes les operations CRUD passent par ici.
// Les routes ne touchent jamais directement jsonDatabase.js.

const { readDb, writeDb, withWriteLock } = require('./jsonDatabase');

// ---------- USERS ----------

function findUserByEmail(email) {
  const db = readDb();
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function findUserById(id) {
  const db = readDb();
  return db.users.find((u) => u.id === id) || null;
}

function createUser({ email, passwordHash, displayName, isOwner = false }) {
  return withWriteLock(() => {
    const db = readDb();
    const id = db._meta.nextUserId++;
    const user = {
      id,
      email,
      passwordHash,
      displayName,
      isOwner,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    writeDb(db);
    return user;
  });
}

function listUsers() {
  const db = readDb();
  return db.users;
}

// ---------- ASSETS ----------

function listAssets({ onlyPublished = true } = {}) {
  const db = readDb();
  let assets = db.assets;
  if (onlyPublished) {
    assets = assets.filter((a) => a.published);
  }
  return assets.map((a) => attachRatingSummary(a, db));
}

function findAssetById(id) {
  const db = readDb();
  const asset = db.assets.find((a) => a.id === id);
  if (!asset) return null;
  return attachRatingSummary(asset, db);
}

function attachRatingSummary(asset, db) {
  const reviews = db.reviews.filter((r) => r.assetId === asset.id);
  const count = reviews.length;
  const average = count > 0 ? reviews.reduce((sum, r) => sum + r.stars, 0) / count : 0;
  return {
    ...asset,
    ratingAverage: Math.round(average * 10) / 10,
    ratingCount: count,
  };
}

function createAsset(data) {
  return withWriteLock(() => {
    const db = readDb();
    const id = db._meta.nextAssetId++;
    const asset = {
      id,
      title: data.title,
      description: data.description,
      priceCents: data.priceCents, // 0 = gratuit
      isFree: data.priceCents === 0,
      category: data.category || 'Autre',
      fileName: data.fileName,
      storedFileName: data.storedFileName,
      thumbnailFileName: data.thumbnailFileName || null,
      published: data.published !== false,
      downloadCount: 0,
      createdAt: new Date().toISOString(),
    };
    db.assets.push(asset);
    writeDb(db);
    return asset;
  });
}

function updateAsset(id, updates) {
  return withWriteLock(() => {
    const db = readDb();
    const idx = db.assets.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    const merged = { ...db.assets[idx], ...updates };
    merged.isFree = merged.priceCents === 0;
    db.assets[idx] = merged;
    writeDb(db);
    return merged;
  });
}

function deleteAsset(id) {
  return withWriteLock(() => {
    const db = readDb();
    const idx = db.assets.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    const [removed] = db.assets.splice(idx, 1);
    db.reviews = db.reviews.filter((r) => r.assetId !== id);
    writeDb(db);
    return removed;
  });
}

function incrementDownloadCount(id) {
  return withWriteLock(() => {
    const db = readDb();
    const asset = db.assets.find((a) => a.id === id);
    if (!asset) return null;
    asset.downloadCount = (asset.downloadCount || 0) + 1;
    writeDb(db);
    return asset;
  });
}

// ---------- REVIEWS ----------

function listReviewsForAsset(assetId) {
  const db = readDb();
  return db.reviews
    .filter((r) => r.assetId === assetId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((r) => {
      const user = db.users.find((u) => u.id === r.userId);
      return { ...r, authorName: user ? user.displayName : 'Utilisateur supprime' };
    });
}

function findReviewByUserAndAsset(userId, assetId) {
  const db = readDb();
  return db.reviews.find((r) => r.userId === userId && r.assetId === assetId) || null;
}

function createOrUpdateReview({ userId, assetId, stars, comment }) {
  return withWriteLock(() => {
    const db = readDb();
    const existing = db.reviews.find((r) => r.userId === userId && r.assetId === assetId);
    if (existing) {
      existing.stars = stars;
      existing.comment = comment || '';
      existing.updatedAt = new Date().toISOString();
      writeDb(db);
      return existing;
    }
    const id = db._meta.nextReviewId++;
    const review = {
      id,
      userId,
      assetId,
      stars,
      comment: comment || '',
      createdAt: new Date().toISOString(),
    };
    db.reviews.push(review);
    writeDb(db);
    return review;
  });
}

function deleteReview(reviewId) {
  return withWriteLock(() => {
    const db = readDb();
    const idx = db.reviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) return false;
    db.reviews.splice(idx, 1);
    writeDb(db);
    return true;
  });
}

// ---------- PURCHASES ----------
// NB : il n'y a pas encore de vrai processeur de paiement branche.
// Cette table enregistre les achats "simules" : elle constitue la source de
// verite pour savoir qui a deverrouille quelle ressource payante.
// Le jour ou un vrai moyen de paiement (Stripe, PayPal...) est branche, il
// suffira d'appeler createPurchase() depuis le webhook de confirmation de
// paiement a la place de l'appel direct fait par la route /purchase actuelle.

function listPurchasesForUser(userId) {
  const db = readDb();
  return db.purchases.filter((p) => p.userId === userId);
}

function listAllPurchases() {
  const db = readDb();
  return db.purchases
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((p) => {
      const user = db.users.find((u) => u.id === p.userId);
      const asset = db.assets.find((a) => a.id === p.assetId);
      return {
        ...p,
        userEmail: user ? user.email : 'Utilisateur supprime',
        assetTitle: asset ? asset.title : 'Ressource supprimee',
      };
    });
}

function hasPurchased(userId, assetId) {
  const db = readDb();
  return db.purchases.some((p) => p.userId === userId && p.assetId === assetId);
}

function createPurchase({ userId, assetId, priceCents }) {
  return withWriteLock(() => {
    const db = readDb();
    const id = db._meta.nextPurchaseId++;
    const purchase = {
      id,
      userId,
      assetId,
      priceCents,
      // 'simulated' = paiement simule en attendant un vrai PSP (Stripe...).
      paymentStatus: 'simulated',
      createdAt: new Date().toISOString(),
    };
    db.purchases.push(purchase);
    writeDb(db);
    return purchase;
  });
}

function getDashboardStats() {
  const db = readDb();
  const totalRevenueCents = db.purchases.reduce((sum, p) => sum + (p.priceCents || 0), 0);
  return {
    totalUsers: db.users.length,
    totalAssets: db.assets.length,
    publishedAssets: db.assets.filter((a) => a.published).length,
    totalSales: db.purchases.length,
    totalRevenueCents,
    totalDownloads: db.assets.reduce((sum, a) => sum + (a.downloadCount || 0), 0),
    totalReviews: db.reviews.length,
  };
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  listUsers,
  listAssets,
  findAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  incrementDownloadCount,
  listReviewsForAsset,
  findReviewByUserAndAsset,
  createOrUpdateReview,
  deleteReview,
  listPurchasesForUser,
  listAllPurchases,
  hasPurchased,
  createPurchase,
  getDashboardStats,
};
