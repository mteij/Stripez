import { state } from './state.js';
import { dom } from './dom.js';
import { 
    addNameToLedger, logActivity, renamePersonOnLedger, deletePersonFromLedger, removeLastStripeFromPerson,
    addRuleToFirestore, updateRuleInFirestore, addStripeToPerson, getStripezDate, removeLastDrunkStripeFromPerson,
    setPersonRole, bulkUpdateRules, deleteRuleFromFirestore, updateRuleOrderInFirestore, deleteLogFromFirestore,
    approveDrinkRequest, rejectDrinkRequest, requestDrink, addDrunkStripeToPerson, getCalendarConfig, saveCalendarUrl,
    saveStripezDate
} from '../api.js';
import { 
    showConfirm, showPrompt, showLoading, hideLoading, showAlert, showRuleEditModal,
    showBulkEditRulesModal, showStatsModal, showLogbookModal, showAgendaModal
} from '../ui.js';
import { ensureSchikkoSession } from './auth.js';
import { handleRender, handleRenderRules, handleRenderLogbook } from './render.js';
import { initListRandomizer, initDiceRandomizer, rollDiceAndAssign, initWheelRandomizer } from '../../randomizer/randomizer.js';
import { handleGeminiSubmit } from './oracle.js';
import { loadCalendarData, updateDatalist } from '../main.js';

async function handleAddName() {
    if (!await ensureSchikkoSession()) return;
    const name = dom.mainInput.value.trim();
    if (!name) return;
    if (state.ledgerDataCache.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        await showAlert(`"${name}" is already on the ledger.`, 'Duplicate Name');
        return;
    }
    showLoading('Saving to ledger...');
    try {
        await addNameToLedger(name);
        await logActivity('ADD_PERSON', 'Schikko', `Inscribed "${name}" onto the ledger.`);
        
        state.justAddedName = true;
        handleRender(true);
        
        dom.mainInput.value = '';
        state.currentSearchTerm = '';
        
        dom.mainInput.focus();
    } finally {
        hideLoading();
    }
}

