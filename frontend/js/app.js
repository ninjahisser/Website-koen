class ArticleLoader {
    constructor(apiUrl = API_BASE_URL) {
        this.apiUrl = apiUrl;
        this.pendingStandaardArticles = [];
        this.highlightedGroups = new Set(['het klein nieuws', 'de miniatuurwereld']);
    }

    async loadGroups() {
        try {
            const response = await fetch(`${this.apiUrl}/groups`);
            if (!response.ok) {
                throw new Error('Failed to load groups');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading groups:', error);
            throw error;
        }
    }

    async loadArticleById(id) {
        try {
            const response = await fetch(`${this.apiUrl}/articles/${id}`);
            if (!response.ok) {
                throw new Error('Article not found');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading article:', error);
            throw error;
        }
    }

    getYouTubeVideoId(src) {
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

    getFirstComponentMedia(article, type) {
        if (!article || !Array.isArray(article.components)) {
            return null;
        }
        const component = article.components.find(c => c && c.type === type && c.src);
        return component ? component.src : null;
    }

    getFirstMediaInOrder(article) {
        if (!article || !Array.isArray(article.components)) {
            return null;
        }
        const component = article.components.find(c => c && (c.type === 'image' || c.type === 'video') && c.src);
        if (!component) {
            return null;
        }
        return { type: component.type, src: component.src };
    }

    getArticleThumbnailMedia(article) {
        const firstImage = this.getFirstComponentMedia(article, 'image');
        const firstVideo = this.getFirstComponentMedia(article, 'video');
        const firstInOrder = this.getFirstMediaInOrder(article);
        const thumbnail = article && article.thumbnail ? article.thumbnail : null;

        if (thumbnail && thumbnail.mode === 'auto-first' && firstInOrder) {
            return firstInOrder;
        }
        if (thumbnail && thumbnail.mode === 'auto-video' && firstVideo) {
            return { type: 'video', src: firstVideo };
        }
        if (thumbnail && thumbnail.mode === 'auto-image' && firstImage) {
            return { type: 'image', src: firstImage };
        }
        if (thumbnail && (thumbnail.mode === 'custom-url' || thumbnail.mode === 'upload') && thumbnail.src) {
            return { type: thumbnail.kind === 'video' ? 'video' : 'image', src: thumbnail.src };
        }
        if (firstInOrder) {
            return firstInOrder;
        }
        return null;
    }

    getThumbnailImageUrl(article) {
        const media = this.getArticleThumbnailMedia(article);
        if (!media || !media.src) {
            return null;
        }
        if (media.type === 'image') {
            return media.src;
        }
        const ytId = this.getYouTubeVideoId(media.src);
        if (ytId) {
            return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        }
        return null;
    }

    normalizeArticleSize(size) {
        const value = (size || '').toString().trim().toLowerCase();
        if (value === 'teskt') {
            return 'tekst';
        }
        return value;
    }

    findFirstArticleWithImage(groupsData) {
        const allArticles = Object.values(groupsData || {}).flat();
        for (const article of allArticles) {
            if (this.getThumbnailImageUrl(article)) {
                return article;
            }
        }
        return allArticles[0] || null;
    }

    findLatestArticleWithImage(groupsData) {
        const allArticles = Object.values(groupsData || {}).flat();
        const sorted = allArticles.slice().sort((a, b) => {
            const aTime = new Date(a.created_at || 0).getTime();
            const bTime = new Date(b.created_at || 0).getTime();
            return bTime - aTime;
        });
        for (const article of sorted) {
            if (this.getThumbnailImageUrl(article)) {
                return article;
            }
        }
        return sorted[0] || null;
    }

    findFirstImageFromGroups(groupsData) {
        const allArticles = Object.values(groupsData || {}).flat();
        for (const article of allArticles) {
            const image = this.getThumbnailImageUrl(article);
            if (image) {
                return image;
            }
        }
        return null;
    }

    createGroupSection(groupName, articles) {
        const section = document.createElement('div');
        section.className = 'group-section';
        const isLargeSize = (size) => {
            const normalized = this.normalizeArticleSize(size);
            return normalized === 'groot' || normalized === 'tekst';
        };
        const isSmallSize = (size) => this.normalizeArticleSize(size) === 'klein';
        const isKleinStyleGroup = this.highlightedGroups.has(groupName);
        if (isKleinStyleGroup) {
            section.className = 'klein-nieuws-section';
        }
        if (groupName !== 'standaard' && groupName === 'standaard') {
            const header = document.createElement('div');
            header.className = 'group-header';
            header.innerHTML = `<h2 class="group-title">${groupName.toUpperCase()}</h2>`;
            section.appendChild(header);
        } else if (isKleinStyleGroup) {
            const header = document.createElement('div');
            header.className = 'klein-nieuws-header';
            header.innerHTML = `<h2>${groupName}</h2>`;
            section.appendChild(header);
        }
        const container = document.createElement('div');
        if (groupName === 'standaard') {
            container.className = 'standaard-grid';
            const rows = [];
            const sourceArticles = [
                ...(this.pendingStandaardArticles || []),
                ...(articles || [])
            ];
            this.pendingStandaardArticles = [];

            const largeQueue = sourceArticles.filter(article => isLargeSize(article.size));
            const smallQueue = sourceArticles.filter(article => isSmallSize(article.size));
            // 50/50 start side so small-stack is sometimes on the left
            let placeLargeLeft = Math.random() >= 0.5;

            while (true) {
                if (largeQueue.length > 0 && smallQueue.length >= 2) {
                    rows.push({
                        layout: placeLargeLeft ? 'large-left' : 'large-right',
                        groot: largeQueue.shift(),
                        smalls: [smallQueue.shift(), smallQueue.shift()]
                    });
                    placeLargeLeft = !placeLargeLeft;
                    continue;
                }

                if (smallQueue.length >= 3) {
                    rows.push({
                        layout: 'small-stack-3',
                        smalls: [smallQueue.shift(), smallQueue.shift(), smallQueue.shift()]
                    });
                    continue;
                }
                break;
            }

            this.pendingStandaardArticles = [...largeQueue, ...smallQueue];

            rows.forEach(row => {
                const rowEl = document.createElement('div');
                rowEl.className = 'standaard-row';

                if (row.layout === 'large-left' || row.layout === 'large-right') {
                    rowEl.classList.add('groot-row');
                    rowEl.style.display = 'grid';
                    rowEl.style.gridTemplateColumns = row.layout === 'large-left' ? '2fr 1fr' : '1fr 2fr';
                    rowEl.style.gap = '20px';

                    const grootCard = this.createArticleCard(row.groot);
                    grootCard.classList.add('large-item');

                    const smallContainer = document.createElement('div');
                    smallContainer.className = 'small-stack';
                    row.smalls.forEach(item => {
                        const card = this.createArticleCard(item);
                        card.classList.add('small-item');
                        smallContainer.appendChild(card);
                    });

                    if (row.layout === 'large-left') {
                        rowEl.appendChild(grootCard);
                        rowEl.appendChild(smallContainer);
                    } else {
                        rowEl.appendChild(smallContainer);
                        rowEl.appendChild(grootCard);
                    }
                } else {
                    rowEl.classList.add('small-stack-3-row');
                    rowEl.style.display = 'flex';
                    rowEl.style.flexDirection = 'column';
                    rowEl.style.gap = '20px';
                    row.smalls.forEach(item => {
                        const card = this.createArticleCard(item);
                        card.classList.add('small-item');
                        rowEl.appendChild(card);
                    });
                }
                container.appendChild(rowEl);
            });
        } else {
            let gridClass = 'group-grid-dynamic';
            if (groupName === 'featured') {
                gridClass = 'featured-grid-dynamic';
            } else if (isKleinStyleGroup) {
                gridClass = 'klein-nieuws-grid-dynamic';
            }
            container.className = gridClass;

            articles.forEach((article) => {
                const card = this.createArticleCard(article);
                if (isLargeSize(article.size)) {
                    card.classList.add('large-item');
                } else {
                    card.classList.add('small-item');
                }
                container.appendChild(card);
            });
        }

        section.appendChild(container);
        return section;
    }

createArticleCard(article) {
    const card = document.createElement('div');
    card.className = 'article-card';
    const thumbnailMedia = this.getArticleThumbnailMedia(article);
    let categoryLabel = '';
    if (article.category && article.category.toLowerCase() !== 'standaard') {
        categoryLabel = `<div class="article-label">${article.category.toUpperCase()}</div>`;
    }
    const normalizedSize = this.normalizeArticleSize(article && article.size);
    const isTextOnly = normalizedSize === 'tekst';
    const html = isTextOnly
        ? `
                <div class="article-text-block">
                    ${categoryLabel}
                    <div class="article-text-title">${article.title}</div>
                </div>
            `
        : `
                ${(() => {
                    if (thumbnailMedia && thumbnailMedia.type === 'video' && thumbnailMedia.src) {
                        const ytId = this.getYouTubeVideoId(thumbnailMedia.src);
                        if (ytId) {
                            const poster = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                            return `<div style="position: relative;"><img src="${poster}" alt="${article.title}" class="article-image" loading="lazy"><span style="position:absolute;right:12px;bottom:12px;background:rgba(0,0,0,0.65);color:#fff;padding:4px 8px;font-size:12px;border-radius:3px;">VIDEO</span></div>`;
                        }
                        return `<video class="article-image" muted loop autoplay playsinline preload="metadata"><source src="${resolveMediaUrl(thumbnailMedia.src)}"></video>`;
                    }
                    const imageUrl = thumbnailMedia && thumbnailMedia.src ? resolveMediaUrl(thumbnailMedia.src) : 'https://via.placeholder.com/800x450';
                    return `<img src="${imageUrl}" alt="${article.title}" class="article-image" loading="lazy" onerror="this.src='https://via.placeholder.com/800x450'">`;
                })()}
                <div class="article-overlay">
                    ${categoryLabel}
                    <h3 class="article-title">${article.title}</h3>
                </div>
            `;
    if (isTextOnly) {
        card.classList.add('article-card-text');
    }
    card.innerHTML = html;
    card.addEventListener('click', () => {
        if (article.id) {
            window.location.href = `/article/${article.id}`;
        }
    });
    return card;
}

renderAllGroups(groupsData, container) {
    container.innerHTML = '';
    // Find the first article with an image globally
    const firstWithImage = this.findFirstArticleWithImage(groupsData);
    // Order: featured first, then klein nieuws, then others alphabetically
    const groupKeys = Object.keys(groupsData).sort((a, b) => {
        if (a === 'featured') return -1;
        if (b === 'featured') return 1;
        if (a === 'het klein nieuws') return -1;
        if (b === 'het klein nieuws') return 1;
        return a.localeCompare(b);
    });

    let usedFirstImage = false;
    groupKeys.forEach(groupName => {
        let articles = groupsData[groupName] || [];
        // Filter out ALL instances of the firstWithImage article by id, but only once globally
        if (firstWithImage && !usedFirstImage) {
            const idx = articles.findIndex(article => article.id === firstWithImage.id);
            if (idx !== -1) {
                articles = [...articles.slice(0, idx), ...articles.slice(idx + 1)];
                usedFirstImage = true;
            }
        }
        if (articles.length > 0) {
            const section = this.createGroupSection(groupName, articles);
            container.appendChild(section);
        }
    });
}

showArticleDetail(article) {
    const modal = document.createElement('div');
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
        `;

    const content = document.createElement('div');
    content.style.cssText = `
            background-color: white;
            border-radius: 0;
            max-width: 900px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            padding: 40px;
        `;

    let componentsHtml = '';
    if (article.components && article.components.length > 0) {
        article.components.forEach(component => {
            if (component.type === 'text') {
                componentsHtml += `<p style="margin: 15px 0; line-height: 1.6; color: #333;">${component.content || ''}</p>`;
            } else if (component.type === 'image') {
                componentsHtml += `<img src="${component.src}" alt="Article image" style="width: 100%; margin: 20px 0; border-radius: 0;">`;
            } else if (component.type === 'video') {
                componentsHtml += `<video controls style="width: 100%; margin: 20px 0; border-radius: 0;"><source src="${component.src}"></video>`;
            } else if (component.type === 'audio') {
                componentsHtml += `<audio controls style="width: 100%; margin: 20px 0;"><source src="${component.src}"></audio>`;
            }
        });
    }

    content.innerHTML = `
            <h1 style="font-family: 'Merriweather', Georgia, serif; font-size: 32px; margin-bottom: 15px; color: #000;">${article.title}</h1>
            <div style="color: #666; margin-bottom: 25px; border-bottom: 1px solid #ddd; padding-bottom: 15px;">
                <span><strong>Category:</strong> ${article.category || 'General'}</span>
            </div>
            ${componentsHtml}
        `;

    modal.appendChild(content);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    document.body.appendChild(modal);
}
}

    function normalizeSidebarLink(rawValue) {
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

    function applySidebarLink(button, rawValue) {
        if (!button) return;
        const href = normalizeSidebarLink(rawValue);
        button.href = href;
        const opensNewTab = href !== '#' && !href.startsWith('#');
        button.target = opensNewTab ? '_blank' : '_self';
        button.rel = opensNewTab ? 'noopener noreferrer' : '';
    }

    function renderFooterSocialLinks(container, links) {
        if (!container) return;
        const section = container.closest('.footer-section');
        const items = Array.isArray(links)
            ? links.filter(item => item && typeof item === 'object')
                .map(item => ({
                    label: String(item.label || '').trim(),
                    url: String(item.url || '').trim()
                }))
                .filter(item => item.label && item.url)
            : [];

        container.innerHTML = '';
        if (items.length === 0) {
            if (section) {
                section.style.display = 'none';
            }
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.textContent = item.label;
            applySidebarLink(link, item.url);
            li.appendChild(link);
            container.appendChild(li);
        });

        if (section) {
            section.style.display = '';
        }
    }

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const loader = new ArticleLoader();
    loader.pendingStandaardArticles = [];
    const container = document.getElementById('groupsContainer');
    const kleinContainer = document.getElementById('kleinContainer');
    const miniContainer = document.getElementById('miniContainer');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const heroImage = document.getElementById('heroImage');
    const heroTitle = document.getElementById('heroTitle');
    const heroLink = document.getElementById('heroLink');
    const newsletterTitle = document.getElementById('newsletterTitle');
    const newsletterText = document.getElementById('newsletterText');
    const newsletterButton = document.getElementById('newsletterButton');
    const infoBlockOne = document.getElementById('infoBlockOne');
    const workshopTitle = document.getElementById('workshopTitle');
    const workshopText = document.getElementById('workshopText');
    const workshopButton = document.getElementById('workshopButton');
    const infoBlockTwo = document.getElementById('infoBlockTwo');
    const footerShopLink = document.getElementById('footerShopLink');
    const footerGeneralSection = document.getElementById('footerGeneralSection');
    const footerSocialLinks = document.getElementById('footerSocialLinks');
    const navSubmenu = document.querySelector('.nav-submenu');

    try {
        const [groupsData, siteSettings, articlesData] = await Promise.all([
            loader.loadGroups(),
            fetch(`${API_BASE_URL}/site`).then(res => res.ok ? res.json() : null),
            fetch(`${API_BASE_URL}/articles`).then(res => res.ok ? res.json() : [])
        ]);
        loadingEl.style.display = 'none';

        if (siteSettings) {
            if (newsletterTitle) newsletterTitle.textContent = siteSettings.newsletterTitle || '';
            if (newsletterText) newsletterText.textContent = siteSettings.newsletterText || '';
            if (newsletterButton) {
                newsletterButton.textContent = siteSettings.newsletterButtonText || '';
                applySidebarLink(newsletterButton, siteSettings.newsletterButtonLink);
            }
            if (infoBlockOne) {
                infoBlockOne.style.display = siteSettings.newsletterVisible === false ? 'none' : '';
            }
            if (workshopTitle) workshopTitle.textContent = siteSettings.workshopTitle || '';
            if (workshopText) workshopText.textContent = siteSettings.workshopText || '';
            if (workshopButton) {
                workshopButton.textContent = siteSettings.workshopButtonText || '';
                applySidebarLink(workshopButton, siteSettings.workshopButtonLink);
            }
            if (infoBlockTwo) {
                infoBlockTwo.style.display = siteSettings.workshopVisible === false ? 'none' : '';
            }
            if (footerShopLink) {
                footerShopLink.style.display = siteSettings.shopVisible === false ? 'none' : '';
            }
            if (footerGeneralSection) {
                const visibleLinks = Array.from(footerGeneralSection.querySelectorAll('a'))
                    .filter(link => link.style.display !== 'none');
                footerGeneralSection.style.display = visibleLinks.length > 0 ? '' : 'none';
            }
            renderFooterSocialLinks(footerSocialLinks, siteSettings.footerSocialLinks);
            const configuredHighlights = Array.isArray(siteSettings.highlightedGroups)
                ? siteSettings.highlightedGroups.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
                : [];
            loader.highlightedGroups = new Set(configuredHighlights.length > 0 ? configuredHighlights : ['het klein nieuws', 'de miniatuurwereld']);
        }

        // Hide the side containers since we'll put everything in main content
        if (kleinContainer) kleinContainer.style.display = 'none';
        if (miniContainer) miniContainer.style.display = 'none';

        const getArticleCategory = (article) => (article && article.category ? String(article.category).trim() : '');
        const buildCategoryList = (allArticles) => {
            const categorySet = new Set();
            (allArticles || []).forEach(article => {
                const value = getArticleCategory(article);
                if (value) {
                    categorySet.add(value);
                }
            });
            return Array.from(categorySet).sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base' }));
        };

        const filterByCategory = (allArticles, selectedCategory) => {
            const normalized = (selectedCategory || '').trim().toLowerCase();
            if (!normalized) {
                return (allArticles || []).slice();
            }
            return (allArticles || []).filter(article => getArticleCategory(article).toLowerCase() === normalized);
        };

        const getArticleGroup = (article) => {
            const value = article && article.group ? String(article.group).trim() : 'standaard';
            return value || 'standaard';
        };

        const filterByGroup = (allArticles, selectedGroup) => {
            const normalized = (selectedGroup || '').trim().toLowerCase();
            if (!normalized) {
                return (allArticles || []).slice();
            }
            return (allArticles || []).filter(article => getArticleGroup(article).toLowerCase() === normalized);
        };

        const urlParams = new URLSearchParams(window.location.search);
        let activeCategory = (urlParams.get('categorie') || urlParams.get('category') || '').trim();
        let activeGroup = (urlParams.get('group') || '').trim();
        const knownGroups = ['standaard', ...Object.keys(groupsData || {})];
        if (activeGroup) {
            const matchedGroup = knownGroups.find(groupName => groupName.toLowerCase() === activeGroup.toLowerCase());
            activeGroup = matchedGroup || '';
        }

        const syncFiltersInUrl = () => {
            const url = new URL(window.location.href);
            if (activeCategory) {
                url.searchParams.set('categorie', activeCategory);
            } else {
                url.searchParams.delete('categorie');
                url.searchParams.delete('category');
            }
            if (activeGroup) {
                url.searchParams.set('group', activeGroup);
            } else {
                url.searchParams.delete('group');
            }
            const nextUrl = `${url.pathname}${url.search}${url.hash}`;
            window.history.replaceState({}, '', nextUrl);
        };

        const renderCategoryNav = (categories) => {
            if (!navSubmenu) {
                return;
            }

            if (activeCategory) {
                const matched = categories.find(category => category.toLowerCase() === activeCategory.toLowerCase());
                activeCategory = matched || '';
            }

            navSubmenu.innerHTML = '';

            const createButton = (label, value) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'nav-category-btn';
                btn.dataset.category = value;
                btn.textContent = label.toUpperCase();
                if ((value || '') === (activeCategory || '')) {
                    btn.classList.add('active');
                }
                btn.addEventListener('click', () => {
                    activeCategory = value;
                    activeGroup = '';
                    renderHomepageByCategory(activeCategory, activeGroup);
                    syncFiltersInUrl();
                    Array.from(navSubmenu.querySelectorAll('.nav-category-btn')).forEach(item => {
                        item.classList.toggle('active', item.dataset.category === activeCategory);
                    });
                });
                navSubmenu.appendChild(btn);
            };

            createButton('Alles', '');
            categories.forEach(category => createButton(category, category));
        };

        const getNewestTime = (list) => Math.max(...list.map(article => new Date(article.created_at || 0).getTime()));
        const getMinGlobalOrder = (list) => {
            const orders = (list || [])
                .map(article => Number(article.order_global))
                .filter(value => Number.isFinite(value) && value > 0);
            return orders.length ? Math.min(...orders) : Number.MAX_SAFE_INTEGER;
        };

        const renderStandaardWithFlush = (baseArticles) => {
            if (!baseArticles || baseArticles.length === 0) {
                return;
            }

            container.appendChild(loader.createGroupSection('standaard', baseArticles));

            if (loader.pendingStandaardArticles && loader.pendingStandaardArticles.length > 0) {
                const pending = [...loader.pendingStandaardArticles];
                loader.pendingStandaardArticles = [];
                const flushSection = document.createElement('div');
                flushSection.className = 'group-section';
                const flushGrid = document.createElement('div');
                flushGrid.className = 'standaard-grid';

                let i = 0;
                let placeLargeLeft = Math.random() >= 0.5;
                while (i < pending.length) {
                    if (i + 2 < pending.length) {
                        const rowEl = document.createElement('div');
                        rowEl.className = 'standaard-row groot-row';
                        rowEl.style.display = 'grid';
                        rowEl.style.gridTemplateColumns = placeLargeLeft ? '2fr 1fr' : '1fr 2fr';
                        rowEl.style.gap = '20px';
                        const grootCard = loader.createArticleCard(pending[i]);
                        grootCard.classList.add('large-item');
                        const smallStack = document.createElement('div');
                        smallStack.className = 'small-stack';
                        [pending[i + 1], pending[i + 2]].forEach(a => {
                            const c = loader.createArticleCard(a);
                            c.classList.add('small-item');
                            smallStack.appendChild(c);
                        });
                        if (placeLargeLeft) {
                            rowEl.appendChild(grootCard);
                            rowEl.appendChild(smallStack);
                        } else {
                            rowEl.appendChild(smallStack);
                            rowEl.appendChild(grootCard);
                        }
                        flushGrid.appendChild(rowEl);
                        placeLargeLeft = !placeLargeLeft;
                        i += 3;
                    } else if (i + 1 < pending.length) {
                        const rowEl = document.createElement('div');
                        rowEl.className = 'standaard-row groot-row';
                        rowEl.style.display = 'grid';
                        rowEl.style.gridTemplateColumns = placeLargeLeft ? '2fr 1fr' : '1fr 2fr';
                        rowEl.style.gap = '20px';
                        const grootCard = loader.createArticleCard(pending[i]);
                        grootCard.classList.add('large-item');
                        const smallStack = document.createElement('div');
                        smallStack.className = 'small-stack';
                        smallStack.style.height = 'auto';
                        const smallCard = loader.createArticleCard(pending[i + 1]);
                        smallCard.classList.add('small-item');
                        smallStack.appendChild(smallCard);
                        if (placeLargeLeft) {
                            rowEl.appendChild(grootCard);
                            rowEl.appendChild(smallStack);
                        } else {
                            rowEl.appendChild(smallStack);
                            rowEl.appendChild(grootCard);
                        }
                        flushGrid.appendChild(rowEl);
                        placeLargeLeft = !placeLargeLeft;
                        i += 2;
                    } else {
                        const rowEl = document.createElement('div');
                        rowEl.className = 'standaard-row groot-row';
                        rowEl.style.display = 'grid';
                        rowEl.style.gridTemplateColumns = placeLargeLeft ? '2fr 1fr' : '1fr 2fr';
                        rowEl.style.gap = '20px';
                        rowEl.style.marginLeft = '0';
                        rowEl.style.marginRight = '0';

                        const card = loader.createArticleCard(pending[i]);
                        card.classList.add('large-item');
                        rowEl.appendChild(card);

                        const spacer = document.createElement('div');
                        spacer.className = 'small-stack';
                        spacer.style.height = 'auto';
                        if (placeLargeLeft) {
                            rowEl.appendChild(spacer);
                        } else {
                            rowEl.insertBefore(spacer, card);
                        }

                        flushGrid.appendChild(rowEl);
                        placeLargeLeft = !placeLargeLeft;
                        i += 1;
                    }
                }

                flushSection.appendChild(flushGrid);
                container.appendChild(flushSection);
            }
        };

        const renderHomepageByCategory = (selectedCategory, selectedGroup = '') => {
            container.innerHTML = '';
            loader.pendingStandaardArticles = [];

            const filteredArticles = filterByGroup(filterByCategory(articlesData || [], selectedCategory), selectedGroup);
            const heroArticle = filteredArticles[0] || null;
            const heroArticleId = heroArticle && heroArticle.id ? heroArticle.id : null;

            if (heroTitle) {
                heroTitle.textContent = heroArticle ? (heroArticle.title || '') : '';
            }
            if (heroLink) {
                heroLink.href = heroArticle && heroArticle.id ? `/article/${heroArticle.id}` : '#';
            }
            if (heroImage) {
                const isHeroTextOnly = loader.normalizeArticleSize(heroArticle && heroArticle.size) === 'tekst';
                const heroSrc = (!isHeroTextOnly && heroArticle) ? loader.getThumbnailImageUrl(heroArticle) : null;
                heroImage.classList.toggle('hero-image-text', isHeroTextOnly);
                heroImage.style.backgroundImage = heroSrc ? `url('${resolveMediaUrl(heroSrc)}')` : 'none';
                heroImage.style.backgroundColor = isHeroTextOnly ? 'var(--third)' : '';
            }

            const isNotHero = article => !heroArticleId || article.id !== heroArticleId;
            const filteredGroupsData = Object.fromEntries(
                Object.entries(groupsData || {}).map(([groupName, groupArticles]) => [
                    groupName,
                    filterByGroup(filterByCategory(groupArticles || [], selectedCategory), selectedGroup)
                ])
            );

            const standaardArticles = filteredArticles.filter(article => (!article.group || article.group === 'standaard') && isNotHero(article));
            const dynamicGroupEntries = Object.entries(filteredGroupsData)
                .filter(([groupName]) => groupName !== 'standaard')
                .map(([groupName, groupArticles]) => ({ groupName, groupArticles: (groupArticles || []).filter(isNotHero) }))
                .filter(entry => entry.groupArticles.length > 0);

            const groupSections = [];
            if (standaardArticles.length > 0) {
                groupSections.push({
                    type: 'standaard',
                    name: 'standaard',
                    articles: standaardArticles,
                    newest: getNewestTime(standaardArticles),
                    order: getMinGlobalOrder(standaardArticles)
                });
            }
            dynamicGroupEntries.forEach(entry => {
                groupSections.push({
                    type: 'normal',
                    name: entry.groupName,
                    articles: entry.groupArticles,
                    newest: getNewestTime(entry.groupArticles),
                    order: getMinGlobalOrder(entry.groupArticles)
                });
            });

            groupSections
                .sort((a, b) => a.order - b.order)
                .forEach(section => {
                    if (section.type === 'standaard') {
                        renderStandaardWithFlush(section.articles);
                        return;
                    }
                    container.appendChild(loader.createGroupSection(section.name, section.articles));
                });

            if (groupSections.length === 0) {
                container.innerHTML = '<div class="loading">Geen artikels in deze categorie.</div>';
            }
        };

        if (container) {
            container.addEventListener('click', (event) => {
                const targetButton = event.target.closest('button[data-group-filter]');
                if (!targetButton) {
                    return;
                }
                const nextGroup = (targetButton.dataset.groupFilter || '').trim();
                if (!nextGroup) {
                    return;
                }
                activeGroup = nextGroup;
                renderHomepageByCategory(activeCategory, activeGroup);
                syncFiltersInUrl();
            });
        }

        const categories = buildCategoryList(articlesData || []);
        renderCategoryNav(categories);
        syncFiltersInUrl();
        renderHomepageByCategory(activeCategory, activeGroup);
    } catch (error) {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorEl.innerHTML = `<strong>Error loading articles:</strong> ${error.message}<br><small>Make sure the backend server is running at ${API_BASE_URL}</small>`;
    }
});

