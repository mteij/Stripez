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
let diceSpinBtn, diceResultsContainer;
let diceMaxValueSlider, diceSliderValueSpan;

// New elements for punishment assignment
let dicePunishmentAssignContainer;
let assignPersonSelect;
let assignStripesBtn;

// New: store functions and data globally within randomizer.js scope.
let _addStripeToPersonFn = null;
let _ledgerData = [];
let _showAlertFn = null;

function handleDiceSpin() {
    // rand(min, max) is used. The slider's min is now 1, so no adjustment needed here.
    const sliderValue = parseInt(diceMaxValueSlider.value);
    const finalDiceResult = rand(1, sliderValue); // Min value is now 1 based on slider's 'min' attribute

    diceResultsContainer.innerHTML = ''; // Clear previous result
    let resultDiv = document.createElement("div");
    resultDiv.className = `font-cinzel-decorative text-5xl font-bold mt-4 text-[#5c3d2e]`;
    resultDiv.textContent = finalDiceResult;
    diceResultsContainer.appendChild(resultDiv);

    // Show punishment assignment section for manual rolls
    dicePunishmentAssignContainer.classList.remove('hidden');

    // Populate the select dropdown with ledger names for manual rolls
    assignPersonSelect.innerHTML = '';
    _ledgerData.forEach(person => { // Use the stored _ledgerData
        const option = document.createElement('option');
        option.value = person.id; // Store person ID as value
        option.textContent = person.name;
        assignPersonSelect.appendChild(option);
    });

    // Set up the button to assign stripes for manual rolls
    assignStripesBtn.onclick = async () => {
        const selectedPersonId = assignPersonSelect.value;
        const stripesToAdd = finalDiceResult; // Use the rolled value

        if (selectedPersonId && stripesToAdd > 0) {
            if (_addStripeToPersonFn && _showAlertFn) { // Use the stored functions
                for (let i = 0; i < stripesToAdd; i++) {
                    await _addStripeToPersonFn(selectedPersonId);
                }
                await _showAlertFn(`${stripesToAdd} stripes assigned to ${assignPersonSelect.options[assignPersonSelect.selectedIndex].text}!`, "Success!");
                
                // Clear and hide modal elements after assignment
                assignPersonSelect.value = ''; // Reset dropdown
                dicePunishmentAssignContainer.classList.add('hidden'); // Hide for next time
                diceResultsContainer.innerHTML = ''; // Clear dice result
                document.getElementById('dice-randomizer-modal').classList.add('hidden'); // Close the dice modal after assignment
            } else {
                console.error("addStripeToPerson or showAlert function not available for manual assignment.");
                await _showAlertFn("Error: Cannot assign stripes. A required function was not found.", "Error");
            }
        } else {
            await _showAlertFn('Please select a person and ensure a rolled value exists.', "Missing Information");
        }
    };
}


// initDiceRandomizer now accepts showAlertFn
export function initDiceRandomizer(ledgerData = [], addStripeToPersonFn = null, showAlertFn = null) {
    diceSpinBtn = document.getElementById('dice-spin-btn');
    diceResultsContainer = document.getElementById('dice-roulette-results');
    diceMaxValueSlider = document.getElementById('dice-max-value-slider');
    diceSliderValueSpan = document.getElementById('dice-slider-value');

    // New elements for assignment section
    dicePunishmentAssignContainer = document.getElementById('dice-punishment-assign-container');
    assignPersonSelect = document.getElementById('assign-person-select');
    assignStripesBtn = document.getElementById('assign-stripes-btn');

    _ledgerData = ledgerData; // Store ledger data
    _addStripeToPersonFn = addStripeToPersonFn; // Store the function
    _showAlertFn = showAlertFn; // Store the alert function

    if (!diceSpinBtn || !diceResultsContainer || !diceMaxValueSlider || !diceSliderValueSpan || !dicePunishmentAssignContainer || !assignPersonSelect || !assignStripesBtn) {
        console.error("One or more Dice Randomizer elements are missing from the DOM.");
        return;
    }
    
    diceResultsContainer.innerHTML = '';
    dicePunishmentAssignContainer.classList.add('hidden'); 

    diceSpinBtn.onclick = handleDiceSpin;

    // Update slider value display
    diceSliderValueSpan.textContent = diceMaxValueSlider.value;
    diceMaxValueSlider.addEventListener('input', () => {
        diceSliderValueSpan.textContent = diceMaxValueSlider.value;
        dicePunishmentAssignContainer.classList.add('hidden');
    });
}

export async function rollDiceAndAssign(maxValue, targetPerson, addStripeFn, ledgerData, showAlertFn) {
    initDiceRandomizer(ledgerData, addStripeFn, showAlertFn); 

    const diceRandomizerModal = document.getElementById('dice-randomizer-modal');
    if (!diceRandomizerModal) {
        console.error("Dice randomizer modal element not found.");
        return;
    }

    diceMaxValueSlider.value = maxValue;
    diceSliderValueSpan.textContent = maxValue;

    const finalDiceResult = rand(1, maxValue);
    diceResultsContainer.innerHTML = '';
    let resultDiv = document.createElement("div");
    resultDiv.className = `font-cinzel-decorative text-5xl font-bold mt-4 text-[#5c3d2e]`;
    resultDiv.textContent = finalDiceResult;
    diceResultsContainer.appendChild(resultDiv);

    dicePunishmentAssignContainer.classList.remove('hidden');

    assignPersonSelect.innerHTML = '';
    ledgerData.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = person.name;
        if (targetPerson && person.id === targetPerson.id) {
            option.selected = true;
        }
        assignPersonSelect.appendChild(option);
    });

    assignStripesBtn.onclick = async () => {
        const selectedPersonId = assignPersonSelect.value;
        const stripesToAdd = finalDiceResult;

        if (selectedPersonId && stripesToAdd > 0) {
            if (_addStripeToPersonFn && _showAlertFn) {
                for (let i = 0; i < stripesToAdd; i++) {
                    await _addStripeToPersonFn(selectedPersonId);
                }
                await _showAlertFn(`${stripesToAdd} stripes assigned to ${assignPersonSelect.options[assignPersonSelect.selectedIndex].text}!`, "Punishment Dealt!");
                
                assignPersonSelect.value = '';
                dicePunishmentAssignContainer.classList.add('hidden');
                diceResultsContainer.innerHTML = '';
                diceRandomizerModal.classList.add('hidden');
                
            } else {
                console.error("addStripeToPerson or showAlert function not available.");
                await _showAlertFn("Error: Cannot assign stripes. A function is missing.", "Error");
            }
        } else {
             await _showAlertFn('Please select a person to punish.', 'Missing Target');
        }
    };

    diceRandomizerModal.classList.remove('hidden');
}

export function rollSpecificDice(maxValue) {
    console.warn("rollSpecificDice is deprecated. Use rollDiceAndAssign for AI-triggered rolls.");
}