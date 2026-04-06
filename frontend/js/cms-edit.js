

const statusEl = document.getElementById('edit-status');
const formEl = document.getElementById('edit-form');
const categorySelect = document.getElementById('category');
const newCategoryInput = document.getElementById('new-category');
const groupSelect = document.getElementById('group');
const newGroupInput = document.getElementById('new-group');
const componentsList = document.getElementById('components-list');
const previewLink = document.getElementById('preview-link');
const thumbnailModeInput = document.getElementById('thumbnail-mode');
const thumbnailKindInput = document.getElementById('thumbnail-kind');
const thumbnailUrlInput = document.getElementById('thumbnail-url');
const thumbnailUploadInput = document.getElementById('thumbnail-upload');
const thumbnailKindRow = document.getElementById('thumbnail-kind-row');
const thumbnailUrlRow = document.getElementById('thumbnail-url-row');
const thumbnailUploadRow = document.getElementById('thumbnail-upload-row');
const thumbnailUploadStatus = document.getElementById('thumbnail-upload-status');
const thumbnailPreview = document.getElementById('thumbnail-preview');
let uploadedThumbnailUrl = '';

function setStatus(message, kind = 'info') {
    statusEl.textContent = message;
    statusEl.className = `cms-status cms-status-${kind}`;
}

