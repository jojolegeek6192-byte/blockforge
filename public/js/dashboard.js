// dashboard.js
// Tout ce qui concerne le tableau de bord vendeur (owner uniquement).

const Dashboard = (() => {
  let currentAssets = [];

  async function render(root) {
    root.innerHTML = document.getElementById('tpl-dashboard').innerHTML;

    await Promise.all([loadStats(root), loadAssets(root)]);
    setupTabs(root);
    setupModal(root);

    root.querySelector('#newAssetBtn').addEventListener('click', () => openAssetModal());
  }

  async function loadStats(root) {
    const statsEl = root.querySelector('#dashboardStats');
    try {
      const { stats } = await Api.get('/dashboard/stats');
      statsEl.innerHTML = `
        <div class="stat-card"><div class="stat-value">${stats.totalAssets}</div><div class="stat-label">Ressources (${stats.publishedAssets} publiees)</div></div>
        <div class="stat-card"><div class="stat-value">${stats.totalSales}</div><div class="stat-label">Ventes</div></div>
        <div class="stat-card"><div class="stat-value">${formatPrice(stats.totalRevenueCents)}</div><div class="stat-label">Revenu total (simule)</div></div>
        <div class="stat-card"><div class="stat-value">${stats.totalDownloads}</div><div class="stat-label">Telechargements</div></div>
        <div class="stat-card"><div class="stat-value">${stats.totalUsers}</div><div class="stat-label">Utilisateurs inscrits</div></div>
        <div class="stat-card"><div class="stat-value">${stats.totalReviews}</div><div class="stat-label">Avis publies</div></div>
      `;
    } catch (err) {
      statsEl.innerHTML = emptyMessageHtml('Impossible de charger les statistiques.');
    }
  }

  async function loadAssets(root) {
    const tableEl = root.querySelector('#dashboardAssetsTable');
    try {
      const { assets } = await Api.get('/assets/owner/all');
      currentAssets = assets;
      if (assets.length === 0) {
        tableEl.innerHTML = emptyMessageHtml('Aucune ressource pour le moment. Cliquez sur "Nouvelle ressource" pour commencer.');
        return;
      }
      tableEl.innerHTML = `
        <table class="data-table">
          <thead>
            <tr><th>Titre</th><th>Prix</th><th>Statut</th><th>Note</th><th>Telechargements</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${assets.map((a) => `
              <tr>
                <td>${escapeHtml(a.title)}</td>
                <td>${formatPrice(a.priceCents)}</td>
                <td><span class="badge ${a.published ? 'green' : 'gray'}">${a.published ? 'Publiee' : 'Brouillon'}</span></td>
                <td>${renderStars(a.ratingAverage)} <span class="rating-count">(${a.ratingCount})</span></td>
                <td>${a.downloadCount}</td>
                <td class="row-actions">
                  <button class="btn btn-ghost btn-sm" data-edit-asset="${a.id}">Modifier</button>
                  <button class="btn btn-danger btn-sm" data-delete-asset="${a.id}">Supprimer</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      tableEl.querySelectorAll('[data-edit-asset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const asset = currentAssets.find((a) => a.id === Number(btn.dataset.editAsset));
          if (asset) openAssetModal(asset);
        });
      });
      tableEl.querySelectorAll('[data-delete-asset]').forEach((btn) => {
        btn.addEventListener('click', () => handleDeleteAsset(Number(btn.dataset.deleteAsset), root));
      });
    } catch (err) {
      tableEl.innerHTML = emptyMessageHtml('Impossible de charger les ressources.');
    }
  }

  async function loadSales(root) {
    const tableEl = root.querySelector('#dashboardSalesTable');
    try {
      const { sales } = await Api.get('/dashboard/sales');
      if (sales.length === 0) {
        tableEl.innerHTML = emptyMessageHtml('Aucune vente enregistree pour le moment.');
        return;
      }
      tableEl.innerHTML = `
        <table class="data-table">
          <thead><tr><th>Date</th><th>Ressource</th><th>Acheteur</th><th>Montant</th></tr></thead>
          <tbody>
            ${sales.map((s) => `
              <tr>
                <td>${formatDate(s.createdAt)}</td>
                <td>${escapeHtml(s.assetTitle)}</td>
                <td>${escapeHtml(s.userEmail)}</td>
                <td>${formatPrice(s.priceCents)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      tableEl.innerHTML = emptyMessageHtml('Impossible de charger les ventes.');
    }
  }

  async function loadUsers(root) {
    const tableEl = root.querySelector('#dashboardUsersTable');
    try {
      const { users } = await Api.get('/dashboard/users');
      tableEl.innerHTML = `
        <table class="data-table">
          <thead><tr><th>Nom</th><th>Email</th><th>Role</th><th>Inscrit le</th></tr></thead>
          <tbody>
            ${users.map((u) => `
              <tr>
                <td>${escapeHtml(u.displayName)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td><span class="badge ${u.isOwner ? 'purple' : 'gray'}">${u.isOwner ? 'Proprietaire' : 'Client'}</span></td>
                <td>${formatDate(u.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      tableEl.innerHTML = emptyMessageHtml('Impossible de charger les utilisateurs.');
    }
  }

  function setupTabs(root) {
    const tabButtons = root.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        tabButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        root.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
        const panel = root.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`);
        panel.classList.remove('hidden');

        if (btn.dataset.tab === 'sales') await loadSales(root);
        if (btn.dataset.tab === 'users') await loadUsers(root);
      });
    });
  }

  async function handleDeleteAsset(id, root) {
    if (!confirm('Supprimer definitivement cette ressource ? Cette action est irreversible.')) return;
    try {
      await Api.del(`/assets/${id}`);
      showToast('Ressource supprimee.', 'success');
      await loadAssets(root);
      await loadStats(root);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ---------- Modal creation/edition ----------

  function setupModal(dashboardRoot) {
    const modal = document.getElementById('assetModal');
    const form = document.getElementById('assetForm');
    const closeBtn = document.getElementById('closeAssetModal');
    const cancelBtn = document.getElementById('cancelAssetForm');

    closeBtn.onclick = closeAssetModal;
    cancelBtn.onclick = closeAssetModal;
    modal.onclick = (e) => { if (e.target === modal) closeAssetModal(); };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('assetFormError');
      errorEl.textContent = '';

      const formData = new FormData(form);
      const assetId = formData.get('assetId');
      // La checkbox HTML envoie "on" si cochee, rien sinon : on normalise.
      formData.set('published', form.published.checked ? 'true' : 'false');

      try {
        if (assetId) {
          await Api.put(`/assets/${assetId}`, formData, { isFormData: true });
          showToast('Ressource mise a jour.', 'success');
        } else {
          if (!form.assetFile.files.length) {
            errorEl.textContent = 'Le fichier .rbxm/.rbxmx est obligatoire pour une nouvelle ressource.';
            return;
          }
          await Api.post('/assets', formData, { isFormData: true });
          showToast('Ressource creee.', 'success');
        }
        closeAssetModal();
        await loadAssets(dashboardRoot);
        await loadStats(dashboardRoot);
      } catch (err) {
        errorEl.textContent = err.message;
      }
    };
  }

  function openAssetModal(asset = null) {
    const modal = document.getElementById('assetModal');
    const form = document.getElementById('assetForm');
    const title = document.getElementById('assetModalTitle');
    const errorEl = document.getElementById('assetFormError');
    const fileHint = document.getElementById('assetFileRequiredHint');

    form.reset();
    errorEl.textContent = '';

    if (asset) {
      title.textContent = `Modifier : ${asset.title}`;
      form.assetId.value = asset.id;
      form.title.value = asset.title;
      form.description.value = asset.description;
      form.category.value = asset.category || '';
      form.priceEuros.value = (asset.priceCents / 100).toFixed(2);
      form.published.checked = !!asset.published;
      fileHint.textContent = '(laisser vide pour conserver le fichier actuel)';
      form.assetFile.removeAttribute('required');
    } else {
      title.textContent = 'Nouvelle ressource';
      form.assetId.value = '';
      form.published.checked = true;
      fileHint.textContent = '*';
    }

    modal.classList.remove('hidden');
  }

  function closeAssetModal() {
    document.getElementById('assetModal').classList.add('hidden');
  }

  return { render };
})();
