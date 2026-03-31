class ArticleLoader {
    constructor(apiUrl = API_BASE_URL) {
        this.apiUrl = apiUrl;
        this.pendingStandaardArticles = [];
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

    getFirstImage(article) {
        if (article.components && article.components.length > 0) {
            const imageComponent = article.components.find(c => c.type === 'image');
            return imageComponent ? imageComponent.src : null;
        }
        return null;
    }

    findFirstArticleWithImage(groupsData) {
        const allArticles = Object.values(groupsData || {}).flat();
        for (const article of allArticles) {
            if (this.getFirstImage(article)) {
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
            if (this.getFirstImage(article)) {
                return article;
            }
        }
        return sorted[0] || null;
    }

    findFirstImageFromGroups(groupsData) {
        const allArticles = Object.values(groupsData || {}).flat();
        for (const article of allArticles) {
            const image = this.getFirstImage(article);
            if (image) {
                return image;
            }
        }
        return null;
    }

    createGroupSection(groupName, articles) {
        const section = document.createElement('div');
        section.className = 'group-section';
        const isLargeSize = (size) => size === 'groot' || size === 'tekst';
        const isSmallSize = (size) => size === 'klein';
        const isKleinStyleGroup = groupName === 'het klein nieuws' || groupName === 'de miniatuurwereld';
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
            let placeLargeLeft = true;

            while (true) {
                // Full rows only:
                // 1) GROOT - KLEIN/KLEIN
                // 2) KLEIN/KLEIN - GROOT
                if (largeQueue.length > 0 && smallQueue.length >= 2) {
                    rows.push({
                        layout: placeLargeLeft ? 'large-left' : 'large-right',
                        groot: largeQueue.shift(),
                        smalls: [smallQueue.shift(), smallQueue.shift()]
                    });
                    placeLargeLeft = !placeLargeLeft;
                    continue;
                }

                // 3) KLEIN/KLEIN/KLEIN (stacked)
                if (smallQueue.length >= 3) {
                    rows.push({
                        layout: 'small-stack-3',
                        smalls: [smallQueue.shift(), smallQueue.shift(), smallQueue.shift()]
                    });
                    continue;
                }
            }

            // Stop when no full row can be built anymore.
            break;
        }

        this.pendingStandaardArticles = [...largeQueue, ...smallQueue];

        rows.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = 'standaard-row';

            if (row.layout === 'large-left' || row.layout === 'large-right') {
                rowEl.classList.add('groot-row');
                rowEl.style.display = 'grid';
                rowEl.style.gridTemplateColumns = '2fr 1fr';
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

    //Remove last article

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
if (groupName === 'het klein nieuws') {
    const footer = document.createElement('div');
    footer.className = 'klein-nieuws-footer';
    footer.innerHTML = '<button class="btn-blue-full">BEKIJK "HET KLEIN NIEUWS"</button>';
    section.appendChild(footer);
}
return section;
    }

createArticleCard(article) {
    const card = document.createElement('div');
    card.className = 'article-card';
    const imageUrl = this.getFirstImage(article);
    let categoryLabel = '';
    if (article.category && article.category.toLowerCase() !== 'standaard') {
        categoryLabel = `<div class="article-label">${article.category.toUpperCase()}</div>`;
    }
    const isTextOnly = article.size === 'tekst';
    const html = isTextOnly
        ? `
                <div class="article-text-block">
                    ${categoryLabel}
                    <div class="article-text-title">${article.title}</div>
                </div>
            `
        : `
                <img src="${resolveMediaUrl(imageUrl) || 'https://via.placeholder.com/800x450'}" 
                     alt="${article.title}" 
                     class="article-image"
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/800x450'">
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
    const workshopTitle = document.getElementById('workshopTitle');
    const workshopText = document.getElementById('workshopText');
    const workshopButton = document.getElementById('workshopButton');

    try {
        const [groupsData, siteSettings, articlesData] = await Promise.all([
            loader.loadGroups(),
            fetch(`${API_BASE_URL}/site`).then(res => res.ok ? res.json() : null),
            fetch(`${API_BASE_URL}/articles`).then(res => res.ok ? res.json() : [])
        ]);
        loadingEl.style.display = 'none';

        const groupNames = Object.keys(groupsData || {});
        const shuffledGroups = groupNames
            .map(name => ({ name, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(entry => entry.name);

        // set hero image based on the latest article with an image across all articles
        const heroArticle = loader.findLatestArticleWithImage({ all: articlesData || [] });
        if (heroArticle) {
            const heroSrc = loader.getFirstImage(heroArticle);
            if (heroSrc && heroImage) {
                heroImage.style.backgroundImage = `url('${resolveMediaUrl(heroSrc)}')`;
            }
            if (heroTitle) {
                heroTitle.textContent = heroArticle.title || '';
            }
            if (heroLink) {
                heroLink.href = heroArticle.id ? `/article/${heroArticle.id}` : '#';
            }
        }


        if (siteSettings) {
            if (newsletterTitle) newsletterTitle.textContent = siteSettings.newsletterTitle || '';
            if (newsletterText) newsletterText.textContent = siteSettings.newsletterText || '';
            if (newsletterButton) {
                newsletterButton.textContent = siteSettings.newsletterButtonText || '';
                newsletterButton.href = siteSettings.newsletterButtonLink || '#';
            }
            if (workshopTitle) workshopTitle.textContent = siteSettings.workshopTitle || '';
            if (workshopText) workshopText.textContent = siteSettings.workshopText || '';
            if (workshopButton) {
                workshopButton.textContent = siteSettings.workshopButtonText || '';
                workshopButton.href = siteSettings.workshopButtonLink || '#';
            }
        }

        // Hide the side containers since we'll put everything in main content
        if (kleinContainer) kleinContainer.style.display = 'none';
        if (miniContainer) miniContainer.style.display = 'none';

        // Get all article groups - include both ungrouped and 'standaard' group articles
        const ungroupedArticles = (articlesData || []).filter(article => !article.group || article.group === 'standaard');
        const kleinArticles = (groupsData['het klein nieuws'] || []).slice(0, 2);
        const miniatuurArticles = (groupsData['de miniatuurwereld'] || []).slice(0, 4);

        if (ungroupedArticles.length > 0) {
            // Split articles into chunks and insert special sections randomly
            const totalArticles = ungroupedArticles.length;
            const sections = [];

            // Determine random insertion points for special sections
            const insertPoints = [];
            if (kleinArticles.length > 0) {
                // Insert after 30-70% of articles
                insertPoints.push({
                    position: Math.floor(totalArticles * (0.3 + Math.random() * 0.4)),
                    section: loader.createGroupSection('het klein nieuws', kleinArticles)
                });
            }
            if (miniatuurArticles.length > 0) {
                // Insert after 40-80% of articles
                insertPoints.push({
                    position: Math.floor(totalArticles * (0.4 + Math.random() * 0.4)),
                    section: loader.createGroupSection('de miniatuurwereld', miniatuurArticles)
                });
            }

            // Sort insert points by position
            insertPoints.sort((a, b) => a.position - b.position);

            // Build the content by inserting special sections at the right positions
            let lastIndex = 0;
            insertPoints.forEach(insertPoint => {
                // Add articles up to this insertion point
                if (insertPoint.position > lastIndex) {
                    const articlesSlice = ungroupedArticles.slice(lastIndex, insertPoint.position);
                    if (articlesSlice.length > 0) {
                        const articleSection = loader.createGroupSection('standaard', articlesSlice);
                        container.appendChild(articleSection);
                    }
                }
                // Add the special section
                container.appendChild(insertPoint.section);
                lastIndex = insertPoint.position;
            });

            // Add remaining articles after all insertions
            if (lastIndex < totalArticles) {
                const remainingArticles = ungroupedArticles.slice(lastIndex);
                if (remainingArticles.length > 0) {
                    const articleSection = loader.createGroupSection('standaard', remainingArticles);
                    container.appendChild(articleSection);
                }
            }
        } else {
            // No main articles, just show special sections
            if (kleinArticles.length > 0) {
                const kleinSection = loader.createGroupSection('het klein nieuws', kleinArticles);
                container.appendChild(kleinSection);
            }
            if (miniatuurArticles.length > 0) {
                const miniSection = loader.createGroupSection('de miniatuurwereld', miniatuurArticles);
                container.appendChild(miniSection);
            }
        }
    } catch (error) {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorEl.innerHTML = `<strong>Error loading articles:</strong> ${error.message}<br><small>Make sure the backend server is running at ${API_BASE_URL}</small>`;
    }
});

