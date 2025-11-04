// public/js/main.js

// --- MODULE IMPORTS ---
import {
    ensureAnon, setupRealtimeListener,
    addNameToLedger, addStripeToPerson, removeLastStripeFromPerson,
    renamePersonOnLedger, deletePersonFromLedger, addRuleToFirestore,
    deleteRuleFromFirestore, updateRuleOrderInFirestore, updateRuleInFirestore,
    deleteLogFromFirestore, addDrunkStripeToPerson, removeLastDrunkStripeFromPerson,
    getCalendarConfig, getAppConfig, saveCalendarUrl, getStripezDate, saveStripezDate,
    setPersonRole, logActivity, getSchikkoStatus, getSchikkoInfo,
    setSchikko, loginSchikko, confirmSchikko, getCalendarDataProxy, getOracleJudgement,
    // drink requests
    requestDrink, listDrinkRequests, approveDrinkRequest, rejectDrinkRequest
} from './api.js';
import {
    renderLedger, showStatsModal, closeMenus, renderRules,
    renderUpcomingEvent, renderFullAgenda, showAgendaModal,
    showAlert, showConfirm, showPrompt, showSchikkoLoginModal,
    showSetSchikkoModal, showRuleEditModal, renderAppCountdown,
    showLogbookModal, renderLogbook, renderLogbookChart, showLoading, hideLoading,
    setStripeTotals
} from './ui.js';
import { initListRandomizer, initDiceRandomizer, rollDiceAndAssign } from '../randomizer/randomizer.js';


// --- STATE VARIABLES ---
let currentUserId = null;
let ledgerDataCache = [];
let rulesDataCache = []; // Full, unfiltered rules data
let logbookDataCache = [];
let calendarEventsCache = [];
let currentSortOrder = 'default';
let currentSearchTerm = ''; // For ledger search
let currentRuleSearchTerm = ''; // New: For rules inconsistencies search
let currentTagFilter = 'all'; // For tag filtering
let currentLogbookSearchTerm = '';
let currentLogbookFilter = 'all';
let currentLogbookSort = 'newest';
let isSchikkoSessionActive = false; // Secure session state for Schikko
let isSchikkoSetForTheYear = false; // NEW: Tracks if a schikko is set for the year

// App branding/config (from server env)
let appName = 'Stripez';
let appYear = new Date().getFullYear();
let hasOracle = false;
// Whether guests require Schikko approval to record drunk stripes (from server)
let requireApprovalForDrinks = true;

// --- DOM ELEMENTS ---
const loadingState = document.getElementById('loading-state');
const mainInput = document.getElementById('main-input');
const addBtn = document.getElementById('add-btn');
const sortSelect = document.getElementById('sort-select');
const sortButtonText = document.getElementById('sort-button-text');
const punishmentListDiv = document.getElementById('punishment-list');
const closeStatsModalBtn = document.getElementById('close-stats-modal');
const statsModal = document.getElementById('stats-modal');
const rulesListOl = document.getElementById('rules-list');
const editRulesBtn = document.getElementById('edit-rules-btn');
const addDecreeBtn = document.getElementById('add-decree-btn');
const showDecreesContainer = document.getElementById('show-decrees-container');
const decreesContent = document.getElementById('decrees-content');
const showDecreesBtn = document.getElementById('show-decrees-btn');
const ruleSearchInput = document.getElementById('rule-search-input');
const ruleTagFilter = document.getElementById('rule-tag-filter');
const appInfoFooter = document.getElementById('app-info-footer');
const ledgerNamesDatalist = document.getElementById('ledger-names');
const upcomingEventDiv = document.getElementById('upcoming-event');
const editCalendarBtn = document.getElementById('edit-calendar-btn');
const fullAgendaBtn = document.getElementById('full-agenda-btn');
const agendaModal = document.getElementById('agenda-modal');
const closeAgendaModalBtn = document.getElementById('close-agenda-modal');
const setSchikkoBtn = document.getElementById('set-schikko-btn');
const schikkoLoginContainer = document.getElementById('schikko-login-container');
const schikkoLoginBtn = document.getElementById('schikko-login-btn');
const editAppDateBtn = document.getElementById('edit-app-date-btn');

// TOTP setup modal elements (populated if present in HTML)
const totpModal = document.getElementById('totp-setup-modal');
const closeTotpModalBtn = document.getElementById('close-totp-setup-modal');
const totpQrEl = document.getElementById('totp-qr');
const totpSecretEl = document.getElementById('totp-secret');
const totpManualEl = document.getElementById('totp-manual');

// Initialize default sorting UI (Role → Stripes → A–Z)
currentSortOrder = 'default';
if (sortSelect) {
    sortSelect.value = 'default';
    if (sortButtonText) {
        sortButtonText.textContent = 'Sort: Default';
    }
}


// Dice randomizer modal and buttons
const diceRandomizerModal = document.getElementById('dice-randomizer-modal');
const closeDiceRandomizerModalBtn = document.getElementById('close-dice-randomizer-modal');


// List randomizer modal and buttons
const listRandomizerModal = document.getElementById('list-randomizer-modal');
const closeListRandomizerModalBtn = document.getElementById('close-list-randomizer-modal');

// Randomizer Hub elements
const openRandomizerHubBtn = document.getElementById('open-randomizer-hub-btn');
const randomizerHubModal = document.getElementById('randomizer-hub-modal');
const closeRandomizerHubModalBtn = document.getElementById('close-randomizer-hub-modal');
const openListRandomizerFromHubBtn = document.getElementById('open-list-randomizer-from-hub-btn');
const openDiceRandomizerFromHubBtn = document.getElementById('open-dice-randomizer-from-hub-btn');

// Gemini Oracle elements
const openGeminiFromHubBtn = document.getElementById('open-gemini-from-hub-btn');
const geminiModal = document.getElementById('gemini-modal');
const closeGeminiModalBtn = document.getElementById('close-gemini-modal');
const geminiSubmitBtn = document.getElementById('gemini-submit-btn');
const geminiInput = document.getElementById('gemini-input');
const geminiOutput = document.getElementById('gemini-output');
const geminiActionButtonsContainer = document.createElement('div');
geminiActionButtonsContainer.className = 'flex flex-wrap justify-center gap-4 mt-4';

// Drunk Stripes Modal Elements
const drunkStripesModal = document.getElementById('drunk-stripes-modal');
const closeDrunkStripesModalBtn = document.getElementById('close-drunk-stripes-modal');
const howManyBeersInput = document.getElementById('how-many-beers-input');
const incrementBeersBtn = document.getElementById('increment-beers-btn');
const decrementBeersBtn = document.getElementById('decrement-beers-btn');
const confirmDrunkStripesBtn = document.getElementById('confirm-drunk-stripes-btn');
const availableStripesDisplay = document.getElementById('available-stripes-display');

// Drink Requests admin UI
const openDrinkRequestsBtn = document.getElementById('open-drink-requests-btn');
const drinkRequestsModal = document.getElementById('drink-requests-modal');
const closeDrinkRequestsModalBtn = document.getElementById('close-drink-requests-modal');
const drinkRequestsContent = document.getElementById('drink-requests-content');

// Logbook elements
const openLogbookBtn = document.getElementById('open-logbook-btn');
const closeLogbookModalBtn = document.getElementById('close-logbook-modal');
const logbookSearchInput = document.getElementById('logbook-search-input');
const logbookFilterSelect = document.getElementById('logbook-filter-select');
const logbookSortSelect = document.getElementById('logbook-sort-select');
const logbookContentDiv = document.getElementById('logbook-content');