async function handleRename(docId) {
    const person = state.ledgerDataCache.find(p => p.id === docId);
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
    const person = state.ledgerDataCache.find(p => p.id === docId);
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

async function handleAddRule() {
    const isConfirmed = await ensureSchikkoSession();
    if (!isConfirmed) return;

    const text = dom.ruleSearchInput.value.trim();
    if (!text) {
        await showAlert("Please enter a decree in the search field to add.", "Empty Decree");
        return;
    }
    const maxOrder = state.rulesDataCache.reduce((max, rule) => Math.max(max, rule.order), 0);
    showLoading('Saving decree...');
    try {
        await addRuleToFirestore(text, maxOrder + 1);
        await logActivity('ADD_RULE', 'Schikko', `Added a new decree: "${text}"`);
    } finally {
        hideLoading();
    }
    dom.ruleSearchInput.value = '';
    state.currentRuleSearchTerm = '';
    handleRenderRules();
}

async function handleEditRule(docId) {
    const rule = state.rulesDataCache.find(r => r.id === docId);
    if (!rule) return;
    
    const result = await showRuleEditModal(rule.text, rule.tags, state.rulesDataCache);

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

import { closeMenus } from '../ui.js';

export function setupEventListeners() {
    dom.mainInput.addEventListener('input', () => { state.currentSearchTerm = dom.mainInput.value; handleRender(); });
    if(dom.ruleSearchInput) dom.ruleSearchInput.addEventListener('input', () => { state.currentRuleSearchTerm = dom.ruleSearchInput.value; handleRenderRules(); });
    if(dom.ruleTagFilter) dom.ruleTagFilter.addEventListener('change', (e) => { state.currentTagFilter = e.target.value; handleRenderRules(); });
    dom.mainInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddName(); } });
    if(dom.addBtn) dom.addBtn.addEventListener('click', handleAddName);
    if(dom.addDecreeBtn) dom.addDecreeBtn.addEventListener('click', handleAddRule);
    if(dom.closeStatsModalBtn) dom.closeStatsModalBtn.addEventListener('click', () => dom.statsModal.classList.add('hidden'));
    if(dom.sortSelect) {
        dom.sortSelect.addEventListener('change', (e) => {
            state.currentSortOrder = e.target.value;
            if(dom.sortButtonText) dom.sortButtonText.textContent = `Sort: ${e.target.options[e.target.selectedIndex].text}`;
            handleRender();
        });
    }

    if(dom.showDecreesBtn) dom.showDecreesBtn.addEventListener('click', () => {
        const isHidden = dom.decreesContent.classList.contains('hidden');
        if (isHidden) {
            dom.decreesContent.classList.remove('hidden');
            dom.showDecreesBtn.setAttribute('data-state', 'expanded');
        } else {
            dom.decreesContent.classList.add('hidden');
            dom.showDecreesBtn.setAttribute('data-state', 'collapsed');
            if (dom.rulesListOl.classList.contains('rules-list-editing')) {
                dom.rulesListOl.classList.remove('rules-list-editing');
                if(dom.editRulesBtn) dom.editRulesBtn.textContent = 'Finish Editing';
            }
            dom.ruleSearchInput.value = '';
            state.currentRuleSearchTerm = '';
            handleRenderRules();
        }
    });

    if(dom.punishmentListDiv) {
        dom.punishmentListDiv.addEventListener('click', async (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            e.preventDefault();
            const action = target.dataset.action;
            const id = target.dataset.id;
            if (action !== 'toggle-menu' && action !== 'toggle-stripe-menu') closeMenus();
            const actor = state.isSchikkoSessionActive ? 'Schikko' : 'Guest';
            switch (action) {
                case 'toggle-menu':
                    if (state.isSchikkoSessionActive) {
                        const menu = document.getElementById(`menu-${id}`);
                        if (menu) {
                            closeMenus();
                            const button = e.target.closest('[data-action="toggle-menu"]');
                            const rect = button.getBoundingClientRect();
                            menu.style.position = 'fixed';
                            menu.style.top = `${rect.bottom + window.scrollY}px`;
                            menu.style.right = `${window.innerWidth - rect.right + window.scrollX}px`;
                            menu.style.zIndex = '99999';
                            if (menu.parentNode !== document.body) document.body.appendChild(menu);
                            menu.classList.remove('hidden');
                        }
                    }
                    break;
                case 'toggle-stripe-menu':
                    if (state.isSchikkoSessionActive) {
                        const menu = document.getElementById(`stripe-menu-${id}`);
                        if (menu) {
                            closeMenus();
                            const button = e.target.closest('[data-action="toggle-stripe-menu"]');
                            const rect = button.getBoundingClientRect();
                            menu.style.position = 'fixed';
                            menu.style.top = `${rect.bottom + window.scrollY}px`;
                            menu.style.right = `${window.innerWidth - rect.right + window.scrollX}px`;
                            menu.style.zIndex = '99999';
                            if (menu.parentNode !== document.body) document.body.appendChild(menu);
                            menu.classList.remove('hidden');
                        }
                    }
                    break;
                case 'bulk-stripes':
                    if (await ensureSchikkoSession()) {
                        const person = state.ledgerDataCache.find(p => p.id === id);
                        if (person) {
                            state.currentPersonIdForBulkStripes = id;
                            dom.howManyBulkStripesInput.value = 1;
                            dom.bulkStripesPersonDisplay.textContent = person.name;
                            dom.bulkStripesModal.classList.remove('hidden');
                        }
                    }
                    break;
                case 'add-stripe':
                    if (await ensureSchikkoSession()) {
                        const person = state.ledgerDataCache.find(p => p.id === id);
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
                    if (!state.isSchikkoSessionActive) {
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
                                const countdownString = `Next ${state.appName || 'event'} in: ${days}d ${hours}h ${minutes}m ${seconds}s`;
                                await showAlert(`The consumption of the Golden Liquid is a sacred rite reserved for the ${state.appName || 'event'}.\n${countdownString}`, 'Patience, Young One!');
                                return;
                            }
                        } else {
                            await showAlert(`The date for the next ${state.appName || 'event'} has not been decreed. The Golden Liquid cannot be consumed.`, 'Patience, Young One!');
                            return;
                        }
                    }

                    state.currentPersonIdForDrunkStripes = id;
                    const person = state.ledgerDataCache.find(p => p.id === state.currentPersonIdForDrunkStripes);
                    const availablePenaltiesToFulfill = (person?.stripes?.length || 0) - (person?.drunkStripes?.length || 0);
                    const currentDrunkStripes = person?.drunkStripes?.length || 0;
                    
                    if (state.isSchikkoSessionActive) {
                        dom.howManyBeersInput.value = 1;
                        dom.howManyBeersInput.min = -currentDrunkStripes;
                        dom.howManyBeersInput.max = availablePenaltiesToFulfill;
                        dom.availableStripesDisplay.textContent = `Current: ${currentDrunkStripes}, Available: ${availablePenaltiesToFulfill}`;
                        dom.howManyBeersInput.disabled = false;
                        dom.incrementBeersBtn.disabled = false;
                        dom.decrementBeersBtn.disabled = false;
                        dom.confirmDrunkStripesBtn.disabled = false;
                    } else {
                        dom.howManyBeersInput.value = Math.min(1, availablePenaltiesToFulfill);
                        dom.howManyBeersInput.min = 1;
                        dom.howManyBeersInput.max = availablePenaltiesToFulfill;
                        dom.availableStripesDisplay.textContent = ` Available Stripes: ${availablePenaltiesToFulfill}`;
                        const disabled = availablePenaltiesToFulfill <= 0;
                        dom.howManyBeersInput.disabled = disabled;
                        dom.incrementBeersBtn.disabled = disabled;
                        dom.decrementBeersBtn.disabled = disabled;
                        dom.confirmDrunkStripesBtn.disabled = disabled;
                        if (disabled) dom.availableStripesDisplay.textContent = 'No Stripes available to fulfill!';
                    }

                    dom.drunkStripesModal.classList.remove('hidden'); 
                    break;
                case 'remove-stripe':
                    if (await ensureSchikkoSession()) {
                        const person = state.ledgerDataCache.find(p => p.id === id);
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
                        const person = state.ledgerDataCache.find(p => p.id === id);
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
                     if (await ensureSchikkoSession()) handleRename(id);
                    break;
                case 'delete':
                     if (await ensureSchikkoSession()) handleDeletePerson(id);
                    break;
                case 'set-role':
                    if (await ensureSchikkoSession()) {
                        const role = target.dataset.role || '';
                        const person = state.ledgerDataCache.find(p => p.id === id);
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
                    const personStats = state.ledgerDataCache.find(p => p.id === id);
                    if (personStats) showStatsModal(personStats);
                    break;
            }
        });
    }

    if(dom.editRulesBtn) {
        dom.editRulesBtn.addEventListener('click', async () => {
            if (!dom.rulesListOl.classList.contains('rules-list-editing')) {
                const isConfirmed = await ensureSchikkoSession();
                if (!isConfirmed) return;
            }
            dom.rulesListOl.classList.toggle('rules-list-editing');
            dom.editRulesBtn.textContent = dom.rulesListOl.classList.contains('rules-list-editing') ? 'Finish Editing' : 'Edit Decrees';
            handleRenderRules();
        });
    }

    if(dom.bulkEditBtn) {
        dom.bulkEditBtn.addEventListener('click', async () => {
            if (await ensureSchikkoSession()) showBulkEditRulesModal(true, state.rulesDataCache);
        });
    }

    if(dom.closeBulkEditModalBtn) dom.closeBulkEditModalBtn.addEventListener('click', () => showBulkEditRulesModal(false));
    if(dom.bulkEditCancelBtn) dom.bulkEditCancelBtn.addEventListener('click', () => showBulkEditRulesModal(false));
    if(dom.bulkEditSaveBtn) {
        dom.bulkEditSaveBtn.addEventListener('click', async () => {
            const textarea = document.getElementById('bulk-rules-input');
            if (!textarea) return;
            showLoading('Updating decrees...');
            try {
                await bulkUpdateRules(textarea.value);
                await logActivity('BULK_UPDATE_RULES', 'Schikko', 'Bulk updated decrees.');
                showBulkEditRulesModal(false);
            } catch (e) {
                console.error(e);
                showAlert('Failed to update decrees: ' + e.message, 'Error');
            } finally {
                hideLoading();
            }
        });
    }

    if(dom.rulesListOl) {
        dom.rulesListOl.addEventListener('click', async (e) => {
            const target = e.target.closest('[data-rule-action]');
            if (!target || !dom.rulesListOl.classList.contains('rules-list-editing')) return;
            const action = target.dataset.ruleAction;
            const id = target.dataset.id;
            const ruleIndex = state.rulesDataCache.findIndex(r => r.id === id);
            if (ruleIndex === -1) return;
            const actor = state.isSchikkoSessionActive ? 'Schikko' : 'Guest';
            switch (action) {
                case 'delete':
                    const ruleToDelete = state.rulesDataCache[ruleIndex];
                    showLoading('Deleting decree...');
                    try {
                        await deleteRuleFromFirestore(id);
                        await logActivity('DELETE_RULE', actor, `Deleted decree: "${ruleToDelete.text}"`);
                    } finally { hideLoading(); }
                    break;
                case 'move-up':
                    if (ruleIndex > 0) {
                        showLoading('Reordering...');
                        try {
                            await updateRuleOrderInFirestore(state.rulesDataCache[ruleIndex], state.rulesDataCache[ruleIndex - 1]);
                            await logActivity('MOVE_RULE', actor, `Moved decree up: "${state.rulesDataCache[ruleIndex].text}"`);
                        } finally { hideLoading(); }
                    }
                    break;
                case 'move-down':
                    if (ruleIndex < state.rulesDataCache.length - 1) {
                        showLoading('Reordering...');
                        try {
                            await updateRuleOrderInFirestore(state.rulesDataCache[ruleIndex], state.rulesDataCache[ruleIndex + 1]);
                            await logActivity('MOVE_RULE', actor, `Moved decree down: "${state.rulesDataCache[ruleIndex].text}"`);
                        } finally { hideLoading(); }
                    }
                    break;
                case 'edit': await handleEditRule(id); break;
            }
        });
    }

    document.addEventListener('click', async (e) => {
        if (window.__openingDiceModal) {
            window.__openingDiceModal = false;
            return;
        }

        if (!e.target.closest('[data-action="toggle-menu"]') && !e.target.closest('[id^="menu-"]') &&
            !e.target.closest('[data-action="toggle-stripe-menu"]') && !e.target.closest('[id^="stripe-menu-"]')) {
            closeMenus();
        }
        if (dom.drunkStripesModal && !dom.drunkStripesModal.classList.contains('hidden') && !e.target.closest('#drunk-stripes-modal') && !e.target.closest('[data-action="add-drunk-stripe"]')) {
            dom.drunkStripesModal.classList.add('hidden');
        }
        if (dom.bulkStripesModal && !dom.bulkStripesModal.classList.contains('hidden') && !e.target.closest('#bulk-stripes-modal') && !e.target.closest('[data-action="bulk-stripes"]')) {
            dom.bulkStripesModal.classList.add('hidden');
            state.currentPersonIdForBulkStripes = null;
        }

        // Global dropdown actions handling
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.dataset.action;
        const id = target.dataset.id;
        
        if (!['add-stripe', 'remove-stripe', 'bulk-stripes', 'rename', 'delete', 'set-role'].includes(action)) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        if (action !== 'toggle-menu' && action !== 'toggle-stripe-menu') closeMenus();
        const actor = state.isSchikkoSessionActive ? 'Schikko' : 'Guest';
        
        switch (action) {
            case 'bulk-stripes':
                if (await ensureSchikkoSession()) {
                    const person = state.ledgerDataCache.find(p => p.id === id);
                    if (person) {
                        state.currentPersonIdForBulkStripes = id;
                        dom.howManyBulkStripesInput.value = 1;
                        dom.bulkStripesPersonDisplay.textContent = person.name;
                        dom.bulkStripesModal.classList.remove('hidden');
                    }
                }
                break;
            case 'add-stripe':
                if (await ensureSchikkoSession()) {
                    const person = state.ledgerDataCache.find(p => p.id === id);
                    if (person) {
                        showLoading('Saving stripe...');
                        try {
                            await addStripeToPerson(id);
                            await logActivity('ADD_STRIPE', actor, `Added 1 stripe to ${person.name}.`);
                        } finally { hideLoading(); }
                    }
                }
                break;
            case 'remove-stripe':
                if (await ensureSchikkoSession()) {
                    const person = state.ledgerDataCache.find(p => p.id === id);
                    if (person) {
                        showLoading('Reverting...');
                        try {
                            await removeLastStripeFromPerson(person);
                            await logActivity('REMOVE_STRIPE', actor, `Removed the last stripe from ${person.name}.`);
                        } finally { hideLoading(); }
                    }
                }
                break;
            case 'rename':
                if (await ensureSchikkoSession()) handleRename(id);
                break;
            case 'delete':
                if (await ensureSchikkoSession()) handleDeletePerson(id);
                break;
            case 'set-role':
                if (await ensureSchikkoSession()) {
                    const role = target.dataset.role || '';
                    const person = state.ledgerDataCache.find(p => p.id === id);
                    showLoading('Updating role...');
                    try {
                        await setPersonRole(id, role);
                        if (person) {
                            const actionText = role ? `Set role "${role}" for ${person.name}.` : `Cleared role for ${person.name}.`;
                            await logActivity('SET_ROLE', 'Schikko', actionText);
                        }
                    } finally { hideLoading(); }
                }
                break;
        }
    });

    if(dom.openLogbookBtn) dom.openLogbookBtn.addEventListener('click', () => {
        if (!state.isSchikkoSessionActive) return;
        showLogbookModal(true);
    });
    if(dom.closeLogbookModalBtn) dom.closeLogbookModalBtn.addEventListener('click', () => showLogbookModal(false));
    if(dom.logbookSearchInput) dom.logbookSearchInput.addEventListener('input', () => { state.currentLogbookSearchTerm = dom.logbookSearchInput.value; handleRenderLogbook(); });
    if(dom.logbookFilterSelect) dom.logbookFilterSelect.addEventListener('change', (e) => { state.currentLogbookFilter = e.target.value; handleRenderLogbook(); });
    if(dom.logbookSortSelect) dom.logbookSortSelect.addEventListener('change', (e) => { state.currentLogbookSort = e.target.value; handleRenderLogbook(); });

    if(dom.logbookContentDiv) {
        dom.logbookContentDiv.addEventListener('click', async (e) => {
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
                        } finally { hideLoading(); }
                    }
                }
            }
        });
    }

    if(dom.openRandomizerHubBtn) dom.openRandomizerHubBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.randomizerHubModal.classList.remove('hidden');
    });
    if(dom.closeRandomizerHubModalBtn) dom.closeRandomizerHubModalBtn.addEventListener('click', () => dom.randomizerHubModal.classList.add('hidden'));

    if(dom.randomizerHubModal) {
        dom.randomizerHubModal.addEventListener('click', (e) => {
            const card = e.target.closest('.randomizer-card');
            if (!card) return;
            
            const randomizerType = card.dataset.randomizer;
            dom.randomizerHubModal.classList.add('hidden');
            
            switch (randomizerType) {
                case 'list':
                    dom.listRandomizerModal.classList.remove('hidden');
                    initListRandomizer(state.ledgerDataCache, state.isSchikkoSessionActive, addStripeToPerson, showAlert);
                    break;
                case 'dice':
                    dom.diceRandomizerModal.classList.remove('hidden');
                    try { dom.diceRandomizerModal.style.zIndex = '200000'; } catch (_) {}
                    initDiceRandomizer(state.ledgerDataCache, addStripeToPerson, showAlert, state.isSchikkoSessionActive);
                    break;
                case 'wheel':
                    const wheelModal = document.getElementById('wheel-randomizer-modal');
                    if (wheelModal) wheelModal.classList.remove('hidden');
                    initWheelRandomizer(
                        state.ledgerDataCache, state.isSchikkoSessionActive, addStripeToPerson, showAlert,
                        { logActivity, removeLastStripeFn: removeLastStripeFromPerson, ensureSessionFn: ensureSchikkoSession }
                    );
                    break;
            }
        });
    }

    if(dom.openListRandomizerFromHubBtn) dom.openListRandomizerFromHubBtn.addEventListener('click', () => {
        dom.randomizerHubModal.classList.add('hidden');
        dom.listRandomizerModal.classList.remove('hidden');
        initListRandomizer(state.ledgerDataCache, state.isSchikkoSessionActive, addStripeToPerson, showAlert);
    });

    if(dom.openDiceRandomizerFromHubBtn) dom.openDiceRandomizerFromHubBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.randomizerHubModal.classList.add('hidden');
        dom.diceRandomizerModal.classList.remove('hidden');
        try { dom.diceRandomizerModal.style.zIndex = '200000'; } catch (_) {}
        initDiceRandomizer(state.ledgerDataCache, addStripeToPerson, showAlert, state.isSchikkoSessionActive);
    });

    if(dom.openWheelRandomizerFromHubBtn) dom.openWheelRandomizerFromHubBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.randomizerHubModal.classList.add('hidden');
        const wheelModal = document.getElementById('wheel-randomizer-modal');
        if (wheelModal) wheelModal.classList.remove('hidden');
        initWheelRandomizer(
            state.ledgerDataCache, state.isSchikkoSessionActive, addStripeToPerson, showAlert,
            { logActivity, removeLastStripeFn: removeLastStripeFromPerson, ensureSessionFn: ensureSchikkoSession }
        );
    });

    if(dom.closeDiceRandomizerModalBtn) dom.closeDiceRandomizerModalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.diceRandomizerModal.classList.add('hidden');
    });

    if(dom.closeListRandomizerModalBtn) dom.closeListRandomizerModalBtn.addEventListener('click', () => dom.listRandomizerModal.classList.add('hidden'));

    if(dom.openGeminiFromHubBtn) dom.openGeminiFromHubBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.randomizerHubModal.classList.add('hidden');
        dom.geminiModal.classList.remove('hidden');
        dom.geminiOutput.classList.add('hidden');
        dom.geminiOutput.innerHTML = '';
        dom.geminiInput.value = '';
        dom.geminiActionButtonsContainer.innerHTML = '';
    });

    if(dom.closeGeminiModalBtn) dom.closeGeminiModalBtn.addEventListener('click', () => dom.geminiModal.classList.add('hidden'));
    if(dom.geminiSubmitBtn) dom.geminiSubmitBtn.addEventListener('click', handleGeminiSubmit);

    // Drink Requests UI
    async function loadDrinkRequests() {
        try {
            const resp = await listDrinkRequests();
            const requests = resp?.requests || [];
            if (!dom.drinkRequestsContent) return;
            if (!Array.isArray(requests) || requests.length === 0) {
                dom.drinkRequestsContent.innerHTML = '<p class="text-center text-lg text-[#6f4e37] p-4">No pending drink requests.</p>';
                return;
            }
            dom.drinkRequestsContent.innerHTML = '';
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
                dom.drinkRequestsContent.appendChild(row);
            });
        } catch (e) {
            console.error('Failed to load drink requests:', e);
            if (dom.drinkRequestsContent) dom.drinkRequestsContent.innerHTML = '<p class="text-center text-lg text-[#6f4e37] p-4">Failed to load requests.</p>';
        }
    }

    if(dom.openDrinkRequestsBtn) dom.openDrinkRequestsBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!await ensureSchikkoSession()) return;
        if (dom.drinkRequestsModal) dom.drinkRequestsModal.classList.remove('hidden');
        await loadDrinkRequests();
    });

    if(dom.closeDrinkRequestsModalBtn) dom.closeDrinkRequestsModalBtn.addEventListener('click', () => {
        if (dom.drinkRequestsModal) dom.drinkRequestsModal.classList.add('hidden');
    });

    if(dom.drinkRequestsContent) dom.drinkRequestsContent.addEventListener('click', async (e) => {
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
        } finally { hideLoading(); }
        await loadDrinkRequests();
    });

    if(dom.closeDrunkStripesModalBtn) dom.closeDrunkStripesModalBtn.addEventListener('click', () => dom.drunkStripesModal.classList.add('hidden'));

    if(dom.incrementBeersBtn) dom.incrementBeersBtn.addEventListener('click', () => {
        const currentValue = parseInt(dom.howManyBeersInput.value);
        const maxValue = parseInt(dom.howManyBeersInput.max);
        if (currentValue < maxValue) dom.howManyBeersInput.value = currentValue + 1;
    });

    if(dom.decrementBeersBtn) dom.decrementBeersBtn.addEventListener('click', () => {
        const currentValue = parseInt(dom.howManyBeersInput.value);
        const minValue = parseInt(dom.howManyBeersInput.min);
        if (currentValue > minValue) dom.howManyBeersInput.value = currentValue - 1;
    });

    if(dom.confirmDrunkStripesBtn) dom.confirmDrunkStripesBtn.addEventListener('click', async () => {
        if (!state.currentPersonIdForDrunkStripes) return;

        const count = parseInt(dom.howManyBeersInput.value);
        const person = state.ledgerDataCache.find(p => p.id === state.currentPersonIdForDrunkStripes);
        const availablePenaltiesToFulfill = (person?.stripes?.length || 0) - (person?.drunkStripes?.length || 0);
        const currentDrunkStripes = person?.drunkStripes?.length || 0;

        if (!state.isSchikkoSessionActive) {
            if (count <= 0) {
                await showAlert(`Guests can only add positive amounts of draughts!`, "Invalid Amount");
                return;
            }
            if (count > availablePenaltiesToFulfill) {
                await showAlert(`Cannot consume more stripes than available! You have ${availablePenaltiesToFulfill} stripes remaining.`, "Too Many Draughts");
                return;
            }
        } else {
            if (count > availablePenaltiesToFulfill) {
                await showAlert(`Cannot add more draughts than available stripes! You have ${availablePenaltiesToFulfill} stripes remaining.`, "Too Many Draughts");
                return;
            }
            if (count < -currentDrunkStripes) {
                await showAlert(`Cannot remove more draughts than already consumed! You have ${currentDrunkStripes} draughts recorded.`, "Too Many Removals");
                return;
            }
        }

        if (count !== 0) {
            if (!state.isSchikkoSessionActive && state.requireApprovalForDrinks && count > 0) {
                showLoading('Submitting request...');
                try {
                    await requestDrink(state.currentPersonIdForDrunkStripes, count);
                    await logActivity('DRINK_REQUEST', 'Guest', `Guest requested ${count} draught(s) for ${person?.name || 'someone'}.`);
                    hideLoading();
                    await showAlert('Your drink request was submitted and awaits Schikko approval.', 'Request Submitted');
                } catch (e) {
                    hideLoading();
                    await showAlert(`Failed to submit drink request: ${e?.message || 'Unknown error'}`, 'Request Failed');
                } finally { hideLoading(); }
            } else {
                const actor = state.isSchikkoSessionActive ? 'Schikko' : 'Guest';
                showLoading(count > 0 ? 'Recording draughts...' : 'Removing draughts...');
                try {
                    if (count > 0) {
                        await addDrunkStripeToPerson(state.currentPersonIdForDrunkStripes, count);
                        await logActivity('ADD_DRUNK_STRIPE', actor, `${actor} recorded ${count} consumed draught(s) for ${person?.name || 'someone'}.`);
                    } else {
                        await removeLastDrunkStripeFromPerson(person, Math.abs(count));
                        await logActivity('REMOVE_DRUNK_STRIPE', actor, `${actor} removed ${Math.abs(count)} consumed draught(s) for ${person?.name || 'someone'}.`);
                    }
                } finally { hideLoading(); }
            }
        }

        dom.drunkStripesModal.classList.add('hidden');
        state.currentPersonIdForDrunkStripes = null;
    });

    if(dom.closeBulkStripesModalBtn) dom.closeBulkStripesModalBtn.addEventListener('click', () => {
        dom.bulkStripesModal.classList.add('hidden');
        state.currentPersonIdForBulkStripes = null;
    });

    if(dom.incrementBulkStripesBtn) dom.incrementBulkStripesBtn.addEventListener('click', () => {
        const currentValue = parseInt(dom.howManyBulkStripesInput.value);
        if (currentValue < 50) dom.howManyBulkStripesInput.value = currentValue + 1;
    });

    if(dom.decrementBulkStripesBtn) dom.decrementBulkStripesBtn.addEventListener('click', () => {
        const currentValue = parseInt(dom.howManyBulkStripesInput.value);
        if (currentValue > -50) dom.howManyBulkStripesInput.value = currentValue - 1;
    });

    if(dom.confirmBulkStripesBtn) dom.confirmBulkStripesBtn.addEventListener('click', async () => {
        if (!state.currentPersonIdForBulkStripes) return;
        const count = parseInt(dom.howManyBulkStripesInput.value);
        const person = state.ledgerDataCache.find(p => p.id === state.currentPersonIdForBulkStripes);
        
        if (!person) return;

        if (count !== 0) {
            if (!await ensureSchikkoSession()) return;
            const actor = state.isSchikkoSessionActive ? 'Schikko' : 'Guest';
            showLoading(count > 0 ? 'Adding stripes...' : 'Removing stripes...');
            try {
                if (count > 0) {
                    await addStripeToPerson(state.currentPersonIdForBulkStripes, count);
                    await logActivity('ADD_STRIPE', actor, `Added ${count} stripe${count > 1 ? 's' : ''} to ${person.name}.`);
                } else {
                    for (let i = 0; i < Math.abs(count); i++) {
                        await removeLastStripeFromPerson(person);
                    }
                    await logActivity('REMOVE_STRIPE', actor, `Removed ${Math.abs(count)} stripe${Math.abs(count) > 1 ? 's' : ''} from ${person.name}.`);
                }
            } finally { hideLoading(); }
        }

        dom.bulkStripesModal.classList.add('hidden');
        state.currentPersonIdForBulkStripes = null;
    });

    if(dom.editCalendarBtn) dom.editCalendarBtn.addEventListener('click', async () => {
        if(!await ensureSchikkoSession()) return;
        const config = await getCalendarConfig();
        const newUrl = await showPrompt('Enter the public iCal URL for the calendar:', config.url || '', 'Update Calendar');
        if (newUrl) {
            showLoading('Updating calendar...');
            try {
                await saveCalendarUrl(newUrl);
                await loadCalendarData();
            } finally { hideLoading(); }
        }
    });

    if(dom.editAppDateBtn) dom.editAppDateBtn.addEventListener('click', async () => {
        if (!await ensureSchikkoSession()) return;
        const currentData = await getStripezDate();
        let defaultDate = '';
        if (currentData && currentData.date) {
            const dt = currentData.date.toDate();
            dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
            defaultDate = dt.toISOString().slice(0, 16);
        }
        const userStr = await showPrompt(`Enter the new date/time for the next ${state.appName || 'event'} (YYYY-MM-DDTHH:MM):`, defaultDate, "Reschedule Event");
        if (userStr) {
            const parsed = new Date(userStr);
            if (!isNaN(parsed.getTime())) {
                showLoading('Rescheduling...');
                try {
                    await saveStripezDate(userStr);
                } catch (e) {
                    console.error("Error saving event date:", e);
                    await showAlert("Failed to save the new date.", "Error");
                } finally { hideLoading(); }
            } else {
                await showAlert("Invalid date format. Please use ISO format like 2026-03-14T20:00", "Invalid format");
            }
        }
    });

    if(dom.fullAgendaBtn) dom.fullAgendaBtn.addEventListener('click', () => showAgendaModal(state.calendarEventsCache));
    if(dom.closeAgendaModalBtn) dom.closeAgendaModalBtn.addEventListener('click', () => dom.agendaModal.classList.add('hidden'));

    if(dom.setSchikkoBtn) dom.setSchikkoBtn.addEventListener('click', async () => {
        if (!await ensureSchikkoSession()) return;
        const code = await showSchikkoLoginModal("Enter a SECRET CODE to become the new Schikko. Do not lose this. This will reset the ledger for the new year.");
        if (code) {
            const confirm = await showConfirm("Are you absolutely sure? This will initialize a new schikko term and clean up the current system settings for the year.", "Confirm Ascension");
            if (confirm) {
                showLoading("Establishing term...");
                try {
                    await setSchikko(code);
                } catch (error) {
                    console.error("Error setting Schikko:", error);
                    showAlert("Failed to set Schikko. Make sure the secret code matches requirements.", "Error");
                } finally {
                    hideLoading();
                }
            }
        }
    });

    if(dom.schikkoLoginBtn) dom.schikkoLoginBtn.addEventListener('click', async () => {
        if (state.isSchikkoSessionActive) {
            const confirmed = await showConfirm("Are you sure you want to log out as Schikko? This will end your administrative session.", "Confirm Logout");
            if (confirmed) {
                showLoading('Logging out...');
                localStorage.removeItem('schikkoSessionId');
                state.isSchikkoSessionActive = false;
                import('./auth.js').then(m => m.updateGuestUI());
                import('../main.js').then(m => m.updateAppFooter());
                setTimeout(() => { hideLoading(); showAlert("You have logged out.", "Logout Successful"); }, 300);
            }
        } else {
            await ensureSchikkoSession();
        }
    });
}
