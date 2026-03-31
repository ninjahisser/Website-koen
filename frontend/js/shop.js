function animateCartButton() {
    const btn = document.getElementById('floating-cart-btn');
    if (!btn) return;
    btn.classList.remove('cart-animate');
    // Force reflow for restart animation
    void btn.offsetWidth;
    btn.classList.add('cart-animate');
}
const shopStatusEl = document.getElementById('shop-status');
const productsGridEl = document.getElementById('products-grid');

let stripeClient = null;
let stripeConfig = { enabled: false, publishableKey: '' };
let products = [];

function formatPrice(priceCents, currency = 'eur') {
    return new Intl.NumberFormat('nl-BE', {
        style: 'currency',
        currency: (currency || 'eur').toUpperCase()
    }).format((priceCents || 0) / 100);
}

function setStatus(message, kind = 'info') {
    if (!message) {
        shopStatusEl.style.display = 'none';
        shopStatusEl.textContent = '';
        shopStatusEl.className = 'cms-status';
        return;
    }
    shopStatusEl.style.display = 'block';
    shopStatusEl.textContent = message;
    shopStatusEl.className = `cms-status cms-status-${kind}`;
}





function renderProducts() {
    if (!products.length) {
        productsGridEl.innerHTML = '<div class="error">Geen producten gevonden.</div>';
        return;
    }

    productsGridEl.innerHTML = products.map(product => `
        <article id="${product.id}" class="shop-card">
            <div class="shop-card-image-wrap">
                <img class="shop-card-image" src="${resolveMediaUrl(product.image)}" alt="${product.title}">
                <span class="shop-card-badge">${product.badge || product.category || 'Shop'}</span>
            </div>
            <div class="shop-card-content">
                <div class="shop-card-topline">${product.category || 'Artikel'}</div>
                <h3>${product.title}</h3>
                <p class="shop-card-subtitle">${product.subtitle || ''}</p>
                <p class="shop-card-description">${product.short_description || product.description || ''}</p>
                <div class="shop-card-footer">
                    <span class="shop-price">${formatPrice(product.price_cents, product.currency)}</span>
                    <button class="btn-blue shop-buy-button" data-product-id="${product.id}">${product.cta_label || 'Koop nu'}</button>
                </div>
            </div>
        </article>
    `).join('');
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        setStatus('Product niet gevonden.', 'error');
        return;
    }

    // Use global cart instance from cart.js
    if (typeof cart !== 'undefined') {
        const result = cart.addItem(product);
        animateCartButton();
        if (result === 'added') {
            setStatus(`${product.title} toegevoegd aan winkelmandje!`, 'success');
        } else {
            setStatus(`${product.title} hoeveelheid verhoogd!`, 'success');
        }
    } else {
        setStatus('Winkelmandje niet beschikbaar.', 'error');
    }
}

function handleQueryStatus() {
    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get('checkout');
    if (checkoutState === 'success') {
        setStatus('Bestelling geslaagd!', 'success');
    } else if (checkoutState === 'cancelled') {
        setStatus('Betaling geannuleerd. Je kan opnieuw proberen wanneer je wil.', 'error');
    }
}

function registerEvents() {
    document.addEventListener('click', event => {
        const button = event.target.closest('.shop-buy-button');
        if (!button) {
            return;
        }
        addToCart(button.dataset.productId);
    });
}


async function loadShop() {
    handleQueryStatus();
    try {
        const [productsResponse, stripeResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/products`),
            fetch(`${API_BASE_URL}/stripe/config`)
        ]);

        if (!productsResponse.ok) {
            throw new Error('Producten konden niet geladen worden.');
        }

        products = await productsResponse.json();
        stripeConfig = stripeResponse.ok ? await stripeResponse.json() : { enabled: false, publishableKey: '' };
        if (stripeConfig.enabled && stripeConfig.publishableKey && window.Stripe) {
            stripeClient = window.Stripe(stripeConfig.publishableKey);
        }

        // Stripe status UI niet meer nodig
        renderProducts();

        if (window.location.hash) {
            const target = document.querySelector(window.location.hash);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    } catch (error) {
        productsGridEl.innerHTML = '<div class="error">Fout bij laden van shop.</div>';
        setStatus(error.message, 'error');
        // Stripe status UI niet meer nodig
    }
}

registerEvents();
loadShop();
