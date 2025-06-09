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

    viewData.forEach(person => {
        const stripeCount = person.stripes?.length || 0;
        let stripesHTML = '';
        for (let i = 0; i < stripeCount; i++) {
            stripesHTML += `<div class="punishment-stripe"></div>`;
        }

        const personDiv = document.createElement('div');
        personDiv.className = 'flex items-center justify-between bg-[#f5eeda] p-4 rounded-lg border-2 border-[#b9987e]';
        personDiv.innerHTML = `
            <div class="flex-grow cursor-pointer" data-action="show-stats" data-id="${person.id}">
                <p class="text-xl md:text-2xl font-bold text-[#5c3d2e]">${person.name}</p>
                <div class="mt-2 h-5">${stripesHTML}</div>
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
            scales: {
                x: { type: 'time', time: { tooltipFormat: 'DD T' }, title: { display: true, text: 'Date of Transgression' } },
                y: { beginAtZero: true, title: { display: true, text: 'Total Stripes' }, ticks: { stepSize: 1 } }
            },
            responsive: true, maintainAspectRatio: false
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

export { renderLedger, showStatsModal, closeMenus };