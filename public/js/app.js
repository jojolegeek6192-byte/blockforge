// app.js
// Definition de toutes les "pages" (vues) de l'application et branchement
// au routeur. C'est le fichier qui orchestre tout.

const appRoot = () => document.getElementById('app');

// ---------- Page : Accueil ----------

async function renderHome() {
  const root = appRoot();
  root.innerHTML = document.getElementById('tpl-home').innerHTML;

  // Lance l'animation 3D Three.js sur le canvas de la hero section.
  const canvas = root.querySelector('#heroCanvas');
  if (canvas) Hero3D.init(canvas);

  const grid = root.querySelector('#homeAssetGrid');
  try {
    const { assets } = await Api.get('/assets');
    const top = assets.slice(0, 6);
    grid.innerHTML = top.length
      ? top.map(assetCardHtml).join('')
      : emptyMessageHtml('Aucune ressource publiee pour le moment.');
  } catch (err) {
    grid.innerHTML = emptyMessageHtml('Impossible de charger les ressources.');
  }
}

function destroyHome() {
  Hero3D.destroy();
}

// ---------- Page : Catalogue ----------

async function renderCatalogue(params, query) {
  const root = appRoot();
  root.innerHTML = document.getElementById('tpl-catalogue').innerHTML;

  const grid = root.querySelector('#catalogueGrid');
  const searchInput = root.querySelector('#searchInput');
  const filterSelect = root.querySelector('#filterSelect');
  const sortSelect = root.querySelector('#sortSelect');

  if (query.filter === 'gratuit') filterSelect.value = 'free';

  let allAssets = [];
  try {
    const { assets } = await Api.get('/assets');
    allAssets = assets;
  } catch (err) {
    grid.innerHTML = emptyMessageHtml('Impossible de charger le catalogue.');
    return;
  }

  function applyFiltersAndRender() {
    let list = [...allAssets];
    const term = searchInput.value.trim().toLowerCase();
    if (term) {
      list = list.filter((a) =>
        a.title.toLowerCase().includes(term) || a.description.toLowerCase().includes(term)
      );
    }
    if (filterSelect.value === 'free') list = list.filter((a) => a.isFree);
    if (filterSelect.value === 'paid') list = list.filter((a) => !a.isFree);

    switch (sortSelect.value) {
      case 'rating':
        list.sort((a, b) => b.ratingAverage - a.ratingAverage);
        break;
      case 'price-asc':
        list.sort((a, b) => a.priceCents - b.priceCents);
        break;
      case 'price-desc':
        list.sort((a, b) => b.priceCents - a.priceCents);
        break;
      default:
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    grid.innerHTML = list.length ? list.map(assetCardHtml).join('') : emptyMessageHtml('Aucune ressource ne correspond a ces criteres.');
  }

  searchInput.addEventListener('input', applyFiltersAndRender);
  filterSelect.addEventListener('change', applyFiltersAndRender);
  sortSelect.addEventListener('change', applyFiltersAndRender);

  applyFiltersAndRender();
}

// ---------- Page : Detail ressource ----------

async function renderAssetDetail(params) {
  const root = appRoot();
  root.innerHTML = document.getElementById('tpl-asset-detail').innerHTML;
  const container = root.querySelector('#assetDetailRoot');

  let asset, alreadyPurchased;
  try {
    const data = await Api.get(`/assets/${params.id}`);
    asset = data.asset;
    alreadyPurchased = data.alreadyPurchased;
  } catch (err) {
    container.innerHTML = emptyMessageHtml('Ressource introuvable.');
    return;
  }

  const priceClass = asset.isFree ? 'free' : '';
  let actionHtml = '';

  if (asset.isFree) {
    actionHtml = `<a class="btn btn-primary" href="/api/assets/${asset.id}/download-free">Telecharger gratuitement</a>`;
  } else if (!AuthState.isLoggedIn()) {
    actionHtml = `<a class="btn btn-primary" href="#/connexion" data-link>Se connecter pour acheter</a>
                  <p class="purchase-status">Vous devez avoir un compte pour acheter cette ressource.</p>`;
  } else if (alreadyPurchased) {
    actionHtml = `<a class="btn btn-primary" href="/api/assets/${asset.id}/download" id="downloadBtn">Telecharger le fichier</a>
                  <p class="purchase-status">Vous possedez deja cette ressource.</p>`;
  } else {
    actionHtml = `<button class="btn btn-primary" id="buyBtn">Acheter pour ${formatPrice(asset.priceCents)}</button>
                  <p class="purchase-status">Paiement simule a des fins de demonstration — le telechargement se lance automatiquement apres l'achat.</p>`;
  }

  container.innerHTML = `
    <div class="asset-detail-grid">
      <div class="asset-detail-media">${thumbHtml(asset)}</div>
      <div>
        <span class="asset-detail-category">${escapeHtml(asset.category || 'Ressource')}</span>
        <h1 class="asset-detail-title">${escapeHtml(asset.title)}</h1>
        <div class="asset-detail-meta">
          <span class="rating-stars">${renderStars(asset.ratingAverage)}</span>
          <span class="rating-count">${asset.ratingAverage.toFixed(1)} / 5 (${asset.ratingCount} avis)</span>
        </div>
        <p class="asset-detail-desc">${escapeHtml(asset.description)}</p>
        <div class="purchase-box">
          <div class="asset-detail-price ${priceClass}">${formatPrice(asset.priceCents)}</div>
          ${actionHtml}
        </div>
      </div>
    </div>

    <div class="reviews-section">
      <h2 class="section-title">Avis (${asset.ratingCount})</h2>
      <div id="reviewFormContainer"></div>
      <div id="reviewsList"><p class="muted">Chargement des avis…</p></div>
    </div>
  `;

  const buyBtn = container.querySelector('#buyBtn');
  if (buyBtn) {
    buyBtn.addEventListener('click', () => handlePurchase(asset.id, buyBtn));
  }

  await renderReviewForm(container, asset.id);
  await loadReviews(container, asset.id);
}

async function handlePurchase(assetId, buyBtn) {
  buyBtn.disabled = true;
  buyBtn.textContent = 'Traitement du paiement…';
  try {
    const data = await Api.post(`/purchases/${assetId}`, {});
    showToast('Achat confirme ! Telechargement en cours…', 'success');
    // Declenchement automatique du telechargement apres l'achat.
    const link = document.createElement('a');
    link.href = data.downloadUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // On rafraichit la vue pour afficher l'etat "deja possede".
    setTimeout(() => Router.navigate(`/ressource/${assetId}`), 600);
    setTimeout(() => window.location.reload(), 650);
  } catch (err) {
    showToast(err.message, 'error');
    buyBtn.disabled = false;
    buyBtn.textContent = `Acheter`;
  }
}

async function renderReviewForm(container, assetId) {
  const formContainer = container.querySelector('#reviewFormContainer');
  if (!AuthState.isLoggedIn()) {
    formContainer.innerHTML = `<p class="muted">Connectez-vous pour laisser un avis.</p>`;
    return;
  }

  let myReview = null;
  try {
    const data = await Api.get(`/reviews/asset/${assetId}/mine`);
    myReview = data.review;
  } catch (err) { /* pas grave, on affiche le formulaire vide */ }

  formContainer.innerHTML = `
    <div class="review-form">
      <strong>${myReview ? 'Modifier mon avis' : 'Laisser un avis'}</strong>
      <div class="star-picker" id="starPicker">
        ${[1,2,3,4,5].map((n) => `<button type="button" data-star="${n}">★</button>`).join('')}
      </div>
      <textarea class="input" id="reviewComment" rows="3" maxlength="1000" placeholder="Votre commentaire (optionnel)">${escapeHtml(myReview ? myReview.comment : '')}</textarea>
      <button class="btn btn-primary" id="submitReviewBtn" style="margin-top:12px;">Valider mon avis</button>
    </div>
  `;

  let selectedStars = myReview ? myReview.stars : 0;
  const starButtons = formContainer.querySelectorAll('#starPicker button');
  function paintStars() {
    starButtons.forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.star) <= selectedStars);
    });
  }
  paintStars();
  starButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedStars = Number(btn.dataset.star);
      paintStars();
    });
  });

  formContainer.querySelector('#submitReviewBtn').addEventListener('click', async () => {
    if (selectedStars < 1) {
      showToast('Selectionnez une note avant de valider.', 'error');
      return;
    }
    const comment = formContainer.querySelector('#reviewComment').value;
    try {
      await Api.post(`/reviews/asset/${assetId}`, { stars: selectedStars, comment });
      showToast('Avis enregistre, merci !', 'success');
      await loadReviews(container, assetId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadReviews(container, assetId) {
  const listEl = container.querySelector('#reviewsList');
  try {
    const { reviews } = await Api.get(`/reviews/asset/${assetId}`);
    listEl.innerHTML = reviews.length
      ? reviews.map((r) => `
          <div class="review-item">
            <div class="review-item-head">
              <span class="review-author">${escapeHtml(r.authorName)}</span>
              <span class="review-date">${formatDate(r.createdAt)}</span>
            </div>
            <span class="rating-stars">${renderStars(r.stars)}</span>
            ${r.comment ? `<p class="review-comment">${escapeHtml(r.comment)}</p>` : ''}
          </div>
        `).join('')
      : emptyMessageHtml('Aucun avis pour le moment. Soyez le premier a en laisser un !');
  } catch (err) {
    listEl.innerHTML = emptyMessageHtml('Impossible de charger les avis.');
  }
}

// ---------- Page : Connexion ----------

async function renderLogin() {
  const root = appRoot();
  root.innerHTML = document.getElementById('tpl-login').innerHTML;
  const form = root.querySelector('#loginForm');
  const errorEl = root.querySelector('#loginError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const formData = new FormData(form);
    try {
      await AuthState.login(formData.get('email'), formData.get('password'));
      showToast('Connexion reussie.', 'success');
      Router.navigate('/');
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// ---------- Page : Inscription ----------

async function renderRegister() {
  const root = appRoot();
  root.innerHTML = document.getElementById('tpl-register').innerHTML;
  const form = root.querySelector('#registerForm');
  const errorEl = root.querySelector('#registerError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const formData = new FormData(form);
    try {
      await AuthState.register(formData.get('displayName'), formData.get('email'), formData.get('password'));
      showToast('Compte cree avec succes.', 'success');
      Router.navigate('/');
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// ---------- Page : Mes achats ----------

async function renderMyPurchases() {
  const root = appRoot();
  if (!AuthState.isLoggedIn()) {
    Router.navigate('/connexion');
    return;
  }
  root.innerHTML = document.getElementById('tpl-my-purchases').innerHTML;
  const listEl = root.querySelector('#purchasesList');

  try {
    const [{ purchases }, { assets }] = await Promise.all([
      Api.get('/purchases/me'),
      Api.get('/assets'),
    ]);
    const assetsById = new Map(assets.map((a) => [a.id, a]));
    const purchasedAssets = purchases
      .map((p) => assetsById.get(p.assetId))
      .filter(Boolean);

    listEl.innerHTML = purchasedAssets.length
      ? purchasedAssets.map(assetCardHtml).join('')
      : emptyMessageHtml("Vous n'avez encore achete aucune ressource.");
  } catch (err) {
    listEl.innerHTML = emptyMessageHtml('Impossible de charger vos achats.');
  }
}

// ---------- Page : Dashboard ----------

async function renderDashboard() {
  const root = appRoot();
  if (!AuthState.isLoggedIn() || !AuthState.isOwner()) {
    Router.navigate('/');
    showToast('Acces reserve au proprietaire de la boutique.', 'error');
    return;
  }
  await Dashboard.render(root);
}

// ---------- Page : 404 ----------

async function renderNotFound() {
  appRoot().innerHTML = document.getElementById('tpl-not-found').innerHTML;
}

// ---------- Init globale ----------

let lastPageWasHome = false;

function wrapHomeLifecycle(renderFn, { isHome = false } = {}) {
  return async (params, query) => {
    if (lastPageWasHome && !isHome) destroyHome();
    lastPageWasHome = isHome;
    await renderFn(params, query);
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  await AuthState.refresh();

  Router.register('/', wrapHomeLifecycle(renderHome, { isHome: true }));
  Router.register('/catalogue', wrapHomeLifecycle(renderCatalogue));
  Router.register('/ressource/:id', wrapHomeLifecycle(renderAssetDetail));
  Router.register('/connexion', wrapHomeLifecycle(renderLogin));
  Router.register('/inscription', wrapHomeLifecycle(renderRegister));
  Router.register('/mes-achats', wrapHomeLifecycle(renderMyPurchases));
  Router.register('/dashboard', wrapHomeLifecycle(renderDashboard));
  Router.setNotFound(wrapHomeLifecycle(renderNotFound));

  Router.start();

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await AuthState.logout();
    showToast('Vous etes deconnecte.', 'success');
    Router.navigate('/');
  });

  document.getElementById('burgerBtn').addEventListener('click', () => {
    document.querySelector('.main-nav').classList.toggle('open');
  });
});
