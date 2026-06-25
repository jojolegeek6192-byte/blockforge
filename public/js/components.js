// components.js
// Petites fonctions utilitaires de rendu, partagees entre les differentes
// pages de l'app.

function formatPrice(priceCents) {
  if (priceCents === 0) return 'Gratuit';
  return `${(priceCents / 100).toFixed(2).replace('.', ',')} €`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderStars(average) {
  const rounded = Math.round(average);
  let stars = '';
  for (let i = 1; i <= 5; i++) stars += i <= rounded ? '★' : '☆';
  return stars;
}

function thumbHtml(asset) {
  if (asset.thumbnailFileName) {
    return `<img src="/uploads/thumbnails/${encodeURIComponent(asset.thumbnailFileName)}" alt="${escapeHtml(asset.title)}" loading="lazy" />`;
  }
  return '⬡';
}

function assetCardHtml(asset) {
  const priceClass = asset.isFree ? 'free' : '';
  const badgeClass = asset.isFree ? '' : 'paid';
  const badgeLabel = asset.isFree ? 'Gratuit' : 'Premium';
  return `
    <a href="#/ressource/${asset.id}" data-link class="asset-card">
      <div class="asset-thumb">
        <span class="asset-badge ${badgeClass}">${badgeLabel}</span>
        ${thumbHtml(asset)}
      </div>
      <div class="asset-card-body">
        <h3 class="asset-card-title">${escapeHtml(asset.title)}</h3>
        <p class="asset-card-desc">${escapeHtml(asset.description)}</p>
        <div class="asset-card-footer">
          <span class="asset-price ${priceClass}">${formatPrice(asset.priceCents)}</span>
          <span>
            <span class="rating-stars">${renderStars(asset.ratingAverage)}</span>
            <span class="rating-count">(${asset.ratingCount})</span>
          </span>
        </div>
      </div>
    </a>
  `;
}

function emptyMessageHtml(text) {
  return `<p class="muted">${escapeHtml(text)}</p>`;
}

// ---------- Toasts ----------

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}
