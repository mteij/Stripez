import { state } from './state.js';
import { renderLedger, renderRules, renderLogbookChart, renderLogbook } from '../ui.js';

export function handleRender(animateNewItems = false) {
    let viewData = [...state.ledgerDataCache];
    const term = state.currentSearchTerm.toLowerCase();
    if (term) {
        viewData = viewData.filter(person => person.name.toLowerCase().includes(term));
    }
    
    const currentLength = state.ledgerDataCache.length;
    if (currentLength > state.lastLedgerLength && !state.justAddedName) {
        animateNewItems = true;
        state.justAddedName = true;
        setTimeout(() => { state.justAddedName = false; }, 1000);
    }
    state.lastLedgerLength = currentLength;
    
    viewData.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (term) {
            const aStartsWith = nameA.startsWith(term);
            const bStartsWith = nameB.startsWith(term);
            if (!aStartsWith && bStartsWith) return 1;
        }
        switch (state.currentSortOrder) {
            case 'default': {
                const roleRank = (p) => {
                    const r = (p.role || '').toLowerCase();
                    const appRole = state.appName.toLowerCase();
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

    renderLedger(viewData, term, state.isSchikkoSessionActive, animateNewItems);
}

export function handleRenderRules() {
    let filteredRules = [...state.rulesDataCache];
    const term = state.currentRuleSearchTerm.toLowerCase();

    if (term) {
        filteredRules = filteredRules.filter(rule => rule.text.toLowerCase().includes(term));
    }

    if (state.currentTagFilter !== 'all') {
        filteredRules = filteredRules.filter(rule => (rule.tags || []).includes(state.currentTagFilter));
    }

    renderRules(filteredRules, state.isSchikkoSessionActive);
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
        timestamp: group[group.length - 1].timestamp,
        ids: group.map(log => log.id)
    };
    return [newLog];
}

export function handleRenderLogbook() {
    let filteredData = [...state.logbookDataCache];

    const term = state.currentLogbookSearchTerm.toLowerCase();
    if (term) {
        filteredData = filteredData.filter(log => log.details.toLowerCase().includes(term) || log.actor.toLowerCase().includes(term));
    }

    const categoryFilter = state.currentLogbookFilter;
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

    const personActions = new Set(['ADD_STRIPE', 'REMOVE_STRIPE', 'ADD_DRUNK_STRIPE', 'REMOVE_DRUNK_STRIPE', 'RENAME_PERSON', 'DELETE_PERSON', 'ADD_PERSON', 'ORACLE_JUDGEMENT']);
    const currentNames = new Set(state.ledgerDataCache.map(p => p.name.toLowerCase()));
    
    filteredData = filteredData.filter(log => {
        if (!personActions.has(log.action)) {
            return true;
        }
        const details = log.details.toLowerCase();
        for (const name of currentNames) {
            if (details.includes(name)) {
                return true;
            }
        }
        return false;
    });

    filteredData = filteredData.filter(log => log.id);

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

    renderLogbookChart(groupedData, categoryFilter);

    const listData = [...groupedData].sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return state.currentLogbookSort === 'newest' ? timeB - timeA : timeA - timeB;
    });

    renderLogbook(listData, state.isSchikkoSessionActive);
}
