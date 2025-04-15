// Search Engine API Configurations
// IMPORTANT: Replace these with your actual credentials
// 1. Get your Google API key from: https://console.cloud.google.com/
//    - Create a project
//    - Enable Custom Search API
//    - Create credentials
const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY_HERE'; // Replace with your actual API key

// 2. Get your Search Engine ID from: https://programmablesearchengine.google.com/
//    - Create a search engine
//    - Configure to search the entire web
//    - Copy the Search Engine ID
const GOOGLE_CX = 'YOUR_SEARCH_ENGINE_ID_HERE'; // Replace with your actual Search Engine ID

const API_ENDPOINTS = {
    google: `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&lr=lang_en`,
    duckduckgo: 'https://api.duckduckgo.com/'
};

// DOM Elements
const searchBox = document.querySelector('.search-box');
const resultsContainer = document.querySelector('.results-container');
const typeFilter = document.getElementById('type-filter');

// Search result class to standardize results from different engines
class SearchResult {
    constructor(title, url, description, source, score = 0, type = 'article') {
        this.title = title;
        this.url = url;
        this.description = description;
        this.source = source;
        this.score = score;
        this.type = type;
    }
}

// Function to get type filter for Google search
function getTypeFilter(typeFilter) {
    switch (typeFilter) {
        case 'video':
            return '&searchType=image&fileType=mp4';
        case 'image':
            return '&searchType=image';
        default:
            return '';
    }
}

// Function to fetch results from Google
async function fetchGoogleResults(query) {
    try {
        const typeFilterParam = getTypeFilter(typeFilter.value);
        const apiUrl = `${API_ENDPOINTS.google}&q=${encodeURIComponent(query)}${typeFilterParam}`;
        console.log('Google API URL:', apiUrl);
        
        const response = await fetch(apiUrl);
        const responseText = await response.text();
        console.log('Raw Google API Response:', responseText);
        
        if (!response.ok) {
            console.error('Google API Response Status:', response.status);
            console.error('Google API Response Headers:', response.headers);
            throw new Error(`Google API error: ${response.status} ${response.statusText}`);
        }
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse Google API response:', e);
            throw new Error('Invalid JSON response from Google API');
        }
        
        console.log('Parsed Google API Response:', data);
        
        if (data.error) {
            console.error('Google API Error:', data.error);
            throw new Error(`Google API error: ${data.error.message}`);
        }
        
        if (!data.items || !Array.isArray(data.items)) {
            console.warn('No items in Google response. Response data:', data);
            return [];
        }
        
        const results = data.items.map(item => ({
            title: item.title || 'Untitled',
            url: item.link || '',
            description: item.snippet || 'No description available',
            source: 'Google',
            score: item.rank || 0,
            type: typeFilter.value === 'any' ? 'article' : typeFilter.value
        }));
        
        console.log('Processed Google results:', results);
        return results;
    } catch (error) {
        console.error('Google search error:', error);
        return [];
    }
}