let currentPersonIdForDrunkStripes = null;


// --- AUTHENTICATION & INITIALIZATION ---
(async function init() {
   try {
       await ensureAnon();

       // Load app config (branding + oracle availability)
       try {
           const cfg = await getAppConfig();
           appName = cfg?.name || appName;
           appYear = Number(cfg?.year) || appYear;
           hasOracle = !!cfg?.hasOracle;
           requireApprovalForDrinks = typeof cfg?.requireApprovalForDrinks === 'boolean' ? cfg.requireApprovalForDrinks : requireApprovalForDrinks;
 
           const displayTitle = appYear ? `${appName} ${appYear}` : appName;
 
           // Update document/head branding
           document.title = displayTitle;
           const metaApp = document.querySelector('meta[name="application-name"]');
           if (metaApp) metaApp.setAttribute('content', appName);
           const metaApple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
           if (metaApple) metaApple.setAttribute('content', appName);
 
           // Update visible header
           const titleSpan = document.getElementById('main-title-text');
           if (titleSpan) titleSpan.textContent = displayTitle;
 
           // Hide Oracle if not available
           if (!hasOracle) {
               const oracleBtn = document.getElementById('open-gemini-from-hub-btn');
               if (oracleBtn) oracleBtn.classList.add('hidden');
           }
       } catch (_) {
           // keep defaults on failure
       }

       await checkSchikkoStatus().then(() => {
           const persistedSessionId = localStorage.getItem('schikkoSessionId');
           if (persistedSessionId) {
               isSchikkoSessionActive = true;
           }
           updateGuestUI();
           updateAppFooter();
       });

       loadCalendarData();
       loadAndRenderAppCountdown();

       setupRealtimeListener('punishments', (data) => {
           loadingState.style.display = 'none';
           ledgerDataCache = data;
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
           rulesDataCache = data.sort((a, b) => a.order - b.order);
           handleRenderRules();
           updateTagFilterDropdown();
           updateAppFooter();
       });

       setupRealtimeListener('activity_log', (data) => {
           logbookDataCache = data;
           handleRenderLogbook();
       });
   } catch (err) {
       console.error('Initialization failed:', err);
   }
})();

// --- HELPER & NEW AUTH FUNCTIONS ---

/**
 * Handles the Schikko login process.
 */
async function handleLogin() {
    await ensureSchikkoSession();
}

/**
 * Handles the Schikko logout process.
 */
async function handleLogout() {
    const confirmed = await showConfirm("Are you sure you want to log out as Schikko? This will end your administrative session.", "Confirm Logout");
    if (confirmed) {
        showLoading('Logging out...');
        // Clear persisted Schikko session
        localStorage.removeItem('schikkoSessionId');
        isSchikkoSessionActive = false;
        updateGuestUI();
        updateAppFooter();
        await new Promise(r => setTimeout(r, 300));
        hideLoading();
        await showAlert("You have logged out.", "Logout Successful");
    }
}

function updateGuestUI() {
    const isGuest = !isSchikkoSessionActive;

    document.querySelectorAll('[data-action="add-stripe"]').forEach(btn => btn.style.display = isGuest ? 'none' : 'inline-flex');
    document.querySelectorAll('[data-action="toggle-menu"]').forEach(btn => btn.style.display = isGuest ? 'none' : 'inline-flex');
    
    if (editRulesBtn) editRulesBtn.style.display = isGuest ? 'none' : 'inline-flex';
    if (addDecreeBtn) addDecreeBtn.style.display = isGuest ? 'none' : 'flex';
    if (addBtn) addBtn.style.display = isGuest ? 'none' : 'flex';
    if (editCalendarBtn) editCalendarBtn.style.display = isGuest ? 'none' : 'inline-flex';
    if (openDrinkRequestsBtn) openDrinkRequestsBtn.style.display = isGuest ? 'none' : 'inline-flex';
    
    if (schikkoLoginBtn) {
        schikkoLoginBtn.textContent = isSchikkoSessionActive ? 'Schikko Logout' : 'Schikko Login';
    }

    handleRender();
    handleRenderRules();
    loadAndRenderAppCountdown();
}

/**
 * Checks if a schikko is set for the year and updates UI accordingly.
 */
async function checkSchikkoStatus() {
    try {
        const result = await getSchikkoStatus();
        const isSet = result.isSet;

        isSchikkoSetForTheYear = isSet;

        if (isSet) {
            setSchikkoBtn.classList.add('hidden');
        } else {
            setSchikkoBtn.classList.remove('hidden');
        }
        // Always present Schikko login (supports ADMIN_KEY even when no Schikko is set)
        schikkoLoginContainer.classList.remove('hidden');
    } catch (error) {
        console.error("Error checking Schikko status:", error);
        showAlert("Could not verify the Schikko's status. The archives may be sealed.", "Connection Error");
    }
}

/**
 * Replaces the old schikko confirmation with a secure password login flow.
 * Caches the login status in the current session to avoid repeated logins.
 */
async function ensureSchikkoSession() {
    if (isSchikkoSessionActive) {
        return true;
    }

    const code = await showSchikkoLoginModal();
    if (!code) {
        return false;
    }

    try {
        showLoading('Verifying code...');
        const result = await loginSchikko(code);
        hideLoading();

        if (result?.success && result?.sessionId) {
            localStorage.setItem('schikkoSessionId', result.sessionId);
            isSchikkoSessionActive = true;
            await showAlert("Code accepted. You are the Schikko.", "Login Successful");
            updateGuestUI();
            updateAppFooter();
            return true;
        } else {
            await showAlert("The code was incorrect. Access denied.", "Login Failed");
            return false;
        }
    } catch (error) {
        hideLoading();
        console.error("Error during Schikko login:", error);
        await showAlert(`An error occurred: ${error.message}`, "Login Error");
        return false;
    }
}

async function loadCalendarData() {
    const config = await getCalendarConfig();
    if (config && config.url) {
        try {
            const result = await getCalendarDataProxy(config.url);
            const icalData = result.icalData;

            const jcalData = ICAL.parse(icalData);
            const vcalendar = new ICAL.Component(jcalData);
            const vevents = vcalendar.getAllSubcomponents('vevent');
            const now = new Date();

            calendarEventsCache = vevents.map(vevent => {
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

            renderUpcomingEvent(calendarEventsCache[0]);
        } catch (error) {
            console.error('Error fetching or parsing calendar data:', error);
            upcomingEventDiv.innerHTML = 'Could not load calendar data.';
        }
    } else {
        upcomingEventDiv.innerHTML = 'No calendar URL set.';
    }
}

async function loadAndRenderAppCountdown() {
    const eventData = await getStripezDate();
    renderAppCountdown(eventData, isSchikkoSessionActive, appName);
}

function updateDatalist() {
    if (ledgerNamesDatalist) {
        ledgerNamesDatalist.innerHTML = '';
        ledgerDataCache.forEach(person => {
            const option = document.createElement('option');
            option.value = person.name;
            ledgerNamesDatalist.appendChild(option);
        });
    }
}

function updateTagFilterDropdown() {
    const allTags = new Set();
    rulesDataCache.forEach(rule => {
        (rule.tags || []).forEach(tag => allTags.add(tag));
    });

    ruleTagFilter.innerHTML = '<option value="all">All Tags</option>';
    
    [...allTags].sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        ruleTagFilter.appendChild(option);
    });

    // Ensure the dropdown's visible state matches the current filter state
    ruleTagFilter.value = currentTagFilter;
}

