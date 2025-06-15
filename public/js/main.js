// public/js/main.js

// --- MODULE IMPORTS ---
import {
    auth, onAuthStateChanged, signInAnonymously, setupRealtimeListener,
    addNameToLedger, addStripeToPerson, removeLastStripeFromPerson,
    renamePersonOnLedger, deletePersonFromLedger, addRuleToFirestore,
    deleteRuleFromFirestore, updateRuleOrderInFirestore, updateRuleTextInFirestore,
    addDrunkStripeToPerson,
    removeLastDrunkStripeFromPerson,
    getCalendarConfig,
    saveCalendarUrl
} from './firebase.js';
import { 
    renderLedger, showStatsModal, closeMenus, renderRules, 
    renderUpcomingEvent, renderFullAgenda, showAgendaModal,
    showAlert, showConfirm, showPrompt, showSchikkoLoginModal
} from './ui.js';
import { initListRandomizer, initDiceRandomizer, rollDiceAndAssign } from '../randomizer/randomizer.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";


// --- STATE VARIABLES ---
let currentUserId = null;
let ledgerDataCache = [];
let rulesDataCache = []; // Full, unfiltered rules data
let calendarEventsCache = [];
let currentSortOrder = 'asc';
let currentSearchTerm = ''; // For ledger search
let currentRuleSearchTerm = ''; // New: For rules inconsistencies search
let isSchikkoSessionActive = false; // Secure session state for Schikko
let lastPunishmentInfo = { // New state for last punishment awarded
    name: null,
    amount: null,
    type: null, // 'stripes' or 'drunkStripes'
    timestamp: null
};

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


let currentPersonIdForDrunkStripes = null;


// --- AUTHENTICATION & INITIALIZATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        checkSchikkoStatus().then(() => {
            updateGuestUI();
            updateAppFooter();
        });
        loadCalendarData();
        setupRealtimeListener('punishments', (data) => {
            loadingState.style.display = 'none';
            ledgerDataCache = data;
            handleRender();
            updateDatalist();
        });
        setupRealtimeListener('rules', (data) => {
            rulesDataCache = data.sort((a, b) => a.order - b.order);
            handleRenderRules();
            updateAppFooter();
        });
    } else {
        signInAnonymously(auth).catch((error) => console.error("Anonymous sign-in failed:", error));
    }
});

// --- HELPER & NEW AUTH FUNCTIONS ---

function updateGuestUI() {
    const isGuest = !isSchikkoSessionActive;

    document.querySelectorAll('[data-action="add-stripe"]').forEach(btn => btn.style.display = isGuest ? 'none' : 'inline-flex');
    document.querySelectorAll('[data-action="toggle-menu"]').forEach(btn => btn.style.display = isGuest ? 'none' : 'inline-flex');
    
    if (editRulesBtn) editRulesBtn.style.display = isGuest ? 'none' : 'inline-flex';
    if (addDecreeBtn) addDecreeBtn.style.display = isGuest ? 'none' : 'inline-flex';
    if (addBtn) addBtn.style.display = isGuest ? 'none' : 'flex';

    if(openGeminiFromHubBtn) openGeminiFromHubBtn.textContent = isGuest ? "Oracle's Judgement (Read-Only)" : "Oracle's Judgement";

    handleRender();
    handleRenderRules();
}

/**
 * Checks if a schikko is set for the year and updates UI accordingly.
 */
async function checkSchikkoStatus() {
    try {
        const functions = getFunctions(undefined, "europe-west4");
        const getSchikkoStatus = httpsCallable(functions, 'getSchikkoStatus');
        const result = await getSchikkoStatus();
        const isSet = result.data.isSet;

        if (isSet) {
            setSchikkoBtn.classList.add('hidden');
            schikkoLoginContainer.classList.remove('hidden');
        } else {
            setSchikkoBtn.classList.remove('hidden');
            schikkoLoginContainer.classList.add('hidden');
        }
    } catch (error) {
        console.error("Error checking Schikko status:", error);
        showAlert("Could not verify the Schikko's status. The archives may be sealed.", "Connection Error");
    }
}

/**
 * Replaces the old schikko confirmation with a secure password login flow.
 * Caches the login status in the current session to avoid repeated logins.
 */
