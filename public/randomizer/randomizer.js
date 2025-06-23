// public/randomizer/randomizer.js - REWRITTEN FOR BOTH LIST AND DICE RANDOMIZERS

// --- Shared Utility Functions ---
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- List Randomizer Logic ---
let shuffleListBtn, pickRandomItemBtn, listOutput; // Removed listOutputHeading
let availableNames = []; // This will hold the names from Firebase

function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function renderListOutput(names, isShuffled = true) {
    if (names.length === 0) {
        listOutput.innerHTML = '<span class="text-red-700">No names available from the ledger.</span>';
        listOutput.classList.remove('hidden'); // Ensure it's visible to show the error
        return;
    }

    let outputHTML = '';
    if (isShuffled) {
        outputHTML = '<h3>Shuffled Names:</h3><ol class="list-output-ol">';
        names.forEach(name => {
            outputHTML += `<li>${name}</li>`;
        });
        outputHTML += '</ol>';
    } else {
        outputHTML = `<h3>Selected Name:</h3><p class="text-xl font-bold">${names[0]}</p>`;
    }
    listOutput.innerHTML = outputHTML;
    listOutput.classList.remove('hidden'); // Show the output div
}

function handleShuffleList() {
    if (availableNames.length === 0) {
        listOutput.innerHTML = '<span class="text-red-700">No names to shuffle. The ledger is empty.</span>';
        listOutput.classList.remove('hidden'); // Ensure it's visible to show the error
        return;
    }
    const shuffledNames = shuffleArray([...availableNames]);
    renderListOutput(shuffledNames, true);
}

function handlePickRandomItem() {
    if (availableNames.length === 0) {
        listOutput.innerHTML = '<span class="text-red-700">No names to pick from. The ledger is empty.</span>';
        listOutput.classList.remove('hidden'); // Ensure it's visible to show the error
        return;
    }
    const randomIndex = rand(0, availableNames.length - 1);
    const selectedName = availableNames[randomIndex];
    renderListOutput([selectedName], false);
}

export function initListRandomizer(ledgerData) {
    shuffleListBtn = document.getElementById('shuffle-list-btn');
    pickRandomItemBtn = document.getElementById('pick-random-item-btn');
    listOutput = document.getElementById('list-output');

    if (!shuffleListBtn || !pickRandomItemBtn || !listOutput) {
        console.error("Name randomizer elements not found! Check IDs in index.html.");
        return;
    }

    availableNames = ledgerData.map(person => person.name);

    // Hide the output initially
    listOutput.classList.add('hidden');
    listOutput.innerHTML = ''; // Clear any previous content

    shuffleListBtn.onclick = handleShuffleList;
    pickRandomItemBtn.onclick = handlePickRandomItem;
}


// --- Dice Randomizer Logic ---
let diceSpinBtn, diceResultsContainer, addDiceBtn, diceListContainer;

// New elements for punishment assignment
let dicePunishmentAssignContainer;
let assignPersonSelect;
let assignStripesBtn;

// New: store functions and data globally within randomizer.js scope.
let _addStripeToPersonFn = null;
let _ledgerData = [];
let _showAlertFn = null;

function renderDiceList() {
    const diceEntries = diceListContainer.querySelectorAll('.flex');
    diceEntries.forEach((entry, index) => {
        entry.querySelector('label').textContent = `Die ${index + 1}:`;
    });
    // Show/hide remove buttons
    const removeBtns = diceListContainer.querySelectorAll('.remove-dice-btn');
    removeBtns.forEach(btn => {
        btn.style.display = diceEntries.length > 1 ? 'flex' : 'none';
    });
}

function handleAddDie() {
    const newDieHtml = `
        <div class="flex items-center gap-2">
            <label class="font-cinzel-decorative text-lg text-[#6f4e37] flex-shrink-0">Die:</label>
            <input type="number" value="6" min="1" max="100" class="dice-max-value-input w-full text-center bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]">
            <button class="remove-dice-btn btn-ancient text-red-300 hover:text-red-100 text-base font-bold w-[44px] h-[44px] flex-shrink-0 flex items-center justify-center rounded-md" title="Remove Die">&times;</button>
        </div>
    `;
    diceListContainer.insertAdjacentHTML('beforeend', newDieHtml);
    renderDiceList();
}

function handleRemoveDie(event) {
    const removeBtn = event.target.closest('.remove-dice-btn');
    if (removeBtn) {
        if (diceListContainer.children.length > 1) {
            removeBtn.closest('.flex').remove();
            renderDiceList();
        } else {
            if (_showAlertFn) _showAlertFn("You must have at least one die.", "Cannot Remove");
        }
    }
}

