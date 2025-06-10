// In public/js/main.js

// --- MODULE IMPORTS ---
import {
    auth, onAuthStateChanged, signInAnonymously, setupRealtimeListener,
    addNameToLedger, addStripeToPerson, removeLastStripeFromPerson,
    renamePersonOnLedger, deletePersonFromLedger, addRuleToFirestore,
    deleteRuleFromFirestore, updateRuleOrderInFirestore, updateRuleTextInFirestore
} from './firebase.js';
import { renderLedger, showStatsModal, closeMenus, renderRules } from './ui.js';
import { initListRandomizer, initDiceRandomizer } from '../randomizer/randomizer.js';
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
const hideDecreesBtn = document.getElementById('hide-decrees-btn');
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
const openGeminiFromHubBtn = document.getElementById('open-gemini-from-hub-btn');
const geminiModal = document.getElementById('gemini-modal');
const closeGeminiModalBtn = document.getElementById('close-gemini-modal');
const geminiSubmitBtn = document.getElementById('gemini-submit-btn');
const geminiInput = document.getElementById('gemini-input');
const geminiOutput = document.getElementById('gemini-output');


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
            if (aStartsWith && !bStartsWith) return -1;
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
 * Handles the Gemini Oracle submission by calling the backend function.
 */
async function handleGeminiSubmit() {
    const inputText = geminiInput.value.trim();
    if (inputText === '') {
        geminiOutput.textContent = 'The Oracle cannot judge the unspoken. Inscribe the transgression.';
        geminiOutput.classList.remove('hidden');
        return;
    }

    // Disable button and show loading state
    geminiSubmitBtn.disabled = true;
    geminiSubmitBtn.textContent = 'Consulting...';
    geminiOutput.classList.add('hidden');

    try {
        // Get a reference to the Firebase Functions service
        const functions = getFunctions();
        // Get a reference to the 'getOracleJudgement' callable function
        const getOracleJudgement = httpsCallable(functions, 'getOracleJudgement');

        // Call the function with the required payload
        const result = await getOracleJudgement({
            promptText: inputText,
            rules: rulesDataCache
        });

        // Display the judgement from the AI
        geminiOutput.textContent = result.data.judgement;

    } catch (error) {
        console.error("Error calling Oracle function:", error);
        geminiOutput.textContent = `The Oracle is silent. An error occurred: ${error.message}`;
    } finally {
        // Re-enable button and show output
        geminiSubmitBtn.disabled = false;
        geminiSubmitBtn.textContent = 'Consult the Oracle';
        geminiOutput.classList.remove('hidden');
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
    showDecreesContainer.classList.add('hidden');
    decreesContent.classList.remove('hidden');
    handleRenderRules();
});
hideDecreesBtn?.addEventListener('click', () => {
    decreesContent.classList.add('hidden');
    showDecreesContainer.classList.remove('hidden');
    if (rulesListOl.classList.contains('rules-list-editing')) {
        rulesListOl.classList.remove('rules-list-editing');
        editRulesBtn.textContent = 'Finish Editing';
    }
    ruleSearchInput.value = '';
    currentRuleSearchTerm = '';
    handleRenderRules();
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
        case 'remove-stripe': handleRemoveStripe(id); break;
        case 'rename': handleRename(id); break;
        case 'delete': handleDeletePerson(id); break;
        case 'show-stats':
            const person = ledgerDataCache.find(p => p.id === id);
            if (person) showStatsModal(person);
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
document.addEventListener('click', (e) => { if (!e.target.closest('[data-action="toggle-menu"]') && !e.target.closest('[id^="menu-"]')) closeMenus(); });
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
openGeminiFromHubBtn?.addEventListener('click', () => {
    randomizerHubModal.classList.add('hidden');
    geminiModal.classList.remove('hidden');
    geminiOutput.classList.add('hidden');
    geminiInput.value = '';
});
closeGeminiModalBtn?.addEventListener('click', () => geminiModal.classList.add('hidden'));
geminiSubmitBtn?.addEventListener('click', handleGeminiSubmit);