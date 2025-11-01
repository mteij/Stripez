// public/js/ui.js

let stripeChart = null;
let logbookChart = null;
let nicatCountdownInterval = null;
let nicatConfettiShown = false;
let stripeTotals = { total: 0, drunk: 0 };
let nicatLiveNow = false;
let schikkoLoggedIn = false;

// Launch NICAT confetti once per page load (or per NICAT period)
function launchNicatConfetti() {
    if (typeof window !== 'undefined' && typeof window.confetti === 'function') {
        var count = 200;
        var defaults = {
          origin: { y: 0.7 }
        };
        function fire(particleRatio, opts) {
            window.confetti({
                ...defaults,
                ...opts,
                particleCount: Math.floor(count * particleRatio)
            });
        }
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    }
}

// --- UTILITY FUNCTIONS ---
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

//// Simple HTML escaper to avoid XSS when injecting user-controlled text
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
 
 // --- GLOBAL LOADING OVERLAY HELPERS ---
 function showLoading(message = 'Working...') {
     const overlay = document.getElementById('loading-overlay');
     if (!overlay) return;
     const textEl = document.getElementById('loading-text');
     if (textEl && typeof message === 'string') textEl.textContent = message;
     overlay.classList.remove('hidden');
 }
 
 function hideLoading() {
     const overlay = document.getElementById('loading-overlay');
     if (!overlay) return;
     overlay.classList.add('hidden');
 }
 
 // --- GENERIC MODAL UI FUNCTIONS ---

/**
 * Shows a themed alert modal.
 * @param {string} message - The message to display.
 * @param {string} [title='A Declaration!'] - The title for the modal.
 */
function showAlert(message, title = 'A Declaration!') {
    const modal = document.getElementById('generic-alert-modal');
    const titleEl = document.getElementById('alert-title');
    const messageEl = document.getElementById('alert-message');
    const okBtn = document.getElementById('alert-ok-btn');

    titleEl.textContent = title;
    messageEl.textContent = message;

    modal.classList.remove('hidden');

    // Return a promise that resolves when the user clicks "OK"
    return new Promise(resolve => {
        okBtn.onclick = () => {
            modal.classList.add('hidden');
            resolve();
        };
    });
}


/**
 * Shows a themed confirmation modal.
 * @param {string} message - The confirmation question.
 * @param {string} [title='A Query!'] - The title for the modal.
 * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false otherwise.
 */
function showConfirm(message, title = 'A Query!') {
    const modal = document.getElementById('generic-confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const yesBtn = document.getElementById('confirm-yes-btn');
    const noBtn = document.getElementById('confirm-no-btn');

    titleEl.textContent = title;
    messageEl.textContent = message;

    modal.classList.remove('hidden');

    return new Promise(resolve => {
        yesBtn.onclick = () => {
            modal.classList.add('hidden');
            resolve(true);
        };
        noBtn.onclick = () => {
            modal.classList.add('hidden');
            resolve(false);
        };
    });
}

/**
 * Shows a themed prompt modal.
 * @param {string} message - The message to display in the prompt.
 * @param {string} [defaultValue=''] - The default value for the input field.
 * @param {string} [title='An Inquiry!'] - The title for the modal.
 * @returns {Promise<string|null>} A promise that resolves with the input value, or null if canceled.
 */
function showPrompt(message, defaultValue = '', title = 'An Inquiry!') {
    const modal = document.getElementById('generic-prompt-modal');
    const titleEl = document.getElementById('prompt-title');
    const messageEl = document.getElementById('prompt-message');
    const inputEl = document.getElementById('prompt-input');
    const okBtn = document.getElementById('prompt-ok-btn');
    const cancelBtn = document.getElementById('prompt-cancel-btn');

    titleEl.textContent = title;
    messageEl.textContent = message;
    inputEl.value = defaultValue;

    modal.classList.remove('hidden');
    inputEl.focus();
    inputEl.select();


    return new Promise(resolve => {
        const handleOk = () => {
            modal.classList.add('hidden');
            resolve(inputEl.value);
        };
        
        okBtn.onclick = handleOk;
        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleOk();
            }
        };

        cancelBtn.onclick = () => {
            modal.classList.add('hidden');
            resolve(null);
        };
    });
}


function renderUpcomingEvent(event) {
    const upcomingEventDiv = document.getElementById('upcoming-event');
    if (event) {
        const eventDate = new Date(event.startDate);
        const dateString = eventDate.toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const timeString = eventDate.toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit'
        });
        upcomingEventDiv.innerHTML = `<strong>Next Activity:</strong> ${escapeHTML(event.summary || '')} on ${dateString} at ${timeString}`;
    } else {
        upcomingEventDiv.innerHTML = 'No upcoming activities found.';
    }
}