// --- RENDER LOGIC ---
function handleRender() {
    let viewData = [...ledgerDataCache];
    const term = currentSearchTerm.toLowerCase();
    if (term) {
        viewData = viewData.filter(person => person.name.toLowerCase().includes(term));
    }
    viewData.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (term) {
            const aStartsWith = nameA.startsWith(term);
            const bStartsWith = nameB.startsWith(term);
            if (!aStartsWith && bStartsWith) return 1;
        }
        switch (currentSortOrder) {
            case 'default': {
                const roleRank = (p) => {
                    const r = (p.role || '').toLowerCase();
                    const appRole = appName.toLowerCase();
                    if (r === 'schikko' || r === appRole) return 0;
                    if (r === 'board') return 1;
                    if (r === 'activist') return 2;
                    return 3;
                };
                const rankA = roleRank(a);
                const rankB = roleRank(b);
                if (rankA !== rankB) return rankA - rankB;

                const stripesA = a.stripes?.length || 0;
                const stripesB = b.stripes?.length || 0;
                if (stripesA !== stripesB) return stripesB - stripesA;

                return nameA.localeCompare(nameB);
            }
            case 'stripes_desc': return (b.stripes?.length || 0) - (a.stripes?.length || 0);
            case 'stripes_asc': return (a.stripes?.length || 0) - (b.stripes?.length || 0);
            case 'desc': return nameB.localeCompare(nameA);
            case 'asc': default: return nameA.localeCompare(nameB);
        }
    });
    renderLedger(viewData, term, isSchikkoSessionActive);
}

function handleRenderRules() {
    let filteredRules = [...rulesDataCache];
    const term = currentRuleSearchTerm.toLowerCase();

    if (term) {
        filteredRules = filteredRules.filter(rule => rule.text.toLowerCase().includes(term));
    }

    if (currentTagFilter !== 'all') {
        filteredRules = filteredRules.filter(rule => (rule.tags || []).includes(currentTagFilter));
    }

    renderRules(filteredRules, isSchikkoSessionActive);
}

function extractPersonFromLog(log) {
    const details = log.details;
    if (log.action === 'ADD_STRIPE') {
        const match = details.match(/to (.+)\.$/);
        return match ? match[1] : null;
    } else if (log.action === 'REMOVE_STRIPE') {
        const match = details.match(/from (.+)\.$/);
        return match ? match[1] : null;
    } else if (log.action === 'ADD_DRUNK_STRIPE' || log.action === 'REMOVE_DRUNK_STRIPE') {
        const match = details.match(/for (.+)\.$/);
        return match ? match[1] : null;
    } else if (log.action === 'RENAME_PERSON') {
        return null;
    } else if (log.action === 'DELETE_PERSON') {
        const match = details.match(/"(.+)" from the ledger\.$/);
        return match ? match[1] : null;
    } else if (log.action === 'ADD_PERSON') {
        const match = details.match(/"(.+)" onto the ledger\.$/);
        return match ? match[1] : null;
    } else if (log.action === 'ORACLE_JUDGEMENT') {
        const match = details.match(/for (.+):/);
        return match ? match[1] : null;
    }
    return null;
}

function finalizeGroup(group) {
    if (group.length === 1) {
        return group;
    }
    const firstLog = group[0];
    const count = group.length;
    const person = extractPersonFromLog(firstLog);
    let newDetails = '';
    if (firstLog.action === 'ADD_STRIPE') {
        newDetails = `Added ${count} stripe${count > 1 ? 's' : ''} to ${person}.`;
    } else if (firstLog.action === 'REMOVE_STRIPE') {
        newDetails = `Removed ${count} stripe${count > 1 ? 's' : ''} from ${person}.`;
    } else if (firstLog.action === 'ADD_DRUNK_STRIPE') {
        newDetails = `Recorded ${count} consumed draught${count > 1 ? 's' : ''} for ${person}.`;
    } else if (firstLog.action === 'REMOVE_DRUNK_STRIPE') {
        newDetails = `Reverted ${count} drunk stripe${count > 1 ? 's' : ''} for ${person}.`;
    }
    const newLog = {
        ...firstLog,
        details: newDetails,
        timestamp: group[group.length - 1].timestamp, // use the last timestamp
        ids: group.map(log => log.id) // store all ids
    };
    return [newLog];
}

function handleRenderLogbook() {
    let filteredData = [...logbookDataCache];

    // Filter by search term
    const term = currentLogbookSearchTerm.toLowerCase();
    if (term) {
        filteredData = filteredData.filter(log => log.details.toLowerCase().includes(term) || log.actor.toLowerCase().includes(term));
    }

    // Filter by category
    const categoryFilter = currentLogbookFilter;
    if (categoryFilter !== 'all') {
        switch (categoryFilter) {
            case 'punishment':
                filteredData = filteredData.filter(log => log.action.includes('STRIPE') || log.action.includes('ORACLE'));
                break;
            case 'rules':
                filteredData = filteredData.filter(log => log.action.includes('RULE'));
                break;
            case 'ledger':
                filteredData = filteredData.filter(log => log.action.includes('PERSON'));
                break;
            case 'schikko':
                filteredData = filteredData.filter(log => log.actor === 'Schikko');
                break;
            case 'guest':
                filteredData = filteredData.filter(log => log.actor === 'Guest');
                break;
        }
    }

    // Filter out logs for people not in the current ledger
    const personActions = new Set(['ADD_STRIPE', 'REMOVE_STRIPE', 'ADD_DRUNK_STRIPE', 'REMOVE_DRUNK_STRIPE', 'RENAME_PERSON', 'DELETE_PERSON', 'ADD_PERSON', 'ORACLE_JUDGEMENT']);
    const currentNames = new Set(ledgerDataCache.map(p => p.name.toLowerCase()));
    filteredData = filteredData.filter(log => {
        if (!personActions.has(log.action)) {
            return true; // Show non-person related logs
        }
        const details = log.details.toLowerCase();
        for (const name of currentNames) {
            if (details.includes(name)) {
                return true; // Show if mentions a current person
            }
        }
        return false; // Hide person-related logs that don't mention current people
    });

    // Ensure all logs have an id for deletion
    filteredData = filteredData.filter(log => log.id);

    // Group consecutive similar logs within 10 minutes
    const groupableActions = new Set(['ADD_STRIPE', 'REMOVE_STRIPE', 'ADD_DRUNK_STRIPE', 'REMOVE_DRUNK_STRIPE']);
    filteredData.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
    const groupedData = [];
    let currentGroup = null;
    filteredData.forEach(log => {
        const person = extractPersonFromLog(log);
        const isGroupable = groupableActions.has(log.action) && person;
        if (!isGroupable) {
            if (currentGroup) {
                groupedData.push(...finalizeGroup(currentGroup));
                currentGroup = null;
            }
            groupedData.push(log);
            return;
        }
        if (!currentGroup) {
            currentGroup = [log];
        } else {
            const lastLog = currentGroup[currentGroup.length - 1];
            const timeDiff = log.timestamp.toMillis() - lastLog.timestamp.toMillis();
            const sameAction = log.action === lastLog.action;
            const samePerson = person === extractPersonFromLog(lastLog);
            if (sameAction && samePerson && timeDiff <= 10 * 60 * 1000) {
                currentGroup.push(log);
            } else {
                groupedData.push(...finalizeGroup(currentGroup));
                currentGroup = [log];
            }
        }
    });
    if (currentGroup) {
        groupedData.push(...finalizeGroup(currentGroup));
    }

    // Render the chart with the grouped data
    renderLogbookChart(groupedData, categoryFilter);

    // Now, sort the grouped data for the list view
    const listData = [...groupedData].sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return currentLogbookSort === 'newest' ? timeB - timeA : timeA - timeB;
    });

    // Render the sorted list
    renderLogbook(listData, isSchikkoSessionActive);
}

