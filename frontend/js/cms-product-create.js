const createStatusEl = document.getElementById('product-create-status');
const createFormEl = document.getElementById('product-create-form');
const createImageInputEl = document.getElementById('image');
const createImageFileEl = document.getElementById('image-file');
const createImagePreviewEl = document.getElementById('image-preview');
const createImageUploadStatusEl = document.getElementById('image-upload-status');

function setCreateStatus(message, kind = 'info') {
    createStatusEl.textContent = message;
    createStatusEl.className = `cms-status cms-status-${kind}`;
}

function updateCreateImagePreview(url) {
    createImagePreviewEl.innerHTML = url ? `<img src="${resolveMediaUrl(url)}" alt="Preview">` : '';
}

async function uploadCreateImage(file) {
    createImageUploadStatusEl.textContent = 'Uploaden...';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('article_id', `product_temp_${Date.now()}`);
    formData.append('index', '0');

    const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || 'Upload mislukt.');
    }
    createImageInputEl.value = payload.url;
    updateCreateImagePreview(payload.url);
    createImageUploadStatusEl.textContent = 'Afbeelding geüpload.';
}

function collectCreatePayload() {
    return {
        title: document.getElementById('title').value.trim(),
        subtitle: document.getElementById('subtitle').value.trim(),
        category: document.getElementById('category').value.trim(),
        badge: document.getElementById('badge').value.trim(),
        short_description: document.getElementById('short_description').value.trim(),
        description: document.getElementById('description').value.trim(),
        image: createImageInputEl.value.trim(),
        price_eur: document.getElementById('price_eur').value,
        cta_label: document.getElementById('cta_label').value.trim(),
        featured: document.getElementById('featured').checked,
        active: document.getElementById('active').checked
    };
}

createImageInputEl.addEventListener('input', () => updateCreateImagePreview(createImageInputEl.value.trim()));
createImageFileEl.addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    try {
        await uploadCreateImage(file);
    } catch (error) {
        createImageUploadStatusEl.textContent = error.message;
    }
});

createFormEl.addEventListener('submit', async event => {
    event.preventDefault();
    setCreateStatus('Product aanmaken...', 'info');
    try {
        const response = await fetch(`${API_BASE_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(collectCreatePayload())
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || 'Aanmaken mislukt.');
        }
        setCreateStatus('Product aangemaakt.', 'success');
        window.location.href = `/cms-product-edit?id=${encodeURIComponent(payload.id)}`;
    } catch (error) {
        setCreateStatus(error.message, 'error');
    }
});