function renderFullAgenda(events) {
    const agendaContentDiv = document.getElementById('agenda-content');
    agendaContentDiv.innerHTML = '';

    if (!events || events.length === 0) {
        agendaContentDiv.innerHTML = '<p>No upcoming events in the agenda.</p>';
        return;
    }

    events.forEach(event => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'p-3 bg-[#e9e2d7] rounded-md border border-[#b9987e]';
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        const dateString = startDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeString = `${startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;

        eventDiv.innerHTML = `
            <h3 class="text-xl font-bold text-[#5c3d2e]">${escapeHTML(event.summary || '')}</h3>
            <p class="text-md text-[#6f4e37]">${dateString} at ${timeString}</p>
            ${event.location ? `<p class="text-sm text-[#6f4e37]">Location: ${escapeHTML(event.location)}</p>` : ''}
            ${event.description ? `<p class="text-sm mt-2">${escapeHTML(event.description)}</p>` : ''}
        `;
        agendaContentDiv.appendChild(eventDiv);
    });
}

function showAgendaModal(show) {
    const agendaModal = document.getElementById('agenda-modal');
    if (show) {
        agendaModal.classList.remove('hidden');
    } else {
        agendaModal.classList.add('hidden');
    }
}

function showLogbookModal(show) {
    const logbookModal = document.getElementById('logbook-modal');
    if (show) {
        logbookModal.classList.remove('hidden');
    } else {
        logbookModal.classList.add('hidden');
    }
}

function renderLogbook(logData, isSchikko = false) {
    const logContentDiv = document.getElementById('logbook-content');
    if (!logContentDiv) return;
    logContentDiv.innerHTML = '';

    if (!logData || logData.length === 0) {
        logContentDiv.innerHTML = '<p class="text-center text-lg text-[#6f4e37] p-4">No activities match your query.</p>';
        return;
    }

    logData.forEach(log => {
        const logEntryDiv = document.createElement('div');
        logEntryDiv.className = 'flex items-start gap-3 p-3 bg-[#e9e2d7] rounded-md border border-[#b9987e]';

        const iconMap = {
            ADD_STRIPE: '⚖️',
            ADD_DRUNK_STRIPE: '🍺',
            REMOVE_STRIPE: '♻️',
            ADD_PERSON: '👤',
            RENAME_PERSON: '✏️',
            DELETE_PERSON: '🗑️',
            ADD_RULE: '📜',
            EDIT_RULE: '🖋️',
            DELETE_RULE: '🔥',
            MOVE_RULE: '↕️',
            ORACLE_JUDGEMENT: '🔮',
            default: '•',
        };

        let icon = iconMap[log.action] || iconMap.default;
        if(log.action.includes('ORACLE')) icon = iconMap.ORACLE_JUDGEMENT;


        const actorColor = log.actor === 'Schikko' ? 'text-red-700' : 'text-blue-700';

        const timestamp = log.timestamp ? log.timestamp.toDate().toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'}) : 'Just now';

        let deleteButtonHTML = '';
        if (isSchikko) {
            const ids = log.ids || [log.id];
            deleteButtonHTML = `<button data-log-action="delete" data-log-ids="${ids.join(',')}" class="btn-ancient text-red-300 hover:text-red-100 text-base font-bold w-[44px] h-[44px] flex items-center justify-center rounded-md ml-2 flex-shrink-0" title="Delete Log Entry">&times;</button>`;
        }

        logEntryDiv.innerHTML = `
            <div class="text-2xl flex-shrink-0 pt-1">${icon}</div>
            <div class="flex-grow">
                <p class="text-md text-[#4a3024]">${escapeHTML(log.details || '')}</p>
                <p class="text-sm text-[#6f4e37] mt-1">
                    <span class="${actorColor} font-bold">${escapeHTML(log.actor || '')}</span> at ${escapeHTML(timestamp)}
                </p>
            </div>
            ${deleteButtonHTML}
        `;
        logContentDiv.appendChild(logEntryDiv);
    });
}

function renderLogbookChart(logData, filter) {
    const ctx = document.getElementById('logbook-chart')?.getContext('2d');
    if (!ctx) return;

    if (logbookChart) {
        logbookChart.destroy();
    }

    const getActionType = (action) => {
        if (action.includes('STRIPE') || action.includes('ORACLE')) return 'Punishments';
        if (action.includes('RULE')) return 'Decree Changes';
        if (action.includes('PERSON')) return 'Ledger Changes';
        return 'Other';
    };

    const datasets = {};
    const labels = new Set();
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Initialize labels for the last 30 days
    for (let i = 0; i <= 30; i++) {
        const date = new Date(thirtyDaysAgo);
        date.setDate(date.getDate() + i);
        labels.add(date.toISOString().split('T')[0]);
    }

    const sortedLabels = Array.from(labels).sort();

    const actionTypes = {
        'Punishments': { color: 'rgba(192, 57, 43, 0.7)', data: new Array(sortedLabels.length).fill(0) },
        'Decree Changes': { color: 'rgba(44, 62, 80, 0.7)', data: new Array(sortedLabels.length).fill(0) },
        'Ledger Changes': { color: 'rgba(243, 156, 18, 0.7)', data: new Array(sortedLabels.length).fill(0) }
    };

    logData.forEach(log => {
        if (log.timestamp) {
            const dateStr = log.timestamp.toDate().toISOString().split('T')[0];
            const type = getActionType(log.action);
            const index = sortedLabels.indexOf(dateStr);
            if (index !== -1 && actionTypes[type]) {
                actionTypes[type].data[index]++;
            }
        }
    });

    const finalDatasets = [];
    for (const [key, value] of Object.entries(actionTypes)) {
        if (filter === 'all' || filter.toLowerCase().includes(key.split(' ')[0].toLowerCase())) {
             finalDatasets.push({
                label: key,
                data: value.data,
                borderColor: value.color,
                backgroundColor: value.color.replace('0.7', '0.2'),
                fill: true,
                tension: 0.3
            });
        }
    }

    logbookChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedLabels,
            datasets: finalDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Activity Over Last 30 Days' },
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

/**
 * Renders the entire list of transgressors into the DOM.
 * @param {Array} viewData - The sorted and filtered array of person objects to display.
 * @param {string} term - The current search term.
 * @param {boolean} isSchikko - Flag to determine if the user is the Schikko.
 */
function renderLedger(viewData, term, isSchikko) {
    const punishmentListDiv = document.getElementById('punishment-list');
    punishmentListDiv.innerHTML = '';

    if (viewData.length === 0) {
        const message = term ? "No transgressors match your search." : "The ledger is clear. No transgressions recorded.";
        punishmentListDiv.innerHTML = `<div class="text-center text-xl text-[#6f4e37]">${message}</div>`;
        return;
    }

    const containerWidth = punishmentListDiv.clientWidth;
    const safeStripeAreaPercentage = 0.55; 
    const safeStripeAreaWidth = containerWidth * safeStripeAreaPercentage;
    const effectiveStripeWidthPx = 8; 
    const calculatedThreshold = Math.floor(safeStripeAreaWidth / effectiveStripeWidthPx);
    const MIN_THRESHOLD = 15;
    const MAX_THRESHOLD = 40;
    const STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY = Math.max(MIN_THRESHOLD, Math.min(calculatedThreshold, MAX_THRESHOLD));

    viewData.forEach(person => {
        const normalStripesCount = person.stripes?.length || 0;
        const drunkStripesCount = person.drunkStripes?.length || 0;
        
        let stripesContentHtml = '';
        let stripeContainerDynamicClasses = '';
        
        if (normalStripesCount > STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY) {
            stripesContentHtml = `<p class="text-xl text-[#c0392b] font-bold">${normalStripesCount} (Drank: ${drunkStripesCount})</p>`; 
            stripeContainerDynamicClasses += 'justify-start';
        } else {
            const stripesToDisplay = normalStripesCount;
            stripeContainerDynamicClasses += 'overflow-x-auto whitespace-nowrap min-h-[44px] items-center pl-2 pr-2 pt-4';

            for (let i = 0; i < stripesToDisplay; i++) {
                const isCurrentStripeDrunk = i < drunkStripesCount;
                const isFifthInSequence = (i + 1) % 5 === 0;

                let stripeClasses = 'punishment-stripe';
                if (isCurrentStripeDrunk) {
                    stripeClasses += ' punishment-stripe-drunk';
                }

                const applySpecialFormatting = isFifthInSequence;

                if (applySpecialFormatting) {
                    if (isCurrentStripeDrunk) {
                        stripeClasses += ' punishment-stripe-drunk-fifth';
                    } else {
                        stripeClasses += ' punishment-stripe-black';
                    }
                }
                
                const numberHTML = applySpecialFormatting ? `<span class="stripe-number">${i + 1}</span>` : '';
                
                stripesContentHtml += `
                    <div class="stripe-wrapper">
                        <div class="${stripeClasses}"></div>
                        ${numberHTML}
                    </div>`;
            }
        }

        const personDiv = document.createElement('div');
        personDiv.className = 'flex items-center justify-between bg-[#f5eeda] p-4 rounded-lg border-2 border-[#b9987e]';

        let buttonsHTML = `<div class="flex items-center gap-2 flex-shrink-0">`;
        if (isSchikko) {
            buttonsHTML += `<button data-action="add-stripe" data-id="${person.id}" class="btn-ancient text-2xl font-bold w-12 h-12 flex items-center justify-center rounded-md">+</button>`;
        }
        buttonsHTML += `<button data-action="add-drunk-stripe" data-id="${person.id}" class="btn-beer" title="Pour Liquid">
                            <span class="hidden sm:inline">Drink</span><span>🍺</span>
                        </button>`;
        if (isSchikko) {
            buttonsHTML += `<div class="relative">
                    <button data-action="toggle-menu" data-id="${person.id}" class="btn-ancient text-lg font-bold py-2 px-3 rounded-md">&#x22EE;</button>
                    <div id="menu-${person.id}" class="hidden absolute right-0 mt-2 w-56 bg-[#fdf8e9] border-2 border-[#8c6b52] rounded-md shadow-lg z-10">
                        <a href="#" data-action="remove-stripe" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Remove Last Stripe</a>
                        <a href="#" data-action="remove-drunk-stripe" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Revert Drunk Stripe</a>
                        <a href="#" data-action="rename" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Rename</a>
                        <div class="border-t border-[#b9987e] my-1"></div>

                        <!-- Flyout Roles submenu -->
                        <div class="kebab-submenu-item">
                            <div class="kebab-submenu-trigger block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda] flex items-center justify-between">
                                <span>Roles</span>
                                <span class="ml-2 text-[#6f4e37]">›</span>
                            </div>
                            <div class="kebab-submenu hidden absolute left-full top-0 ml-0 w-56 bg-[#fdf8e9] border-2 border-[#8c6b52] rounded-md shadow-lg z-20">
                                <a href="#" data-action="set-role" data-role="Schikko" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Schikko</a>
                                <a href="#" data-action="set-role" data-role="NICAT" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">NICAT</a>
                                <a href="#" data-action="set-role" data-role="Board" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Board</a>
                                <a href="#" data-action="set-role" data-role="Activist" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Activist</a>
                                <a href="#" data-action="set-role" data-role="" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Clear Role</a>
                            </div>
                        </div>

                        <div class="border-t border-[#b9987e] my-1"></div>
                        <a href="#" data-action="delete" data-id="${person.id}" class="block px-4 py-2 text-md text-red-700 hover:bg-[#f5eeda] hover:text-red-800 font-bold">Delete Person</a>
                    </div>
                </div>`;
        }
        buttonsHTML += `</div>`;

        const roleText = person.role ? String(person.role) : '';
        const roleLower = roleText.toLowerCase();
        const roleTagClass = roleLower === 'schikko' ? ' role-tag-schikko' : '';
        const roleTagHtml = roleText ? `<span class="role-tag${roleTagClass}">${escapeHTML(roleText)}</span>` : '';

        personDiv.innerHTML = `
            <div class="flex-grow cursor-pointer" data-action="show-stats" data-id="${person.id}">
                <p class="text-xl md:text-2xl font-bold text-[#5c3d2e] flex items-center gap-2">${escapeHTML(person.name)} ${roleTagHtml}</p>
                <div class="flex items-center min-h-[44px] ${stripeContainerDynamicClasses}">${stripesContentHtml}</div>
            </div>
            ${buttonsHTML}`;
        punishmentListDiv.appendChild(personDiv);
    });
}

/**
 * Renders and displays the statistics modal with a chart for a given person.
 * @param {object} person - The person object for whom to show stats.
 */
function showStatsModal(person) {
    const statsModal = document.getElementById('stats-modal');
    const statsName = document.getElementById('stats-name');
    const stripeChartCanvas = document.getElementById('stripe-chart').getContext('2d');
    const stripeFilterSelect = document.getElementById('stripe-filter-select');
    const remainingStripesDisplay = document.getElementById('remaining-stripes-display');


    statsName.textContent = `Statistics for ${person.name}`;
    if (stripeChart) stripeChart.destroy();

    const normalStripeTimestamps = (person.stripes || []).map(ts => ts.toDate()).sort((a, b) => a - b);
    const drunkStripeTimestamps = (person.drunkStripes || []).map(ts => ts.toDate()).sort((a, b) => a - b);
    
    // Function to update the chart and the display text based on the selected filter
    const updateChart = (filterType) => {
        if (stripeChart) stripeChart.destroy(); // Destroy existing chart before creating a new one

        let dataPoints = [];
        let label = '';
        let borderColor = '';
        let backgroundColor = '';

        // Get the selected option's text for dynamic title
        const selectedOptionText = stripeFilterSelect.options[stripeFilterSelect.selectedIndex].text;

        const THIRTY_MINUTES_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

        let displayValue = 0;
        if (filterType === 'total') {
            displayValue = normalStripeTimestamps.length;
            remainingStripesDisplay.textContent = `Total Stripes: ${displayValue}`;
        } else if (filterType === 'drunk') {
            displayValue = drunkStripeTimestamps.length;
            remainingStripesDisplay.textContent = `Drunk Stripes: ${displayValue}`;
        } else if (filterType === 'left') {
            displayValue = Math.max(0, normalStripeTimestamps.length - drunkStripeTimestamps.length);
            remainingStripesDisplay.textContent = `Stripes Left: ${displayValue}`;
        }


        if (filterType === 'total' || filterType === 'drunk' || filterType === 'left') { 
            let rawTimestamps = [];
            if (filterType === 'total') {
                rawTimestamps = normalStripeTimestamps;
            } else if (filterType === 'drunk') {
                rawTimestamps = drunkStripeTimestamps;
            } else if (filterType === 'left') {
                const allEvents = [
                    ...normalStripeTimestamps.map(ts => ({ type: 'normal', timestamp: ts })),
                    ...drunkStripeTimestamps.map(ts => ({ type: 'drunk', timestamp: ts }))
                ].sort((a, b) => a.timestamp - b.timestamp);

                let currentNormal = 0;
                let currentDrunk = 0;
                let syntheticTimestamps = []; 
                
                if (allEvents.length > 0) {
                    syntheticTimestamps.push({ timestamp: new Date(allEvents[0].timestamp.getTime() - 1000), count: 0 });
                }

                allEvents.forEach(event => {
                    if (event.type === 'normal') {
                        currentNormal++;
                    } else {
                        currentDrunk++;
                    }
                    syntheticTimestamps.push({ timestamp: event.timestamp, count: currentNormal - currentDrunk });
                });
                rawTimestamps = syntheticTimestamps; 
            } else { 
                return;
            }

            if (rawTimestamps.length === 0) {
                stripeChart = new Chart(stripeChartCanvas, {
                    type: 'line', data: { datasets: [] },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { title: { display: true, text: `No ${selectedOptionText} to display.`, font: { size: 16 }, color: '#6f4e37' } }, 
                        scales: { x: { display: false }, y: { display: false } }
                    }
                });
                return;
            }

            let groupedDataPoints = [];

            if (filterType === 'total' || filterType === 'drunk') {
                let cumulative = 0;
                groupedDataPoints.push({ x: new Date(rawTimestamps[0].getTime() - 1000), y: 0 });

                rawTimestamps.forEach(timestamp => {
                    cumulative++;
                    const lastPoint = groupedDataPoints[groupedDataPoints.length - 1];

                    if (timestamp.getTime() - lastPoint.x.getTime() <= THIRTY_MINUTES_MS) {
                        lastPoint.x = timestamp;
                        lastPoint.y = cumulative;
                    } else {
                        groupedDataPoints.push({ x: timestamp, y: cumulative });
                    }
                });
            } else if (filterType === 'left') {
                groupedDataPoints.push({ x: rawTimestamps[0].timestamp, y: rawTimestamps[0].count });

                for (let i = 1; i < rawTimestamps.length; i++) {
                    const currentEvent = rawTimestamps[i];
                    const lastPoint = groupedDataPoints[groupedDataPoints.length - 1];

                    if (currentEvent.timestamp.getTime() - lastPoint.x.getTime() <= THIRTY_MINUTES_MS) {
                        lastPoint.x = currentEvent.timestamp;
                        lastPoint.y = currentEvent.count;
                    } else {
                        groupedDataPoints.push({ x: currentEvent.timestamp, y: currentEvent.count });
                    }
                }
            }

            label = selectedOptionText; 
            borderColor = filterType === 'total' ? 'rgba(96, 108, 129, 1)' : (filterType === 'drunk' ? 'rgba(243, 156, 18, 1)' : 'rgba(192, 57, 43, 1)');
            backgroundColor = filterType === 'total' ? 'rgba(96, 108, 129, 0.2)' : (filterType === 'drunk' ? 'rgba(243, 156, 18, 0.2)' : 'rgba(192, 57, 43, 0.2)');

            dataPoints = groupedDataPoints; 
        }

        const chartData = {
            datasets: [{
                label: label, data: dataPoints,
                borderColor: borderColor, backgroundColor: backgroundColor,
                fill: true, tension: 0.4 // Changed tension to 0.4 for smoothness
            }]
        };

        stripeChart = new Chart(stripeChartCanvas, {
            type: 'line', data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                const date = new Date(tooltipItems[0].parsed.x);
                                return date.toLocaleString(undefined, {
                                    year: 'numeric', month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                });
                            },
                            label: function(tooltipItem) {
                                const value = tooltipItem.parsed.y;
                                return `${label}: ${value}`;
                            }
                        }
                    },
                    // Removed the main chart title when data exists
                },
                scales: {
                    x: {
                        type: 'time',
                        title: { display: true, text: 'Date of Event' }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Count' },
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    };

    // Initial chart render based on current select value
    updateChart(stripeFilterSelect.value);

    // Replace previous listener to avoid stacking them
    stripeFilterSelect.onchange = (e) => {
        updateChart(e.target.value);
    };

    statsModal.classList.remove('hidden');
}

/**
 * Closes all open kebab menus.
 */
function closeMenus() {
    document.querySelectorAll('[id^="menu-"]').forEach(menu => menu.classList.add('hidden'));
}

/**
 * Renders the interactive list of all rules into the DOM.
 * @param {Array} rulesData - The sorted array of all rule objects to display.
 * @param {boolean} isSchikko - Flag to determine if the user is the Schikko.
 */
function renderRules(rulesData, isSchikko) {
    const rulesListOl = document.getElementById('rules-list');
    if (!rulesListOl) return;
    rulesListOl.innerHTML = ''; // Clear existing rules

    const ruleSearchInput = document.getElementById('rule-search-input');
    const hasSearchTerm = ruleSearchInput && ruleSearchInput.value.trim() !== '';

    if (rulesData.length === 0) {
        const li = document.createElement('li');
        li.className = "text-center text-xl text-[#6f4e37] no-roman-numeral";
        li.textContent = hasSearchTerm ? "No Schikko's decrees match your quest." : "The scrolls of Schikko's decrees remain unwritten.";
        rulesListOl.appendChild(li);
        return;
    }

    const isEditing = rulesListOl.classList.contains('rules-list-editing') && isSchikko;

    rulesData.forEach((rule, index) => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-start gap-4';
        
        let buttonsHTML = '<div class="rule-actions items-center gap-2 pl-4 flex-shrink-0">';

        if (isEditing) {
            buttonsHTML += `<button data-rule-action="edit" data-id="${rule.id}" class="btn-ancient text-base font-bold w-[44px] h-[44px] flex items-center justify-center rounded-md" title="Edit Rule">&#x270E;</button>`;

            if (index > 0) {
                buttonsHTML += `<button data-rule-action="move-up" data-id="${rule.id}" class="btn-ancient text-base font-bold w-[44px] h-[44px] flex items-center justify-center rounded-md" title="Move Up">&uarr;</button>`;
            } else {
                buttonsHTML += `<span class="w-[44px] h-[44px]"></span>`;
            }
            
            if (index < rulesData.length - 1) {
                buttonsHTML += `<button data-rule-action="move-down" data-id="${rule.id}" class="btn-ancient text-base font-bold w-[44px] h-[44px] flex items-center justify-center rounded-md" title="Move Down">&darr;</button>`;
            } else {
                buttonsHTML += `<span class="w-[44px] h-[44px]"></span>`;
            }

            buttonsHTML += `<button data-rule-action="delete" data-id="${rule.id}" class="btn-ancient text-red-300 hover:text-red-100 text-base font-bold w-[44px] h-[44px] flex items-center justify-center rounded-md" title="Delete Rule">&times;</button>`;
        }
        buttonsHTML += '</div>';

        let ruleTextContent = escapeHTML(rule.text);
        const colonIndex = rule.text.indexOf(':');
        
        if (colonIndex !== -1) {
            const partBeforeColon = escapeHTML(rule.text.substring(0, colonIndex + 1));
            const partAfterColon = escapeHTML(rule.text.substring(colonIndex + 1));
            ruleTextContent = `${partBeforeColon}<span class="text-red-700">${partAfterColon}</span>`;
        }

        let tagsHTML = '';
        if (rule.tags && rule.tags.length > 0) {
            const numColors = 5;
            tagsHTML += '<div class="rule-tags-container flex-shrink-0 ml-4">';
            // Sort tags alphabetically before rendering
            rule.tags.sort().forEach(tag => {
                const colorClassIndex = hashCode(tag) % numColors + 1;
                tagsHTML += `<span class="rule-tag tag-color-${colorClassIndex}">${escapeHTML(tag)}</span>`;
            });
            tagsHTML += '</div>';
        }

        li.innerHTML = `
            <div class="flex-grow flex justify-between items-center">
                <span>${ruleTextContent}</span>
                ${tagsHTML}
            </div>
            ${buttonsHTML}`;
        rulesListOl.appendChild(li);
    });
}

