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
            <div class="cms-article-card">
                <h3><a class="cms-article-link" href="/article/${article.id}" target="_blank" rel="noopener">${article.title}</a></h3>
                <div class="cms-card-actions">
                    <button onclick="editArticle('${article.id}')">Aanpassen</button>
                    <a class="cms-button cms-button-small" href="/article/${article.id}" target="_blank" rel="noopener">Bekijk</a>
                    <button onclick="deleteArticle('${article.id}')">Verwijderen</button>
                </div>
                <span>Views: ${article.views} | Clicks: ${article.clicks}</span>
            </div>
        `).join('');
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
        //HVLN // document.getElementById('workshopTitleInput').value = data.workshopTitle || '';
        //HVLN // document.getElementById('workshopTextInput').value = data.workshopText || '';
        //HVLN // document.getElementById('workshopButtonTextInput').value = data.workshopButtonText || '';
        //HVLN // document.getElementById('workshopButtonLinkInput').value = data.workshopButtonLink || '';
        if (statusEl) {
            statusEl.textContent = '';
        }
    } catch (error) {
        if (statusEl) {
            statusEl.textContent = 'Fout bij laden van homepage instellingen.';
        }
    }
}

async function saveHomepageSettings() {
    const statusEl = document.getElementById('homepage-status');
    if (statusEl) {
        statusEl.textContent = 'Opslaan...';
    }
    const payload = {
        newsletterTitle: document.getElementById('newsletterTitleInput').value.trim(),
        newsletterText: document.getElementById('newsletterTextInput').value.trim(),
        newsletterButtonText: document.getElementById('newsletterButtonTextInput').value.trim(),
        newsletterButtonLink: document.getElementById('newsletterButtonLinkInput').value.trim(),
        //HLVN // workshopTitle: document.getElementById('workshopTitleInput').value.trim(),
        //HVLN // workshopText: document.getElementById('workshopTextInput').value.trim(),
        //HVLN // workshopButtonText: document.getElementById('workshopButtonTextInput').value.trim(),
        //HVLN // workshopButtonLink: document.getElementById('workshopButtonLinkInput').value.trim()
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
            statusEl.textContent = 'Opgeslagen.';
        }
    } catch (error) {
        if (statusEl) {
            statusEl.textContent = 'Fout bij opslaan.';
        }
    }
}

const saveHomepageBtn = document.getElementById('save-homepage-btn');
if (saveHomepageBtn) {
    saveHomepageBtn.addEventListener('click', saveHomepageSettings);
}

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
    // Tab functionaliteit voor 4 tabs
    const tabBtns = document.querySelectorAll('.cms-tab-btn');
    const tabContents = {
        'cms-tab-orders': document.getElementById('cms-tab-orders'),
        'cms-tab-products': document.getElementById('cms-tab-products'),
        'cms-tab-content': document.getElementById('cms-tab-content'),
        'cms-tab-stats': document.getElementById('cms-tab-stats'),
        'cms-tab-homepage': document.getElementById('cms-tab-homepage')
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
    // Standaard: Shop tab actief
    Object.keys(tabContents).forEach(key => {
        tabContents[key].style.display = (key === 'cms-tab-orders') ? '' : 'none';
    });

    // Laad data
    loadStats();
    loadArticles();
    loadProducts();
    loadHomepageSettings();
    loadOrders();
});
