// Logout functie
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (!confirm('Weet je zeker dat je uit wilt loggen?')) {
                return;
            }
            
            try {
                const response = await fetch('/api/cms/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    window.location.href = '/cms-login';
                }
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }
});

function formatPrice(priceCents, currency = 'eur') {
    return new Intl.NumberFormat('nl-BE', {
        style: 'currency',
        currency: (currency || 'eur').toUpperCase()
    }).format((priceCents || 0) / 100);
}

function getYouTubeVideoId(src) {
    if (!src) return '';
    try {
        const url = new URL(src);
        if (url.hostname.includes('youtube.com')) {
            if (url.pathname === '/watch') {
                return url.searchParams.get('v') || '';
            }
            if (url.pathname.startsWith('/embed/')) {
                return url.pathname.replace('/embed/', '').split('/')[0];
            }
        }
        if (url.hostname.includes('youtu.be')) {
            return url.pathname.replace('/', '').split('/')[0];
        }
    } catch (error) {
        return '';
    }
    return '';
}

function getArticleThumbnailPreview(article) {
    const fallback = { src: '/img/studiomalem_header.png', isVideo: false, isText: false };
    if (!article) return fallback;

    const rawSize = (article.size || '').toString().trim().toLowerCase();
    const normalizedSize = rawSize === 'teskt' ? 'tekst' : rawSize;
    if (normalizedSize === 'tekst') {
        return {
            isText: true,
            isVideo: false,
            src: '',
            title: article.title || 'Tekstartikel',
            category: article.category || ''
        };
    }

    const thumbnail = article.thumbnail || null;
    const components = Array.isArray(article.components) ? article.components : [];

    const firstImage = components.find(c => c && c.type === 'image' && c.src);
    const firstVideo = components.find(c => c && c.type === 'video' && c.src);
    const firstInOrder = components.find(c => c && (c.type === 'image' || c.type === 'video') && c.src);

    let media = null;
    if (thumbnail && (thumbnail.mode === 'custom-url' || thumbnail.mode === 'upload') && thumbnail.src) {
        media = { type: thumbnail.kind === 'video' ? 'video' : 'image', src: thumbnail.src };
    } else if (thumbnail && thumbnail.mode === 'auto-video' && firstVideo) {
        media = { type: 'video', src: firstVideo.src };
    } else if (thumbnail && thumbnail.mode === 'auto-image' && firstImage) {
        media = { type: 'image', src: firstImage.src };
    } else if (thumbnail && thumbnail.mode === 'auto-first' && firstInOrder) {
        media = { type: firstInOrder.type, src: firstInOrder.src };
    } else if (firstInOrder) {
        media = { type: firstInOrder.type, src: firstInOrder.src };
    }

    if (!media || !media.src) {
        return fallback;
    }

    if (media.type === 'video') {
        const ytId = getYouTubeVideoId(media.src);
        if (ytId) {
            return { src: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`, isVideo: true };
        }
        return { src: resolveMediaUrl(media.src), isVideo: true };
    }

    return { src: resolveMediaUrl(media.src), isVideo: false };
}

let isArticleOrderDirty = false;
let autoSaveOrderTimer = null;

function markArticleOrderDirty(dirty) {
    isArticleOrderDirty = !!dirty;
}

function scheduleAutoSaveArticleOrder() {
    markArticleOrderDirty(true);
    if (autoSaveOrderTimer) {
        clearTimeout(autoSaveOrderTimer);
    }
    autoSaveOrderTimer = setTimeout(() => {
        saveArticleOrder(true);
    }, 250);
}

function getArticleOrderFromDom() {
    return Array.from(document.querySelectorAll('#articles-container .cms-article-card[data-article-id]'))
        .map(card => card.dataset.articleId)
        .filter(Boolean);
}

function moveArticleCard(articleId, direction) {
    const card = document.querySelector(`#articles-container .cms-article-card[data-article-id="${articleId}"]`);
    if (!card) return;

    if (direction === 'left') {
        const prev = card.previousElementSibling;
        if (!prev) return;
        prev.insertAdjacentElement('beforebegin', card);
        scheduleAutoSaveArticleOrder();
        return;
    }

    if (direction === 'right') {
        const next = card.nextElementSibling;
        if (!next) return;
        next.insertAdjacentElement('afterend', card);
        scheduleAutoSaveArticleOrder();
    }
}

async function saveArticleOrder(isAutomatic = false) {
    const order = getArticleOrderFromDom();
    if (!order.length) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/articles/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_ids: order })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Volgorde opslaan mislukt');
        }
        markArticleOrderDirty(false);
    } catch (error) {
        if (isAutomatic) {
            console.error('Automatisch opslaan van volgorde mislukt:', error);
        } else {
            alert(`Fout bij opslaan volgorde: ${error.message}`);
        }
    }
}