function renderNicatCountdown(nicatData, isSchikko) {
    const countdownContainer = document.getElementById('nicat-countdown');
    const editBtn = document.getElementById('edit-nicat-btn');
    const titleTextEl = document.getElementById('main-title-text');
    const liveBadgeEl = document.getElementById('nicat-live-badge');
    
    // Track Schikko login state inside UI module so other helpers can adapt
    schikkoLoggedIn = !!isSchikko;

    if (isSchikko) {
        editBtn.classList.remove('hidden');
    } else {
        editBtn.classList.add('hidden');
    }

    if (nicatCountdownInterval) clearInterval(nicatCountdownInterval);

    // If no NICAT date is set, default title to current year and hide LIVE
    if (!nicatData || !nicatData.date) {
        if (titleTextEl) titleTextEl.textContent = `NICAT ${new Date().getFullYear()}`;
        if (liveBadgeEl) liveBadgeEl.classList.add('hidden');
        document.title = `NICAT ${new Date().getFullYear()}`;
        countdownContainer.textContent = 'Date for the next NICAT is not yet decreed.';
        nicatLiveNow = false;
        updateStripeOMeterUI(false);
        return;
    }

    // Treat NICAT as a 3-day period starting on the selected date (local midnight)
    const startDateRaw = nicatData.date.toDate();
    const startDate = new Date(startDateRaw.getFullYear(), startDateRaw.getMonth(), startDateRaw.getDate());
    const NICAT_DURATION_DAYS = 3;
    const endDate = new Date(startDate.getTime() + NICAT_DURATION_DAYS * 24 * 60 * 60 * 1000);

    // Update dynamic title to NICAT {YEAR}
    if (titleTextEl) titleTextEl.textContent = `NICAT ${startDate.getFullYear()}`;

    // Fire confetti immediately on page load if NICAT is currently happening (once per load)
    const nowInitial = Date.now();
    const isLiveNow = nowInitial >= startDate.getTime() && nowInitial < endDate.getTime();
    const baseTitle = `NICAT ${startDate.getFullYear()}`;
    document.title = isLiveNow ? `${baseTitle} • LIVE` : baseTitle;
    if (liveBadgeEl) {
        if (isLiveNow) liveBadgeEl.classList.remove('hidden'); else liveBadgeEl.classList.add('hidden');
    }
    nicatLiveNow = isLiveNow;
    updateStripeOMeterUI(nicatLiveNow);
    if (isLiveNow && !nicatConfettiShown) {
        nicatConfettiShown = true;
        launchNicatConfetti();
    }

    nicatCountdownInterval = setInterval(() => {
        const nowMs = Date.now();

        // Toggle LIVE badge visibility and update page title
        const nowLive = nowMs >= startDate.getTime() && nowMs < endDate.getTime();
        if (liveBadgeEl) {
            if (nowLive) {
                liveBadgeEl.classList.remove('hidden');
            } else {
                liveBadgeEl.classList.add('hidden');
            }
        }
        document.title = nowLive ? `${baseTitle} • LIVE` : baseTitle;
        nicatLiveNow = nowLive;
        updateStripeOMeterUI(nicatLiveNow);

        if (nowMs < startDate.getTime()) {
            // Countdown to NICAT start
            const distance = startDate.getTime() - nowMs;
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            countdownContainer.innerHTML = `<span class="hidden sm:inline">Next NICAT in:</span>
                <span class="font-bold">${days}d</span>
                <span class="font-bold">${hours}h</span>
                <span class="font-bold">${minutes}m</span>
                <span class="font-bold">${seconds}s</span>`;
            return;
        }

        if (nowMs < endDate.getTime()) {
            // NICAT is currently happening — countdown to end
            const distance = endDate.getTime() - nowMs;
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            // Ensure we trigger confetti once when NICAT is in progress
            if (!nicatConfettiShown) {
                nicatConfettiShown = true;
                launchNicatConfetti();
            }

            countdownContainer.innerHTML = `<span class="hidden sm:inline">NICAT in progress — Ends in:</span>
                <span class="font-bold">${days}d</span>
                <span class="font-bold">${hours}h</span>
                <span class="font-bold">${minutes}m</span>
                <span class="font-bold">${seconds}s</span>`;
            return;
        }

        clearInterval(nicatCountdownInterval);
        countdownContainer.textContent = "The NICAT has passed! Awaiting the next decree...";
        if (liveBadgeEl) liveBadgeEl.classList.add('hidden');
        document.title = baseTitle;
        nicatLiveNow = false;
        updateStripeOMeterUI(false);
    }, 1000);
}

