// public/js/main.js

// --- MODULE IMPORTS ---
import {
    auth, onAuthStateChanged, signInAnonymously, setupRealtimeListener,
    addNameToLedger, addStripeToPerson, removeLastStripeFromPerson,
    renamePersonOnLedger, deletePersonFromLedger, addRuleToFirestore,
    deleteRuleFromFirestore, updateRuleOrderInFirestore, updateRuleTextInFirestore
} from './firebase.js';
import { renderLedger, showStatsModal, closeMenus, renderRules } from './ui.js';
// Import both randomizer initialization functions
import { initListRandomizer, initDiceRandomizer } from '../randomizer/randomizer.js';


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
const ruleSearchInput = document.getElementById('rule-search-input'); // New DOM element

// Dice randomizer modal and buttons (re-added)
const diceRandomizerModal = document.getElementById('dice-randomizer-modal');
const closeDiceRandomizerModalBtn = document.getElementById('close-dice-randomizer-modal');

// List randomizer modal and buttons
const listRandomizerModal = document.getElementById('list-randomizer-modal');
const closeListRandomizerModalBtn = document.getElementById('close-list-randomizer-modal');

// New Randomizer Hub elements
const openRandomizerHubBtn = document.getElementById('open-randomizer-hub-btn');
const randomizerHubModal = document.getElementById('randomizer-hub-modal');
const closeRandomizerHubModalBtn = document.getElementById('close-randomizer-hub-modal');
const openListRandomizerFromHubBtn = document.getElementById('open-list-randomizer-from-hub-btn');
const openDiceRandomizerFromHubBtn = document.getElementById('open-dice-randomizer-from-hub-btn');


// --- AUTHENTICATION & INITIALIZATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        // Listener for the punishment ledger
        setupRealtimeListener('punishments', (data) => {
            loadingState.style.display = 'none';
            ledgerDataCache = data;
            handleRender(); // Render ledger on data change
        });
        // Listener for the dynamic rules list
        setupRealtimeListener('rules', (data) => {
            rulesDataCache = data.sort((a, b) => a.order - b.order);
            handleRenderRules(); // Render rules on data change
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

// New: Renders rules based on current search term
function handleRenderRules() {
    let filteredRules = [...rulesDataCache];
    const term = currentRuleSearchTerm.toLowerCase();

    if (term) {
        filteredRules = filteredRules.filter(rule => rule.text.toLowerCase().includes(term));
    }
    renderRules(filteredRules);
}


// --- CONFIRMATION ---
function confirmSchikko() {
    // If already confirmed in this session, skip the prompt
    if (isSchikkoConfirmed) {
        return true;
    }
    const answer = prompt("To proceed, you must confirm your station. Who are you?");
    const isConfirmed = answer && answer.toLowerCase() === 'schikko';
    if (isConfirmed) {
        // Remember confirmation for this session
        isSchikkoConfirmed = true;
    }
    return isConfirmed;
}

// --- EVENT HANDLERS ---
async function handleAddName() {
    const name = mainInput.value.trim();
    if (!name) return;
    const exists = ledgerDataCache.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (exists) {
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
    // First, confirm identity if not already done this session
    if (!confirmSchikko()) return;

    // Get text from the rule search input field
    const text = ruleSearchInput.value.trim();
    // Exit if user cancelled or entered empty text
    if (!text) { // Changed condition from '!text || text.trim() === ''' to just '!text'
        alert("Please enter a decree in the search field to add.");
        return;
    }

    const maxOrder = rulesDataCache.reduce((max, rule) => Math.max(max, rule.order), 0);
    await addRuleToFirestore(text, maxOrder + 1);
    
    // Clear the search input after adding
    ruleSearchInput.value = '';
    currentRuleSearchTerm = '';
    handleRenderRules(); // Re-render rules to clear search filter and show new rule
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
mainInput.addEventListener('input', () => {
    currentSearchTerm = mainInput.value;
    handleRender();
});

// New: Rule search input listener
ruleSearchInput?.addEventListener('input', () => {
    currentRuleSearchTerm = ruleSearchInput.value;
    handleRenderRules();
});


mainInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddName(); } });
addBtn.addEventListener('click', handleAddName);
addDecreeBtn?.addEventListener('click', handleAddRule);
closeStatsModalBtn.addEventListener('click', () => statsModal.classList.add('hidden'));

sortSelect.addEventListener('change', (e) => {
    currentSortOrder = e.target.value;
    const selectedOptionText = e.target.options[e.target.selectedIndex].text;
    sortButtonText.textContent = `Sort: ${selectedOptionText}`;
    handleRender();
});

showDecreesBtn?.addEventListener('click', () => {
    showDecreesContainer.classList.add('hidden');
    decreesContent.classList.remove('hidden');
    handleRenderRules(); // Render rules when shown, in case search term changed while hidden
});

hideDecreesBtn?.addEventListener('click', () => {
    decreesContent.classList.add('hidden');
    showDecreesContainer.classList.remove('hidden');
    // Also exit edit mode for a clean state
    if (rulesListOl.classList.contains('rules-list-editing')) {
        rulesListOl.classList.remove('rules-list-editing');
        editRulesBtn.textContent = 'Finish Editing';
    }
    // Clear rule search when hiding decrees
    ruleSearchInput.value = '';
    currentRuleSearchTerm = '';
    handleRenderRules(); // Re-render rules list to clear search filter
});

punishmentListDiv.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    e.preventDefault();
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (action !== 'toggle-menu') { closeMenus(); }
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
    // Only ask for confirmation when entering edit mode
    if (!rulesListOl.classList.contains('rules-list-editing')) {
        if (!confirmSchikko()) {
            return; // If confirmation fails, do not enter edit mode
        }
    }
    
    rulesListOl.classList.toggle('rules-list-editing');
    const isEditing = rulesListOl.classList.contains('rules-list-editing');
    editRulesBtn.textContent = isEditing ? 'Finish Editing' : 'Edit Decrees';
    handleRenderRules(); // Re-render rules to show/hide edit buttons
});

