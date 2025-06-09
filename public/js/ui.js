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
    // This is a rough estimation; fine-tuning might be needed on various devices.
    let STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY;
    const screenWidth = window.innerWidth;

    // Define approximate pixel width per stripe (including margin and skew effects)
    const effectiveStripeWidthPx = 8; // 5px width + 3px margin. Skew is handled by container height.

    // Calculate available width for stripes (approximate based on max-w-4xl and sidebar buttons)
    // Assuming the main content area is ~896px max-w, and the stripe container is flex-grow.
    // It's part of a flex row with buttons on the right, so it's not the full 896px.
    // Let's estimate it's roughly 60% of the max width, or 80% of current screen width if smaller.
    const availableContainerWidth = Math.min(896 * 0.6, screenWidth * 0.8);

    STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY = Math.floor(availableContainerWidth / effectiveStripeWidthPx);

    // Ensure a minimum threshold, e.g., display at least 5-10 individual stripes even on tiny screens
    if (STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY < 10) {
        STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY = 10;
    }


    viewData.forEach(person => {
        const stripeCount = person.stripes?.length || 0;
        let stripesContent = ''; // Will hold either individual stripe divs or a number
        let stripeContainerClasses = 'mt-2 flex items-center '; // Common classes
        
        if (stripeCount > STRIPE_COUNT_THRESHOLD_FOR_NUMBER_DISPLAY) {
            // Display total count as a number if it exceeds the threshold
            // No 'w-full' or 'text-center' on the p tag, it's handled by the parent container's justify-start
            stripesContent = `<p class="text-xl text-[#c0392b] font-bold">${stripeCount}</p>`;
            // Align number to start of the flex container (left)
            stripeContainerClasses += 'h-auto justify-start';
        } else {
            // Display individual stripes, allowing horizontal scroll if needed
            for (let i = 0; i < stripeCount; i++) {
                const isFifthStripe = (i + 1) % 5 === 0;
                const isLastStripe = (i + 1) === stripeCount;

                // Apply 'punishment-stripe-black' only if it's the 5th stripe AND NOT the very last stripe overall
                if (isFifthStripe && !isLastStripe) {
                    stripesContent += `<div class="punishment-stripe punishment-stripe-black"></div>`;
                } else {
                    stripesContent += `<div class="punishment-stripe"></div>`;
                }
            }
            // Add classes for horizontal scrolling, nowrap, min-height, items-start, and padding-left
            stripeContainerClasses += 'overflow-x-auto whitespace-nowrap min-h-[32px] items-start pl-2';
        }

        const personDiv = document.createElement('div');
        personDiv.className = 'flex items-center justify-between bg-[#f5eeda] p-4 rounded-lg border-2 border-[#b9987e]';
        personDiv.innerHTML = `
            <div class="flex-grow cursor-pointer" data-action="show-stats" data-id="${person.id}">
                <p class="text-xl md:text-2xl font-bold text-[#5c3d2e]">${person.name}</p>
                <div class="${stripeContainerClasses}">${stripesContent}</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <button data-action="add-stripe" data-id="${person.id}" class="btn-ancient text-sm sm:text-base font-bold py-2 px-4 rounded-md">Add Stripe</button>
                <div class="relative">
                    <button data-action="toggle-menu" data-id="${person.id}" class="btn-ancient text-lg font-bold py-2 px-3 rounded-md">&#x22EE;</button>
                    <div id="menu-${person.id}" class="hidden absolute right-0 mt-2 w-52 bg-[#fdf8e9] border-2 border-[#8c6b52] rounded-md shadow-lg z-10">
                        <a href="#" data-action="remove-stripe" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Remove Last Stripe</a>
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

    statsName.textContent = `Statistics for ${person.name}`;
    if (stripeChart) stripeChart.destroy();

    const stripeTimestamps = (person.stripes || []).map(ts => ts.toDate()).sort((a, b) => a - b);

    if (stripeTimestamps.length === 0) {
        stripeChart = new Chart(stripeChartCanvas, {
            type: 'line', data: { datasets: [] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'No stripes have been recorded for this transgressor.', font: { size: 16 }, color: '#6f4e37' } },
                scales: { x: { display: false }, y: { display: false } }
            }
        });
        statsModal.classList.remove('hidden');
        return;
    }

    const TIME_WINDOW_MS = 5000;
    const graphPoints = [];
    graphPoints.push({ x: stripeTimestamps[0], y: 0 });
    let lastTimestamp = stripeTimestamps[0];
    let cumulativeCount = 1;
    for (let i = 1; i < stripeTimestamps.length; i++) {
        const currentTimestamp = stripeTimestamps[i];
        if (currentTimestamp.getTime() - lastTimestamp.getTime() > TIME_WINDOW_MS) {
            graphPoints.push({ x: lastTimestamp, y: cumulativeCount });
        }
        cumulativeCount++;
        lastTimestamp = currentTimestamp;
    }
    graphPoints.push({ x: lastTimestamp, y: cumulativeCount });

    const chartData = {
        datasets: [{
            label: 'Total Stripes Over Time', data: graphPoints,
            borderColor: 'rgba(192, 57, 43, 1)', backgroundColor: 'rgba(192, 57, 43, 0.2)',
            fill: true, tension: 0.4
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
                            return `Total Stripes: ${value}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    title: { display: true, text: 'Date of Transgression' }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Total Stripes' },
                    ticks: { stepSize: 1 }
                }
            }
        }
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

    if (rulesData.length === 0) {
        const li = document.createElement('li');
        li.className = "text-center text-xl text-[#6f4e37]";
        li.textContent = "No lesser decrees have been recorded.";
        li.style.listStyle = 'none'; // Prevents roman numeral from showing on this message
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