async function updateAppFooter() {
    if (!appInfoFooter) return;
    
    let latestUpdateTimestamp = null;
    if (rulesDataCache.length > 0) {
        latestUpdateTimestamp = rulesDataCache.reduce((max, rule) => {
            const ruleTs = rule.updatedAt || rule.createdAt;
            return (ruleTs && (!max || ruleTs.toMillis() > max.toMillis())) ? ruleTs : max;
        }, null);
        if (latestUpdateTimestamp && typeof latestUpdateTimestamp.toDate === 'function') {
            latestUpdateTimestamp = latestUpdateTimestamp.toDate();
        } else {
             latestUpdateTimestamp = null;
        }
    }
    const dateString = latestUpdateTimestamp ?
        latestUpdateTimestamp.toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            }) : 'Unknown Date';
    
    let schikkoInfoText = 'No Schikko has been chosen for this year.';
    if (isSchikkoSetForTheYear) { // Use the correct state variable
        try {
            const info = await getSchikkoInfo();
            if (info.name) {
                const expiryDate = new Date(info.expires);
                const expiryString = expiryDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric'});
                schikkoInfoText = `Current Schikko: ${info.name}. Reign ends on ${expiryString}.`;
            }
        } catch (error) {
            console.error("Could not fetch Schikko info:", error);
            schikkoInfoText = "Could not retrieve the current Schikko's identity.";
        }
    }

    appInfoFooter.innerHTML = `
        <span class="font-cinzel-decorative">${schikkoInfoText}</span><br>
        <span class="font-cinzel-decorative">Decrees last inscribed upon the ledger on: <span class="text-[#c0392b]">${dateString}</span>.</span>
    `;
}

/**
 * Creates action buttons based on the Oracle's judgement.
 * @param {object} parsedJudgement - The parsed JSON object from the Gemini function.
 */
function createActionButtons(parsedJudgement) {
    geminiActionButtonsContainer.innerHTML = ''; 
    if (!geminiActionButtonsContainer.parentNode) {
        geminiOutput.parentNode.insertBefore(geminiActionButtonsContainer, geminiOutput.nextSibling);
    }
    
    // For non-Schikko users, just show an acknowledgement button.
    if (!isSchikkoSessionActive) {
         const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        acknowledgeBtn.textContent = `Acknowledge Judgement`;
        acknowledgeBtn.onclick = (e) => {
            e.stopPropagation();
            geminiModal.classList.add('hidden');
        };
        geminiActionButtonsContainer.appendChild(acknowledgeBtn);
        return;
    }

    // Handle case where the person is declared innocent.
    if (parsedJudgement.innocent) {
        const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        acknowledgeBtn.textContent = `The Oracle declares ${parsedJudgement.person || 'Someone'} innocent.`;
        acknowledgeBtn.onclick = (e) => {
            e.stopPropagation();
            logActivity('ORACLE_JUDGEMENT', 'Schikko', `The Oracle declared ${parsedJudgement.person || 'Someone'} innocent.`);
            geminiModal.classList.add('hidden');
        };
        geminiActionButtonsContainer.appendChild(acknowledgeBtn);
        return;
    }

    const targetPersonName = parsedJudgement.person || 'Someone';
    const person = ledgerDataCache.find(p => p.name.toLowerCase() === targetPersonName.toLowerCase());

    // Handle case where the judged person is not on the ledger.
    if (!person) {
        const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        acknowledgeBtn.textContent = `Person "${targetPersonName}" not found. Acknowledge.`;
        acknowledgeBtn.onclick = (e) => {
            e.stopPropagation();
            geminiModal.classList.add('hidden');
        };
        geminiActionButtonsContainer.appendChild(acknowledgeBtn);
        return;
    }

    // Collect all penalties.
    let totalStripes = 0;
    const diceRolls = []; // Use an array to allow for multiple dice of the same type.
    
    if (Array.isArray(parsedJudgement.penalties)) {
        parsedJudgement.penalties.forEach(penalty => {
            if (penalty.type === 'stripes' && typeof penalty.amount === 'number') {
                totalStripes += penalty.amount;
            } else if (penalty.type === 'dice' && typeof penalty.value === 'number') {
                diceRolls.push(penalty.value);
            }
        });
    }

    const hasStripes = totalStripes > 0;
    const hasDice = diceRolls.length > 0;

    // Create a single button for stripes if they are the only penalty.
    if (hasStripes && !hasDice) {
        const stripesBtn = document.createElement('button');
        stripesBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        stripesBtn.textContent = `Add ${totalStripes} Stripes to ${person.name}`;
        stripesBtn.onclick = async (e) => {
            e.stopPropagation();
            await addStripeToPerson(person.id, totalStripes);
            logActivity('ORACLE_JUDGEMENT', 'Schikko', `The Oracle decreed ${totalStripes} stripe(s) to ${person.name}.`);
            geminiModal.classList.add('hidden');
        };
        geminiActionButtonsContainer.appendChild(stripesBtn);
    }
    // Create a single button for dice if they are the only penalty.
    else if (!hasStripes && hasDice) {
        const diceBtn = document.createElement('button');
        diceBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        diceBtn.textContent = `Roll Dice for ${person.name}`;
        diceBtn.onclick = (e) => {
            e.stopPropagation();
            logActivity('ORACLE_JUDGEMENT', 'Schikko', `The Oracle decreed a dice roll for ${person.name}.`);
            rollDiceAndAssign(diceRolls, person, addStripeToPerson, ledgerDataCache, showAlert); 
            geminiModal.classList.add('hidden');
        };
        geminiActionButtonsContainer.appendChild(diceBtn);
    }
    // Create a combined button if there are both stripes and dice.
    else if (hasStripes && hasDice) {
        const combinedBtn = document.createElement('button');
        combinedBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        combinedBtn.textContent = `Add ${totalStripes} Stripes & Roll Dice for ${person.name}`;
        combinedBtn.onclick = async (e) => {
            e.stopPropagation();
            // Add stripes first
            await addStripeToPerson(person.id, totalStripes);
            logActivity('ORACLE_JUDGEMENT', 'Schikko', `The Oracle decreed ${totalStripes} stripe(s) to ${person.name}.`);
            // Then open the pre-filled dice roller
            logActivity('ORACLE_JUDGEMENT', 'Schikko', `The Oracle also decreed a dice roll for ${person.name}.`);
            rollDiceAndAssign(diceRolls, person, addStripeToPerson, ledgerDataCache, showAlert, isSchikkoSessionActive);
            geminiModal.classList.add('hidden');
        };
        geminiActionButtonsContainer.appendChild(combinedBtn);
    }
    // Handle cases with no actionable penalties.
    else {
        const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        acknowledgeBtn.textContent = `Acknowledge Judgement`;
        acknowledgeBtn.onclick = (e) => {
            e.stopPropagation();
            geminiModal.classList.add('hidden');
        };
        geminiActionButtonsContainer.appendChild(acknowledgeBtn);
    }
}


