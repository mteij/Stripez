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
import { renderLedger, showStatsModal, closeMenus, renderRules, renderUpcomingEvent, renderFullAgenda, showAgendaModal } from './ui.js';
import { initListRandomizer, initDiceRandomizer, rollSpecificDice, rollDiceAndAssign } from '../randomizer/randomizer.js';
// New: Import functions from the Firebase SDK to call our backend
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";


// --- STATE VARIABLES ---
let currentUserId = null;
let ledgerDataCache = [];
let rulesDataCache = []; // Full, unfiltered rules data
let calendarEventsCache = [];
let currentSortOrder = 'stripes_desc';
let currentSearchTerm = ''; // For ledger search
let currentRuleSearchTerm = ''; // New: For rules inconsistencies search
let isSchikkoConfirmed = false; // Track confirmation status for the session
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
const openGeminiFromHubBtn = document.getElementById('open-gemini-from-hub-btn'); // Moved from modal
const geminiModal = document.getElementById('gemini-modal');
// FIX: Corrected typo - assignment should be to 'closeGeminiModalBtn' not 'document'
const closeGeminiModalBtn = document.getElementById('close-gemini-modal');
const geminiSubmitBtn = document.getElementById('gemini-submit-btn');
const geminiInput = document.getElementById('gemini-input');
const geminiOutput = document.getElementById('gemini-output');
const geminiActionButtonsContainer = document.createElement('div'); // New container for action buttons
geminiActionButtonsContainer.className = 'flex flex-wrap justify-center gap-4 mt-4'; // Styling for buttons


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
        loadCalendarData();
        setupRealtimeListener('punishments', (data) => {
            loadingState.style.display = 'none';
            ledgerDataCache = data;
            handleRender();
            updateDatalist(); // Update datalist whenever ledger data changes
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

// --- HELPER FUNCTIONS ---

async function loadCalendarData() {
    const config = await getCalendarConfig();
    if (config && config.url) {
        try {
            // Get a reference to the Firebase Functions service
            const functions = getFunctions(undefined, "europe-west4");
            const getCalendarDataProxy = httpsCallable(functions, 'getCalendarDataProxy');

            // Call the proxy function with the URL
            const result = await getCalendarDataProxy({ url: config.url });
            const icalData = result.data.icalData;

            const jcalData = ICAL.parse(icalData);
            const vcalendar = new ICAL.Component(jcalData);
            const vevents = vcalendar.getAllSubcomponents('vevent');
            const now = new Date();

            calendarEventsCache = vevents.map(vevent => {
                const event = new ICAL.Event(vevent);
                const isRecurring = event.isRecurring();
                
                if (isRecurring) {
                    const iterator = event.iterator();
                    let next;
                    const occurrences = [];
                    while ((next = iterator.next()) && occurrences.length < 100) { // Limit to 100 occurrences
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


/**
 * Updates the datalist for the main input field with current ledger names.
 */
function updateDatalist() {
    if (ledgerNamesDatalist) {
        ledgerNamesDatalist.innerHTML = ''; // Clear existing options
        ledgerDataCache.forEach(person => {
            const option = document.createElement('option');
            option.value = person.name;
            ledgerNamesDatalist.appendChild(option);
        });
    }
}

/**
 * Calculates the Levenshtein distance between two strings.
 * Used for fuzzy string matching.
 * @param {string} a The first string.
 * @param {string} b The second string.
 * @return {number} The Levenshtein distance between the two strings.
 */
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
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
    renderLedger(viewData, term);
}

function handleRenderRules() {
    let filteredRules = [...rulesDataCache];
    const term = currentRuleSearchTerm.toLowerCase();
    if (term) {
        filteredRules = filteredRules.filter(rule => rule.text.toLowerCase().includes(term));
    }
    renderRules(filteredRules);
}

function updateAppFooter() {
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

    appInfoFooter.innerHTML = `
        <span class="font-cinzel-decorative">Crafted by the hand of Michiel, with the wisdom of the Oracles (ChatGPT).</span><br>
        <span class="font-cinzel-decorative">Decrees last inscribed upon the ledger on: <span class="text-[#c0392b]">${dateString}</span>.</span>
        ${lastPunishmentText}
    `;
}


/**
 * Creates and appends action buttons based on the parsed judgment.
 * @param {object} parsedJudgement - The JSON object returned by the Oracle Cloud Function.
 */
function createActionButtons(parsedJudgement) {
    // Clear previous buttons
    geminiActionButtonsContainer.innerHTML = ''; 
    
    // Append the container to the DOM if it's not already there
    if (!geminiActionButtonsContainer.parentNode) {
        geminiOutput.parentNode.insertBefore(geminiActionButtonsContainer, geminiOutput.nextSibling);
    }

    if (parsedJudgement.innocent) {
        const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
        acknowledgeBtn.textContent = `The Oracle declares ${parsedJudgement.person || 'Someone'} innocent.`;
        acknowledgeBtn.onclick = (e) => { // Added event parameter
            e.stopPropagation(); // Stop propagation
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
        acknowledgeBtn.onclick = (e) => { // Added event parameter
            e.stopPropagation(); // Stop propagation
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

    // --- Combined Button for Stripes and Dice ---
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
        
        combinedBtn.onclick = async (e) => { // Added event parameter
            e.stopPropagation(); // Stop propagation
            // Apply stripes
            for (let i = 0; i < totalStripes; i++) {
                await addStripeToPerson(person.id);
            }
            // Update last punishment info
            lastPunishmentInfo = {
                name: person.name,
                amount: totalStripes,
                type: 'stripes',
                timestamp: new Date()
            };
            updateAppFooter(); // Update footer immediately

            // Open dice roller for each unique die value
            sortedDice.forEach(diceValue => {
                // Pass ledgerDataCache and addStripeToPerson to the new function
                rollDiceAndAssign(diceValue, person, addStripeToPerson, ledgerDataCache); 
            });
            geminiModal.classList.add('hidden'); // Close Gemini modal
        };
        geminiActionButtonsContainer.appendChild(combinedBtn);
    } 
    // --- Separate Buttons if only Stripes or only Dice ---
    else {
        // Stripes Button (if applicable)
        if (hasStripes) {
            const stripesBtn = document.createElement('button');
            stripesBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
            stripesBtn.textContent = `Add ${totalStripes} Stripes to ${person.name}`;
            stripesBtn.onclick = async (e) => { // Added event parameter
                e.stopPropagation(); // Stop propagation
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
            };
            geminiActionButtonsContainer.appendChild(stripesBtn);
        }

        // Dice Roll Buttons (one for each unique die value)
        uniqueDiceValues.forEach(diceValue => {
            const diceBtn = document.createElement('button');
            diceBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
            diceBtn.textContent = `Roll 🎲 ${diceValue} for ${person.name}`;
            diceBtn.onclick = (e) => { // Added event parameter
                e.stopPropagation(); // Stop propagation
                // Pass ledgerDataCache and addStripeToPerson to the new function
                rollDiceAndAssign(diceValue, person, addStripeToPerson, ledgerDataCache); 
                geminiModal.classList.add('hidden');
            };
            geminiActionButtonsContainer.appendChild(diceBtn);
        });

        // If no specific penalties, add a generic acknowledge button
        if (!hasStripes && !hasDice) {
            const acknowledgeBtn = document.createElement('button');
            acknowledgeBtn.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg';
            acknowledgeBtn.textContent = `Acknowledge Judgement for ${person.name}`;
            acknowledgeBtn.onclick = (e) => { // Added event parameter
                e.stopPropagation(); // Stop propagation
                geminiModal.classList.add('hidden');
            };
            geminiActionButtonsContainer.appendChild(acknowledgeBtn);
        }
    }
}


/**
 * Handles the Gemini Oracle submission by calling the backend function.
 */
async function handleGeminiSubmit() {
    const inputText = geminiInput.value.trim();
    if (inputText === '') {
        geminiOutput.textContent = 'The Oracle cannot judge the unspoken. Inscribe the transgression.';
        geminiOutput.classList.remove('hidden');
        return;
    }

    // Clear previous output and any existing action buttons
    geminiOutput.innerHTML = '';
    geminiActionButtonsContainer.innerHTML = ''; // Clear buttons

    // Disable button and show loading state
    geminiSubmitBtn.disabled = true;
    geminiSubmitBtn.textContent = 'Consulting...';
    geminiOutput.classList.add('hidden');

    try {
        // Get a reference to the Firebase Functions service in the correct region
        const functions = getFunctions(undefined, "europe-west4");
        const getOracleJudgement = httpsCallable(functions, 'getOracleJudgement');

        // Call the function with the required payload
        const result = await getOracleJudgement({
            promptText: inputText,
            rules: rulesDataCache,
            ledgerNames: ledgerDataCache.map(person => person.name) // Pass names from ledger
        });

        // The result.data.judgement is now the parsed JSON object
        const parsedJudgement = result.data.judgement; 
        
        // Construct a human-readable summary for display
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
                penaltyParts.push(`rolls: ${[...new Set(diceRollsSummary)].join(', ')}`); // Unique dice rolls for display
            }
            
            const ruleNumbers = parsedJudgement.rulesBroken || [];
            let rulesText = '';
            if (ruleNumbers.length > 0) {
                rulesText = ` (Broken Rule${ruleNumbers.length > 1 ? 's' : ''}: ${ruleNumbers.join(', ')})`;
            }

            if (penaltyParts.length > 0) {
                displayMessage = `Judgement for ${parsedJudgement.person || 'Someone'}: ${penaltyParts.join(' and ')}${rulesText}.`;
            } else {
                displayMessage = `The Oracle has spoken for ${parsedJudgement.person || 'Someone'}${rulesText}. No explicit penalties were calculated.`;
            }
        }

        geminiOutput.textContent = displayMessage; 
        geminiOutput.classList.remove('hidden');

        // Create action buttons based on the detailed judgment
        createActionButtons(parsedJudgement);


    } catch (error) {
        console.error("Error calling Oracle function:", error);
        // Display a user-friendly error message, extracting details from HttpsError if available
        let errorMessage = `The Oracle is silent. An error occurred: ${error.message}`;
        if (error.code && error.details) {
            errorMessage = `Oracle error (${error.code}): ${error.message}`;
            if (typeof error.details === 'string' && error.details.startsWith('{')) {
                 // Try to parse if details is a stringified JSON
                try {
                    const detailObj = JSON.parse(error.details);
                    if (detailObj.judgement) {
                         errorMessage += ` Raw AI response: ${detailObj.judgement}`;
                    }
                } catch (parseError) {
                    // Ignore parsing errors, stick to original message
                }
            }
        }
        geminiOutput.textContent = errorMessage;
        geminiOutput.classList.remove('hidden');
    } finally {
        // Re-enable button
        geminiSubmitBtn.disabled = false;
        geminiSubmitBtn.textContent = 'Consult the Oracle';
    }
}

// --- CONFIRMATION ---
function confirmSchikko() {
    if (isSchikkoConfirmed) return true;
    const answer = prompt("Art thou the Schikko? If it be so, inscribe 'Schikko'.");
    const isConfirmed = answer && answer.toLowerCase() === 'schikko';
    if (isConfirmed) isSchikkoConfirmed = true;
    return isConfirmed;
}

// --- EVENT HANDLERS ---
async function handleAddName() {
    const name = mainInput.value.trim();
    if (!name) return;
    if (ledgerDataCache.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        alert(`"${name}" is already on the ledger.`);
        return;
    }
    await addNameToLedger(name, currentUserId);
    mainInput.value = '';
    currentSearchTerm = '';
}

async function handleRename(docId) {
    const person = ledgerDataCache.find(p => p.id === docId);
    if (!person) return;
    const newName = prompt("Enter the new name for " + person.name, person.name);
    if (newName && newName.trim() !== "") {
        await renamePersonOnLedger(docId, newName);
    }
}

async function handleDeletePerson(docId) {
    const person = ledgerDataCache.find(p => p.id === docId);
    if (!person) return;
    if (confirm(`Are you sure you want to remove "${person.name}" from the ledger? This action cannot be undone.`)) {
        await deletePersonFromLedger(docId);
    }
}

async function handleRemoveStripe(docId) {
    const person = ledgerDataCache.find(p => p.id === docId);
    await removeLastStripeFromPerson(person);
}

async function handleAddRule() {
    if (!confirmSchikko()) return;
    const text = ruleSearchInput.value.trim();
    if (!text) {
        alert("Please enter a decree in the search field to add.");
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
    const newText = prompt("Enter the new text for the decree:", rule.text);
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
punishmentListDiv.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    e.preventDefault();
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (action !== 'toggle-menu') closeMenus();
    switch (action) {
        case 'toggle-menu': document.getElementById(`menu-${id}`)?.classList.toggle('hidden'); break;
        case 'add-stripe': 
            addStripeToPerson(id); 
            lastPunishmentInfo = {
                name: ledgerDataCache.find(p => p.id === id)?.name,
                amount: 1, // Single stripe added
                type: 'stripes',
                timestamp: new Date()
            };
            updateAppFooter();
            break;
        case 'add-drunk-stripe': 
            currentPersonIdForDrunkStripes = id; 
            const person = ledgerDataCache.find(p => p.id === currentPersonIdForDrunkStripes);
            const availablePenaltiesToFulfill = (person?.stripes?.length || 0) - (person?.drunkStripes?.length || 0);
            
            howManyBeersInput.value = Math.min(1, availablePenaltiesToFulfill); 
            howManyBeersInput.max = availablePenaltiesToFulfill; 
            availableStripesDisplay.textContent = `Available Penalties: ${availablePenaltiesToFulfill}`;
            
            if (availablePenaltiesToFulfill <= 0) {
                howManyBeersInput.disabled = true;
                incrementBeersBtn.disabled = true;
                decrementBeersBtn.disabled = true;
                confirmDrunkStripesBtn.disabled = true; 
                availableStripesDisplay.textContent = 'No penalties available to fulfill!';
            } else {
                howManyBeersInput.disabled = false;
                incrementBeersBtn.disabled = false;
                decrementBeersBtn.disabled = false;
                confirmDrunkStripesBtn.disabled = false; 
            }

            drunkStripesModal.classList.remove('hidden'); 
            break;
        case 'remove-stripe': handleRemoveStripe(id); break;
        case 'remove-drunk-stripe': 
            const personToRemoveDrunkStripe = ledgerDataCache.find(p => p.id === id);
            if (personToRemoveDrunkStripe) removeLastDrunkStripeFromPerson(personToRemoveDrunkStripe);
            break;
        case 'rename': handleRename(id); break;
        case 'delete': handleDeletePerson(id); break;
        case 'show-stats':
            const personToShowStats = ledgerDataCache.find(p => p.id === id);
            if (personToShowStats) showStatsModal(personToShowStats);
            break;
    }
});
editRulesBtn?.addEventListener('click', () => {
    if (!rulesListOl.classList.contains('rules-list-editing')) {
        if (!confirmSchikko()) return;
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
    // Do not close menus if the click target is within a toggle menu or the toggle menu button itself
    if (!e.target.closest('[data-action="toggle-menu"]') && !e.target.closest('[id^="menu-"]')) {
        closeMenus(); 
    }
    // Close drunk stripes modal if click outside and it's open
    if (!drunkStripesModal.classList.contains('hidden') && !e.target.closest('#drunk-stripes-modal') && !e.target.closest('[data-action="add-drunk-stripe"]')) { 
        drunkStripesModal.classList.add('hidden'); 
    }
    // Close dice randomizer modal if click outside and it's open (and not a dice-spin button)
    // IMPORTANT: Make sure this doesn't interfere with the AI-triggered open event.
    // The e.stopPropagation() on the AI buttons should prevent this listener from firing for their clicks.
    if (!diceRandomizerModal.classList.contains('hidden') && !e.target.closest('#dice-randomizer-modal') && !e.target.closest('#open-dice-randomizer-from-hub-btn')) {
        diceRandomizerModal.classList.add('hidden');
    }
});

openRandomizerHubBtn?.addEventListener('click', (e) => { // Added event parameter
    e.stopPropagation(); // Stop propagation
    randomizerHubModal.classList.remove('hidden');
});

closeRandomizerHubModalBtn?.addEventListener('click', () => randomizerHubModal.classList.add('hidden'));

openListRandomizerFromHubBtn?.addEventListener('click', () => {
    randomizerHubModal.classList.add('hidden');
    listRandomizerModal.classList.remove('hidden');
    initListRandomizer(ledgerDataCache);
});

openDiceRandomizerFromHubBtn?.addEventListener('click', (e) => { // Added event parameter
    e.stopPropagation(); // Stop propagation
    randomizerHubModal.classList.add('hidden');
    diceRandomizerModal.classList.remove('hidden'); // This makes the modal visible
    // Ensure initDiceRandomizer receives ledgerDataCache and addStripeToPerson for manual rolls
    initDiceRandomizer(ledgerDataCache, addStripeToPerson); 
});

// FIX: Corrected close button for Dice Randomizer Modal
closeDiceRandomizerModalBtn?.addEventListener('click', (e) => { // Added event parameter
    e.stopPropagation(); // Stop propagation to prevent immediate re-opening by global listener
    diceRandomizerModal.classList.add('hidden');
});

closeListRandomizerModalBtn?.addEventListener('click', () => listRandomizerModal.classList.add('hidden'));

openGeminiFromHubBtn?.addEventListener('click', (e) => { // Added event parameter
    e.stopPropagation(); // Stop propagation
    randomizerHubModal.classList.add('hidden'); 
    geminiModal.classList.remove('hidden');
    geminiOutput.classList.add('hidden');
    geminiOutput.innerHTML = ''; 
    geminiInput.value = '';
    geminiActionButtonsContainer.innerHTML = ''; // Clear buttons when opening
});

closeGeminiModalBtn?.addEventListener('click', () => {
    geminiModal.classList.add('hidden');
    geminiOutput.classList.add('hidden'); 
    geminiOutput.innerHTML = ''; 
    geminiInput.value = ''; 
    geminiActionButtonsContainer.innerHTML = ''; // Clear buttons when closing
});

geminiSubmitBtn?.addEventListener('click', handleGeminiSubmit);

// Drunk Stripes Modal Event Listeners
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
            alert(`Cannot consume more stripes than available! You have ${availablePenaltiesToFulfill} penalties remaining.`);
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
    const config = await getCalendarConfig();
    const newUrl = prompt('Enter the public iCal URL for the calendar:', config.url);
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