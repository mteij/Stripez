// public/js/main.js
// public/js/main.js

// --- MODULE IMPORTS ---
import {
    auth, onAuthStateChanged, signInAnonymously, setupRealtimeListener,
    addNameToLedger, addStripeToPerson, removeLastStripeFromPerson,
    renamePersonOnLedger, deletePersonFromLedger, addRuleToFirestore,
    deleteRuleFromFirestore, updateRuleOrderInFirestore, updateRuleTextInFirestore,
    addDrunkStripeToPerson, // Corrected: Import addDrunkStripeToPerson
    removeLastDrunkStripeFromPerson // Corrected: Import removeLastDrunkStripeFromPerson
} from './firebase.js';
import { renderLedger, showStatsModal, closeMenus, renderRules } from './ui.js';
import { initListRandomizer, initDiceRandomizer, rollSpecificDice } from '../randomizer/randomizer.js';
// New: Import functions from the Firebase SDK to call our backend
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";


// --- STATE VARIABLES ---
let currentUserId = null;
let ledgerDataCache = [];
let rulesDataCache = []; // Full, unfiltered rules data
let currentSortOrder = 'stripes_desc';
let currentSearchTerm = ''; // For ledger search
let currentRuleSearchTerm = ''; // New: For rules search
let isSchikkoConfirmed = false; // Track confirmation status for the session

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
const closeGeminiModalBtn = document.getElementById('close-gemini-modal');
const geminiSubmitBtn = document.getElementById('gemini-submit-btn');
const geminiInput = document.getElementById('gemini-input');
const geminiOutput = document.getElementById('gemini-output');

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
        setupRealtimeListener('punishments', (data) => {
            loadingState.style.display = 'none';
            ledgerDataCache = data;
            handleRender();
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
        latestUpdateTimestamp = rulesDataCache.reduce((latestTs, rule) => {
            const ruleTs = rule.updatedAt || rule.createdAt;
            if (!ruleTs) return latestTs;
            const currentMillis = ruleTs.toMillis ? ruleTs.toMillis() : 0;
            const latestMillis = latestTs ? (latestTs.toMillis ? latestTs.toMillis() : 0) : 0;
            return currentMillis > latestMillis ? ruleTs : latestTs;
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
    appInfoFooter.innerHTML = `
        <span class="font-cinzel-decorative">Crafted by the hand of Michiel, with the wisdom of the Oracles (ChatGPT).</span><br>
        <span class="font-cinzel-decorative">Decrees last inscribed upon the ledger on: <span class="text-[#c0392b]">${dateString}</span>.</span>
    `;
}

/**
 * Parses the Oracle's judgment text to extract action and parameters.
 * @param {string} judgementText - The raw judgment string from the Oracle.
 * @returns {object|null} An object containing action type and parameters, or null if unparseable.
*/
function parseOracleJudgment(judgementText) {
    const lowerJudgement = judgementText.toLowerCase();

    // Remove the rule citation part for cleaner parsing of actions
    const textWithoutRules = judgementText.replace(/ \[Rule(?:s)?\s*[\d,\s]+\]/i, '').trim();

    // 1. Extract potential name: The first word of the sentence
    // Or a word preceded by a known action verb
    let name = null;
    const initialNameMatch = textWithoutRules.match(/^(\w+)/);
    if (initialNameMatch && !['roll', 'rolls', 'test', 'person', 'someone', 'oracle'].includes(initialNameMatch[1].toLowerCase())) {
        name = initialNameMatch[1];
    } else {
        // Try to find name after common phrases like "gets", "must roll", "is assigned"
        const nameAfterVerbMatch = textWithoutRules.match(/(?:gets|is assigned|receives|has|must roll|should roll|is to roll)\s+(\w+)/i);
        if (nameAfterVerbMatch) {
            name = nameAfterVerbMatch[1];
        }
    }
    // If no name found yet, but we found a number, let's assume 'Someone'
    if (!name && (textWithoutRules.match(/\d+/) || lowerJudgement.includes('dice') || lowerJudgement.includes('stripe'))) {
        name = 'Someone'; // Default name if no explicit one is found for actions
    }


    // 2. Look for dice roll pattern
    // Examples: "rolls a 3-sided die", "roll dice 3", "must roll 10"
    const diceMatch = textWithoutRules.match(/(?:roll|rolls|roll a|must roll|should roll|is to roll)\s+(?:a\s+)?(?:dice|die)?\s*(\d+)(?:-sided)?/i);
    const diceValue = (diceMatch && !isNaN(parseInt(diceMatch[1]))) ? parseInt(diceMatch[1]) : null;

    // 3. Look for stripes pattern
    // Examples: "gets 2 stripes", "has 5 stripes", "2 stripes"
    const stripesMatch = textWithoutRules.match(/(\d+)\s+stripes?/i);
    const stripesCount = (stripesMatch && !isNaN(parseInt(stripesMatch[1]))) ? parseInt(stripesMatch[1]) : null;

    // Determine type based on what was found
    if (name && stripesCount !== null && diceValue !== null) {
        // Combined action: [Name] ... [stripes] ... [dice]
        return {
            type: 'addStripesAndRollDice',
            name: name,
            count: stripesCount,
            diceValue: diceValue
        };
    } else if (name && stripesCount !== null) {
        // Add stripes only
        return {
            type: 'addStripes',
            name: name,
            count: stripesCount
        };
    } else if (name && diceValue !== null) {
        // Roll dice only
        return {
            type: 'rollDice',
            name: name,
            value: diceValue
        };
    } else if (lowerJudgement.includes('innocent')) {
        // Innocent
        return { type: 'innocent' };
    } else {
        // Acknowledge (fallback)
        return { type: 'acknowledge' };
    }
}

/**
 * Creates a dynamic action button based on the parsed judgment.
 * @param {object} parsedJudgement - The object returned by parseOracleJudgment.
 * @returns {HTMLButtonElement} The action button.
 */
function createActionButton(parsedJudgement) {
    const actionButton = document.createElement('button');
    actionButton.className = 'btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg mt-4';

    if (parsedJudgement.type === 'addStripes') {
        actionButton.textContent = `Add ${parsedJudgement.count} Stripes to ${parsedJudgement.name}`;
        actionButton.onclick = async () => {
            const person = ledgerDataCache.find(p => p.name.toLowerCase() === parsedJudgement.name.toLowerCase());
            if (person) {
                for (let i = 0; i < parsedJudgement.count; i++) {
                    await addStripeToPerson(person.id);
                }
                geminiModal.classList.add('hidden');
                actionButton.remove();
            } else {
                alert(`Person "${parsedJudgement.name}" not found on ledger.`);
                geminiModal.classList.add('hidden');
                actionButton.remove();
            }
        };
    } else if (parsedJudgement.type === 'rollDice') {
        actionButton.textContent = `Roll 🎲 ${parsedJudgement.value}`;
        actionButton.onclick = () => {
            rollSpecificDice(parsedJudgement.value);
            geminiModal.classList.add('hidden');
            actionButton.remove();
        };
    } else if (parsedJudgement.type === 'addStripesAndRollDice') {
        actionButton.textContent = `Add ${parsedJudgement.count} Stripes & Roll 🎲 ${parsedJudgement.diceValue} to ${parsedJudgement.name}`;
        actionButton.onclick = async () => {
            const person = ledgerDataCache.find(p => p.name.toLowerCase() === parsedJudgement.name.toLowerCase());
            if (person) {
                for (let i = 0; i < parsedJudgement.count; i++) {
                    await addStripeToPerson(person.id);
                }
                rollSpecificDice(parsedJudgement.diceValue);
                geminiModal.classList.add('hidden');
                actionButton.remove();
            } else {
                alert(`Person "${parsedJudgement.name}" not found on ledger.`);
                geminiModal.classList.add('hidden');
                actionButton.remove();
            }
        };
    } else { // Innocent or unhandled judgment, just acknowledge
        actionButton.textContent = 'Acknowledge Judgement';
        actionButton.onclick = () => {
            geminiModal.classList.add('hidden');
            actionButton.remove();
        };
    }
    return actionButton;
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

    // Clear previous output and any existing action button
    geminiOutput.innerHTML = '';
    const existingActionButton = geminiOutput.nextElementSibling;
    if (existingActionButton && existingActionButton.classList.contains('btn-punishment')) {
        existingActionButton.remove();
    }


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

        // The result.data is now the structured JSON object directly
        const judgement = result.data.judgement; 
        geminiOutput.textContent = judgement; // Display the human-readable message
        geminiOutput.classList.remove('hidden');

        // Parse judgment and create action button (parseOracleJudgment just returns the structured object)
        const parsedJudgement = parseOracleJudgment(judgement);
        const actionButton = createActionButton(parsedJudgement);
        geminiOutput.parentNode.insertBefore(actionButton, geminiOutput.nextSibling);


    } catch (error) {
        console.error("Error calling Oracle function:", error);
        geminiOutput.textContent = `The Oracle is silent. An error occurred: ${error.message}`;
        geminiOutput.classList.remove('hidden');
    } finally {
        // Re-enable button and show output
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
        case 'add-stripe': addStripeToPerson(id); break;
        case 'add-drunk-stripe': // Changed to 'drunk'
            currentPersonIdForDrunkStripes = id; 
            const person = ledgerDataCache.find(p => p.id === currentPersonIdForDrunkStripes);
            // Calculate available penalties that can still be fulfilled (normal minus already drunk)
            const availablePenaltiesToFulfill = (person?.stripes?.length || 0) - (person?.drunkStripes?.length || 0); // Changed to 'drunk'
            
            howManyBeersInput.value = Math.min(1, availablePenaltiesToFulfill); // Default to 1, or 0 if no unfulfilled penalties
            howManyBeersInput.max = availablePenaltiesToFulfill; // Set max value
            availableStripesDisplay.textContent = `Available Penalties: ${availablePenaltiesToFulfill}`; // Update display
            
            if (availablePenaltiesToFulfill <= 0) {
                // Disable buttons and input if no penalties available
                howManyBeersInput.disabled = true;
                incrementBeersBtn.disabled = true;
                decrementBeersBtn.disabled = true;
                confirmDrunkStripesBtn.disabled = true; 
                availableStripesDisplay.textContent = 'No penalties available to fulfill!';
            } else {
                // Enable if penalties are available
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
    if (!e.target.closest('[data-action="toggle-menu"]') && !e.target.closest('[id^="menu-"]')) {
        closeMenus(); 
    }
    // Close drunk stripes modal if click outside and it's open
    if (!drunkStripesModal.classList.contains('hidden') && !e.target.closest('#drunk-stripes-modal') && !e.target.closest('[data-action="add-drunk-stripe"]')) { // Changed to 'drunk'
        drunkStripesModal.classList.add('hidden'); 
    }
});
openRandomizerHubBtn?.addEventListener('click', () => randomizerHubModal.classList.remove('hidden'));
closeRandomizerHubModalBtn?.addEventListener('click', () => randomizerHubModal.classList.add('hidden'));
openListRandomizerFromHubBtn?.addEventListener('click', () => {
    randomizerHubModal.classList.add('hidden');
    listRandomizerModal.classList.remove('hidden');
    initListRandomizer(ledgerDataCache);
});
openDiceRandomizerFromHubBtn?.addEventListener('click', () => {
    randomizerHubModal.classList.add('hidden');
    diceRandomizerModal.classList.remove('hidden');
    initDiceRandomizer();
});
closeListRandomizerModalBtn?.addEventListener('click', () => listRandomizerModal.classList.add('hidden'));
closeDiceRandomizerModalBtn?.addEventListener('click', () => diceRandomizerModal.classList.add('hidden'));
openGeminiFromHubBtn?.addEventListener('click', () => { // This is the button moved to main page
    randomizerHubModal.classList.add('hidden'); // Ensure hub is closed if clicked from there
    geminiModal.classList.remove('hidden');
    geminiOutput.classList.add('hidden');
    geminiOutput.innerHTML = ''; // Clear previous judgment
    geminiInput.value = '';
    // Remove the action button if it exists
    const existingActionButton = geminiOutput.nextElementSibling;
    if (existingActionButton && existingActionButton.classList.contains('btn-punishment')) {
        existingActionButton.remove();
    }
});
closeGeminiModalBtn?.addEventListener('click', () => {
    geminiModal.classList.add('hidden');
    geminiOutput.classList.add('hidden'); // Ensure output is hidden when closing
    geminiOutput.innerHTML = ''; // Clear previous judgment
    geminiInput.value = ''; // Clear input
    // Remove the action button if it exists
    const existingActionButton = geminiOutput.nextElementSibling;
    if (existingActionButton && existingActionButton.classList.contains('btn-punishment')) {
        existingActionButton.remove();
    }
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
    if (currentValue > 1) { // Ensure it doesn't go below 1
        howManyBeersInput.value = currentValue - 1;
    }
});

confirmDrunkStripesBtn.addEventListener('click', async () => { 
    if (currentPersonIdForDrunkStripes) { 
        const count = parseInt(howManyBeersInput.value);
        const person = ledgerDataCache.find(p => p.id === currentPersonIdForDrunkStripes); 
        // Calculate available penalties that can still be fulfilled (normal minus already drunk)
        const availablePenaltiesToFulfill = (person?.stripes?.length || 0) - (person?.drunkStripes?.length || 0); // Changed to 'drunk'
        
        if (count > availablePenaltiesToFulfill) {
            alert(`Cannot consume more stripes than available! You have ${availablePenaltiesToFulfill} penalties remaining.`);
            return;
        }

        if (count > 0) {
            await addDrunkStripeToPerson(currentPersonIdForDrunkStripes, count); 
        }
        drunkStripesModal.classList.add('hidden'); 
        currentPersonIdForDrunkStripes = null; 
    }
});