async function handleGeminiSubmit() {
    const inputText = geminiInput.value.trim();
    if (inputText === '') {
        geminiOutput.textContent = 'The Oracle cannot judge the unspoken. Inscribe the transgression.';
        geminiOutput.classList.remove('hidden');
        return;
    }

    geminiOutput.innerHTML = '';
    geminiActionButtonsContainer.innerHTML = '';

    geminiSubmitBtn.disabled = true;
    geminiSubmitBtn.textContent = 'Consulting...';
    geminiOutput.classList.add('hidden');

    try {
        const result = await getOracleJudgement(
            inputText,
            rulesDataCache,
            ledgerDataCache.map(person => person.name)
        );

        const parsedJudgement = result.judgement;
        
        let displayMessage = '';
        if (parsedJudgement.innocent) {
            displayMessage = `The Oracle declares ${parsedJudgement.person || 'Someone'} innocent. No rules broken.`;
        } else {
            let totalStripes = 0;
            const diceRollsSummary = [];
            
            if (Array.isArray(parsedJudgement.penalties)) {
                parsedJudgement.penalties.forEach(penalty => {
                    if (penalty.type === 'stripes' && typeof penalty.amount === 'number') {
                        totalStripes += penalty.amount;
                    } else if (penalty.type === 'dice' && typeof penalty.value === 'number') {
                        diceRollsSummary.push(`d${penalty.value}`);
                    }
                });
            }

            const penaltyParts = [];
            if (totalStripes > 0) {
                penaltyParts.push(`${totalStripes} stripes`);
            }
            if (diceRollsSummary.length > 0) {
                penaltyParts.push(`rolls: ${diceRollsSummary.join(', ')}`);
            }
            
            const ruleNumbers = parsedJudgement.rulesBroken || [];
            let rulesText = '';
            if (ruleNumbers.length > 0) {
                rulesText = ` (Broken Rule${ruleNumbers.length > 1 ? 's' : ''}: ${ruleNumbers.join(', ')})`;
            }

            if (penaltyParts.length > 0) {
                displayMessage = `Judgement for ${parsedJudgement.person || 'Someone'}: ${penaltyParts.join(' and ')}${rulesText}.`;
            } else {
                displayMessage = `The Oracle has spoken for ${parsedJudgement.person || 'Someone'}${rulesText}. No explicit punishments were calculated.`;
            }
        }

        geminiOutput.textContent = displayMessage; 
        geminiOutput.classList.remove('hidden');

        createActionButtons(parsedJudgement);

    } catch (error) {
        console.error("Error calling Oracle function:", error);
        let errorMessage = `The Oracle is silent. An error occurred: ${error.message}`;
        if (error.code && error.details) {
            errorMessage = `Oracle error (${error.code}): ${error.message}`;
            if (typeof error.details === 'string' && error.details.startsWith('{')) {
                try {
                    const detailObj = JSON.parse(error.details);
                    if (detailObj.judgement) {
                         errorMessage += ` Raw AI response: ${detailObj.judgement}`;
                    }
                } catch (parseError) {}
            }
        }
        geminiOutput.textContent = errorMessage;
        geminiOutput.classList.remove('hidden');
    } finally {
        geminiSubmitBtn.disabled = false;
        geminiSubmitBtn.textContent = 'Consult the Oracle';
    }
}



/**
* Show TOTP setup with QR and manual details, and require 6‑digit confirmation to finalize Schikko.
* Expects qrcodejs (window.QRCode) to be loaded; falls back to a link if absent.
*/
function showTotpSetup(otpauthUrl, secret, account, issuer, firstName, lastName) {
   if (!totpModal) return;

   // Populate QR/secret/manual
   if (totpQrEl) {
       totpQrEl.innerHTML = '';
       try {
           if (window.QRCode) {
               new QRCode(totpQrEl, { text: otpauthUrl, width: 200, height: 200 });
           } else {
               const a = document.createElement('a');
               a.href = otpauthUrl;
               a.textContent = 'Open otpauth:// link';
               a.className = 'text-blue-700 underline break-all';
               totpQrEl.appendChild(a);
           }
       } catch (_) {}
   }
   if (totpSecretEl) totpSecretEl.textContent = secret || '';
   if (totpManualEl) {
       const manual = `Issuer: ${issuer || ''}\nAccount: ${account || ''}\nType: TOTP (SHA1, 6 digits, 30s)`;
       totpManualEl.textContent = manual;
   }

   // Bind confirm handlers
   const codeInput = document.getElementById('totp-code-input');
   const confirmBtn = document.getElementById('totp-confirm-btn');

   const cleanup = () => {
       if (confirmBtn) confirmBtn.onclick = null;
       if (codeInput) codeInput.onkeydown = null;
   };

   const doConfirm = async () => {
       const code = String(codeInput?.value || '').trim();
       if (!/^\d{6}$/.test(code)) {
           await showAlert('Enter a valid 6‑digit code from your authenticator app.', 'Invalid Code');
           return;
       }
       try {
           showLoading('Verifying 2FA...');
           const result = await confirmSchikko({
               firstName,
               lastName,
               secret,
               code,
           });
           hideLoading();
           if (result?.success) {
               totpModal.classList.add('hidden');
               cleanup();
               await showAlert('2FA confirmed. The title has been claimed.', 'Title Claimed!');
               await checkSchikkoStatus(); // reflect new state in UI (shows login)
           } else {
               await showAlert('The code was incorrect. Please try again.', 'Verification Failed');
           }
       } catch (e) {
           hideLoading();
           await showAlert(`An error occurred while confirming 2FA: ${e.message}`, 'Verification Error');
       }
   };

   if (confirmBtn) confirmBtn.onclick = (e) => { e.stopPropagation(); doConfirm(); };
   if (codeInput) codeInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); doConfirm(); } };

   totpModal.classList.remove('hidden');
}

// --- EVENT HANDLERS ---
async function handleAddName() {
    if (!await ensureSchikkoSession()) return;
    const name = mainInput.value.trim();
    if (!name) return;
    if (ledgerDataCache.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        await showAlert(`"${name}" is already on the ledger.`, 'Duplicate Name');
        return;
    }
    showLoading('Saving to ledger...');
    try {
        await addNameToLedger(name);
        await logActivity('ADD_PERSON', 'Schikko', `Inscribed "${name}" onto the ledger.`);
    } finally {
        hideLoading();
    }
    mainInput.value = '';
    currentSearchTerm = '';
}

async function handleRename(docId) {
    const person = ledgerDataCache.find(p => p.id === docId);
    if (!person) return;
    const newName = await showPrompt("Enter the new name for " + person.name, person.name, "Rename Transgressor");
    if (newName && newName.trim() !== "" && newName.trim() !== person.name) {
        const oldName = person.name;
        showLoading('Renaming...');
        try {
            await renamePersonOnLedger(docId, newName);
            await logActivity('RENAME_PERSON', 'Schikko', `Renamed "${oldName}" to "${newName.trim()}".`);
        } finally {
            hideLoading();
        }
    }
}

async function handleDeletePerson(docId) {
    const person = ledgerDataCache.find(p => p.id === docId);
    if (!person) return;
    const confirmed = await showConfirm(`Are you sure you want to remove "${person.name}" from the ledger? This action cannot be undone.`, "Confirm Deletion");
    if (confirmed) {
        showLoading('Deleting...');
        try {
            await deletePersonFromLedger(docId);
            await logActivity('DELETE_PERSON', 'Schikko', `Erased "${person.name}" from the ledger.`);
        } finally {
            hideLoading();
        }
    }
}

