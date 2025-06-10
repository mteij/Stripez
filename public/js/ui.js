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
        const drunkStripesCount = person.drunkenStripes?.length || 0; // Renamed variable and property access
        
        let stripesContentHtml = ''; // Will hold either individual stripe divs or the number string
        let stripeContainerDynamicClasses = ''; // Classes for the div wrapping stripes/number
        
        // Decide whether to show individual stripes or a number
        if (normalStripesCount > STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY) {
            // Display total count as a number if it exceeds the threshold
            stripesContentHtml = `<p class="text-xl text-[#c0392b] font-bold">${normalStripesCount} (Drunk: ${drunkStripesCount})</p>`; // Renamed text
            stripeContainerDynamicClasses += 'justify-start'; // Left-align the number
        } else {
            // Display individual stripes, allowing horizontal scroll if needed
            const stripesToDisplay = normalStripesCount; // All existing stripes (red + drunk)

            for (let i = 0; i < stripesToDisplay; i++) {
                if (i < drunkStripesCount) { // This stripe is drunk (Renamed variable)
                    stripesContentHtml += `<div class="punishment-stripe punishment-stripe-drunk"></div>`;
                } else { // This stripe is normal (un-drunk)
                    const isFifthStripe = (i + 1) % 5 === 0;
                    
                    // Apply black stripe if it's a 5th undrunken stripe
                    if (isFifthStripe) {
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
                <button data-action="add-drunken-stripe" data-id="${person.id}" class="btn-square-beer-button" title="Pour Liquid">🍺</button>
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
    const drunkStripeTimestamps = (person.drunkenStripes || []).map(ts => ts.toDate()).sort((a, b) => a - b); // Renamed variable and property access
    const remainingCount = normalStripeTimestamps.length - drunkStripeTimestamps.length; // Renamed variable
    remainingStripesDisplay.textContent = `Remaining Penalties: ${Math.max(0, remainingCount)}`; // Always show remaining


    // Function to update the chart based on the selected filter
    const updateChart = (filterType) => {
        if (stripeChart) stripeChart.destroy(); // Destroy existing chart before creating a new one

        let dataPoints = [];
        let label = '';
        let borderColor = '';
        let backgroundColor = '';

        if (filterType === 'total' || filterType === 'normal' || filterType === 'drunk') { // Renamed 'drunken' to 'drunk'
            let timestamps = [];
            if (filterType === 'total') {
                timestamps = [...normalStripeTimestamps, ...drunkStripeTimestamps].sort((a, b) => a - b); // Renamed variable
            } else if (filterType === 'normal') {
                timestamps = normalStripeTimestamps;
            } else if (filterType === 'drunk') { // Renamed 'drunken' to 'drunk'
                timestamps = drunkStripeTimestamps; // Renamed variable
            }

            if (timestamps.length === 0) {
                stripeChart = new Chart(stripeChartCanvas, {
                    type: 'line', data: { datasets: [] },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { title: { display: true, text: `No ${filterType === 'normal' ? 'penalties given' : (filterType === 'drunk' ? 'penalties fulfilled (drunk)' : 'events')} for this transgressor.`, font: { size: 16 }, color: '#6f4e37' } }, // Renamed text
                        scales: { x: { display: false }, y: { display: false } }
                    }
                });
                return;
            }

            label = filterType === 'total' ? 'Total Stripes' : (filterType === 'normal' ? 'Penalties Given (Red Stripes)' : 'Penalties Fulfilled (Drunk Stripes)'); // Renamed text
            borderColor = filterType === 'total' ? 'rgba(96, 108, 129, 1)' : (filterType === 'normal' ? 'rgba(192, 57, 43, 1)' : 'rgba(243, 156, 18, 1)');
            backgroundColor = filterType === 'total' ? 'rgba(96, 108, 129, 0.2)' : (filterType === 'normal' ? 'rgba(192, 57, 43, 0.2)' : 'rgba(243, 156, 18, 0.2)');

            dataPoints = [];
            let cumulativeCount = 0;
            // Add a starting point at the first event time, with 0 count, for visual clarity
            if (timestamps.length > 0) {
                dataPoints.push({ x: timestamps[0], y: 0 });
            }

            timestamps.forEach(timestamp => {
                cumulativeCount++;
                dataPoints.push({ x: timestamp, y: cumulativeCount });
            });
            
            // To ensure the line extends to the last point even if it's the only one
            if (timestamps.length > 0 && dataPoints[dataPoints.length - 1]?.x !== timestamps[timestamps.length - 1]) {
                dataPoints.push({ x: timestamps[timestamps.length - 1], y: cumulativeCount });
            }

        } else if (filterType === 'remaining') { // This block is now effectively removed as an option
            const currentRemainingCount = normalStripeTimestamps.length - drunkStripeTimestamps.length; // Renamed variable
            // This case is primarily for display, not a time series chart
            stripeChart = new Chart(stripeChartCanvas, {
                type: 'line', data: { datasets: [] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { title: { display: true, text: `Current Penalties Remaining: ${Math.max(0, currentRemainingCount)}. This is not a time series graph.`, font: { size: 16 }, color: '#6f4e37' } }, // Renamed text
                    scales: { x: { display: false }, y: { display: false } }
                }
            });
            return;
        }

        const chartData = {
            datasets: [{
                label: label, data: dataPoints,
                borderColor: borderColor, backgroundColor: backgroundColor,
                fill: true, tension: 0.0 // Changed tension to 0.0 for less smoothness
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
                    }
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