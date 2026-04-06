

const loadingEl = document.getElementById('article-loading');
const errorEl = document.getElementById('article-error');
const contentEl = document.getElementById('article-content');
const navSubmenuEl = document.querySelector('.nav-submenu');

function getArticleId() {
    const pathMatch = window.location.pathname.match(/\/article\/([^/]+)$/);
    if (pathMatch && pathMatch[1]) {
        return pathMatch[1];
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function renderComponents(components) {
    return (components || []).map(component => {
        if (component.type === 'text') {
            return `<p class="article-text">${component.content || ''}</p>`;
        }
        if (component.type === 'image') {
            return `<img class="article-media" src="${resolveMediaUrl(component.src)}" alt="${component.alt || 'Artikel afbeelding'}">`;  
        }
        if (component.type === 'video') {
            const src = component.src || '';
            let videoHtml = '';
            
            // Check if YouTube URL
            if (src.includes('youtube.com') || src.includes('youtu.be')) {
                let videoId = '';
                
                // Extract video ID from various YouTube URL formats
                try {
                    if (src.includes('youtube.com/watch?v=')) {
                        const url = new URL(src);
                        videoId = url.searchParams.get('v');
                    } else if (src.includes('youtu.be/')) {
                        videoId = src.split('youtu.be/')[1].split('?')[0].split('&')[0];
                    } else if (src.includes('youtube.com/embed/')) {
                        videoId = src.split('youtube.com/embed/')[1].split('?')[0].split('&')[0];
                    }
                } catch (e) {
                    console.error('Error parsing YouTube URL:', e);
                }
                
                if (videoId) {
                    const autoplayParam = component.autoplay ? '&autoplay=1' : '';
                    const muteParam = component.mute ? '&mute=1' : '';
                    videoHtml = `<iframe class="article-media article-video-embed" src="https://www.youtube.com/embed/${videoId}?rel=0${autoplayParam}${muteParam}" frameborder="0" allowfullscreen></iframe>`;
                }
            } else {
                // Direct video file
                const autoplayAttr = component.autoplay ? 'autoplay' : '';
                const muteAttr = component.mute ? 'muted' : '';
                videoHtml = `<video class="article-media" controls ${autoplayAttr} ${muteAttr}><source src="${resolveMediaUrl(src)}"></video>`;
            }
            
            return videoHtml;
        }
        if (component.type === 'audio') {
            return `<audio class="article-audio" controls><source src="${resolveMediaUrl(component.src)}"></audio>`;
        }
        return '';
    }).join('');
}

function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('nl-NL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function getCategoryValue(article) {
    return (article && article.category ? String(article.category) : '').trim();
}

function buildCategoryHeader(categories, activeCategory = '') {
    if (!navSubmenuEl) return;

    navSubmenuEl.innerHTML = '';
    const normalizedActive = (activeCategory || '').trim().toLowerCase();

    const createButton = (label, value) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nav-category-btn';
        btn.dataset.category = value;
        btn.textContent = label.toUpperCase();

        if ((value || '').trim().toLowerCase() === normalizedActive) {
            btn.classList.add('active');
        }

        btn.addEventListener('click', () => {
            if (!value) {
                window.location.href = '/';
                return;
            }
            window.location.href = `/?categorie=${encodeURIComponent(value)}`;
        });

        navSubmenuEl.appendChild(btn);
    };

    createButton('Alles', '');
    categories.forEach(category => createButton(category, category));
}

async function loadHeaderCategories(activeCategory = '') {
    try {
        const res = await fetch(`${API_BASE_URL}/articles`);
        if (!res.ok) {
            throw new Error('Kon categorieen niet laden');
        }
        const articles = await res.json();
        const categorySet = new Set();
        (articles || []).forEach(article => {
            const value = getCategoryValue(article);
            if (value) {
                categorySet.add(value);
            }
        });
        const categories = Array.from(categorySet).sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base' }));
        buildCategoryHeader(categories, activeCategory);
    } catch (error) {
        buildCategoryHeader([], activeCategory);
    }
}

async function loadArticle() {
    const articleId = getArticleId();
    if (!articleId) {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorEl.textContent = 'Geen artikel-ID gevonden.';
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/articles/${encodeURIComponent(articleId)}`);
        if (!res.ok) {
            throw new Error('Artikel niet gevonden');
        }
        const article = await res.json();
        await loadHeaderCategories(getCategoryValue(article));
        const dateText = formatDate(article.created_at);

        contentEl.innerHTML = `
            <div class="article-header">
                <div class="article-meta-row">
                    ${article.category ? `<span class="article-badge">${article.category}</span>` : ''}
                    ${dateText ? `<span class="article-date">${dateText}</span>` : ''}
                </div>
                <h1 class="article-title">${article.title}</h1>
            </div>
            <div class="article-body">
                ${renderComponents(article.components || [])}
            </div>
        `;
        if (article.size === 'tekst') {
            contentEl.classList.add('article-content-tekst');
        } else {
            contentEl.classList.remove('article-content-tekst');
        }
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
    } catch (error) {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorEl.textContent = `Fout bij laden: ${error.message}`;
    }
}

loadArticle();