function showToast(message, kind = 'success') {
    const toast = document.createElement('div');
    toast.className = `cms-toast${kind === 'error' ? ' error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 220);
    }, 2200);
}

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

function getYouTubeThumb(src) {
    const videoId = getYouTubeVideoId(src);
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
}

function resolvePreviewUrl(src) {
    if (!src) return '';
    if (typeof resolveMediaUrl === 'function') {
        return resolveMediaUrl(src);
    }
    return src;
}

function getAutoThumbnailCandidate(mode) {
    const rows = Array.from(componentsList.querySelectorAll('.component-row'));
    if (mode === 'auto-first') {
        for (const row of rows) {
            const type = row.dataset.type;
            if (type !== 'image' && type !== 'video') {
                continue;
            }
            const src = row.querySelector('.component-input')?.value.trim() || '';
            if (src) {
                return { type, src };
            }
        }
        return null;
    }

    if (mode === 'auto-image' || mode === 'auto-video') {
        const wantedType = mode === 'auto-image' ? 'image' : 'video';
        for (const row of rows) {
            if (row.dataset.type !== wantedType) {
                continue;
            }
            const src = row.querySelector('.component-input')?.value.trim() || '';
            if (src) {
                return { type: wantedType, src };
            }
        }
    }

    return null;
}

function renderThumbnailMedia(type, src, caption) {
    const resolvedSrc = resolvePreviewUrl(src);
    if (!resolvedSrc) {
        return '<p class="thumb-preview-note">Nog geen thumbnail gevonden.</p>';
    }

    if (type === 'video') {
        const ytThumb = getYouTubeThumb(resolvedSrc);
        if (ytThumb) {
            return `
                <div>
                    <img src="${ytThumb}" class="thumb-preview-media" alt="YouTube thumbnail">
                    <p class="thumb-preview-caption">${caption}</p>
                </div>
            `;
        }
        return `
            <div>
                <video src="${resolvedSrc}" class="thumb-preview-media" muted loop autoplay playsinline></video>
                <p class="thumb-preview-caption">${caption}</p>
            </div>
        `;
    }

    return `
        <div>
            <img src="${resolvedSrc}" class="thumb-preview-media" alt="Thumbnail preview">
            <p class="thumb-preview-caption">${caption}</p>
        </div>
    `;
}

function animateListReorder(moveAction) {
    const items = Array.from(componentsList.querySelectorAll('.component-row'));
    const firstPositions = new Map();
    items.forEach(item => {
        firstPositions.set(item, item.getBoundingClientRect().top);
    });

    moveAction();

    const reorderedItems = Array.from(componentsList.querySelectorAll('.component-row'));
    reorderedItems.forEach(item => {
        const firstTop = firstPositions.get(item);
        if (typeof firstTop !== 'number') {
            return;
        }
        const lastTop = item.getBoundingClientRect().top;
        const deltaY = firstTop - lastTop;
        if (!deltaY) {
            return;
        }
        item.style.transition = 'none';
        item.style.transform = `translateY(${deltaY}px)`;
        requestAnimationFrame(() => {
            item.style.transition = 'transform 180ms ease';
            item.style.transform = 'translateY(0)';
            const cleanup = () => {
                item.style.transition = '';
                item.removeEventListener('transitionend', cleanup);
            };
            item.addEventListener('transitionend', cleanup);
        });
    });
}

function renderThumbnailPreview() {
    if (!thumbnailPreview || !thumbnailModeInput) return;
    const mode = thumbnailModeInput.value;
    const kind = thumbnailKindInput ? thumbnailKindInput.value : 'image';
    const src = mode === 'upload' ? uploadedThumbnailUrl : (thumbnailUrlInput ? thumbnailUrlInput.value.trim() : '');

    if (mode === 'auto-first' || mode === 'auto-image' || mode === 'auto-video') {
        const autoCandidate = getAutoThumbnailCandidate(mode);
        const autoLabel = mode === 'auto-first'
            ? 'Automatisch: eerste element'
            : (mode === 'auto-image' ? 'Automatisch: eerste afbeelding' : 'Automatisch: eerste video');
        if (!autoCandidate) {
            thumbnailPreview.innerHTML = `<p class="thumb-preview-note">${autoLabel} (nog geen media gevonden)</p>`;
            return;
        }
        thumbnailPreview.innerHTML = renderThumbnailMedia(autoCandidate.type, autoCandidate.src, autoLabel);
        return;
    }

    if (!src) {
        thumbnailPreview.innerHTML = '<p class="thumb-preview-note">Nog geen thumbnail gekozen.</p>';
        return;
    }

    if (kind === 'video') {
        thumbnailPreview.innerHTML = renderThumbnailMedia('video', src, 'Aangepaste video thumbnail');
        return;
    }

    thumbnailPreview.innerHTML = renderThumbnailMedia('image', src, 'Aangepaste afbeelding thumbnail');
}

function toggleThumbnailFields() {
    if (!thumbnailModeInput) return;
    const mode = thumbnailModeInput.value;
    const isCustomUrl = mode === 'custom-url';
    const isUpload = mode === 'upload';
    if (thumbnailKindRow) {
        thumbnailKindRow.style.display = (isCustomUrl || isUpload) ? '' : 'none';
    }
    if (thumbnailUrlRow) {
        thumbnailUrlRow.style.display = isCustomUrl ? '' : 'none';
    }
    if (thumbnailUploadRow) {
        thumbnailUploadRow.style.display = isUpload ? '' : 'none';
    }
    renderThumbnailPreview();
}

function collectThumbnail() {
    if (!thumbnailModeInput) return null;
    const mode = thumbnailModeInput.value;
    if (mode === 'auto-first' || mode === 'auto-image' || mode === 'auto-video') {
        return { mode };
    }

    const kind = thumbnailKindInput ? thumbnailKindInput.value : 'image';
    const src = mode === 'upload' ? uploadedThumbnailUrl.trim() : (thumbnailUrlInput ? thumbnailUrlInput.value.trim() : '');
    if (!src) {
        return null;
    }

    return {
        mode,
        kind,
        src
    };
}

function fillThumbnailInputs(thumbnail) {
    if (!thumbnailModeInput) return;
    const mode = thumbnail && thumbnail.mode ? thumbnail.mode : 'auto-first';
    thumbnailModeInput.value = ['auto-first', 'auto-image', 'auto-video', 'custom-url', 'upload'].includes(mode)
        ? mode
        : 'auto-first';

    if (thumbnailKindInput) {
        thumbnailKindInput.value = thumbnail && thumbnail.kind === 'video' ? 'video' : 'image';
    }

    if (thumbnailUrlInput) {
        thumbnailUrlInput.value = thumbnail && thumbnail.mode === 'custom-url' ? (thumbnail.src || '') : '';
    }

    uploadedThumbnailUrl = thumbnail && thumbnail.mode === 'upload' ? (thumbnail.src || '') : '';
    toggleThumbnailFields();
}

function getArticleId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

async function loadGroups() {
    try {
        const res = await fetch(`${API_BASE_URL}/taxonomies`);
        if (!res.ok) {
            throw new Error('Groups niet gevonden');
        }
        const data = await res.json();
        return (Array.isArray(data.groups) ? data.groups : [])
            .map(item => (item && item.name ? String(item.name).trim() : ''))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
    } catch (error) {
        return [];
    }
}

async function loadCategories() {
    try {
        const res = await fetch(`${API_BASE_URL}/taxonomies`);
        if (!res.ok) {
            throw new Error('Artikels niet gevonden');
        }
        const data = await res.json();
        return (Array.isArray(data.categories) ? data.categories : [])
            .map(item => (item && item.name ? String(item.name).trim() : ''))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
    } catch (error) {
        return [];
    }
}

function populateCategorySelect(categories, currentCategory) {
    if (!categorySelect) return;

    const options = (categories || []).slice();
    const current = (currentCategory || '').trim();
    if (current && !options.includes(current)) {
        options.unshift(current);
    }

    categorySelect.innerHTML = '';

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-';
    categorySelect.appendChild(emptyOption);

    options.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });

    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = 'Nieuwe categorie aanmaken';
    categorySelect.appendChild(newOption);

    if (current) {
        categorySelect.value = current;
    } else {
        categorySelect.value = '';
    }

    toggleNewCategoryInput();
}

function toggleNewCategoryInput() {
    if (!categorySelect || !newCategoryInput) return;
    const isNew = categorySelect.value === '__new__';
    newCategoryInput.style.display = isNew ? 'block' : 'none';
}

function populateGroupSelect(groups, currentGroup) {
    const options = groups.slice();
    if (currentGroup && !options.includes(currentGroup)) {
        options.unshift(currentGroup);
    }
    if (!options.includes('standaard')) {
        options.push('standaard');
    }
    options.sort();

    groupSelect.innerHTML = '';
    options.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        groupSelect.appendChild(option);
    });
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = 'Nieuwe groep aanmaken';
    groupSelect.appendChild(newOption);

    if (currentGroup) {
        groupSelect.value = currentGroup;
    } else {
        groupSelect.value = 'standaard';
    }

    toggleNewGroupInput();
}

function toggleNewGroupInput() {
    const isNew = groupSelect.value === '__new__';
    newGroupInput.style.display = isNew ? 'block' : 'none';
}

if (categorySelect) {
    categorySelect.addEventListener('change', toggleNewCategoryInput);
}
groupSelect.addEventListener('change', toggleNewGroupInput);

if (thumbnailModeInput) {
    thumbnailModeInput.addEventListener('change', toggleThumbnailFields);
}
if (thumbnailKindInput) {
    thumbnailKindInput.addEventListener('change', renderThumbnailPreview);
}
if (thumbnailUrlInput) {
    thumbnailUrlInput.addEventListener('input', renderThumbnailPreview);
}
if (thumbnailUploadInput) {
    thumbnailUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        thumbnailUploadStatus.textContent = 'Uploaden...';
        thumbnailUploadStatus.style.color = '#666';

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('article_id', getArticleId() || `temp_${Date.now()}`);
            formData.append('index', `thumb_${Date.now()}`);

            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Upload failed');

            const data = await response.json();
            uploadedThumbnailUrl = data.url || '';
            if (thumbnailKindInput && file.type.startsWith('video/')) {
                thumbnailKindInput.value = 'video';
            }
            if (thumbnailKindInput && file.type.startsWith('image/')) {
                thumbnailKindInput.value = 'image';
            }
            thumbnailUploadStatus.textContent = '✓ Geüpload';
            thumbnailUploadStatus.style.color = '#2d8f46';
            renderThumbnailPreview();
        } catch (error) {
            thumbnailUploadStatus.textContent = '✗ Upload mislukt';
            thumbnailUploadStatus.style.color = '#c52020';
        }
    });
}

function createComponentRow(type, data = {}) {
    const row = document.createElement('div');
    row.className = 'component-row';
    row.dataset.type = type;

    const header = document.createElement('div');
    header.className = 'component-header';
    header.innerHTML = `
        <span class="component-type">${type}</span>
        <div style="display: flex; gap: 8px;">
            <button type="button" class="component-move-up" title="Component omhoog">↑</button>
            <button type="button" class="component-move-down" title="Component omlaag">↓</button>
            <button type="button" class="component-remove">Verwijderen</button>
        </div>
    `;

    const body = document.createElement('div');
    body.className = 'component-body';

    if (type === 'text') {
        body.innerHTML = `
            <label>Tekst</label>
            <textarea class="cms-textarea component-input" rows="4">${data.content || ''}</textarea>
        `;
    } else if (type === 'image') {
        const srcValue = data.src || '';
        const altValue = data.alt || '';
        const previewHtml = srcValue ? `<img src="${srcValue}" style="max-width: 200px; margin-top: 10px; border: 1px solid #ddd;">` : '';
        body.innerHTML = `
            <label>Afbeelding uploaden</label>
            <input type="file" class="cms-input component-file" accept="image/*">
            <label style="margin-top: 10px;">Of bron (URL)</label>
            <input type="text" class="cms-input component-input" placeholder="Of voeg URL in" value="${srcValue}">
            <label>Alt tekst</label>
            <input type="text" class="cms-input component-alt" value="${altValue}">
            <div class="component-upload-status" style="margin-top: 8px; font-size: 12px; color: #666;"></div>
            <div class="component-preview" style="margin-top: 10px;">${previewHtml}</div>
        `;
    } else if (type === 'video') {
        const srcValue = data.src || '';
        const autoplayChecked = data.autoplay ? 'checked' : '';
        const muteChecked = data.mute ? 'checked' : '';
        
        // Check if YouTube URL for initial preview
        let previewHtml = '';
        if (srcValue) {
            if (srcValue.includes('youtube.com') || srcValue.includes('youtu.be')) {
                previewHtml = `<p style="color: #666; font-size: 12px; margin: 0;">YouTube video: ${srcValue}</p>`;
            } else {
                previewHtml = `<video src="${srcValue}" style="max-width: 300px; margin-top: 10px;" controls></video>`;
            }
        }
        
        body.innerHTML = `
            <label>Video uploaden</label>
            <input type="file" class="cms-input component-file" accept="video/*">
            <label style="margin-top: 10px;">Of video URL (YouTube, directe link)</label>
            <input type="text" class="cms-input component-input" placeholder="Bijv. https://www.youtube.com/watch?v=..." value="${srcValue}">
            <div class="component-upload-status" style="margin-top: 8px; font-size: 12px; color: #666;"></div>
            <div style="margin-top: 10px; display: flex; gap: 20px; align-items: center;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin: 0;">
                    <input type="checkbox" class="component-autoplay" ${autoplayChecked}>
                    <span>Autoplay</span>
                    <span class="info-tooltip" title="Video begint automatisch met afspelen">?</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin: 0;">
                    <input type="checkbox" class="component-mute" ${muteChecked}>
                    <span>Mute</span>
                    <span class="info-tooltip" title="Video wordt zonder geluid afgespeeld">?</span>
                </label>
            </div>
            <div style="margin-top: 10px; padding: 8px; background-color: #f0f0f0; border-left: 3px solid var(--third); font-size: 12px; color: #333;">
                <strong>💡 Hint:</strong> Autoplay werkt alleen in browsers wanneer de video ook <strong>gedempt is</strong>. Dit is een beveiligingsmaatregel van moderne browsers.
            </div>
            <div class="component-preview" style="margin-top: 10px;">${previewHtml}</div>
        `;
    } else {
        const srcValue = data.src || '';
        body.innerHTML = `
            <label>Bron (URL)</label>
            <input type="text" class="cms-input component-input" value="${srcValue}">
        `;
    }

    header.querySelector('.component-remove').addEventListener('click', () => {
        row.remove();
        renderThumbnailPreview();
    });

    header.querySelector('.component-move-up').addEventListener('click', () => {
        const prev = row.previousElementSibling;
        if (prev) {
            animateListReorder(() => {
                componentsList.insertBefore(row, prev);
            });
            renderThumbnailPreview();
        }
    });

    header.querySelector('.component-move-down').addEventListener('click', () => {
        const next = row.nextElementSibling;
        if (next) {
            animateListReorder(() => {
                componentsList.insertBefore(next, row);
            });
            renderThumbnailPreview();
        }
    });

    row.appendChild(header);
    row.appendChild(body);
    componentsList.appendChild(row);
    
    // Add file upload handler for images
    if (type === 'image') {
        const fileInput = body.querySelector('.component-file');
        const urlInput = body.querySelector('.component-input');
        const statusDiv = body.querySelector('.component-upload-status');
        const previewDiv = body.querySelector('.component-preview');
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Use current article ID from URL
            const articleId = getArticleId() || `temp_${Date.now()}`;
            const imageIndex = Array.from(componentsList.querySelectorAll('.component-row[data-type="image"]'))
                .indexOf(row);
            
            statusDiv.textContent = 'Uploaden...';
            statusDiv.style.color = '#666';
            
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('article_id', articleId);
                formData.append('index', imageIndex);
                
                const response = await fetch(`${API_BASE_URL}/upload`, {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) throw new Error('Upload failed');
                
                const data = await response.json();
                urlInput.value = data.url;
                statusDiv.textContent = '✓ Geüpload';
                statusDiv.style.color = '#2d8f46';
                
                // Show preview
                previewDiv.innerHTML = `<img src="${data.url}" style="max-width: 200px; margin-top: 10px; border: 1px solid #ddd;">`;
                renderThumbnailPreview();
            } catch (error) {
                statusDiv.textContent = '✗ Upload mislukt';
                statusDiv.style.color = '#c52020';
                console.error('Upload error:', error);
            }
        });
        
        // Update preview when URL is manually changed
        urlInput.addEventListener('input', () => {
            const url = urlInput.value.trim();
            if (url) {
                previewDiv.innerHTML = `<img src="${url}" style="max-width: 200px; margin-top: 10px; border: 1px solid #ddd;">`;
            } else {
                previewDiv.innerHTML = '';
            }
            renderThumbnailPreview();
        });
    }
    
    // Add file upload handler for videos
    if (type === 'video') {
        const fileInput = body.querySelector('.component-file');
        const urlInput = body.querySelector('.component-input');
        const statusDiv = body.querySelector('.component-upload-status');
        const previewDiv = body.querySelector('.component-preview');
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const articleId = getArticleId() || `temp_${Date.now()}`;
            const videoIndex = Array.from(componentsList.querySelectorAll('.component-row[data-type="video"]'))
                .indexOf(row);
            
            statusDiv.textContent = 'Uploaden...';
            statusDiv.style.color = '#666';
            
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('article_id', articleId);
                formData.append('index', videoIndex);
                
                const response = await fetch(`${API_BASE_URL}/upload`, {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) throw new Error('Upload failed');
                
                const data = await response.json();
                urlInput.value = data.url;
                statusDiv.textContent = '✓ Geüpload';
                statusDiv.style.color = '#2d8f46';
                
                previewDiv.innerHTML = `<video src="${data.url}" style="max-width: 300px; margin-top: 10px;" controls></video>`;
                renderThumbnailPreview();
            } catch (error) {
                statusDiv.textContent = '✗ Upload mislukt';
                statusDiv.style.color = '#c52020';
                console.error('Upload error:', error);
            }
        });
        
        // Update preview when URL is manually changed
        urlInput.addEventListener('input', () => {
            const url = urlInput.value.trim();
            if (url) {
                // Check if YouTube URL
                if (url.includes('youtube.com') || url.includes('youtu.be')) {
                    previewDiv.innerHTML = `<p style="color: #666; font-size: 12px; margin: 0;">YouTube video: ${url}</p>`;
                } else {
                    previewDiv.innerHTML = `<video src="${url}" style="max-width: 300px; margin-top: 10px;" controls></video>`;
                }
            } else {
                previewDiv.innerHTML = '';
            }
            renderThumbnailPreview();
        });
    }

    const sourceInput = body.querySelector('.component-input');
    if (sourceInput) {
        sourceInput.addEventListener('input', renderThumbnailPreview);
    }
}

function renderComponents(components) {
    componentsList.innerHTML = '';
    (components || []).forEach(component => {
        createComponentRow(component.type, component);
    });
    renderThumbnailPreview();
}

function collectComponents() {
    const rows = Array.from(componentsList.querySelectorAll('.component-row'));
    return rows.map(row => {
        const type = row.dataset.type;
        if (type === 'text') {
            const content = row.querySelector('.component-input').value.trim();
            return { type, content };
        }
        const src = row.querySelector('.component-input').value.trim();
        const component = { type, src };
        if (type === 'image') {
            component.alt = row.querySelector('.component-alt').value.trim();
        }
        if (type === 'video') {
            component.autoplay = row.querySelector('.component-autoplay')?.checked || false;
            component.mute = row.querySelector('.component-mute')?.checked || false;
        }
        return component;
    }).filter(component => {
        if (component.type === 'text') {
            return component.content.length > 0;
        }
        return component.src.length > 0;
    });
}

document.querySelectorAll('[data-add]').forEach(button => {
    button.addEventListener('click', () => {
        createComponentRow(button.dataset.add, {});
        renderThumbnailPreview();
    });
});

async function loadArticle() {
    const articleId = getArticleId();
    if (!articleId) {
        setStatus('Geen artikel-ID meegegeven.', 'error');
        formEl.style.display = 'none';
        return;
    }

    if (previewLink) {
        previewLink.href = `/article/${encodeURIComponent(articleId)}`;
    }

    setStatus('Artikel laden...', 'info');
    try {
        const res = await fetch(`${API_BASE_URL}/articles/${encodeURIComponent(articleId)}`);
        if (!res.ok) {
            throw new Error('Artikel niet gevonden');
        }
        const article = await res.json();
        document.getElementById('title').value = article.title || '';
        const categories = await loadCategories();
        populateCategorySelect(categories, article.category || '');
        document.getElementById('size').value = article.size || 'klein';
        const groups = await loadGroups();
        populateGroupSelect(groups, article.group || 'standaard');
        fillThumbnailInputs(article.thumbnail || null);
        renderComponents(article.components || []);
        setStatus('Artikel geladen.', 'success');
    } catch (error) {
        setStatus(`Fout bij laden: ${error.message}`, 'error');
        formEl.style.display = 'none';
    }
}

formEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    const articleId = getArticleId();
    if (!articleId) {
        setStatus('Geen artikel-ID meegegeven.', 'error');
        return;
    }

    const components = collectComponents();
    const groupValue = groupSelect.value === '__new__'
        ? newGroupInput.value.trim()
        : groupSelect.value.trim();

    if (!groupValue) {
        setStatus('Geef een groepsnaam op.', 'error');
        return;
    }

    const categoryValue = categorySelect && categorySelect.value === '__new__'
        ? newCategoryInput.value.trim()
        : (categorySelect ? categorySelect.value.trim() : '');

    const payload = {
        title: document.getElementById('title').value.trim(),
        category: categoryValue,
        group: groupValue,
        size: document.getElementById('size').value,
        components,
        thumbnail: collectThumbnail()
    };

    setStatus('Opslaan...', 'info');
    try {
        const res = await fetch(`${API_BASE_URL}/articles/${encodeURIComponent(articleId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            throw new Error('Opslaan mislukt');
        }
        setStatus('Artikel opgeslagen.', 'success');
        showToast('Artikel opgeslagen');
    } catch (error) {
        setStatus(`Fout bij opslaan: ${error.message}`, 'error');
        showToast(`Opslaan mislukt: ${error.message}`, 'error');
    }
});

loadArticle();
toggleThumbnailFields();