async function resetSingleArticleOrder(articleId) {
    if (!articleId) return;
    if (!confirm('Ben je zeker dat je de volgorde van dit artikel wilt resetten naar de standaardpositie?')) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/articles/${encodeURIComponent(articleId)}/reorder/reset`, {
            method: 'POST'
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Reset mislukt');
        }
        await loadArticles();
        markArticleOrderDirty(false);
    } catch (error) {
        alert(`Fout bij resetten van artikelvolgorde: ${error.message}`);
    }
}

async function loadStats() {
    const statsContainer = document.getElementById('stats-container');
    statsContainer.innerHTML = 'Statistieken laden...';
    try {
        const res = await fetch(`${API_BASE_URL}/stats`);
        const stats = await res.json();
        const views = stats.viewsPerArticle || [];
        const maxViews = Math.max(1, ...views.map(article => article.views || 0));
        statsContainer.innerHTML = `
            <div class="stats-cards">
                <div class="stats-card">
                    <div class="stats-label">Meeste bezoekers (laatste 7 dagen)</div>
                    <div class="stats-value">${stats.mostVisited.title} <span>(${stats.mostVisited.views})</span></div>
                </div>
                <div class="stats-card">
                    <div class="stats-label">Totaal aantal bezoekers</div>
                    <div class="stats-value">${stats.totalViews}</div>
                </div>
                <div class="stats-card">
                    <div class="stats-label">Meest aangeklikte artikel</div>
                    <div class="stats-value">${stats.mostClicked.title} <span>(${stats.mostClicked.clicks})</span></div>
                </div>
            </div>
            <div class="views-section">
                <h3>Views per artikel</h3>
                <div class="views-list">
                    ${views.map(article => {
                        const safeViews = article.views || 0;
                        const pct = Math.round((safeViews / maxViews) * 100);
                        return `
                            <div class="views-item">
                                <div class="views-title">${article.title}</div>
                                <div class="views-bar">
                                    <div class="views-bar-fill" style="width:${pct}%"></div>
                                </div>
                                <div class="views-value">${safeViews}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        statsContainer.innerHTML = 'Fout bij laden van statistieken.';
    }
}

async function loadArticles() {
    const container = document.getElementById('articles-container');
    container.innerHTML = 'Artikels laden...';
    try {
        const res = await fetch(`${API_BASE_URL}/articles`);
        const articles = await res.json();
        container.innerHTML = articles.map(article => `
            <div class="cms-article-card" data-article-id="${article.id}">
                ${(() => {
                    const thumb = getArticleThumbnailPreview(article);
                    if (thumb.isText) {
                        return `
                            <div class="cms-article-thumb-wrap">
                                <div class="cms-article-thumb-text" aria-label="Tekstartikel preview">
                                    ${thumb.category ? `<div class="cms-article-thumb-text-label">${thumb.category.toUpperCase()}</div>` : ''}
                                    <div class="cms-article-thumb-text-title">${thumb.title}</div>
                                </div>
                            </div>
                        `;
                    }
                    return `
                        <div class="cms-article-thumb-wrap">
                            <img class="cms-article-thumb" src="${thumb.src}" alt="Thumbnail van ${article.title || 'artikel'}" loading="lazy" onerror="this.src='/img/studiomalem_header.png'">
                            ${thumb.isVideo ? '<span class="cms-article-thumb-badge">VIDEO</span>' : ''}
                        </div>
                    `;
                })()}
                <h3><a class="cms-article-link" href="/article/${article.id}" target="_blank" rel="noopener">${article.title}</a></h3>
                <p class="cms-article-meta">Categorie: ${article.category || '-'}</p>
                <p class="cms-article-meta">Groep: ${article.group || 'standaard'}</p>
                <div class="cms-card-actions cms-card-actions-article">
                    <div class="cms-article-order-arrows">
                        <button type="button" data-move-article="left" data-article-id="${article.id}" title="Naar links">←</button>
                        <button type="button" data-move-article="right" data-article-id="${article.id}" title="Naar rechts">→</button>
                    </div>
                    <button type="button" data-reset-article-order="${article.id}" title="Reset volgorde voor dit artikel">Reset volgorde</button>
                    <hr class="cms-action-divider">
                    <button onclick="editArticle('${article.id}')">Aanpassen</button>
                    <a class="cms-button cms-button-small" href="/article/${article.id}" target="_blank" rel="noopener">Bekijk</a>
                    <hr class="cms-action-divider">
                    <button onclick="deleteArticle('${article.id}')">Verwijderen</button>
                </div>
                <span>Views: ${article.views} | Clicks: ${article.clicks}</span>
            </div>
        `).join('');
        container.querySelectorAll('button[data-move-article]').forEach(btn => {
            btn.addEventListener('click', () => {
                const direction = btn.getAttribute('data-move-article');
                const articleId = btn.getAttribute('data-article-id');
                moveArticleCard(articleId, direction);
            });
        });
        container.querySelectorAll('button[data-reset-article-order]').forEach(btn => {
            btn.addEventListener('click', () => {
                const articleId = btn.getAttribute('data-reset-article-order');
                resetSingleArticleOrder(articleId);
            });
        });
        markArticleOrderDirty(false);
    } catch (error) {
        container.innerHTML = 'Fout bij laden van artikels.';
    }
}

async function loadProducts() {
    const container = document.getElementById('products-container');
    container.innerHTML = 'Producten laden...';
    try {
        const res = await fetch(`${API_BASE_URL}/products?includeInactive=1`);
        const products = await res.json();
        container.innerHTML = products.map(product => `
            <div class="cms-article-card">
                <h3><a class="cms-article-link" href="/shop#${product.id}" target="_blank" rel="noopener">${product.title}</a></h3>
                <div class="cms-card-actions">
                    <button onclick="editProduct('${product.id}')">Aanpassen</button>
                    <a class="cms-button cms-button-small" href="/shop#${product.id}" target="_blank" rel="noopener">Bekijk</a>
                    <button onclick="deleteProduct('${product.id}')">Verwijderen</button>
                </div>
                <span>${formatPrice(product.price_cents, product.currency)} | ${product.active === false ? 'Inactief' : 'Actief'}</span>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = 'Fout bij laden van producten.';
    }
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

let footerSocialLinksState = [];

function normalizeSocialLink(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) {
        return '#';
    }
    if (/^#+https?:\/\//i.test(value)) {
        return value.replace(/^#+/, '');
    }
    if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(value)) {
        return value;
    }
    return `https://${value}`;
}

function renderSocialLinksList() {
    const listEl = document.getElementById('social-links-list');
    if (!listEl) return;

    if (!Array.isArray(footerSocialLinksState) || footerSocialLinksState.length === 0) {
        listEl.innerHTML = '<p class="cms-taxonomy-empty">Nog geen social links toegevoegd.</p>';
        return;
    }

    const lastIndex = footerSocialLinksState.length - 1;
    listEl.innerHTML = footerSocialLinksState.map((item, index) => `
        <div class="cms-social-item" data-social-index="${index}">
            <div class="cms-social-order-btns">
                <button type="button" class="cms-button cms-button-small" data-social-move="up" data-social-index="${index}" ${index === 0 ? 'disabled' : ''} title="Omhoog">↑</button>
                <button type="button" class="cms-button cms-button-small" data-social-move="down" data-social-index="${index}" ${index === lastIndex ? 'disabled' : ''} title="Omlaag">↓</button>
            </div>
            <div class="cms-social-item-fields" data-social-index="${index}">
                <input type="text" class="cms-input cms-social-label-input" value="${escapeHtml(item.label)}" data-social-field="label" data-social-index="${index}" placeholder="Platform">
                <input type="text" class="cms-input cms-social-url-input" value="${escapeHtml(item.url)}" data-social-field="url" data-social-index="${index}" placeholder="URL">
            </div>
            <button type="button" class="cms-button cms-button-small" data-social-remove-index="${index}" title="Verwijderen">✕</button>
        </div>
    `).join('');

    listEl.querySelectorAll('.cms-social-label-input, .cms-social-url-input').forEach(input => {
        input.addEventListener('input', () => {
            const idx = Number(input.getAttribute('data-social-index'));
            const field = input.getAttribute('data-social-field');
            if (!Number.isInteger(idx) || idx < 0 || idx >= footerSocialLinksState.length) return;
            footerSocialLinksState[idx] = { ...footerSocialLinksState[idx], [field]: input.value };
            scheduleHomepageSettingsSave();
        });
    });
}

function setTaxonomyStatus(message, kind = '') {
    const statusEl = document.getElementById('taxonomy-status');
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.className = `cms-status${kind ? ` cms-status-${kind}` : ''}`;
}

function normalizeHomepageInfoLink(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) {
        return '#';
    }
    if (/^#+https?:\/\//i.test(value)) {
        return value.replace(/^#+/, '');
    }
    if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(value)) {
        return value;
    }
    if (value.startsWith('#')) {
        return value;
    }
    return `https://${value}`;
}

function applyHomepagePreviewLink(element, rawValue) {
    if (!element) return;
    const href = normalizeHomepageInfoLink(rawValue);
    element.href = href;
    const opensNewTab = href !== '#' && !href.startsWith('#');
    element.target = opensNewTab ? '_blank' : '_self';
    element.rel = opensNewTab ? 'noopener noreferrer' : '';
}

async function loadTaxonomies() {
    const groupsContainer = document.getElementById('taxonomy-groups-container');
    const categoriesContainer = document.getElementById('taxonomy-categories-container');
    if (!groupsContainer || !categoriesContainer) return;

    groupsContainer.innerHTML = '<p class="cms-taxonomy-empty">Laden...</p>';
    categoriesContainer.innerHTML = '<p class="cms-taxonomy-empty">Laden...</p>';

    try {
        const res = await fetch(`${API_BASE_URL}/taxonomies`);
        if (!res.ok) {
            throw new Error('Kon taxonomies niet laden');
        }
        const data = await res.json();
        const groups = Array.isArray(data.groups) ? data.groups : [];
        const categories = Array.isArray(data.categories) ? data.categories : [];

        if (groups.length === 0) {
            groupsContainer.innerHTML = '<p class="cms-taxonomy-empty">Nog geen groups.</p>';
        } else {
            groupsContainer.innerHTML = `
                <div class="cms-taxonomy-list">
                    ${groups.map(group => `
                        <div class="cms-taxonomy-item">
                            <div>
                                <div class="cms-taxonomy-item-name">${escapeHtml(group.name)}</div>
                                <div class="cms-taxonomy-item-meta">${group.count || 0} artikel(s)${group.custom ? ' · custom' : ''}</div>
                            </div>
                            <div class="cms-taxonomy-item-actions">
                                <label class="cms-article-meta" style="display:flex;align-items:center;gap:6px;margin:0;">
                                    <input type="checkbox" data-taxonomy-action="toggle-highlight-group" data-name="${escapeHtml(group.name)}" ${group.highlighted ? 'checked' : ''}>
                                    highlighted
                                </label>
                                ${group.name !== 'standaard' ? `<button class="cms-button cms-button-small" data-taxonomy-action="rename-group" data-name="${escapeHtml(group.name)}">Naam wijzigen</button>` : ''}
                                <button class="cms-button cms-button-small" data-taxonomy-action="delete-group" data-name="${escapeHtml(group.name)}">Verwijderen</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (categories.length === 0) {
            categoriesContainer.innerHTML = '<p class="cms-taxonomy-empty">Nog geen categorieen.</p>';
        } else {
            categoriesContainer.innerHTML = `
                <div class="cms-taxonomy-list">
                    ${categories.map(category => `
                        <div class="cms-taxonomy-item">
                            <div>
                                <div class="cms-taxonomy-item-name">${escapeHtml(category.name)}</div>
                                <div class="cms-taxonomy-item-meta">${category.count || 0} artikel(s)${category.custom ? ' · custom' : ''}</div>
                            </div>
                            <div class="cms-taxonomy-item-actions">
                                <button class="cms-button cms-button-small" data-taxonomy-action="rename-category" data-name="${escapeHtml(category.name)}">Naam wijzigen</button>
                                <button class="cms-button cms-button-small" data-taxonomy-action="delete-category" data-name="${escapeHtml(category.name)}">Verwijderen</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } catch (error) {
        groupsContainer.innerHTML = '<p class="cms-taxonomy-empty">Fout bij laden van groups.</p>';
        categoriesContainer.innerHTML = '<p class="cms-taxonomy-empty">Fout bij laden van categorieen.</p>';
        setTaxonomyStatus(error.message || 'Fout bij laden', 'error');
    }
}

async function addTaxonomyGroup() {
    const input = document.getElementById('new-taxonomy-group');
    const value = input ? input.value.trim() : '';
    if (!value) {
        setTaxonomyStatus('Geef een groupnaam op.', 'error');
        return;
    }
    try {
        const res = await fetch(`${API_BASE_URL}/taxonomies/groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: value })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Toevoegen mislukt');
        if (input) input.value = '';
        setTaxonomyStatus('Group toegevoegd.', 'success');
        await loadTaxonomies();
    } catch (error) {
        setTaxonomyStatus(error.message || 'Fout bij toevoegen', 'error');
    }
}

async function addTaxonomyCategory() {
    const input = document.getElementById('new-taxonomy-category');
    const value = input ? input.value.trim() : '';
    if (!value) {
        setTaxonomyStatus('Geef een categorienaam op.', 'error');
        return;
    }
    try {
        const res = await fetch(`${API_BASE_URL}/taxonomies/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: value })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Toevoegen mislukt');
        if (input) input.value = '';
        setTaxonomyStatus('Categorie toegevoegd.', 'success');
        await loadTaxonomies();
    } catch (error) {
        setTaxonomyStatus(error.message || 'Fout bij toevoegen', 'error');
    }
}

async function handleTaxonomyAction(event) {
    const target = event.target;
    if (!target || !target.dataset) return;
    const action = target.dataset.taxonomyAction;
    const name = (target.dataset.name || '').trim();
    if (!action || !name) return;

    try {
        if (action === 'toggle-highlight-group') {
            const res = await fetch(`${API_BASE_URL}/taxonomies/groups/${encodeURIComponent(name)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ highlighted: !!target.checked })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Opslaan mislukt');
            setTaxonomyStatus('Highlight bijgewerkt.', 'success');
            return;
        }

        if (action === 'delete-group') {
            if (!confirm(`Group "${name}" verwijderen? Artikelen worden naar "standaard" verplaatst.`)) {
                return;
            }
            const res = await fetch(`${API_BASE_URL}/taxonomies/groups/${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Verwijderen mislukt');
            setTaxonomyStatus(`Group verwijderd. ${data.reassignedArticles || 0} artikel(s) verplaatst.`, 'success');
            await loadTaxonomies();
            await loadArticles();
            return;
        }

        if (action === 'rename-group') {
            const nextName = prompt('Nieuwe naam voor deze group:', name);
            const trimmedName = (nextName || '').trim();
            if (!trimmedName || trimmedName === name) {
                return;
            }
            const res = await fetch(`${API_BASE_URL}/taxonomies/groups/${encodeURIComponent(name)}/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmedName })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Hernoemen mislukt');
            setTaxonomyStatus(`Group hernoemd naar "${data.name}". ${data.updatedArticles || 0} artikel(s) aangepast.`, 'success');
            await loadTaxonomies();
            await loadArticles();
            return;
        }

        if (action === 'delete-category') {
            if (!confirm(`Categorie "${name}" verwijderen? Categorie wordt leeggemaakt op gekoppelde artikels.`)) {
                return;
            }
            const res = await fetch(`${API_BASE_URL}/taxonomies/categories/${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Verwijderen mislukt');
            setTaxonomyStatus(`Categorie verwijderd. ${data.updatedArticles || 0} artikel(s) aangepast.`, 'success');
            await loadTaxonomies();
            await loadArticles();
            return;
        }

        if (action === 'rename-category') {
            const nextName = prompt('Nieuwe naam voor deze categorie:', name);
            const trimmedName = (nextName || '').trim();
            if (!trimmedName || trimmedName === name) {
                return;
            }
            const res = await fetch(`${API_BASE_URL}/taxonomies/categories/${encodeURIComponent(name)}/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmedName })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Hernoemen mislukt');
            setTaxonomyStatus(`Categorie hernoemd naar "${data.name}". ${data.updatedArticles || 0} artikel(s) aangepast.`, 'success');
            await loadTaxonomies();
            await loadArticles();
        }
    } catch (error) {
        setTaxonomyStatus(error.message || 'Fout bij bewerken', 'error');
        await loadTaxonomies();
    }
}

window.editArticle = function(id) {
    window.location.href = `cms-edit.html?id=${encodeURIComponent(id)}`;
};

window.deleteArticle = async function(id) {
    if (!confirm('Weet je zeker dat je dit artikel wilt verwijderen?')) {
        return;
    }
    try {
        await fetch(`${API_BASE_URL}/articles/${id}`, { method: 'DELETE' });
        loadArticles();
    } catch (error) {
        alert('Fout bij verwijderen.');
    }
};

window.editProduct = function(id) {
    window.location.href = `/cms-product-edit?id=${encodeURIComponent(id)}`;
};

window.deleteProduct = async function(id) {
    if (!confirm('Weet je zeker dat je dit product wilt verwijderen?')) {
        return;
    }
    try {
        await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' });
        loadProducts();
    } catch (error) {
        alert('Fout bij verwijderen.');
    }
};

const addArticleBtn = document.getElementById('add-article-btn');
if (addArticleBtn) {
    addArticleBtn.onclick = () => {
        window.location.href = 'cms-create.html';
    };
}

const addProductBtn = document.getElementById('add-product-btn');
if (addProductBtn) {
    addProductBtn.onclick = () => {
        window.location.href = '/cms-product-create';
    };
}

async function loadHomepageSettings() {
    const statusEl = document.getElementById('homepage-status');
    window.__homepageSettingsLoading = true;
    try {
        const res = await fetch(`${API_BASE_URL}/site`);
        if (!res.ok) {
            throw new Error('Instellingen niet gevonden');
        }
        const data = await res.json();
        document.getElementById('newsletterTitleInput').value = data.newsletterTitle || '';
        document.getElementById('newsletterTextInput').value = data.newsletterText || '';
        document.getElementById('newsletterButtonTextInput').value = data.newsletterButtonText || '';
        document.getElementById('newsletterButtonLinkInput').value = data.newsletterButtonLink || '';
        document.getElementById('newsletterVisibleInput').checked = data.newsletterVisible !== false;
        document.getElementById('workshopTitleInput').value = data.workshopTitle || '';
        document.getElementById('workshopTextInput').value = data.workshopText || '';
        document.getElementById('workshopButtonTextInput').value = data.workshopButtonText || '';
        document.getElementById('workshopButtonLinkInput').value = data.workshopButtonLink || '';
        document.getElementById('workshopVisibleInput').checked = data.workshopVisible !== false;
        document.getElementById('shopVisibleInput').checked = data.shopVisible !== false;
        footerSocialLinksState = Array.isArray(data.footerSocialLinks)
            ? data.footerSocialLinks
                .filter(item => item && typeof item === 'object')
                .map(item => ({
                    label: String(item.label || '').trim(),
                    url: String(item.url || '').trim()
                }))
                .filter(item => item.label && item.url)
            : [];
        renderSocialLinksList();
        updateHomepagePreview();
        if (statusEl) {
            statusEl.textContent = '';
        }
    } catch (error) {
        if (statusEl) {
            statusEl.textContent = 'Fout bij laden van homepage instellingen.';
        }
    } finally {
        window.__homepageSettingsLoading = false;
    }
}

let homepageAutoSaveTimer = null;

function scheduleHomepageSettingsSave() {
    if (window.__homepageSettingsLoading) {
        return;
    }
    const statusEl = document.getElementById('homepage-status');
    if (statusEl) {
        statusEl.textContent = 'Wijzigingen worden opgeslagen...';
        statusEl.className = 'cms-status';
    }
    if (homepageAutoSaveTimer) {
        clearTimeout(homepageAutoSaveTimer);
    }
    homepageAutoSaveTimer = setTimeout(() => {
        saveHomepageSettings(true);
    }, 350);
}

function updateHomepagePreview() {
    const newsletterPreviewBox = document.getElementById('newsletterPreviewBox');
    const newsletterPreviewTitle = document.getElementById('newsletterPreviewTitle');
    const newsletterPreviewText = document.getElementById('newsletterPreviewText');
    const newsletterPreviewButton = document.getElementById('newsletterPreviewButton');
    const workshopPreviewBox = document.getElementById('workshopPreviewBox');
    const workshopPreviewTitle = document.getElementById('workshopPreviewTitle');
    const workshopPreviewText = document.getElementById('workshopPreviewText');
    const workshopPreviewButton = document.getElementById('workshopPreviewButton');

    const newsletterVisible = document.getElementById('newsletterVisibleInput')?.checked !== false;
    const workshopVisible = document.getElementById('workshopVisibleInput')?.checked !== false;

    if (newsletterPreviewTitle) newsletterPreviewTitle.textContent = document.getElementById('newsletterTitleInput')?.value.trim() || 'Lege titel';
    if (newsletterPreviewText) newsletterPreviewText.textContent = document.getElementById('newsletterTextInput')?.value.trim() || 'Lege tekst';
    if (newsletterPreviewButton) {
        newsletterPreviewButton.textContent = document.getElementById('newsletterButtonTextInput')?.value.trim() || 'Knop';
        applyHomepagePreviewLink(newsletterPreviewButton, document.getElementById('newsletterButtonLinkInput')?.value.trim());
    }
    if (newsletterPreviewBox) {
        newsletterPreviewBox.style.opacity = newsletterVisible ? '1' : '0.45';
    }

    if (workshopPreviewTitle) workshopPreviewTitle.textContent = document.getElementById('workshopTitleInput')?.value.trim() || 'Lege titel';
    if (workshopPreviewText) workshopPreviewText.textContent = document.getElementById('workshopTextInput')?.value.trim() || 'Lege tekst';
    if (workshopPreviewButton) {
        workshopPreviewButton.textContent = document.getElementById('workshopButtonTextInput')?.value.trim() || 'Knop';
        applyHomepagePreviewLink(workshopPreviewButton, document.getElementById('workshopButtonLinkInput')?.value.trim());
    }
    if (workshopPreviewBox) {
        workshopPreviewBox.style.opacity = workshopVisible ? '1' : '0.45';
    }
}

async function saveHomepageSettings(isAutomatic = false) {
    const statusEl = document.getElementById('homepage-status');
    if (statusEl) {
        statusEl.textContent = 'Opslaan...';
    }
    const payload = {
        newsletterTitle: document.getElementById('newsletterTitleInput').value.trim(),
        newsletterText: document.getElementById('newsletterTextInput').value.trim(),
        newsletterButtonText: document.getElementById('newsletterButtonTextInput').value.trim(),
        newsletterButtonLink: document.getElementById('newsletterButtonLinkInput').value.trim(),
        newsletterVisible: !!document.getElementById('newsletterVisibleInput').checked,
        workshopTitle: document.getElementById('workshopTitleInput').value.trim(),
        workshopText: document.getElementById('workshopTextInput').value.trim(),
        workshopButtonText: document.getElementById('workshopButtonTextInput').value.trim(),
        workshopButtonLink: document.getElementById('workshopButtonLinkInput').value.trim(),
        workshopVisible: !!document.getElementById('workshopVisibleInput').checked,
        shopVisible: !!document.getElementById('shopVisibleInput').checked,
        footerSocialLinks: footerSocialLinksState
    };
    try {
        const res = await fetch(`${API_BASE_URL}/site`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            throw new Error('Opslaan mislukt');
        }
        if (statusEl) {
            statusEl.textContent = isAutomatic ? 'Automatisch opgeslagen.' : 'Opgeslagen.';
            statusEl.className = 'cms-status cms-status-success';
        }
    } catch (error) {
        if (statusEl) {
            statusEl.textContent = 'Fout bij opslaan.';
            statusEl.className = 'cms-status cms-status-error';
        }
    }
}

const saveHomepageBtn = document.getElementById('save-homepage-btn');
if (saveHomepageBtn) {
    saveHomepageBtn.addEventListener('click', saveHomepageSettings);
}

[
    'newsletterTitleInput',
    'newsletterTextInput',
    'newsletterButtonTextInput',
    'newsletterButtonLinkInput',
    'newsletterVisibleInput',
    'workshopTitleInput',
    'workshopTextInput',
    'workshopButtonTextInput',
    'workshopButtonLinkInput',
    'workshopVisibleInput',
    'shopVisibleInput'
].forEach(id => {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener(element.type === 'checkbox' ? 'change' : 'input', () => {
        updateHomepagePreview();
        scheduleHomepageSettingsSave();
    });
});

async function loadContactSettings() {
    const statusEl = document.getElementById('contact-status');
    window.__contactSettingsLoading = true;
    try {
        const res = await fetch(`${API_BASE_URL}/site`);
        if (!res.ok) throw new Error('Instellingen niet gevonden');
        const data = await res.json();
        document.getElementById('contactIntroInput').value = data.contactIntro || '';
        document.getElementById('contactEmailInput').value = data.contactEmail || '';
        document.getElementById('contactPhoneInput').value = data.contactPhone || '';
        document.getElementById('contactAddressInput').value = data.contactAddress || '';
        if (statusEl) statusEl.textContent = '';
    } catch (error) {
        if (statusEl) statusEl.textContent = 'Fout bij laden van contact instellingen.';
    } finally {
        window.__contactSettingsLoading = false;
    }
}

let contactAutoSaveTimer = null;

function scheduleContactSettingsSave() {
    if (window.__contactSettingsLoading) return;
    const statusEl = document.getElementById('contact-status');
    if (statusEl) {
        statusEl.textContent = 'Wijzigingen worden opgeslagen...';
        statusEl.className = 'cms-status';
    }
    if (contactAutoSaveTimer) clearTimeout(contactAutoSaveTimer);
    contactAutoSaveTimer = setTimeout(() => saveContactSettings(true), 350);
}

async function saveContactSettings(isAutomatic = false) {
    const statusEl = document.getElementById('contact-status');
    if (statusEl) statusEl.textContent = 'Opslaan...';
    const payload = {
        contactIntro: document.getElementById('contactIntroInput').value.trim(),
        contactEmail: document.getElementById('contactEmailInput').value.trim(),
        contactPhone: document.getElementById('contactPhoneInput').value.trim(),
        contactAddress: document.getElementById('contactAddressInput').value.trim()
    };
    try {
        const res = await fetch(`${API_BASE_URL}/site`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Opslaan mislukt');
        if (statusEl) {
            statusEl.textContent = isAutomatic ? 'Automatisch opgeslagen.' : 'Opgeslagen.';
            statusEl.className = 'cms-status cms-status-success';
        }
    } catch (error) {
        if (statusEl) {
            statusEl.textContent = 'Fout bij opslaan.';
            statusEl.className = 'cms-status cms-status-error';
        }
    }
}

const saveContactBtn = document.getElementById('save-contact-btn');
if (saveContactBtn) {
    saveContactBtn.addEventListener('click', saveContactSettings);
}

['contactIntroInput', 'contactEmailInput', 'contactPhoneInput', 'contactAddressInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', scheduleContactSettingsSave);
});

async function updateOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error('Fout bij opslaan');
        // Optioneel: feedback tonen
    } catch (e) {
        alert('Fout bij opslaan status: ' + e.message);
    }
}

async function loadOrders() {
    const ordersContainer = document.getElementById('orders-container');
    if (!ordersContainer) return;
    try {
        const res = await fetch(`${API_BASE_URL}/orders`);
        if (!res.ok) throw new Error('Bestellingen niet gevonden');
        const orders = await res.json();
        if (orders.length === 0) {
            ordersContainer.innerHTML = '<p>Geen bestellingen gevonden.</p>';
            return;
        }
        const statusClass = status => {
            if (status === 'completed') return 'order-row-completed';
            if (status === 'pending') return 'order-row-pending';
            if (status === 'processing') return 'order-row-processing';
            if (status === 'cancelled') return 'order-row-cancelled';
            return '';
        };
        const statusBadge = status => {
            if (status === 'completed') return '<span class="order-badge order-badge-completed">✔ Afgerond</span>';
            if (status === 'pending') return '<span class="order-badge order-badge-pending">⏳ In afwachting</span>';
            if (status === 'processing') return '<span class="order-badge order-badge-processing">🔄 In behandeling</span>';
            if (status === 'cancelled') return '<span class="order-badge order-badge-cancelled">✖ Geannuleerd</span>';
            return '';
        };
        const html = `
            <table class="order-table">
                <thead>
                    <tr>
                        <th>Ordernummer</th>
                        <th>E-mail klant</th>
                        <th>Aantal items</th>
                        <th>Totaal</th>
                        <th>Datum</th>
                        <th>Status</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr class="${statusClass(order.status)}">
                            <td><code>${order.id.substring(0, 16)}...</code></td>
                            <td>${order.customer_email}</td>
                            <td>${order.items.length}</td>
                            <td>${formatPrice(order.total_cents)}</td>
                            <td>${new Date(order.created_at).toLocaleDateString('nl-BE')}</td>
                            <td>${statusBadge(order.status)}</td>
                            <td><a href="/cms-order.html?id=${order.id}" class="order-view-btn btn-order-view">Bekijk</a></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        ordersContainer.innerHTML = html;
    } catch (error) {
        ordersContainer.innerHTML = `<p class="error">Fout bij laden van bestellingen: ${error.message}</p>`;
    }
}

function showOrderModal(order) {
    const modal = document.getElementById('order-modal');
    if (!modal) return;
    const statusOptions = ['completed','pending','processing','cancelled'];
    const itemsHtml = order.items.map(item => `
        <li class="order-modal-item">
            <b>${item.product_title}</b> &times; ${item.quantity} — <span class="order-modal-item-price">${formatPrice(item.price_cents)}</span>
        </li>
    `).join('');
    modal.innerHTML = `
        <div class="order-modal-content">
            <button class="order-modal-close" title="Sluiten">&times;</button>
            <h3>Bestelling details</h3>
            <p><b>Ordernummer:</b> <code>${order.id}</code></p>
            <p><b>Status:</b> <select id="order-modal-status">
                ${statusOptions.map(opt => `<option value="${opt}"${order.status===opt?' selected':''}>${opt}</option>`).join('')}
            </select></p>
            <p><b>Datum:</b> ${new Date(order.created_at).toLocaleString('nl-BE')}</p>
            <p><b>Klant e-mail:</b> ${order.customer_email}</p>
            <p><b>Leveradres:</b> ${order.shipping_address ? formatAddress(order.shipping_address) : '<i>Niet opgegeven</i>'}</p>
            <p><b>Items:</b></p>
            <ul class="order-modal-items-list">${itemsHtml}</ul>
            <p class="order-modal-total"><b>Totaal:</b> ${formatPrice(order.total_cents)}</p>
        </div>
    `;
    modal.style.display = 'flex';
    modal.querySelector('.order-modal-close').onclick = () => {
        modal.style.display = 'none';
    };
    modal.onclick = e => {
        if (e.target === modal) modal.style.display = 'none';
    };
    // Status wijzigen
    const statusSelect = modal.querySelector('#order-modal-status');
    statusSelect.onchange = async () => {
        await updateOrderStatus(order.id, statusSelect.value);
        modal.style.display = 'none';
        loadOrders();
    };
}

function formatAddress(addr) {
    if (typeof addr === 'string') return addr;
    return `${addr.name || ''}, ${addr.address || ''}, ${addr.postal || ''} ${addr.city || ''}`;
}

const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
if (refreshOrdersBtn) {
    refreshOrdersBtn.addEventListener('click', loadOrders);
}


document.addEventListener('DOMContentLoaded', () => {
    // Tab functionaliteit voor alle tabs inclusief settings
    const tabBtns = document.querySelectorAll('.cms-tab-btn');
    const tabContents = {
        'cms-tab-orders': document.getElementById('cms-tab-orders'),
        'cms-tab-articles': document.getElementById('cms-tab-articles'),
        'cms-tab-taxonomy': document.getElementById('cms-tab-taxonomy'),
        'cms-tab-products': document.getElementById('cms-tab-products'),
        'cms-tab-content': document.getElementById('cms-tab-content'),
        'cms-tab-stats': document.getElementById('cms-tab-stats'),
        'cms-tab-homepage': document.getElementById('cms-tab-homepage'),
        'cms-tab-contact': document.getElementById('cms-tab-contact')
    };
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.getAttribute('data-tab');
            Object.keys(tabContents).forEach(key => {
                if (tabContents[key]) {
                    tabContents[key].style.display = (key === tab) ? '' : 'none';
                }
            });
        });
    });
    // Standaard: Artikelen tab actief
    Object.keys(tabContents).forEach(key => {
        tabContents[key].style.display = (key === 'cms-tab-articles') ? '' : 'none';
    });

    // Password toggle buttons
    const toggleBtns = document.querySelectorAll('.cms-toggle-pw-btn');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                input.type = input.type === 'password' ? 'text' : 'password';
                btn.textContent = input.type === 'password' ? '👁' : '👁‍🗨️';
            }
        });
    });

    // Settings handlers
    const loadSettingsBtn = document.getElementById('load-settings-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const deployServerBtn = document.getElementById('deploy-server-btn');
    const cmsPasswordInput = document.getElementById('cmsPasswordInput');
    const stripeSecretInput = document.getElementById('stripeSecretKeyInput');
    const stripePublishableInput = document.getElementById('stripePublishableKeyInput');
    const socialPlatformInput = document.getElementById('socialPlatformInput');
    const socialLinkInput = document.getElementById('socialLinkInput');
    const addSocialLinkBtn = document.getElementById('add-social-link-btn');
    const socialLinksList = document.getElementById('social-links-list');
    const settingsStatus = document.getElementById('settingsStatus');

    if (loadSettingsBtn) {
        loadSettingsBtn.addEventListener('click', async () => {
            settingsStatus.textContent = 'Laden...';
            settingsStatus.className = 'cms-status';
            try {
                const stripeResponse = await fetch('/api/cms/stripe-config');
                const stripeData = await stripeResponse.json();

                if (stripeResponse.ok) {
                    stripeSecretInput.value = stripeData.secret_key_full;
                    stripePublishableInput.value = stripeData.publishable_key_full;
                }

                if (stripeResponse.ok) {
                    settingsStatus.textContent = stripeData.configured ? 'Instellingen geladen' : 'Instellingen geladen (geen Stripe keys ingesteld)';
                    settingsStatus.className = 'cms-status cms-status-success';
                } else {
                    settingsStatus.textContent = 'Fout bij laden van Stripe instellingen';
                    settingsStatus.className = 'cms-status cms-status-error';
                }
            } catch (error) {
                console.error('Error loading settings:', error);
                settingsStatus.textContent = 'Fout bij laden van instellingen';
                settingsStatus.className = 'cms-status cms-status-error';
            }
        });
    }

    if (addSocialLinkBtn) {
        addSocialLinkBtn.addEventListener('click', () => {
            const label = (socialPlatformInput?.value || '').trim();
            const url = normalizeSocialLink((socialLinkInput?.value || '').trim());
            const homepageStatus = document.getElementById('homepage-status');
            if (!label || !url || url === '#') {
                if (homepageStatus) {
                    homepageStatus.textContent = 'Geef een platform en geldige link op.';
                    homepageStatus.className = 'cms-status cms-status-error';
                }
                return;
            }
            footerSocialLinksState.push({ label, url });
            if (socialPlatformInput) socialPlatformInput.value = '';
            if (socialLinkInput) socialLinkInput.value = '';
            renderSocialLinksList();
            scheduleHomepageSettingsSave();
        });
    }

    if (socialLinksList) {
        socialLinksList.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            const removeIndex = target.getAttribute('data-social-remove-index');
            if (removeIndex !== null) {
                const index = Number(removeIndex);
                if (!Number.isInteger(index) || index < 0 || index >= footerSocialLinksState.length) return;
                footerSocialLinksState.splice(index, 1);
                renderSocialLinksList();
                scheduleHomepageSettingsSave();
                return;
            }

            const moveDir = target.getAttribute('data-social-move');
            if (moveDir !== null) {
                const index = Number(target.getAttribute('data-social-index'));
                if (!Number.isInteger(index) || index < 0 || index >= footerSocialLinksState.length) return;
                if (moveDir === 'up' && index > 0) {
                    [footerSocialLinksState[index - 1], footerSocialLinksState[index]] =
                        [footerSocialLinksState[index], footerSocialLinksState[index - 1]];
                }
                if (moveDir === 'down' && index < footerSocialLinksState.length - 1) {
                    [footerSocialLinksState[index], footerSocialLinksState[index + 1]] =
                        [footerSocialLinksState[index + 1], footerSocialLinksState[index]];
                }
                renderSocialLinksList();
                scheduleHomepageSettingsSave();
                return;
            }
        });
    }

    const refreshTaxonomyBtn = document.getElementById('refresh-taxonomy-btn');
    if (refreshTaxonomyBtn) {
        refreshTaxonomyBtn.addEventListener('click', loadTaxonomies);
    }
    const addTaxonomyGroupBtn = document.getElementById('add-taxonomy-group-btn');
    if (addTaxonomyGroupBtn) {
        addTaxonomyGroupBtn.addEventListener('click', addTaxonomyGroup);
    }
    const addTaxonomyCategoryBtn = document.getElementById('add-taxonomy-category-btn');
    if (addTaxonomyCategoryBtn) {
        addTaxonomyCategoryBtn.addEventListener('click', addTaxonomyCategory);
    }

    const groupsContainer = document.getElementById('taxonomy-groups-container');
    if (groupsContainer) {
        groupsContainer.addEventListener('click', handleTaxonomyAction);
        groupsContainer.addEventListener('change', handleTaxonomyAction);
    }
    const categoriesContainer = document.getElementById('taxonomy-categories-container');
    if (categoriesContainer) {
        categoriesContainer.addEventListener('click', handleTaxonomyAction);
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            const newCmsPassword = cmsPasswordInput.value.trim();
            const secretKey = stripeSecretInput.value.trim();
            const publishableKey = stripePublishableInput.value.trim();

            settingsStatus.textContent = 'Opslaan...';
            settingsStatus.className = 'cms-status';
            saveSettingsBtn.disabled = true;

            let errorOccurred = false;

            // Save Stripe config
            try {
                const response = await fetch('/api/cms/stripe-config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        secret_key: secretKey,
                        publishable_key: publishableKey
                    })
                });

                const data = await response.json();
                if (!response.ok) {
                    settingsStatus.textContent = data.error || 'Fout bij opslaan Stripe keys';
                    settingsStatus.className = 'cms-status cms-status-error';
                    errorOccurred = true;
                }
            } catch (error) {
                console.error('Error saving Stripe config:', error);
                settingsStatus.textContent = 'Fout bij opslaan van Stripe keys';
                settingsStatus.className = 'cms-status cms-status-error';
                errorOccurred = true;
            }

            // Save CMS password if changed
            if (newCmsPassword && !errorOccurred) {
                try {
                    const response = await fetch('/api/cms/password', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            password: newCmsPassword
                        })
                    });

                    const data = await response.json();
                    if (response.ok) {
                        settingsStatus.textContent = 'Instellingen opgeslagen. U wordt uitgelogd...';
                        settingsStatus.className = 'cms-status cms-status-success';
                        setTimeout(() => {
                            window.location.href = '/cms-login';
                        }, 2000);
                    } else {
                        settingsStatus.textContent = data.error || 'Fout bij wijzigen wachtwoord';
                        settingsStatus.className = 'cms-status cms-status-error';
                    }
                } catch (error) {
                    console.error('Error changing password:', error);
                    settingsStatus.textContent = 'Fout bij wijzigen van wachtwoord';
                    settingsStatus.className = 'cms-status cms-status-error';
                }
            } else if (!errorOccurred) {
                settingsStatus.textContent = 'Instellingen opgeslagen';
                settingsStatus.className = 'cms-status cms-status-success';
            }

            saveSettingsBtn.disabled = false;
        });
    }

    if (deployServerBtn) {
        deployServerBtn.addEventListener('click', async () => {
            if (!confirm('Ben je zeker dat je de server wilt updaten en herstarten via setup_vps.sh? Dit kan de site kort onderbreken.')) {
                return;
            }

            settingsStatus.textContent = 'Deploy wordt gestart...';
            settingsStatus.className = 'cms-status';
            deployServerBtn.disabled = true;

            try {
                const response = await fetch('/api/cms/deploy', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Deploy starten mislukt');
                }
                settingsStatus.textContent = data.message || 'Deploy gestart. Git sync en herstart lopen nu op de server.';
                settingsStatus.className = 'cms-status cms-status-success';
            } catch (error) {
                settingsStatus.textContent = error.message || 'Fout bij starten van deploy';
                settingsStatus.className = 'cms-status cms-status-error';
            } finally {
                deployServerBtn.disabled = false;
            }
        });
    }

    // Laad data
    loadStats();
    loadArticles();
    loadProducts();
    loadTaxonomies();
    loadHomepageSettings();
    loadContactSettings();
    loadOrders();
});