async function handleRemoveStripe(docId) {
    const person = ledgerDataCache.find(p => p.id === docId);
    if (!person) return;
    await removeLastStripeFromPerson(person);
}

async function handleAddRule() {
    const isConfirmed = await ensureSchikkoSession();
    if (!isConfirmed) return;

    const text = ruleSearchInput.value.trim();
    if (!text) {
        await showAlert("Please enter a decree in the search field to add.", "Empty Decree");
        return;
    }
    const maxOrder = rulesDataCache.reduce((max, rule) => Math.max(max, rule.order), 0);
    showLoading('Saving decree...');
    try {
        await addRuleToFirestore(text, maxOrder + 1);
        await logActivity('ADD_RULE', 'Schikko', `Added a new decree: "${text}"`);
    } finally {
        hideLoading();
    }
    ruleSearchInput.value = '';
    currentRuleSearchTerm = '';
    handleRenderRules();
}

async function handleEditRule(docId) {
    const rule = rulesDataCache.find(r => r.id === docId);
    if (!rule) return;
    
    const result = await showRuleEditModal(rule.text, rule.tags, rulesDataCache);

    if (result) {
        const { text, tags } = result;
        if (text.trim() !== "") {
            showLoading('Updating decree...');
            try {
                await updateRuleInFirestore(docId, text, tags);
                await logActivity('EDIT_RULE', 'Schikko', `Updated decree: "${text}"`);
            } finally {
                hideLoading();
            }
        }
    }
}

// --- EVENT LISTENERS ---
mainInput.addEventListener('input', () => { currentSearchTerm = mainInput.value; handleRender(); });
ruleSearchInput?.addEventListener('input', () => { currentRuleSearchTerm = ruleSearchInput.value; handleRenderRules(); });
ruleTagFilter.addEventListener('change', (e) => { currentTagFilter = e.target.value; handleRenderRules(); });
mainInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddName(); } });
addBtn.addEventListener('click', handleAddName);
addDecreeBtn?.addEventListener('click', handleAddRule);
closeStatsModalBtn.addEventListener('click', () => statsModal.classList.add('hidden'));
sortSelect.addEventListener('change', (e) => {
    currentSortOrder = e.target.value;
    sortButtonText.textContent = `Sort: ${e.target.options[e.target.selectedIndex].text}`;
    handleRender();
});
showDecreesBtn?.addEventListener('click', () => {
    const isHidden = decreesContent.classList.contains('hidden');
    if (isHidden) {
        decreesContent.classList.remove('hidden');
        showDecreesBtn.setAttribute('data-state', 'expanded');
        showDecreesBtn.querySelector('span:first-child').textContent = "Hide Decrees";
    } else {
        decreesContent.classList.add('hidden');
        showDecreesBtn.setAttribute('data-state', 'collapsed');
        showDecreesBtn.querySelector('span:first-child').textContent = "Schikko's Decrees";
        if (rulesListOl.classList.contains('rules-list-editing')) {
            rulesListOl.classList.remove('rules-list-editing');
            editRulesBtn.textContent = 'Finish Editing';
        }
        ruleSearchInput.value = '';
        currentRuleSearchTerm = '';
        handleRenderRules();
    }
});
punishmentListDiv.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    e.preventDefault();
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (action !== 'toggle-menu') closeMenus();
    const actor = isSchikkoSessionActive ? 'Schikko' : 'Guest';
    switch (action) {
        case 'toggle-menu': 
            if(isSchikkoSessionActive) document.getElementById(`menu-${id}`)?.classList.toggle('hidden');
            break;
        case 'add-stripe':
            if (await ensureSchikkoSession()) {
                const person = ledgerDataCache.find(p => p.id === id);
                if (person) {
                    showLoading('Saving stripe...');
                    try {
                        await addStripeToPerson(id);
                        await logActivity('ADD_STRIPE', actor, `Added 1 stripe to ${person.name}.`);
                    } finally {
                        hideLoading();
                    }
                }
            }
            break;
        case 'add-drunk-stripe':
            // Schikko can always add drunk stripes. For others, check event date.
            if (!isSchikkoSessionActive) {
                const eventData = await getStripezDate();
                if (eventData && eventData.date) {
                    const eventDate = eventData.date.toDate();
                    const now = new Date();

                    if (now < eventDate) {
                        const distance = eventDate - now;
                        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                        const countdownString = `Next ${appName} in: ${days}d ${hours}h ${minutes}m ${seconds}s`;

                        await showAlert(
                            `The consumption of the Golden Liquid is a sacred rite reserved for the ${appName}.\n${countdownString}`,
                            'Patience, Young One!'
                        );
                        return; // Stop execution
                    }
                } else {
                    await showAlert(
                        `The date for the next ${appName} has not been decreed. The Golden Liquid cannot be consumed.`,
                        'Patience, Young One!'
                    );
                    return;
                }
            }

            // If we're here, it's either the Schikko or it's past the event date.
            currentPersonIdForDrunkStripes = id; 
            const person = ledgerDataCache.find(p => p.id === currentPersonIdForDrunkStripes);
            const availablePenaltiesToFulfill = (person?.stripes?.length || 0) - (person?.drunkStripes?.length || 0);
            
            howManyBeersInput.value = Math.min(1, availablePenaltiesToFulfill); 
            howManyBeersInput.max = availablePenaltiesToFulfill; 
            availableStripesDisplay.textContent = ` Available Stripes: ${availablePenaltiesToFulfill}`;
            
            howManyBeersInput.disabled = availablePenaltiesToFulfill <= 0;
            incrementBeersBtn.disabled = availablePenaltiesToFulfill <= 0;
            decrementBeersBtn.disabled = availablePenaltiesToFulfill <= 0;
            confirmDrunkStripesBtn.disabled = availablePenaltiesToFulfill <= 0; 
            if (availablePenaltiesToFulfill <= 0) availableStripesDisplay.textContent = 'No Stripes available to fulfill!';

            drunkStripesModal.classList.remove('hidden'); 
            break;
        case 'remove-stripe':
            if (await ensureSchikkoSession()) {
                const person = ledgerDataCache.find(p => p.id === id);
                if (person) {
                    showLoading('Reverting...');
                    try {
                        await removeLastStripeFromPerson(person);
                        await logActivity('REMOVE_STRIPE', actor, `Removed the last stripe from ${person.name}.`);
                    } finally {
                        hideLoading();
                    }
                }
            }
            break;
        case 'remove-drunk-stripe':
            if (await ensureSchikkoSession()) {
                const person = ledgerDataCache.find(p => p.id === id);
                if (person) {
                    showLoading('Reverting...');
                    try {
                        await removeLastDrunkStripeFromPerson(person);
                        await logActivity('REMOVE_DRUNK_STRIPE', actor, `Reverted a drunk stripe for ${person.name}.`);
                    } finally {
                        hideLoading();
                    }
                }
            }
            break;
        case 'rename':
             if (await ensureSchikkoSession()) {
                handleRename(id);
             }
            break;
        case 'delete':
             if (await ensureSchikkoSession()) {
                handleDeletePerson(id);
             }
            break;
        case 'set-role':
            if (await ensureSchikkoSession()) {
                const role = target.dataset.role || '';
                const person = ledgerDataCache.find(p => p.id === id);
                showLoading('Updating role...');
                try {
                    await setPersonRole(id, role);
                    if (person) {
                        const actionText = role ? `Set role "${role}" for ${person.name}.` : `Cleared role for ${person.name}.`;
                        await logActivity('SET_ROLE', 'Schikko', actionText);
                    }
                } finally {
                    hideLoading();
                }
            }
            break;
        case 'show-stats':
            const personToShowStats = ledgerDataCache.find(p => p.id === id);
            if (personToShowStats) showStatsModal(personToShowStats);
            break;
    }
});
editRulesBtn?.addEventListener('click', async () => {
    if (!rulesListOl.classList.contains('rules-list-editing')) {
        const isConfirmed = await ensureSchikkoSession();
        if (!isConfirmed) return;
    }
    rulesListOl.classList.toggle('rules-list-editing');
    editRulesBtn.textContent = rulesListOl.classList.contains('rules-list-editing') ? 'Finish Editing' : 'Edit Decrees';
    handleRenderRules();
});
rulesListOl?.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-rule-action]');
    if (!target || !rulesListOl.classList.contains('rules-list-editing')) return;
    const action = target.dataset.ruleAction;
    const id = target.dataset.id;
    const ruleIndex = rulesDataCache.findIndex(r => r.id === id);
    if (ruleIndex === -1) return;
    const actor = isSchikkoSessionActive ? 'Schikko' : 'Guest';
    switch (action) {
        case 'delete':
            const ruleToDelete = rulesDataCache[ruleIndex];
            showLoading('Deleting decree...');
            try {
                await deleteRuleFromFirestore(id);
                await logActivity('DELETE_RULE', actor, `Deleted decree: "${ruleToDelete.text}"`);
            } finally {
                hideLoading();
            }
            break;
        case 'move-up':
            if (ruleIndex > 0) {
                showLoading('Reordering...');
                try {
                    await updateRuleOrderInFirestore(rulesDataCache[ruleIndex], rulesDataCache[ruleIndex - 1]);
                    await logActivity('MOVE_RULE', actor, `Moved decree up: "${rulesDataCache[ruleIndex].text}"`);
                } finally {
                    hideLoading();
                }
            }
            break;
        case 'move-down':
            if (ruleIndex < rulesDataCache.length - 1) {
                showLoading('Reordering...');
                try {
                    await updateRuleOrderInFirestore(rulesDataCache[ruleIndex], rulesDataCache[ruleIndex + 1]);
                    await logActivity('MOVE_RULE', actor, `Moved decree down: "${rulesDataCache[ruleIndex].text}"`);
                } finally {
                    hideLoading();
                }
            }
            break;
        case 'edit': await handleEditRule(id); break;
    }
});
document.addEventListener('click', (e) => { 
    if (!e.target.closest('[data-action="toggle-menu"]') && !e.target.closest('[id^="menu-"]')) {
        closeMenus(); 
    }
    if (!drunkStripesModal.classList.contains('hidden') && !e.target.closest('#drunk-stripes-modal') && !e.target.closest('[data-action="add-drunk-stripe"]')) { 
        drunkStripesModal.classList.add('hidden'); 
    }
    if (!diceRandomizerModal.classList.contains('hidden') && !e.target.closest('#dice-randomizer-modal') && !e.target.closest('#open-dice-randomizer-from-hub-btn')) {
        diceRandomizerModal.classList.add('hidden');
    }
});

