const editStatusEl = document.getElementById('product-edit-status');
const editFormEl = document.getElementById('product-edit-form');
const editImageInputEl = document.getElementById('image');
const editImageFileEl = document.getElementById('image-file');
const editImagePreviewEl = document.getElementById('image-preview');
const editImageUploadStatusEl = document.getElementById('image-upload-status');
const shopPreviewLinkEl = document.getElementById('shop-preview-link');

function getProductId() {
    return new URLSearchParams(window.location.search).get('id');
}

function setEditStatus(message, kind = 'info') {
    editStatusEl.textContent = message;
    editStatusEl.className = `cms-status cms-status-${kind}`;
}

function updateEditImagePreview(url) {
    editImagePreviewEl.innerHTML = url ? `<img src="${resolveMediaUrl(url)}" alt="Preview">` : '';
}

async function uploadEditImage(file) {
    const productId = getProductId() || `product_temp_${Date.now()}`;
    editImageUploadStatusEl.textContent = 'Uploaden...';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('article_id', productId);
    formData.append('index', '0');

    const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || 'Upload mislukt.');
    }
    editImageInputEl.value = payload.url;
    updateEditImagePreview(payload.url);
    editImageUploadStatusEl.textContent = 'Afbeelding geüpload.';
}

function fillForm(product) {
    document.getElementById('title').value = product.title || '';
    document.getElementById('subtitle').value = product.subtitle || '';
    document.getElementById('category').value = product.category || '';
    document.getElementById('badge').value = product.badge || '';
    document.getElementById('short_description').value = product.short_description || '';
    document.getElementById('description').value = product.description || '';
    document.getElementById('price_eur').value = ((product.price_cents || 0) / 100).toFixed(2);
    document.getElementById('cta_label').value = product.cta_label || 'Koop nu';
    document.getElementById('featured').checked = Boolean(product.featured);
    document.getElementById('active').checked = product.active !== false;
    editImageInputEl.value = product.image || '';
    updateEditImagePreview(product.image || '');
    shopPreviewLinkEl.href = `/shop#${product.id}`;
}

function collectEditPayload() {
    return {
        title: document.getElementById('title').value.trim(),
        subtitle: document.getElementById('subtitle').value.trim(),
        category: document.getElementById('category').value.trim(),
        badge: document.getElementById('badge').value.trim(),
        short_description: document.getElementById('short_description').value.trim(),
        description: document.getElementById('description').value.trim(),
        image: editImageInputEl.value.trim(),
        price_eur: document.getElementById('price_eur').value,
        cta_label: document.getElementById('cta_label').value.trim(),
        featured: document.getElementById('featured').checked,
        active: document.getElementById('active').checked
    };
}

async function loadProduct() {
    const productId = getProductId();
    if (!productId) {
        setEditStatus('Geen product-ID meegegeven.', 'error');
        editFormEl.style.display = 'none';
        return;
    }

    setEditStatus('Product laden...', 'info');
    try {
        const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}`);
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || 'Product niet gevonden.');
        }
        fillForm(payload);
        setEditStatus('Product geladen.', 'success');
    } catch (error) {
        setEditStatus(error.message, 'error');
        editFormEl.style.display = 'none';
    }
}

editImageInputEl.addEventListener('input', () => updateEditImagePreview(editImageInputEl.value.trim()));
editImageFileEl.addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    try {
        await uploadEditImage(file);
    } catch (error) {
        editImageUploadStatusEl.textContent = error.message;
    }
});

editFormEl.addEventListener('submit', async event => {
    event.preventDefault();
    const productId = getProductId();
    if (!productId) {
        setEditStatus('Geen product-ID meegegeven.', 'error');
        return;
    }

    setEditStatus('Product opslaan...', 'info');
    try {
        const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(productId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(collectEditPayload())
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || 'Opslaan mislukt.');
        }
        fillForm(payload);
        setEditStatus('Product opgeslagen.', 'success');
    } catch (error) {
        setEditStatus(error.message, 'error');
    }
});

loadProduct();
