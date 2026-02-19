import {
    ensureAnon, setupRealtimeListener, getAppConfig, getCalendarConfig,
    getCalendarDataProxy, getStripezDate, getSchikkoInfo
} from './api.js';
import {
    renderUpcomingEvent, renderAppCountdown, setStripeTotals, showAlert
} from './ui.js';

import { state } from './modules/state.js';
import { dom } from './modules/dom.js';
import { checkSchikkoStatus, updateGuestUI } from './modules/auth.js';
import { handleRender, handleRenderRules, handleRenderLogbook } from './modules/render.js';
import { setupEventListeners } from './modules/events.js';

export async function loadCalendarData() {
    const config = await getCalendarConfig();
    if (config && config.url) {
        try {
            const result = await getCalendarDataProxy(config.url);
            const icalData = result.icalData;

            const jcalData = ICAL.parse(icalData);
            const vcalendar = new ICAL.Component(jcalData);
            const vevents = vcalendar.getAllSubcomponents('vevent');
            const now = new Date();

            state.calendarEventsCache = vevents.map(vevent => {
                const event = new ICAL.Event(vevent);
                if (event.isRecurring()) {
                    const iterator = event.iterator();
                    let next;
                    const occurrences = [];
                    while ((next = iterator.next()) && occurrences.length < 100) {
                        const startJs = next.toJSDate();
                        const t = ICAL.Time.fromJSDate(startJs);
                        t.addDuration(event.duration);
                        const endJs = t.toJSDate();
                        occurrences.push({
                            summary: event.summary,
                            startDate: startJs,
                            endDate: endJs,
                            location: event.location,
                            description: event.description,
                        });
                    }
                    return occurrences;
                } else {
                    return {
                        summary: event.summary,
                        startDate: event.startDate.toJSDate(),
                        endDate: event.endDate.toJSDate(),
                        location: event.location,
                        description: event.description,
                    };
                }
            }).flat().filter(event => event.endDate > now).sort((a, b) => a.startDate - b.startDate);

            renderUpcomingEvent(state.calendarEventsCache[0]);
        } catch (error) {
            console.error('Error fetching or parsing calendar data:', error);
            if (dom.upcomingEventDiv) dom.upcomingEventDiv.innerHTML = 'Could not load calendar data.';
        }
    } else {
        if (dom.upcomingEventDiv) dom.upcomingEventDiv.innerHTML = 'No calendar URL set.';
    }
}

export async function loadAndRenderAppCountdown() {
    const eventData = await getStripezDate();
    renderAppCountdown(eventData, state.isSchikkoSessionActive, state.appName);
}

export function updateDatalist() {
    if (dom.ledgerNamesDatalist) {
        dom.ledgerNamesDatalist.innerHTML = '';
        state.ledgerDataCache.forEach(person => {
            const option = document.createElement('option');
            option.value = person.name;
            dom.ledgerNamesDatalist.appendChild(option);
        });
    }
}

export function updateTagFilterDropdown() {
    const allTags = new Set();
    state.rulesDataCache.forEach(rule => {
        (rule.tags || []).forEach(tag => allTags.add(tag));
    });

    if (dom.ruleTagFilter) {
        dom.ruleTagFilter.innerHTML = '<option value="all">All Tags</option>';
        [...allTags].sort().forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            dom.ruleTagFilter.appendChild(option);
        });
        dom.ruleTagFilter.value = state.currentTagFilter;
    }
}

export async function updateAppFooter() {
    if (!dom.appInfoFooter) return;

    let latestUpdateTimestamp = null;
    if (state.rulesDataCache.length > 0) {
        latestUpdateTimestamp = state.rulesDataCache.reduce((max, rule) => {
            const ruleTs = rule.updatedAt || rule.createdAt;
            return (ruleTs && (!max || ruleTs.toMillis() > max.toMillis())) ? ruleTs : max;
        }, null);
        if (latestUpdateTimestamp && typeof latestUpdateTimestamp.toDate === 'function') {
            latestUpdateTimestamp = latestUpdateTimestamp.toDate();
        } else {
            latestUpdateTimestamp = null;
        }
    }

    let schikkoInfoText = 'No Schikko has been chosen for this year.';
    if (state.isSchikkoSetForTheYear) {
        try {
            const info = await getSchikkoInfo();
            if (info.name) {
                const expiryDate = new Date(info.expires);
                const expiryString = expiryDate.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                });
                schikkoInfoText = `Current Schikko: ${info.name}. Reign ends on ${expiryString}.`;
            }
        } catch (error) {
            console.error("Could not fetch Schikko info:", error);
            schikkoInfoText = "Could not retrieve the current Schikko's identity.";
        }
    }

    const htmlEl = document.documentElement;
    const version = (htmlEl && htmlEl.getAttribute('data-app-version')) || 'dev';

    const dateString = latestUpdateTimestamp
        ? latestUpdateTimestamp.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        })
        : 'Unknown Date';

    dom.appInfoFooter.innerHTML = `
        <div class="mb-2 italic text-sm text-[#8c6b52]">${schikkoInfoText}</div>
        <div>Decrees last amended: ${dateString}</div>
        <div class="mt-1 text-sm opacity-75">Rules and decisions are final. Resistance is futile.</div>
    `;

    const versionSpan = document.getElementById('app-version');
    if (versionSpan) {
        versionSpan.textContent = `v${version}`;
    }
}

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
            const cfg = await getAppConfig();
            state.appName = (cfg?.name && String(cfg.name).trim()) || 'Schikko Rules';
            state.appYear = Number(cfg?.year) || state.appYear;
            state.hasOracle = !!cfg?.hasOracle;
            state.requireApprovalForDrinks = typeof cfg?.requireApprovalForDrinks === 'boolean' ? cfg.requireApprovalForDrinks : state.requireApprovalForDrinks;
  
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

        loadCalendarData();
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