// Logbook listeners
openLogbookBtn?.addEventListener('click', () => showLogbookModal(true));
closeLogbookModalBtn?.addEventListener('click', () => showLogbookModal(false));
logbookSearchInput?.addEventListener('input', () => { currentLogbookSearchTerm = logbookSearchInput.value; handleRenderLogbook(); });
logbookFilterSelect?.addEventListener('change', (e) => { currentLogbookFilter = e.target.value; handleRenderLogbook(); });
logbookSortSelect?.addEventListener('change', (e) => { currentLogbookSort = e.target.value; handleRenderLogbook(); });

logbookContentDiv?.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-log-action]');
    if (!target) return;
    const action = target.dataset.logAction;
    const idsStr = target.dataset.logIds;
    if (!idsStr) return;
    const ids = idsStr.split(',').filter(id => id);
    if (action === 'delete') {
        if (await ensureSchikkoSession()) {
            const confirmed = await showConfirm(`Are you sure you want to delete this log entry? This action cannot be undone.`, "Confirm Log Deletion");
            if (confirmed) {
                showLoading('Deleting log entry...');
                try {
                    await deleteLogFromFirestore(ids);
                } finally {
                    hideLoading();
                }
            }
        }
    }
});


openRandomizerHubBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    randomizerHubModal.classList.remove('hidden');
});

closeRandomizerHubModalBtn?.addEventListener('click', () => randomizerHubModal.classList.add('hidden'));

openListRandomizerFromHubBtn?.addEventListener('click', () => {
    randomizerHubModal.classList.add('hidden');
    listRandomizerModal.classList.remove('hidden');
    initListRandomizer(ledgerDataCache, isSchikkoSessionActive, addStripeToPerson, showAlert);
});

openDiceRandomizerFromHubBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    randomizerHubModal.classList.add('hidden');
    diceRandomizerModal.classList.remove('hidden');
    initDiceRandomizer(ledgerDataCache, addStripeToPerson, showAlert, isSchikkoSessionActive);
});

closeDiceRandomizerModalBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    diceRandomizerModal.classList.add('hidden');
});

closeListRandomizerModalBtn?.addEventListener('click', () => listRandomizerModal.classList.add('hidden'));

openGeminiFromHubBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    randomizerHubModal.classList.add('hidden');
    geminiModal.classList.remove('hidden');
    geminiOutput.classList.add('hidden');
    geminiOutput.innerHTML = '';
    geminiInput.value = '';
    geminiActionButtonsContainer.innerHTML = '';
});

closeGeminiModalBtn?.addEventListener('click', () => {
    geminiModal.classList.add('hidden');
});

geminiSubmitBtn?.addEventListener('click', handleGeminiSubmit);

// ---- Drink Requests admin UI wiring ----
async function loadDrinkRequests() {
    try {
        const resp = await listDrinkRequests();
        renderDrinkRequestsList(resp?.requests || []);
    } catch (e) {
        console.error('Failed to load drink requests:', e);
        if (drinkRequestsContent) {
            drinkRequestsContent.innerHTML = '<p class="text-center text-lg text-[#6f4e37] p-4">Failed to load requests.</p>';
        }
    }
}

function renderDrinkRequestsList(requests) {
    if (!drinkRequestsContent) return;
    if (!Array.isArray(requests) || requests.length === 0) {
        drinkRequestsContent.innerHTML = '<p class="text-center text-lg text-[#6f4e37] p-4">No pending drink requests.</p>';
        return;
    }
    drinkRequestsContent.innerHTML = '';
    requests.forEach(r => {
        const when = r.created_at ? new Date(r.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-[#e9e2d7] border border-[#b9987e] rounded-md p-3';
        row.innerHTML = `
            <div>
                <p class="text-[#4a3024]"><span class="font-bold">${(r.person_name || 'Unknown')}</span> — Amount: <span class="font-bold text-[#c0392b]">${r.amount}</span></p>
                <p class="text-sm text-[#6f4e37]">Requested at ${when}</p>
            </div>
            <div class="flex gap-2">
                <button class="btn-ancient px-3 py-2 rounded-md" data-req-action="approve" data-req-id="${r.id}">Approve</button>
                <button class="btn-subtle-decree px-3 py-2 rounded-md" data-req-action="reject" data-req-id="${r.id}">Reject</button>
            </div>
        `;
        drinkRequestsContent.appendChild(row);
    });
}

openDrinkRequestsBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!await ensureSchikkoSession()) return;
    if (drinkRequestsModal) drinkRequestsModal.classList.remove('hidden');
    await loadDrinkRequests();
});