/**
 * Shows a themed modal for Schikko login.
 * @returns {Promise<string|null>} A promise that resolves with the password, or null if canceled.
 */
function showSchikkoLoginModal() {
    const modal = document.getElementById('schikko-login-modal');
    const passwordInput = document.getElementById('schikko-password-input');
    const okBtn = document.getElementById('schikko-login-submit-btn');
    const cancelBtn = document.getElementById('schikko-login-cancel-btn');

    passwordInput.value = '';
    modal.classList.remove('hidden');
    passwordInput.focus();

    return new Promise(resolve => {
        const cleanup = () => {
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            passwordInput.onkeydown = null;
        };

        const handleOk = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(passwordInput.value);
        };
        
        okBtn.onclick = handleOk;
        passwordInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleOk();
            }
        };

        cancelBtn.onclick = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(null);
        };
    });
}

/**
 * Shows a themed modal for setting the Schikko.
 * @returns {Promise<string|null>} A promise that resolves with the email, or null if canceled.
 */
function showSetSchikkoModal() {
    const modal = document.getElementById('set-schikko-modal');
    const emailInput = document.getElementById('set-schikko-email-input');
    const okBtn = document.getElementById('set-schikko-submit-btn');
    const cancelBtn = document.getElementById('set-schikko-cancel-btn');

    emailInput.value = '';
    modal.classList.remove('hidden');
    emailInput.focus();

    return new Promise(resolve => {
         const cleanup = () => {
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            emailInput.onkeydown = null;
        };

        const handleOk = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(emailInput.value);
        };
        
        okBtn.onclick = handleOk;
        emailInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleOk();
            }
        };

        cancelBtn.onclick = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(null);
        };
    });
}