// Function to fetch results from DuckDuckGo
async function fetchDuckDuckGoResults(query) {
    try {
        const response = await fetch(`${API_ENDPOINTS.duckduckgo}?q=${encodeURIComponent(query)}&format=json&kl=en-en`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('DuckDuckGo API Response:', errorText);
            throw new Error(`DuckDuckGo API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('DuckDuckGo API Response:', data);
        
        if (!data.RelatedTopics || !Array.isArray(data.RelatedTopics)) {
            console.warn('No results from DuckDuckGo');
            return [];
        }
        
        return data.RelatedTopics.map(item => ({
            title: item.Text || 'Untitled',
            url: item.FirstURL || '',
            description: item.Text || 'No description available',
            source: 'DuckDuckGo',
            score: item.Rank || 0,
            type: typeFilter.value === 'any' ? 'article' : typeFilter.value
        }));
    } catch (error) {
        console.error('DuckDuckGo search error:', error);
        return [];
    }
}

// Function to filter results by type
function filterByType(results, typeFilter) {
    if (typeFilter === 'any') return results;
    return results.filter(result => result.type === typeFilter);
}

// Function to deduplicate and rank results
function processResults(results) {
    if (!results || !Array.isArray(results)) {
        console.warn('Invalid results array received');
        return [];
    }

    const urlMap = new Map();
    
    // Deduplicate results and combine scores
    results.forEach(result => {
        if (!result || !result.url) {
            console.warn('Invalid result object:', result);
            return;
        }

        const normalizedUrl = result.url.toLowerCase();
        if (urlMap.has(normalizedUrl)) {
            const existing = urlMap.get(normalizedUrl);
            existing.score += result.score || 0;
            if (result.source) {
                existing.sources.add(result.source);
            }
        } else {
            urlMap.set(normalizedUrl, {
                ...result,
                sources: new Set([result.source].filter(Boolean))
            });
        }
    });

    // Convert to array and sort by score
    return Array.from(urlMap.values())
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map(result => ({
            ...result,
            sources: Array.from(result.sources || [])
        }));
}

// Main search function
async function performSearch(query) {
    // Clear previous results
    resultsContainer.innerHTML = '';
    
    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.textContent = 'Searching Google and DuckDuckGo...';
    resultsContainer.appendChild(loadingDiv);

    try {
        if (!query.trim()) {
            showWelcomeMessage();
            return;
        }

        console.log('Starting search for query:', query);
        
        // Fetch results from both engines in parallel
        const [googleResults, duckduckgoResults] = await Promise.all([
            fetchGoogleResults(query),
            fetchDuckDuckGoResults(query)
        ]);

        console.log('Google results:', googleResults);
        console.log('DuckDuckGo results:', duckduckgoResults);

        // Combine and process all results
        let allResults = [...googleResults, ...duckduckgoResults];
        console.log('Combined results before filtering:', allResults);
        
        // Apply type filter
        allResults = filterByType(allResults, typeFilter.value);
        console.log('Results after type filtering:', allResults);
        
        const processedResults = processResults(allResults);
        console.log('Final processed results:', processedResults);

        // Remove loading state
        resultsContainer.innerHTML = '';

        if (processedResults.length === 0) {
            console.log('No results found after processing');
            showNoResults();
        } else {
            displayResults(processedResults);
        }
    } catch (error) {
        console.error('Search error:', error);
        showError(error.message || 'There was an error fetching search results. Please try again later.');
    }
}

// Display results function
function displayResults(results) {
    if (!results || !Array.isArray(results)) {
        console.error('Invalid results array received for display');
        showError('Invalid search results received');
        return;
    }

    results.forEach((result, index) => {
        if (!result) {
            console.warn('Invalid result object at index:', index);
            return;
        }

        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        
        // Add animation delay based on index
        resultItem.style.animationDelay = `${index * 0.1}s`;
        
        // Format the URL
        const formattedUrl = result.url
            ? result.url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
            : '';

        // Create sources badge
        const sourcesBadge = result.sources && result.sources.length > 1 
            ? `<span class="sources-badge">${result.sources.join(' + ')}</span>`
            : '';

        resultItem.innerHTML = `
            <div class="result-title">${result.title || 'Untitled'} ${sourcesBadge}</div>
            <div class="result-url">${formattedUrl}</div>
            <div class="result-description">${result.description || 'No description available'}</div>
        `;
        
        // Add click event only if URL exists
        if (result.url) {
            resultItem.addEventListener('click', () => {
                window.open(result.url, '_blank');
            });
            resultItem.style.cursor = 'pointer';
        }
        
        resultsContainer.appendChild(resultItem);
    });
}

// Helper functions for different states
function showWelcomeMessage() {
    resultsContainer.innerHTML = `
        <div class="result-item">
            <div class="result-title">Welcome to Multi-Search Engine</div>
            <div class="result-description">Start typing to search across Google and DuckDuckGo.</div>
        </div>
    `;
}

function showNoResults() {
    resultsContainer.innerHTML = `
        <div class="result-item">
            <div class="result-title">No results found</div>
            <div class="result-description">Try different keywords or check your spelling.</div>
        </div>
    `;
}

function showError(errorMessage) {
    resultsContainer.innerHTML = `
        <div class="result-item">
            <div class="result-title">Error</div>
            <div class="result-description">${errorMessage}</div>
        </div>
    `;
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Event listeners
searchBox.addEventListener('input', debounce((e) => {
    performSearch(e.target.value);
}, 300));

// Add event listener for type filter
typeFilter.addEventListener('change', () => {
    if (searchBox.value.trim()) {
        performSearch(searchBox.value);
    }
});

// Initial welcome message
showWelcomeMessage();
