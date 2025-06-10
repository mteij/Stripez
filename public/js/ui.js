// public/js/ui.js

let stripeChart = null;

/**
 * Renders the entire list of transgressors into the DOM.
 * @param {Array} viewData - The sorted and filtered array of person objects to display.
 * @param {string} term - The current search term.
 */
function renderLedger(viewData, term) {
    const punishmentListDiv = document.getElementById('punishment-list');
    punishmentListDiv.innerHTML = '';

    if (viewData.length === 0) {
        const message = term ? "No transgressors match your search." : "The ledger is clear. No transgressions recorded.";
        punishmentListDiv.innerHTML = `<div class="text-center text-xl text-[#6f4e37]">${message}</div>`;
        return;
    }

    // Determine dynamic stripe count threshold based on screen width
    let STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY;
    const screenWidth = window.innerWidth;

    // Approximate pixel width per stripe (5px width + 3px margin-right)
    const effectiveStripeWidthPx = 8; 

    // A more robust way would be to measure the actual available width of the parent container at runtime.
    // For now, let's use a breakpoint-based logic or a more fixed threshold, and ensure layout handles overflow.
    // Let's make it a fixed number that allows for some scrolling.
    
    STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY = 20; // Default to 20 stripes before showing number

    // If screen is very small, we might want to switch earlier.
    if (screenWidth < 400) { // e.g., on very small phone screens
        STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY = 15;
    } else if (screenWidth < 640) { // sm breakpoint
        STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY = 20;
    } else { // Larger screens, can show more stripes
        STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY = 30; // Allows for more stripes on wider screens
    }


    viewData.forEach(person => {
        const normalStripesCount = person.stripes?.length || 0;
        const drunkStripesCount = person.drunkStripes?.length || 0; // Changed to 'drunkStripes'
        
        let stripesContentHtml = ''; // Will hold either individual stripe divs or the number string
        let stripeContainerDynamicClasses = ''; // Classes for the div wrapping stripes/number
        
        // Decide whether to show individual stripes or a number
        if (normalStripesCount > STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY) {
            // Display total count as a number if it exceeds the threshold
            stripesContentHtml = `<p class="text-xl text-[#c0392b] font-bold">${normalStripesCount} (Drunk: ${drunkStripesCount})</p>`; 
            stripeContainerDynamicClasses += 'justify-start'; // Left-align the number
        } else {
            // Display individual stripes, allowing horizontal scroll if needed
            const stripesToDisplay = normalStripesCount; 

            for (let i = 0; i < stripesToDisplay; i++) {
                const isCurrentStripeDrunk = i < drunkStripesCount;
                const isFifthInSequence = (i + 1) % 5 === 0;
                const isLastStripeOverall = (i + 1) === normalStripesCount;

                if (isCurrentStripeDrunk) {
                    if (isFifthInSequence && !isLastStripeOverall) {
                        stripesContentHtml += `<div class="punishment-stripe punishment-stripe-drunk punishment-stripe-drunk-fifth"></div>`;
                    } else {
                        stripesContentHtml += `<div class="punishment-stripe punishment-stripe-drunk"></div>`;
                    }
                } else { // This stripe is normal (un-drunk)
                    if (isFifthInSequence && !isLastStripeOverall) {
                        stripesContentHtml += `<div class="punishment-stripe punishment-stripe-black"></div>`;
                    } else {
                        stripesContentHtml += `<div class="punishment-stripe"></div>`;
                    }
                }
            }
            // Add classes for horizontal scrolling, nowrap, min-height, items-start, and padding-left/right
            stripeContainerDynamicClasses += 'overflow-x-auto whitespace-nowrap min-h-[32px] items-start pl-2 pr-2';
        }

        const personDiv = document.createElement('div');
        // Use flex-wrap on the main personDiv to allow name/stripes and buttons to stack
        personDiv.className = 'flex flex-wrap items-center justify-between bg-[#f5eeda] p-4 rounded-lg border-2 border-[#b9987e]';
        personDiv.innerHTML = `
            <div class="flex-grow w-full md:w-auto cursor-pointer" data-action="show-stats" data-id="${person.id}">
                <p class="text-xl md:text-2xl font-bold text-[#5c3d2e]">${person.name}</p>
                <div class="mt-2 flex items-center min-h-[32px] ${stripeContainerDynamicClasses}">${stripesContentHtml}</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0 mt-2 md:mt-0">
                <button data-action="add-stripe" data-id="${person.id}" class="btn-ancient text-sm sm:text-base font-bold py-2 px-4 rounded-md">Add Stripe</button>
                <button data-action="add-drunk-stripe" data-id="${person.id}" class="btn-square-beer-button" title="Pour Liquid">🍺</button>
                <div class="relative">
                    <button data-action="toggle-menu" data-id="${person.id}" class="btn-ancient text-lg font-bold py-2 px-3 rounded-md">&#x22EE;</button>
                    <div id="menu-${person.id}" class="hidden absolute right-0 mt-2 w-52 bg-[#fdf8e9] border-2 border-[#8c6b52] rounded-md shadow-lg z-10">
                        <a href="#" data-action="remove-stripe" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Remove Last Stripe</a>
                        <a href="#" data-action="remove-drunk-stripe" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Revert Drunk Stripe</a>
                        <a href="#" data-action="rename" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Rename</a>
                        <div class="border-t border-[#b9987e] my-1"></div>
                        <a href="#" data-action="delete" data-id="${person.id}" class="block px-4 py-2 text-md text-red-700 hover:bg-[#f5eeda] hover:text-red-800 font-bold">Delete Person</a>
                    </div>
                </div>
            </div>`;
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
    const stripeFilterSelect = document.getElementById('stripe-filter-select'); // Get the new select element
    const remainingStripesDisplay = document.getElementById('remaining-stripes-display'); // New element


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

        let displayValue = 0; // Initialize display value for the text
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

    // Attach event listeners to filter dropdown
    stripeFilterSelect.addEventListener('change', (e) => {
        updateChart(e.target.value);
    });

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
 */
function renderRules(rulesData) {
    const rulesListOl = document.getElementById('rules-list');
    if (!rulesListOl) return;
    rulesListOl.innerHTML = ''; // Clear existing rules

    // Get the current rule search term from main.js to check if a search is active
    const ruleSearchInput = document.getElementById('rule-search-input');
    const hasSearchTerm = ruleSearchInput && ruleSearchInput.value.trim() !== '';

    if (rulesData.length === 0) {
        const li = document.createElement('li');
        li.className = "text-center text-xl text-[#6f4e37] no-roman-numeral"; // Add a class to remove roman numeral
        // Use a different message based on whether a search term is present
        li.textContent = hasSearchTerm ? "No Schikko's decrees match your quest." : "The scrolls of Schikko's decrees remain unwritten.";
        rulesListOl.appendChild(li);
        return;
    }

    const isEditing = rulesListOl.classList.contains('rules-list-editing');

    rulesData.forEach((rule, index) => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center';
        
        let buttonsHTML = '<div class="rule-actions items-center gap-2 pl-4">';

        if (isEditing) { // Only show these buttons in edit mode
            buttonsHTML += `<button data-rule-action="edit" data-id="${rule.id}" class="btn-ancient text-base font-bold w-[44px] h-[44px] flex items-center justify-center rounded-md" title="Edit Rule">&#x270E;</button>`; // Edit icon

            // Don't show "up" arrow for the first item
            if (index > 0) {
                buttonsHTML += `<button data-rule-action="move-up" data-id="${rule.id}" class="btn-ancient text-base font-bold w-[44px] h-[44px] flex items-center justify-center rounded-md" title="Move Up">&uarr;</button>`;
            } else {
                buttonsHTML += `<span class="w-[44px] h-[44px]"></span>`; // Placeholder for alignment
            }
            
            // Don't show "down" arrow for the last item
            if (index < rulesData.length - 1) {
                buttonsHTML += `<button data-rule-action="move-down" data-id="${rule.id}" class="btn-ancient text-base font-bold w-[44px] h-[44px] flex items-center justify-center rounded-md" title="Move Down">&darr;</button>`;
            } else {
                buttonsHTML += `<span class="w-[44px] h-[44px]"></span>`; // Placeholder for alignment
            }

            buttonsHTML += `<button data-rule-action="delete" data-id="${rule.id}" class="btn-ancient text-red-300 hover:text-red-100 text-base font-bold w-[44px] h-[44px] flex items-center justify-center rounded-md" title="Delete Rule">&times;</button>`;
        }
        buttonsHTML += '</div>'; // Close rule-actions div

        let ruleTextContent = rule.text;
        const colonIndex = rule.text.indexOf(':');

        if (colonIndex !== -1) {
            const partBeforeColon = rule.text.substring(0, colonIndex + 1); // Include the colon
            const partAfterColon = rule.text.substring(colonIndex + 1);
            ruleTextContent = `${partBeforeColon}<span class="text-red-700">${partAfterColon}</span>`;
        }

        li.innerHTML = `<span>${ruleTextContent}</span> ${buttonsHTML}`;
        rulesListOl.appendChild(li);
    });
}

export { renderLedger, showStatsModal, closeMenus, renderRules };