function showRuleEditModal(currentText, currentTags = [], allRules = []) {
    const modal = document.getElementById('edit-rule-modal');
    const textInput = document.getElementById('edit-rule-text-input');
    const tagsInput = document.getElementById('edit-rule-tags-input');
    const okBtn = document.getElementById('edit-rule-ok-btn');
    const cancelBtn = document.getElementById('edit-rule-cancel-btn');
    const existingTagsContainer = document.getElementById('existing-tags-container');

    textInput.value = currentText;
    tagsInput.value = (currentTags || []).join(', ');

    const allTags = new Set();
    allRules.forEach(rule => {
        (rule.tags || []).forEach(tag => allTags.add(tag));
    });

    existingTagsContainer.innerHTML = '';
    if (allTags.size > 0) {
        const sortedTags = [...allTags].sort();
        existingTagsContainer.innerHTML = '<p class="text-sm text-left mb-2 text-[#6f4e37]">Click to add existing tag:</p><div class="flex flex-wrap gap-2"></div>';
        const tagsWrapper = existingTagsContainer.querySelector('div');
        
        sortedTags.forEach(tag => {
            const tagEl = document.createElement('span');
            const numColors = 5;
            const colorClassIndex = hashCode(tag) % numColors + 1;
            tagEl.className = `rule-tag tag-color-${colorClassIndex} cursor-pointer`;
            tagEl.textContent = tag;
            tagEl.onclick = () => {
                const currentTagInputValue = tagsInput.value.trim();
                const currentModalTags = currentTagInputValue ? currentTagInputValue.split(',').map(t => t.trim()) : [];
                if (!currentModalTags.includes(tag)) {
                    currentModalTags.push(tag);
                    tagsInput.value = currentModalTags.join(', ');
                }
            };
            tagsWrapper.appendChild(tagEl);
        });
    }

    modal.classList.remove('hidden');
    textInput.focus();

    return new Promise(resolve => {
        const cleanup = () => {
            okBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        okBtn.onclick = () => {
            modal.classList.add('hidden');
            const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
            cleanup();
            resolve({ text: textInput.value, tags: tags });
        };

        cancelBtn.onclick = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(null);
        };
    });
}


