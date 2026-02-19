// public/js/modules/dom.js

export const dom = {
    loadingState: document.getElementById('loading-state'),
    mainInput: document.getElementById('main-input'),
    addBtn: document.getElementById('add-btn'),
    sortSelect: document.getElementById('sort-select'),
    sortButtonText: document.getElementById('sort-button-text'),
    punishmentListDiv: document.getElementById('punishment-list'),
    closeStatsModalBtn: document.getElementById('close-stats-modal'),
    statsModal: document.getElementById('stats-modal'),
    rulesListOl: document.getElementById('rules-list'),
    editRulesBtn: document.getElementById('edit-rules-btn'),
    bulkEditBtn: document.getElementById('bulk-edit-btn'),
    bulkEditRulesModal: document.getElementById('bulk-edit-rules-modal'),
    closeBulkEditModalBtn: document.getElementById('close-bulk-edit-modal'),
    bulkEditSaveBtn: document.getElementById('bulk-edit-save-btn'),
    bulkEditCancelBtn: document.getElementById('bulk-edit-cancel-btn'),
    addDecreeBtn: document.getElementById('add-decree-btn'),
    showDecreesContainer: document.getElementById('show-decrees-container'),
    decreesContent: document.getElementById('decrees-content'),
    showDecreesBtn: document.getElementById('show-decrees-btn'),
    ruleSearchInput: document.getElementById('rule-search-input'),
    ruleTagFilter: document.getElementById('rule-tag-filter'),
    appInfoFooter: document.getElementById('app-info-footer'),
    ledgerNamesDatalist: document.getElementById('ledger-names'),
    upcomingEventDiv: document.getElementById('upcoming-event'),
    editCalendarBtn: document.getElementById('edit-calendar-btn'),
    fullAgendaBtn: document.getElementById('full-agenda-btn'),
    agendaModal: document.getElementById('agenda-modal'),
    closeAgendaModalBtn: document.getElementById('close-agenda-modal'),
    setSchikkoBtn: document.getElementById('set-schikko-btn'),
    schikkoLoginContainer: document.getElementById('schikko-login-container'),
    schikkoLoginBtn: document.getElementById('schikko-login-btn'),
    editAppDateBtn: document.getElementById('edit-app-date-btn'),

    // TOTP setup modal elements
    totpModal: document.getElementById('totp-setup-modal'),
    closeTotpModalBtn: document.getElementById('close-totp-setup-modal'),
    totpQrEl: document.getElementById('totp-qr'),
    totpSecretEl: document.getElementById('totp-secret'),
    totpManualEl: document.getElementById('totp-manual'),

    // Dice randomizer modal and buttons
    diceRandomizerModal: document.getElementById('dice-randomizer-modal'),
    closeDiceRandomizerModalBtn: document.getElementById('close-dice-randomizer-modal'),

    // List randomizer modal and buttons
    listRandomizerModal: document.getElementById('list-randomizer-modal'),
    closeListRandomizerModalBtn: document.getElementById('close-list-randomizer-modal'),

    // Randomizer Hub elements
    openRandomizerHubBtn: document.getElementById('open-randomizer-hub-btn'),
    randomizerHubModal: document.getElementById('randomizer-hub-modal'),
    closeRandomizerHubModalBtn: document.getElementById('close-randomizer-hub-modal'),
    openListRandomizerFromHubBtn: document.getElementById('open-list-randomizer-from-hub-btn'),
    openDiceRandomizerFromHubBtn: document.getElementById('open-dice-randomizer-from-hub-btn'),
    openWheelRandomizerFromHubBtn: document.getElementById('open-wheel-randomizer-from-hub-btn'),

    // Gemini Oracle elements
    openGeminiFromHubBtn: document.getElementById('open-gemini-from-hub-btn'),
    geminiModal: document.getElementById('gemini-modal'),
    closeGeminiModalBtn: document.getElementById('close-gemini-modal'),
    geminiSubmitBtn: document.getElementById('gemini-submit-btn'),
    geminiInput: document.getElementById('gemini-input'),
    geminiOutput: document.getElementById('gemini-output'),
    geminiActionButtonsContainer: (() => {
        const div = document.createElement('div');
        div.className = 'flex flex-wrap justify-center gap-4 mt-4';
        return div;
    })(),

    // Drunk Stripes Modal Elements
    drunkStripesModal: document.getElementById('drunk-stripes-modal'),
    closeDrunkStripesModalBtn: document.getElementById('close-drunk-stripes-modal'),
    howManyBeersInput: document.getElementById('how-many-beers-input'),
    incrementBeersBtn: document.getElementById('increment-beers-btn'),
    decrementBeersBtn: document.getElementById('decrement-beers-btn'),
    confirmDrunkStripesBtn: document.getElementById('confirm-drunk-stripes-btn'),
    availableStripesDisplay: document.getElementById('available-stripes-display'),

    // Drink Requests admin UI
    openDrinkRequestsBtn: document.getElementById('open-drink-requests-btn'),
    drinkRequestsModal: document.getElementById('drink-requests-modal'),
    closeDrinkRequestsModalBtn: document.getElementById('close-drink-requests-modal'),
    drinkRequestsContent: document.getElementById('drink-requests-content'),

    // Bulk Stripes Modal Elements
    bulkStripesModal: document.getElementById('bulk-stripes-modal'),
    closeBulkStripesModalBtn: document.getElementById('close-bulk-stripes-modal'),
    howManyBulkStripesInput: document.getElementById('how-many-bulk-stripes-input'),
    incrementBulkStripesBtn: document.getElementById('increment-bulk-stripes-btn'),
    decrementBulkStripesBtn: document.getElementById('decrement-bulk-stripes-btn'),
    confirmBulkStripesBtn: document.getElementById('confirm-bulk-stripes-btn'),
    bulkStripesPersonDisplay: document.getElementById('bulk-stripes-person-display'),

    // Logbook elements
    openLogbookBtn: document.getElementById('open-logbook-btn'),
    closeLogbookModalBtn: document.getElementById('close-logbook-modal'),
    logbookSearchInput: document.getElementById('logbook-search-input'),
    logbookFilterSelect: document.getElementById('logbook-filter-select'),
    logbookSortSelect: document.getElementById('logbook-sort-select'),
    logbookContentDiv: document.getElementById('logbook-content')
};