function handleDiceSpin() {
    const diceInputs = diceListContainer.querySelectorAll('.dice-max-value-input');
    let totalResult = 0;
    const individualResults = [];

    diceInputs.forEach(input => {
        const maxValue = parseInt(input.value);
        if (maxValue > 0) {
            const result = rand(1, maxValue);
            individualResults.push(result);
            totalResult += result;
        }
    });

    diceResultsContainer.innerHTML = ''; // Clear previous result
    
    // Display individual rolls if more than one die is rolled
    if (individualResults.length > 1) {
        const individualRollsText = individualResults.join(' + ');
        const individualDiv = document.createElement("div");
        individualDiv.className = `font-medieval-sharp text-2xl mt-4 text-[#6f4e37]`;
        individualDiv.textContent = `Rolls: ${individualRollsText}`;
        diceResultsContainer.appendChild(individualDiv);
    }
    
    // Display total sum
    let resultDiv = document.createElement("div");
    resultDiv.className = `font-cinzel-decorative text-5xl font-bold mt-2 text-[#5c3d2e]`;
    resultDiv.textContent = totalResult;
    diceResultsContainer.appendChild(resultDiv);

    // Show punishment assignment section
    dicePunishmentAssignContainer.classList.remove('hidden');

    // Populate the select dropdown
    assignPersonSelect.innerHTML = '';
    _ledgerData.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = person.name;
        assignPersonSelect.appendChild(option);
    });

    // Set up the button to assign stripes
    assignStripesBtn.onclick = async () => {
        const selectedPersonId = assignPersonSelect.value;
        const stripesToAdd = totalResult;

        if (selectedPersonId && stripesToAdd > 0) {
            if (_addStripeToPersonFn && _showAlertFn) {
                for (let i = 0; i < stripesToAdd; i++) {
                    await _addStripeToPersonFn(selectedPersonId);
                }
                await _showAlertFn(`${stripesToAdd} stripes assigned to ${assignPersonSelect.options[assignPersonSelect.selectedIndex].text}!`, "Success!");
                
                assignPersonSelect.value = '';
                dicePunishmentAssignContainer.classList.add('hidden');
                diceResultsContainer.innerHTML = '';
                document.getElementById('dice-randomizer-modal').classList.add('hidden');
            } else {
                console.error("addStripeToPerson or showAlert function not available for manual assignment.");
                await _showAlertFn("Error: Cannot assign stripes.", "Error");
            }
        } else {
            await _showAlertFn('Please select a person.', "Missing Information");
        }
    };
}


export function initDiceRandomizer(ledgerData = [], addStripeToPersonFn = null, showAlertFn = null) {
    diceSpinBtn = document.getElementById('dice-spin-btn');
    diceResultsContainer = document.getElementById('dice-roulette-results');
    
    addDiceBtn = document.getElementById('add-dice-btn');
    diceListContainer = document.getElementById('dice-list-container');

    dicePunishmentAssignContainer = document.getElementById('dice-punishment-assign-container');
    assignPersonSelect = document.getElementById('assign-person-select');
    assignStripesBtn = document.getElementById('assign-stripes-btn');

    _ledgerData = ledgerData;
    _addStripeToPersonFn = addStripeToPersonFn;
    _showAlertFn = showAlertFn;

    if (!diceSpinBtn || !diceResultsContainer || !addDiceBtn || !diceListContainer || !dicePunishmentAssignContainer || !assignPersonSelect || !assignStripesBtn) {
        console.error("One or more Dice Randomizer elements are missing from the DOM.");
        return;
    }
    
    // Reset UI state
    diceResultsContainer.innerHTML = '';
    dicePunishmentAssignContainer.classList.add('hidden'); 
    diceSpinBtn.style.display = 'inline-block';
    addDiceBtn.style.display = 'inline-block';

    // Set up event listeners
    diceSpinBtn.onclick = handleDiceSpin;
    addDiceBtn.onclick = handleAddDie;
    diceListContainer.removeEventListener('click', handleRemoveDie); // Remove old listener to prevent duplicates
    diceListContainer.addEventListener('click', handleRemoveDie); // Add fresh listener

    renderDiceList(); // Initial render for button visibility
}

export async function rollDiceAndAssign(diceValues, targetPerson, addStripeFn, ledgerData, showAlertFn) {
    console.warn("rollDiceAndAssign is deprecated. The Oracle will now open the manual dice roller.");
    if (_showAlertFn) {
        await _showAlertFn("The Oracle's judgement requires a dice roll. The manual Dice Roller will now open.", "Oracle Decree");
    }

    const diceRandomizerModal = document.getElementById('dice-randomizer-modal');
    if (diceRandomizerModal) {
        // Initialize the manual roller for the user
        initDiceRandomizer(ledgerData, addStripeFn, showAlertFn);

        // Pre-fill the dice for the user
        const diceListContainer = document.getElementById('dice-list-container');
        if (diceListContainer && Array.isArray(diceValues) && diceValues.length > 0) {
            diceListContainer.innerHTML = ''; // Clear default
            diceValues.forEach(val => {
                const newDieHtml = `
                    <div class="flex items-center gap-2">
                        <label class="font-cinzel-decorative text-lg text-[#6f4e37] flex-shrink-0">Die:</label>
                        <input type="number" value="${val}" min="1" max="100" class="dice-max-value-input w-full text-center bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]">
                        <button class="remove-dice-btn btn-ancient text-red-300 hover:text-red-100 text-base font-bold w-[44px] h-[44px] flex-shrink-0 flex items-center justify-center rounded-md" title="Remove Die">&times;</button>
                    </div>
                `;
                diceListContainer.insertAdjacentHTML('beforeend', newDieHtml);
            });
            renderDiceList();
        }

        diceRandomizerModal.classList.remove('hidden');
    }
}