function updateStripeOMeterUI(isLive) {
    const meter = document.getElementById('stripe-o-meter');
    const fill = document.getElementById('stripe-meter-fill');
    const leftEl = document.getElementById('stripe-meter-left');
    const countsEl = document.getElementById('stripe-meter-counts');
    const countdownWrap = document.getElementById('nicat-countdown-container');
    const calendarSection = document.getElementById('calendar-section');

    if (!meter) return;

    if (isLive) {
        // Always show the meter when live
        meter.classList.remove('hidden');

        // Only hide countdown and calendar for non‑Schikko users
        const hideForGuests = !schikkoLoggedIn;
        if (countdownWrap) {
            if (hideForGuests) countdownWrap.classList.add('hidden');
            else countdownWrap.classList.remove('hidden');
        }
        if (calendarSection) {
            if (hideForGuests) calendarSection.classList.add('hidden');
            else calendarSection.classList.remove('hidden');
        }

        const total = Math.max(0, stripeTotals.total || 0);
        const drunk = Math.max(0, stripeTotals.drunk || 0);
        const left = Math.max(0, total - drunk);
        const percent = total > 0 ? Math.round((drunk / total) * 100) : 0;

        if (fill) fill.style.width = `${percent}%`;
        if (leftEl) leftEl.textContent = `Stripes left: ${left}`;
        if (countsEl) countsEl.textContent = `Drunk ${drunk} / Total ${total}`;
    } else {
        // When not live, show countdown and calendar for everyone, hide meter
        meter.classList.add('hidden');
        if (countdownWrap) countdownWrap.classList.remove('hidden');
        if (calendarSection) calendarSection.classList.remove('hidden');
    }
}

function setStripeTotals(total, drunk) {
    stripeTotals.total = Math.max(0, Number(total) || 0);
    stripeTotals.drunk = Math.max(0, Number(drunk) || 0);
    // Refresh UI if we're currently live
    updateStripeOMeterUI(nicatLiveNow === true);
}

export { renderLedger, showStatsModal, closeMenus, renderRules, renderUpcomingEvent, renderFullAgenda, showAgendaModal, showAlert, showConfirm, showPrompt, showSchikkoLoginModal, showSetSchikkoModal, showRuleEditModal, renderNicatCountdown, showLogbookModal, renderLogbook, renderLogbookChart, showLoading, hideLoading, setStripeTotals };