rulesListOl?.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-rule-action]');
    if (!target) return;

    // The only protection needed is to check if we are in edit mode.
    // The confirmation was handled by the "Edit Decrees" button.
    if (!rulesListOl.classList.contains('rules-list-editing')) return;

    const action = target.dataset.ruleAction;
    const id = target.dataset.id;
    const ruleIndex = rulesDataCache.findIndex(r => r.id === id);
    
    if (ruleIndex === -1) return;
    
    // NO confirmation prompt here anymore.

    switch (action) {
        case 'delete':
            await deleteRuleFromFirestore(id);
            break;
        case 'move-up':
            if (ruleIndex > 0) {
                await updateRuleOrderInFirestore(rulesDataCache[ruleIndex], rulesDataCache[ruleIndex - 1]);
            }
            break;
        case 'move-down':
            if (ruleIndex < rulesDataCache.length - 1) {
                await updateRuleOrderInFirestore(rulesDataCache[ruleIndex], rulesDataCache[ruleIndex + 1]);
            }
            break;
        case 'edit': // New edit action
            await handleEditRule(id);
            break;
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="toggle-menu"]') && !e.target.closest('[id^="menu-"]')) {
        closeMenus();
    }
});

// Randomizer Hub Listeners
openRandomizerHubBtn?.addEventListener('click', () => {
    randomizerHubModal.classList.remove('hidden');
});

closeRandomizerHubModalBtn?.addEventListener('click', () => {
    randomizerHubModal.classList.add('hidden');
});

openListRandomizerFromHubBtn?.addEventListener('click', () => {
    randomizerHubModal.classList.add('hidden'); // Close hub
    listRandomizerModal.classList.remove('hidden'); // Open list randomizer
    initListRandomizer(ledgerDataCache); // Initialize the list randomizer with ledger data
});

openDiceRandomizerFromHubBtn?.addEventListener('click', () => {
    randomizerHubModal.classList.add('hidden'); // Close hub
    diceRandomizerModal.classList.remove('hidden'); // Open dice randomizer
    initDiceRandomizer(); // Initialize the dice randomizer
});

// Close listeners for specific randomizer modals
closeListRandomizerModalBtn?.addEventListener('click', () => {
    listRandomizerModal.classList.add('hidden');
});

closeDiceRandomizerModalBtn?.addEventListener('click', () => {
    diceRandomizerModal.classList.add('hidden');
});