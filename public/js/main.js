// public/js/main.js

// --- MODULE IMPORTS ---
import {
    auth, onAuthStateChanged, signInAnonymously, setupRealtimeListener,
    addNameToLedger, addStripeToPerson, removeLastStripeFromPerson,
    renamePersonOnLedger, deletePersonFromLedger, addRuleToFirestore,
    deleteRuleFromFirestore, updateRuleOrderInFirestore
} from './firebase.js';
import { renderLedger, showStatsModal, closeMenus, renderRules } from './ui.js';

// --- STATE VARIABLES ---
let currentUserId = null;
let ledgerDataCache = [];
let rulesDataCache = [];
let currentSortOrder = 'stripes_desc';
let currentSearchTerm = '';
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

// --- AUTHENTICATION & INITIALIZATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        // Listener for the punishment ledger
        setupRealtimeListener('punishments', (data) => {
            loadingState.style.display = 'none';
            ledgerDataCache = data;
            handleRender();
        });
        // Listener for the dynamic rules list
        setupRealtimeListener('rules', (data) => {
            rulesDataCache = data.sort((a, b) => a.order - b.order);
            // Render the interactive list in the collapsible area
            renderRules(rulesDataCache);
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

    const text = prompt("What is the new decree you wish to add?");
    // Exit if user cancelled or entered empty text
    if (!text || text.trim() === '') return;

    const maxOrder = rulesDataCache.reduce((max, rule) => Math.max(max, rule.order), 0);
    await addRuleToFirestore(text, maxOrder + 1);
}

// --- EVENT LISTENERS ---
mainInput.addEventListener('input', () => {
    currentSearchTerm = mainInput.value;
    handleRender();
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
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="toggle-menu"]') && !e.target.closest('[id^="menu-"]')) {
        closeMenus();
    }
});