async function confirmSchikko() {
    if (isSchikkoSessionActive) {
        return true;
    }

    const password = await showSchikkoLoginModal();
    if (!password) {
        return false; // User cancelled the modal
    }
    
    try {
        const functions = getFunctions(undefined, "europe-west4");
        const loginSchikko = httpsCallable(functions, 'loginSchikko');
        const result = await loginSchikko({ password });
        
        if (result.data.success) {
            isSchikkoSessionActive = true;
            await showAlert("Password accepted. You are the Schikko.", "Login Successful");
            updateGuestUI();
            updateAppFooter();
            return true;
        } else {
            await showAlert("The password was incorrect. The archives remain sealed to you.", "Login Failed");
            return false;
        }
    } catch (error) {
        console.error("Error during Schikko login:", error);
        await showAlert(`An error occurred: ${error.message}`, "Login Error");
        return false;
    }
}

async function loadCalendarData() {
    const config = await getCalendarConfig();
    if (config && config.url) {
        try {
            const functions = getFunctions(undefined, "europe-west4");
            const getCalendarDataProxy = httpsCallable(functions, 'getCalendarDataProxy');
            const result = await getCalendarDataProxy({ url: config.url });
            const icalData = result.data.icalData;

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
                        occurrences.push({
                            summary: event.summary,
                            startDate: next.toDate(),
                            endDate: new ICAL.Time.fromJSDate(next.toDate()).add(event.duration).toJSDate(),
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
    renderRules(filteredRules, isSchikkoSessionActive);
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
    
    let lastPunishmentText = '';
    if (lastPunishmentInfo.name && lastPunishmentInfo.amount !== null && lastPunishmentInfo.timestamp) {
        const punishmentType = lastPunishmentInfo.type === 'stripes' ? 'stripes' : 'draughts of golden liquid';
        const timeAgo = lastPunishmentInfo.timestamp.toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit', hour12: false
        });
        lastPunishmentText = `<br><span class="font-cinzel-decorative text-[#c0392b]">The Oracle last decreed ${lastPunishmentInfo.amount} ${punishmentType} to ${lastPunishmentInfo.name} at the hour of ${timeAgo}.</span>`;
    }

    let schikkoInfoText = 'No Schikko has been chosen for this year.';
    if (isSchikkoSessionActive) {
        try {
            const functions = getFunctions(undefined, "europe-west4");
            const getSchikkoInfo = httpsCallable(functions, 'getSchikkoInfo');
            const result = await getSchikkoInfo();
            const info = result.data;
            if (info.email) {
                const expiryDate = new Date(info.expires);
                const expiryString = expiryDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric'});
                schikkoInfoText = `Current Schikko: ${info.email}. Reign ends on ${expiryString}.`;
            }
        } catch (error) {
            console.error("Could not fetch Schikko info:", error);
            schikkoInfoText = "Could not retrieve the current Schikko's identity.";
        }
    }

    appInfoFooter.innerHTML = `
        <span class="font-cinzel-decorative">${schikkoInfoText}</span><br>
        <span class="font-cinzel-decorative">Decrees last inscribed upon the ledger on: <span class="text-[#c0392b]">${dateString}</span>.</span>
        ${lastPunishmentText}
    `;
}

function createActionButtons(parsedJudgement) {
    geminiActionButtonsContainer.innerHTML = ''; 
    if (!geminiActionButtonsContainer.parentNode) {
        geminiOutput.parentNode.insertBefore(geminiActionButtonsContainer, geminiOutput.nextSibling);
    }
    
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


    if (parsedJudgement.innocent) {
        const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        acknowledgeBtn.textContent = `The Oracle declares ${parsedJudgement.person || 'Someone'} innocent.`;
        acknowledgeBtn.onclick = (e) => {
            e.stopPropagation();
            geminiModal.classList.add('hidden');
        };
        geminiActionButtonsContainer.appendChild(acknowledgeBtn);
        return;
    }

    const targetPersonName = parsedJudgement.person || 'Someone';
    const person = ledgerDataCache.find(p => p.name.toLowerCase() === targetPersonName.toLowerCase());

    if (!person) {
        const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        acknowledgeBtn.textContent = `Person "${targetPersonName}" not found on ledger. Acknowledge Judgement.`;
        acknowledgeBtn.onclick = (e) => {
            e.stopPropagation();
            geminiModal.classList.add('hidden');
        };
        geminiActionButtonsContainer.appendChild(acknowledgeBtn);
        return;
    }

    let totalStripes = 0;
    const uniqueDiceValues = new Set(); 
    
    parsedJudgement.penalties.forEach(penalty => {
        if (penalty.type === 'stripes' && typeof penalty.amount === 'number') {
            totalStripes += penalty.amount;
        } else if (penalty.type === 'dice' && typeof penalty.value === 'number') {
            uniqueDiceValues.add(penalty.value);
        }
    });

    const hasStripes = totalStripes > 0;
    const hasDice = uniqueDiceValues.size > 0;

    if (hasStripes && hasDice) {
        const combinedBtn = document.createElement('button');
        combinedBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        
        let diceText = '';
        const sortedDice = [...uniqueDiceValues].sort((a, b) => a - b);
        if (sortedDice.length === 1) {
            diceText = `Roll 🎲 ${sortedDice[0]}`;
        } else {
            diceText = `Roll Dice: ${sortedDice.map(d => `🎲${d}`).join(', ')}`;
        }

        combinedBtn.textContent = `Add ${totalStripes} Stripes & ${diceText} for ${person.name}`;
        
        combinedBtn.onclick = async (e) => {
            e.stopPropagation();
             if (await confirmSchikko()) {
                for (let i = 0; i < totalStripes; i++) {
                    await addStripeToPerson(person.id);
                }
                lastPunishmentInfo = {
                    name: person.name,
                    amount: totalStripes,
                    type: 'stripes',
                    timestamp: new Date()
                };
                updateAppFooter();

                sortedDice.forEach(diceValue => {
                    rollDiceAndAssign(diceValue, person, addStripeToPerson, ledgerDataCache, showAlert); 
                });
                geminiModal.classList.add('hidden');
            }
        };
        geminiActionButtonsContainer.appendChild(combinedBtn);
    } 
    else {
        if (hasStripes) {
            const stripesBtn = document.createElement('button');
            stripesBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
            stripesBtn.textContent = `Add ${totalStripes} Stripes to ${person.name}`;
            stripesBtn.onclick = async (e) => {
                e.stopPropagation();
                if (await confirmSchikko()) {
                    for (let i = 0; i < totalStripes; i++) {
                        await addStripeToPerson(person.id);
                    }
                    lastPunishmentInfo = {
                        name: person.name,
                        amount: totalStripes,
                        type: 'stripes',
                        timestamp: new Date()
                    };
                    updateAppFooter();
                    geminiModal.classList.add('hidden');
                }
            };
            geminiActionButtonsContainer.appendChild(stripesBtn);
        }

        uniqueDiceValues.forEach(diceValue => {
            const diceBtn = document.createElement('button');
            diceBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
            diceBtn.textContent = `Roll 🎲 ${diceValue} for ${person.name}`;
            diceBtn.onclick = async (e) => {
                e.stopPropagation();
                if(await confirmSchikko()) {
                    rollDiceAndAssign(diceValue, person, addStripeToPerson, ledgerDataCache, showAlert); 
                    geminiModal.classList.add('hidden');
                }
            };
            geminiActionButtonsContainer.appendChild(diceBtn);
        });

        if (!hasStripes && !hasDice) {
            const acknowledgeBtn = document.createElement('button');
            acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
            acknowledgeBtn.textContent = `Acknowledge Judgement for ${person.name}`;
            acknowledgeBtn.onclick = (e) => {
                e.stopPropagation();
                geminiModal.classList.add('hidden');
            };
            geminiActionButtonsContainer.appendChild(acknowledgeBtn);
        }
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
        const functions = getFunctions(undefined, "europe-west4");
        const getOracleJudgement = httpsCallable(functions, 'getOracleJudgement');

        const result = await getOracleJudgement({
            promptText: inputText,
            rules: rulesDataCache,
            ledgerNames: ledgerDataCache.map(person => person.name)
        });

        const parsedJudgement = result.data.judgement; 
        
        let displayMessage = '';
        if (parsedJudgement.innocent) {
            displayMessage = `The Oracle declares ${parsedJudgement.person || 'Someone'} innocent. No rules broken.`;
        } else {
            let totalStripes = 0;
            const diceRollsSummary = [];
            
            parsedJudgement.penalties.forEach(penalty => {
                if (penalty.type === 'stripes' && typeof penalty.amount === 'number') {
                    totalStripes += penalty.amount;
                } else if (penalty.type === 'dice' && typeof penalty.value === 'number') {
                    diceRollsSummary.push(`d${penalty.value}`);
                }
            });

            const penaltyParts = [];
            if (totalStripes > 0) {
                penaltyParts.push(`${totalStripes} stripes`);
            }
            if (diceRollsSummary.length > 0) {
                penaltyParts.push(`rolls: ${[...new Set(diceRollsSummary)].join(', ')}`);
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


// --- EVENT HANDLERS ---
async function handleAddName() {
    if (!await confirmSchikko()) return;
    const name = mainInput.value.trim();
    if (!name) return;
    if (ledgerDataCache.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        await showAlert(`"${name}" is already on the ledger.`, 'Duplicate Name');
        return;
    }
    await addNameToLedger(name, currentUserId);
    mainInput.value = '';
    currentSearchTerm = '';
}

async function handleRename(docId) {
    const person = ledgerDataCache.find(p => p.id === docId);
    if (!person) return;
    const newName = await showPrompt("Enter the new name for " + person.name, person.name, "Rename Transgressor");
    if (newName && newName.trim() !== "") {
        await renamePersonOnLedger(docId, newName);
    }
}

async function handleDeletePerson(docId) {
    const person = ledgerDataCache.find(p => p.id === docId);
    if (!person) return;
    const confirmed = await showConfirm(`Are you sure you want to remove "${person.name}" from the ledger? This action cannot be undone.`, "Confirm Deletion");
    if (confirmed) {
        await deletePersonFromLedger(docId);
    }
}

async function handleRemoveStripe(docId) {
    const person = ledgerDataCache.find(p => p.id === docId);
    await removeLastStripeFromPerson(person);
}

async function handleAddRule() {
    const isConfirmed = await confirmSchikko();
    if (!isConfirmed) return;

    const text = ruleSearchInput.value.trim();
    if (!text) {
        await showAlert("Please enter a decree in the search field to add.", "Empty Decree");
        return;
    }
    const maxOrder = rulesDataCache.reduce((max, rule) => Math.max(max, rule.order), 0);
    await addRuleToFirestore(text, maxOrder + 1);
    ruleSearchInput.value = '';
    currentRuleSearchTerm = '';
    handleRenderRules();
}

async function handleEditRule(docId) {
    const rule = rulesDataCache.find(r => r.id === docId);
    if (!rule) return;
    const newText = await showPrompt("Enter the new text for the decree:", rule.text, "Edit Decree");
    if (newText && newText.trim() !== "") {
        await updateRuleTextInFirestore(docId, newText);
    }
}

// --- EVENT LISTENERS ---
mainInput.addEventListener('input', () => { currentSearchTerm = mainInput.value; handleRender(); });
ruleSearchInput?.addEventListener('input', () => { currentRuleSearchTerm = ruleSearchInput.value; handleRenderRules(); });
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
    switch (action) {
        case 'toggle-menu': 
            if(isSchikkoSessionActive) document.getElementById(`menu-${id}`)?.classList.toggle('hidden');
            break;
        case 'add-stripe': 
            if (await confirmSchikko()) {
                addStripeToPerson(id); 
                lastPunishmentInfo = { name: ledgerDataCache.find(p => p.id === id)?.name, amount: 1, type: 'stripes', timestamp: new Date() };
                updateAppFooter();
            }
            break;
        case 'add-drunk-stripe': 
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
            if (await confirmSchikko()) {
                handleRemoveStripe(id); 
            }
            break;
        case 'remove-drunk-stripe': 
            if (await confirmSchikko()) {
                const personToRemoveDrunkStripe = ledgerDataCache.find(p => p.id === id);
                if (personToRemoveDrunkStripe) removeLastDrunkStripeFromPerson(personToRemoveDrunkStripe);
            }
            break;
        case 'rename': 
             if (await confirmSchikko()) {
                handleRename(id);
             }
            break;
        case 'delete':
             if (await confirmSchikko()) {
                handleDeletePerson(id);
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
        const isConfirmed = await confirmSchikko();
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
    switch (action) {
        case 'delete': await deleteRuleFromFirestore(id); break;
        case 'move-up': if (ruleIndex > 0) await updateRuleOrderInFirestore(rulesDataCache[ruleIndex], rulesDataCache[ruleIndex - 1]); break;
        case 'move-down': if (ruleIndex < rulesDataCache.length - 1) await updateRuleOrderInFirestore(rulesDataCache[ruleIndex], rulesDataCache[ruleIndex + 1]); break;
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

openRandomizerHubBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    randomizerHubModal.classList.remove('hidden');
});

closeRandomizerHubModalBtn?.addEventListener('click', () => randomizerHubModal.classList.add('hidden'));

openListRandomizerFromHubBtn?.addEventListener('click', () => {
    randomizerHubModal.classList.add('hidden');
    listRandomizerModal.classList.remove('hidden');
    initListRandomizer(ledgerDataCache);
});

openDiceRandomizerFromHubBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    randomizerHubModal.classList.add('hidden');
    diceRandomizerModal.classList.remove('hidden');
    initDiceRandomizer(ledgerDataCache, addStripeToPerson, showAlert); 
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
    if (currentPersonIdForDrunkStripes) { 
        const count = parseInt(howManyBeersInput.value);
        const person = ledgerDataCache.find(p => p.id === currentPersonIdForDrunkStripes); 
        const availablePenaltiesToFulfill = (person?.stripes?.length || 0) - (person?.drunkStripes?.length || 0); 
        
        if (count > availablePenaltiesToFulfill) {
            await showAlert(`Cannot consume more stripes than available! You have ${availablePenaltiesToFulfill} stripes remaining.`, "Too Many Draughts");
            return;
        }

        if (count > 0) {
            await addDrunkStripeToPerson(currentPersonIdForDrunkStripes, count); 
            lastPunishmentInfo = {
                name: person.name,
                amount: count,
                type: 'drunkStripes',
                timestamp: new Date()
            };
            updateAppFooter();
        }
        drunkStripesModal.classList.add('hidden'); 
        currentPersonIdForDrunkStripes = null; 
    }
});

editCalendarBtn.addEventListener('click', async () => {
    if(!await confirmSchikko()) return;
    const config = await getCalendarConfig();
    const newUrl = await showPrompt('Enter the public iCal URL for the calendar:', config.url || '', 'Update Calendar');
    if (newUrl) {
        await saveCalendarUrl(newUrl);
        loadCalendarData();
    }
});

fullAgendaBtn.addEventListener('click', () => {
    renderFullAgenda(calendarEventsCache);
    showAgendaModal(true);
});

closeAgendaModalBtn.addEventListener('click', () => {
    showAgendaModal(false);
});

// New listeners for Schikko auth flow
setSchikkoBtn.addEventListener('click', async () => {
    const email = await showPrompt("Enter thy email to claim the title of Schikko. The sacred password will be revealed to you once.", "", "Claim the Title of Schikko");
    if (!email || !email.includes('@')) {
        if (email !== null) { // if not cancelled by user
            showAlert("A valid email is required to claim the title.", "Invalid Email");
        }
        return;
    }

    try {
        const functions = getFunctions(undefined, "europe-west4");
        const setSchikko = httpsCallable(functions, 'setSchikko');
        const result = await setSchikko({ email });
        
        if(result.data.success && result.data.password) {
            await showAlert(`You have claimed the title! Your sacred password is: ${result.data.password}. Guard it with your life, it will not be shown again.`, "Title Claimed!");
            checkSchikkoStatus();
        } else {
            throw new Error(result.data.message || "Password could not be retrieved.");
        }

    } catch (error) {
        console.error("Error setting Schikko:", error);
        await showAlert(`An error occurred: ${error.message}`, "Error Claiming Title");
    }
});

schikkoLoginBtn.addEventListener('click', async () => {
    await confirmSchikko();
});