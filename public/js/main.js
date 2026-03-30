import {
    ensureAnon, setupRealtimeListener
} from './api.js';
import {
    setStripeTotals
} from './ui.js';

import { state } from './modules/state.js';
import { dom } from './modules/dom.js';
import { checkSchikkoStatus, updateGuestUI } from './modules/auth.js';
import { handleRender, handleRenderRules, handleRenderLogbook } from './modules/render.js';
import { setupEventListeners } from './modules/events.js';
import {
    loadAndRenderAppCountdown,
    loadAppConfig,
    updateAppFooter,
    updateDatalist,
    updateTagFilterDropdown
} from './modules/app-ui.js';

// Global initialization
(async function init() {
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        event.preventDefault();
    });

    window.addEventListener('error', function(event) {
        console.error('JavaScript error:', event.error);
        if (event.message && event.message.includes('Failed to load resource')) {
            console.warn('External resource loading detected');
        }
    });

    try {
        await ensureAnon();

        try {
            await loadAppConfig();
  
            const displayTitle = state.appYear ? `${state.appName} ${state.appYear}` : state.appName;

            document.title = displayTitle;
            const metaApp = document.querySelector('meta[name="application-name"]');
            if (metaApp) metaApp.setAttribute('content', state.appName);
            const metaApple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
            if (metaApple) metaApple.setAttribute('content', state.appName);

            const titleSpan = document.getElementById('main-title-text');
            if (titleSpan) {
                titleSpan.textContent = displayTitle;
                titleSpan.classList.add('app-fade', 'app-fade-slow');
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        titleSpan.classList.add('app-fade-in');
                    });
                });
            }
            const inlineNameEl = document.getElementById('app-name-inline');
            if (inlineNameEl) {
                inlineNameEl.textContent = state.appName;
                requestAnimationFrame(() => inlineNameEl.classList.remove('opacity-0'));
            }

            if (!state.hasOracle) {
                if (dom.openGeminiFromHubBtn) dom.openGeminiFromHubBtn.classList.add('hidden');
            }
            
            setTimeout(() => {
                try {
                    const titleEl = document.getElementById('main-title-text');
                    if (titleEl) {
                        if (!titleEl.textContent || !titleEl.textContent.trim()) {
                            const meta = document.querySelector('meta[name="application-name"]');
                            const name = ((meta && meta.getAttribute('content')) || '').trim() || state.appName || 'Schikko Rules';
                            const y = Number.isFinite(state.appYear) ? state.appYear : new Date().getFullYear();
                            titleEl.textContent = `${name} ${y}`;
                        }
                        titleEl.classList.remove('opacity-0');
                        titleEl.style.opacity = '1';
                    }
                    const inline = document.getElementById('app-name-inline');
                    if (inline) {
                        if (!inline.textContent || !inline.textContent.trim()) {
                            inline.textContent = state.appName || 'Schikko Rules';
                        }
                        inline.classList.remove('opacity-0');
                        inline.style.opacity = '1';
                    }
                } catch (e) {}
            }, 800);
        } catch (_) {}

        await checkSchikkoStatus().then(() => {
            const persistedSessionId = localStorage.getItem('schikkoSessionId');
            if (persistedSessionId) {
                state.isSchikkoSessionActive = true;
            }
            updateGuestUI();
            updateAppFooter();
        });

        setupEventListeners();

        loadAndRenderAppCountdown();

        setupRealtimeListener('punishments', (data) => {
            if (dom.loadingState) dom.loadingState.style.display = 'none';
            state.ledgerDataCache = data;
            try {
                const totals = data.reduce((acc, p) => {
                    acc.total += (p?.stripes?.length || 0);
                    acc.drunk += (p?.drunkStripes?.length || 0);
                    return acc;
                }, { total: 0, drunk: 0 });
                setStripeTotals(totals.total, totals.drunk);
            } catch (e) {}
            handleRender();
            updateDatalist();
        });

        setupRealtimeListener('rules', (data) => {
            state.rulesDataCache = data.sort((a, b) => a.order - b.order);
            handleRenderRules();
            updateTagFilterDropdown();
            updateAppFooter();
        });

        setupRealtimeListener('activity_log', (data) => {
            state.logbookDataCache = data;
            handleRenderLogbook();
        });
    } catch (err) {
        console.error('Initialization failed:', err);
    }
})();
