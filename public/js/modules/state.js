// public/js/modules/state.js

export const state = {
    currentUserId: null,
    ledgerDataCache: [],
    rulesDataCache: [], // Full, unfiltered rules data
    logbookDataCache: [],
    calendarEventsCache: [],
    currentSortOrder: 'default',
    currentSearchTerm: '', // For ledger search
    currentRuleSearchTerm: '', // For rules inconsistencies search
    currentTagFilter: 'all', // For tag filtering
    currentLogbookSearchTerm: '',
    currentLogbookFilter: 'all',
    currentLogbookSort: 'newest',
    isSchikkoSessionActive: false, // Secure session state for Schikko
    isSchikkoSetForTheYear: false, // Tracks if a schikko is set for the year

    // App branding/config (from server env)
    appName: '',
    appYear: new Date().getFullYear(),
    hasOracle: false,
    requireApprovalForDrinks: true,

    currentPersonIdForDrunkStripes: null,
    currentPersonIdForBulkStripes: null,

    // Rendering trackers
    lastLedgerLength: 0,
    justAddedName: false
};
