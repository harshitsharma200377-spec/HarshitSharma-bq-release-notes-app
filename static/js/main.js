document.addEventListener('DOMContentLoaded', () => {
    // State management
    let allReleases = [];
    let selectedUpdate = null;
    let currentFilterType = 'all';
    let searchQuery = '';

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const refreshText = document.getElementById('refresh-text');
    const lastSyncTime = document.getElementById('last-sync-time');
    const exportBtn = document.getElementById('export-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const retryBtn = document.getElementById('retry-btn');
    const feedContainer = document.getElementById('feed-container');
    
    const searchInput = document.getElementById('search-input');
    const typeFilters = document.getElementById('type-filters');
    
    const composerEmpty = document.getElementById('composer-empty');
    const composerActive = document.getElementById('composer-active');
    const composerBadge = document.getElementById('composer-badge');
    const composerDate = document.getElementById('composer-date');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCount = document.getElementById('char-count');
    const tweetBtn = document.getElementById('tweet-btn');
    const clearComposerBtn = document.getElementById('clear-composer-btn');

    // Fetch releases from local API
    async function fetchReleases() {
        showLoading(true);
        showError(false);
        
        try {
            const response = await fetch('/api/releases');
            if (!response.ok) throw new Error('API request failed');
            
            allReleases = await response.ok ? await response.json() : [];
            updateLastSyncTime();
            renderFeed();
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showError(true);
        } finally {
            showLoading(false);
        }
    }

    function showLoading(isLoading) {
        if (isLoading) {
            loadingState.classList.remove('hidden');
            feedContainer.classList.add('hidden');
            refreshIcon.classList.add('spinning');
            refreshBtn.disabled = true;
            refreshText.textContent = 'Syncing...';
        } else {
            loadingState.classList.add('hidden');
            feedContainer.classList.remove('hidden');
            refreshIcon.classList.remove('spinning');
            refreshBtn.disabled = false;
            refreshText.textContent = 'Refresh';
        }
    }

    function showError(isError) {
        if (isError) {
            errorState.classList.remove('hidden');
            feedContainer.classList.add('hidden');
        } else {
            errorState.classList.add('hidden');
        }
    }

    function updateLastSyncTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        lastSyncTime.textContent = `Last Sync: ${timeStr}`;
    }

    // Process type class matching
    function getTypeClass(type) {
        const t = type.toLowerCase();
        if (t.includes('feature')) return 'feature';
        if (t.includes('announcement')) return 'announcement';
        if (t.includes('issue') || t.includes('bug') || t.includes('fix')) return 'issue';
        if (t.includes('deprecation')) return 'deprecation';
        return 'general';
    }

    // Render feed based on filters and search
    function renderFeed() {
        feedContainer.innerHTML = '';
        
        if (allReleases.length === 0) {
            feedContainer.innerHTML = '<div class="composer-empty"><p>No releases found.</p></div>';
            return;
        }

        let hasVisibleContent = false;

        allReleases.forEach(release => {
            // Filter the items within this date
            const filteredItems = release.items.filter(item => {
                const typeMatches = currentFilterType === 'all' || item.type.toLowerCase() === currentFilterType;
                
                const searchMatches = searchQuery === '' || 
                    item.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    release.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.type.toLowerCase().includes(searchQuery.toLowerCase());
                
                return typeMatches && searchMatches;
            });

            if (filteredItems.length > 0) {
                hasVisibleContent = true;
                
                // Day wrapper
                const daySection = document.createElement('section');
                daySection.className = 'release-day';
                
                // Date title divider
                const dateDivider = document.createElement('div');
                dateDivider.className = 'date-divider';
                dateDivider.textContent = release.date;
                daySection.appendChild(dateDivider);
                
                // Grid wrapper
                const itemsGrid = document.createElement('div');
                itemsGrid.className = 'release-items-grid';
                
                filteredItems.forEach(item => {
                    const typeClass = getTypeClass(item.type);
                    const isSelected = selectedUpdate && 
                        selectedUpdate.id === release.id && 
                        selectedUpdate.content === item.content;

                    const card = document.createElement('div');
                    card.className = `release-card ${typeClass} ${isSelected ? 'selected' : ''}`;
                    
                    card.innerHTML = `
                        <div class="card-header">
                            <span class="card-type ${typeClass}">
                                <span class="indicator ${typeClass}"></span>${item.type}
                            </span>
                            <div class="card-actions">
                                <button class="action-icon copy-icon" title="Copy release note to clipboard">
                                    <i class="fa-regular fa-copy"></i>
                                </button>
                                <button class="action-icon tweet-icon" title="Tweet this update">
                                    <i class="fa-brands fa-x-twitter"></i>
                                </button>
                                <a href="${release.link}" target="_blank" class="action-icon" title="View official docs">
                                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                </a>
                            </div>
                        </div>
                        <div class="card-content">
                            ${item.content}
                        </div>
                        <div class="card-footer">
                            <a href="${release.link}" target="_blank">
                                <i class="fa-solid fa-link"></i> BigQuery Release Documentation
                            </a>
                        </div>
                    `;

                    // Card select logic (click anywhere on the card to compose tweet)
                    card.addEventListener('click', (e) => {
                        // Skip composer trigger if clicked on links inside the card or copy button
                        if (e.target.tagName === 'A' || e.target.closest('a') || e.target.closest('.copy-icon')) {
                            return;
                        }
                        
                        selectUpdateForComposer(release, item);
                        
                        // Scroll composer into view on mobile
                        if (window.innerWidth <= 768) {
                            document.querySelector('.sidebar').scrollIntoView({ behavior: 'smooth' });
                        }
                    });

                    // Copy to clipboard listener
                    const copyBtn = card.querySelector('.copy-icon');
                    copyBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(item.text).then(() => {
                            const icon = copyBtn.querySelector('i');
                            icon.className = 'fa-solid fa-check';
                            copyBtn.classList.add('success');
                            setTimeout(() => {
                                icon.className = 'fa-regular fa-copy';
                                copyBtn.classList.remove('success');
                            }, 2000);
                        }).catch(err => {
                            console.error('Failed to copy text: ', err);
                        });
                    });

                    itemsGrid.appendChild(card);
                });
                
                daySection.appendChild(itemsGrid);
                feedContainer.appendChild(daySection);
            }
        });

        if (!hasVisibleContent) {
            feedContainer.innerHTML = `
                <div class="composer-empty">
                    <div class="empty-icon-wrapper">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </div>
                    <p>No release notes match your filters or search query.</p>
                </div>
            `;
        }
    }

    // Set composer update details
    function selectUpdateForComposer(release, item) {
        selectedUpdate = {
            id: release.id,
            date: release.date,
            type: item.type,
            content: item.content,
            text: item.text,
            link: release.link
        };

        // UI toggles
        composerEmpty.classList.add('hidden');
        composerActive.classList.remove('hidden');

        // Set properties
        composerBadge.className = `badge ${getTypeClass(item.type)}`;
        composerBadge.textContent = item.type;
        composerDate.textContent = release.date;

        // Generate draft Tweet text
        const generatedDraft = generateTweetDraft(item.type, item.text, release.link);
        tweetTextarea.value = generatedDraft;
        updateCharCount();

        // Highlight active card in UI
        document.querySelectorAll('.release-card').forEach(c => c.classList.remove('selected'));
        renderFeed();
    }

    function generateTweetDraft(type, text, link) {
        // Build customized intro tags based on update types
        let prefix = "📢 BigQuery Update:\n";
        if (type.toLowerCase().includes('feature')) {
            prefix = "🚀 New #BigQuery Feature:\n";
        } else if (type.toLowerCase().includes('issue') || type.toLowerCase().includes('bug')) {
            prefix = "⚠️ BigQuery Alert:\n";
        } else if (type.toLowerCase().includes('deprecation')) {
            prefix = "🛑 BigQuery Deprecation:\n";
        } else if (type.toLowerCase().includes('announcement')) {
            prefix = "🔔 BigQuery Announcement:\n";
        }

        // Clean text (remove double spaces/newlines)
        let cleanText = text.replace(/\s+/g, ' ').trim();
        
        // Hashtags & link templates
        const tags = "\n\n#GoogleCloud #DataEngineering";
        const linkPlaceholder = link ? `\n🔗 ${link}` : '';
        
        // Limit text length dynamically
        const extraLen = prefix.length + linkPlaceholder.length + tags.length;
        const maxTextLen = 280 - extraLen;

        if (cleanText.length > maxTextLen) {
            cleanText = cleanText.substring(0, maxTextLen - 3) + '...';
        }

        return `${prefix}${cleanText}${linkPlaceholder}${tags}`;
    }

    // Update Tweet Char Count
    function updateCharCount() {
        const len = tweetTextarea.value.length;
        charCount.textContent = len;
        
        charCount.classList.remove('warning', 'error');
        if (len > 260 && len <= 280) {
            charCount.classList.add('warning');
        } else if (len > 280) {
            charCount.classList.add('error');
        }

        tweetBtn.disabled = len === 0 || len > 280;
    }

    // Cancel / Clear Composer selection
    function clearComposer() {
        selectedUpdate = null;
        composerActive.classList.add('hidden');
        composerEmpty.classList.remove('hidden');
        tweetTextarea.value = '';
        charCount.textContent = '0';
        
        // Clear active cards visual
        document.querySelectorAll('.release-card').forEach(c => c.classList.remove('selected'));
    }

    // Open X Intent to post tweet
    function postTweet() {
        const text = tweetTextarea.value;
        if (!text || text.length > 280) return;
        
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'width=550,height=420');
    }

    // Export active filtered releases to CSV
    function exportToCSV() {
        if (allReleases.length === 0) return;

        const csvRows = [];
        // Add CSV Headers
        csvRows.push(['Date', 'Update Type', 'Link', 'Content Text']);

        allReleases.forEach(release => {
            release.items.forEach(item => {
                const typeMatches = currentFilterType === 'all' || item.type.toLowerCase() === currentFilterType;
                const searchMatches = searchQuery === '' || 
                    item.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    release.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.type.toLowerCase().includes(searchQuery.toLowerCase());

                if (typeMatches && searchMatches) {
                    const cleanText = item.text.replace(/"/g, '""').replace(/\s+/g, ' ').trim();
                    const cleanDate = release.date.replace(/"/g, '""');
                    const cleanType = item.type.replace(/"/g, '""');
                    const cleanLink = release.link.replace(/"/g, '""');

                    csvRows.push([`"${cleanDate}"`, `"${cleanType}"`, `"${cleanLink}"`, `"${cleanText}"`]);
                }
            });
        });

        if (csvRows.length <= 1) {
            alert('No data matches the current filters to export.');
            return;
        }

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `bigquery_releases_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Attach listeners
    refreshBtn.addEventListener('click', fetchReleases);
    retryBtn.addEventListener('click', fetchReleases);
    exportBtn.addEventListener('click', exportToCSV);
    
    tweetTextarea.addEventListener('input', updateCharCount);
    tweetBtn.addEventListener('click', postTweet);
    clearComposerBtn.addEventListener('click', clearComposer);
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Theme toggler
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    }

    function updateThemeIcon(theme) {
        if (theme === 'light') {
            themeToggleIcon.className = 'fa-solid fa-moon';
        } else {
            themeToggleIcon.className = 'fa-solid fa-sun';
        }
    }

    // Filter Chips selection
    typeFilters.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;

        typeFilters.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        currentFilterType = chip.getAttribute('data-type');
        renderFeed();
    });

    // Search query input handling
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderFeed();
    });

    // Initial load
    initTheme();
    fetchReleases();
});