closeDrinkRequestsModalBtn?.addEventListener('click', () => {
    if (drinkRequestsModal) drinkRequestsModal.classList.add('hidden');
});

drinkRequestsContent?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-req-action]');
    if (!btn) return;
    const reqId = btn.getAttribute('data-req-id');
    const act = btn.getAttribute('data-req-action');
    if (!reqId || !act) return;

    if (!await ensureSchikkoSession()) return;

    try {
        showLoading(act === 'approve' ? 'Approving...' : 'Rejecting...');
        if (act === 'approve') {
            const res = await approveDrinkRequest(reqId);
            const applied = Number(res?.applied || 0);
            await logActivity('APPROVE_DRINK_REQUEST', 'Schikko', `Approved drink request (${applied} applied).`);
        } else {
            await rejectDrinkRequest(reqId);
            await logActivity('REJECT_DRINK_REQUEST', 'Schikko', `Rejected drink request.`);
        }
    } finally {
        hideLoading();
    }
    await loadDrinkRequests();
});
 
 closeDrunkStripesModalBtn.addEventListener('click', () => {
     drunkStripesModal.classList.add('hidden');
 });

incrementBeersBtn.addEventListener('click', () => {
    const currentValue = parseInt(howManyBeersInput.value);
    const maxValue = parseInt(howManyBeersInput.max);
    if (currentValue < maxValue) {
        howManyBeersInput.value = currentValue + 1;
    }
});

decrementBeersBtn.addEventListener('click', () => {
    const currentValue = parseInt(howManyBeersInput.value);
    if (currentValue > 1) { 
        howManyBeersInput.value = currentValue - 1;
    }
});

confirmDrunkStripesBtn.addEventListener('click', async () => {
    if (!currentPersonIdForDrunkStripes) return;

    const count = Math.max(1, parseInt(howManyBeersInput.value));
    const person = ledgerDataCache.find(p => p.id === currentPersonIdForDrunkStripes);
    const availablePenaltiesToFulfill = (person?.stripes?.length || 0) - (person?.drunkStripes?.length || 0);

    if (count > availablePenaltiesToFulfill) {
        await showAlert(`Cannot consume more stripes than available! You have ${availablePenaltiesToFulfill} stripes remaining.`, "Too Many Draughts");
        return;
    }

    if (count > 0) {
        if (!isSchikkoSessionActive && requireApprovalForDrinks) {
            // Guests submit a drink request instead of directly recording
            showLoading('Submitting request...');
            try {
                await requestDrink(currentPersonIdForDrunkStripes, count);
                await logActivity('DRINK_REQUEST', 'Guest', `Guest requested ${count} draught(s) for ${person?.name || 'someone'}.`);
                // Hide overlay before showing the modal to avoid blocking interactions
                hideLoading();
                await showAlert('Your drink request was submitted and awaits Schikko approval.', 'Request Submitted');
            } catch (e) {
                // Ensure loading overlay is hidden on error and surface a friendly message
                hideLoading();
                await showAlert(`Failed to submit drink request: ${e?.message || 'Unknown error'}`, 'Request Failed');
            } finally {
                // Safety: make sure overlay is hidden in all cases
                hideLoading();
            }
        } else {
            // Schikko (or approval not required): record immediately
            const actor = isSchikkoSessionActive ? 'Schikko' : 'Guest';
            showLoading('Recording draughts...');
            try {
                await addDrunkStripeToPerson(currentPersonIdForDrunkStripes, count);
                await logActivity('ADD_DRUNK_STRIPE', actor, `${actor} recorded ${count} consumed draught(s) for ${person?.name || 'someone'}.`);
            } finally {
                hideLoading();
            }
        }
    }

    drunkStripesModal.classList.add('hidden');
    currentPersonIdForDrunkStripes = null;
});

editCalendarBtn.addEventListener('click', async () => {
    if(!await ensureSchikkoSession()) return;
    const config = await getCalendarConfig();
    const newUrl = await showPrompt('Enter the public iCal URL for the calendar:', config.url || '', 'Update Calendar');
    if (newUrl) {
        showLoading('Updating calendar...');
        try {
            await saveCalendarUrl(newUrl);
            await loadCalendarData();
        } finally {
            hideLoading();
        }
    }
});

editAppDateBtn.addEventListener('click', async () => {
    if (!await ensureSchikkoSession()) return;

    const eventData = await getStripezDate();
    const currentDate = eventData.date ? eventData.date.toDate().toISOString().split('T')[0] : '';
    const currentDuration = Math.max(1, Number(eventData.durationDays || 3));

    const newDateStr = await showPrompt(
        `Enter the date for the next ${appName}.`,
        currentDate,
        `Decree ${appName} Date (YYYY-MM-DD)`
    );

    if (!newDateStr) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDateStr)) {
        await showAlert("Invalid date format. Please use YYYY-MM-DD.", "Scribe's Error");
        return;
    }

    const durationInput = await showPrompt(
        `How many days shall the ${appName} endure?`,
        String(currentDuration),
        `Event Duration (days, ≥ 1)`
    );
    if (durationInput === null) return; // user canceled
    const parsedDur = parseInt(durationInput, 10);
    const durationDays = Number.isFinite(parsedDur) && parsedDur > 0 ? parsedDur : currentDuration;

    showLoading(`Saving ${appName} date...`);
    try {
        await saveStripezDate(newDateStr, durationDays);
    } finally {
        hideLoading();
    }
    await showAlert(`The date and duration for the ${appName} have been decreed!`, "Success");
    await loadAndRenderAppCountdown();
});

fullAgendaBtn.addEventListener('click', () => {
    renderFullAgenda(calendarEventsCache);
    showAgendaModal(true);
});

closeAgendaModalBtn.addEventListener('click', () => {
    showAgendaModal(false);
});
closeTotpModalBtn?.addEventListener('click', () => {
    totpModal?.classList.add('hidden');
});

// New listeners for Schikko auth flow
setSchikkoBtn.addEventListener('click', async () => {
    const data = await showSetSchikkoModal();
    if (!data) return;

    const { firstName, lastName } = data;
    if (!firstName || !lastName) {
        await showAlert("Please provide a valid first and last name.", "Invalid Input");
        return;
    }

    try {
        showLoading('Preparing TOTP enrollment...');
        const result = await setSchikko({ firstName, lastName });
        hideLoading();

        if (result?.success && result?.otp) {
            const otp = result.otp;
            const account = `${firstName} ${lastName}`.trim();
            // Show modal that requires 6‑digit confirmation to finalize
            showTotpSetup(otp.otpauthUrl, otp.secret, account, `${appName} ${new Date().getFullYear()}`, firstName, lastName);
        } else {
            throw new Error(result?.message || "Failed to start Schikko setup.");
        }
    } catch (error) {
        hideLoading();
        console.error("Error setting Schikko:", error);
        await showAlert(`An error occurred: ${error.message}`, "Error Claiming Title");
    }
});

schikkoLoginBtn.addEventListener('click', async () => {
    if (isSchikkoSessionActive) {
        await handleLogout();
    } else {
        await handleLogin();
    }
});
