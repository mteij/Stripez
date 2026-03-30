import {
    getAppConfig, getStripezDate, getSchikkoInfo
} from '../api.js';
import {
    renderAppCountdown
} from '../ui.js';

import { state } from './state.js';
import { dom } from './dom.js';

export async function loadAndRenderAppCountdown() {
    const eventData = await getStripezDate();
    renderAppCountdown(eventData, state.isSchikkoSessionActive, state.appName);
}

export function updateDatalist() {
    if (!dom.ledgerNamesDatalist) return;

    dom.ledgerNamesDatalist.innerHTML = '';
    state.ledgerDataCache.forEach(person => {
        const option = document.createElement('option');
        option.value = person.name;
        dom.ledgerNamesDatalist.appendChild(option);
    });
}

export function updateTagFilterDropdown() {
    const allTags = new Set();
    state.rulesDataCache.forEach(rule => {
        (rule.tags || []).forEach(tag => allTags.add(tag));
    });

    if (!dom.ruleTagFilter) return;

    dom.ruleTagFilter.innerHTML = '<option value="all">All Tags</option>';
    [...allTags].sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        dom.ruleTagFilter.appendChild(option);
    });
    dom.ruleTagFilter.value = state.currentTagFilter;
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
    `;

    const versionSpan = document.getElementById('app-version');
    if (versionSpan) {
        versionSpan.textContent = `v${version}`;
    }
}

export async function loadAppConfig() {
    const cfg = await getAppConfig();

    state.appName = (cfg?.name && String(cfg.name).trim()) || 'Schikko Rules';
    state.appYear = Number(cfg?.year) || state.appYear;
    state.hasOracle = !!cfg?.hasOracle;
    state.requireApprovalForDrinks = typeof cfg?.requireApprovalForDrinks === 'boolean'
        ? cfg.requireApprovalForDrinks
        : state.requireApprovalForDrinks;

    if (cfg?.firebaseApiKey && cfg?.firebaseProjectId) {
        window.__firebaseConfig = {
            apiKey: cfg.firebaseApiKey,
            authDomain: (cfg?.firebaseAuthDomain && String(cfg.firebaseAuthDomain).trim()) || `${cfg.firebaseProjectId}.firebaseapp.com`,
            projectId: cfg.firebaseProjectId,
        };
    }
}
