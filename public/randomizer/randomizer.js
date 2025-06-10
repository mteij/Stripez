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
// let rolledStripesDisplay; // Removed as per user request
// let actualRolledValueSpan; // Removed as per user request
let assignStripesBtn;

// New: store addStripeToPerson and ledgerData globally within randomizer.js scope.
let _addStripeToPersonFn = null;
let _ledgerData = [];

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
    // actualRolledValueSpan.textContent = finalDiceResult; // Removed as per user request

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
            if (_addStripeToPersonFn) { // Use the stored addStripeToPersonFn
                for (let i = 0; i < stripesToAdd; i++) {
                    await _addStripeToPersonFn(selectedPersonId);
                }
                alert(`${stripesToAdd} stripes assigned to ${assignPersonSelect.options[assignPersonSelect.selectedIndex].text}!`);
                
                // Clear and hide modal elements after assignment
                assignPersonSelect.value = ''; // Reset dropdown
                dicePunishmentAssignContainer.classList.add('hidden'); // Hide for next time
                diceResultsContainer.innerHTML = ''; // Clear dice result
                document.getElementById('dice-randomizer-modal').classList.add('hidden'); // Close the dice modal after assignment
            } else {
                console.error("addStripeToPerson function not available for manual assignment.");
                alert("Error: Cannot assign stripes. Function not found.");
            }
        } else {
            alert('Please select a person and ensure a rolled value exists.');
        }
    };
}


// initDiceRandomizer now accepts ledgerData and addStripeToPersonFn
export function initDiceRandomizer(ledgerData = [], addStripeToPersonFn = null) {
    diceSpinBtn = document.getElementById('dice-spin-btn');
    diceResultsContainer = document.getElementById('dice-roulette-results');
    diceMaxValueSlider = document.getElementById('dice-max-value-slider');
    diceSliderValueSpan = document.getElementById('dice-slider-value');

    // New elements for assignment section
    dicePunishmentAssignContainer = document.getElementById('dice-punishment-assign-container');
    assignPersonSelect = document.getElementById('assign-person-select');
    // rolledStripesDisplay = document.getElementById('rolled-stripes-display'); // Removed from HTML
    // actualRolledValueSpan = document.getElementById('actual-rolled-value'); // Removed from HTML
    assignStripesBtn = document.getElementById('assign-stripes-btn');

    _ledgerData = ledgerData; // Store ledger data
    _addStripeToPersonFn = addStripeToPersonFn; // Store the function

    // Check if all essential elements are found
    if (!diceSpinBtn) { console.error("Dice randomizer: 'dice-spin-btn' not found!"); return; }
    if (!diceResultsContainer) { console.error("Dice randomizer: 'dice-roulette-results' not found!"); return; }
    if (!diceMaxValueSlider) { console.error("Dice randomizer: 'dice-max-value-slider' not found!"); return; }
    if (!diceSliderValueSpan) { console.error("Dice randomizer: 'dice-slider-value' not found!"); return; }
    if (!dicePunishmentAssignContainer) { console.error("Dice randomizer: 'dice-punishment-assign-container' not found!"); return; }
    if (!assignPersonSelect) { console.error("Dice randomizer: 'assign-person-select' not found!"); return; }
    if (!assignStripesBtn) { console.error("Dice randomizer: 'assign-stripes-btn' not found!"); return; }
    // No longer checking for rolledStripesDisplay and actualRolledValueSpan as they are removed from HTML

    // Clear previous results when initialized (modal opened)
    diceResultsContainer.innerHTML = '';
    // The assignment container should be hidden by default until a roll happens.
    // It will be explicitly shown by handleDiceSpin or rollDiceAndAssign.
    dicePunishmentAssignContainer.classList.add('hidden'); 


    diceSpinBtn.onclick = handleDiceSpin;

    // Update slider value display
    diceSliderValueSpan.textContent = diceMaxValueSlider.value;
    diceMaxValueSlider.addEventListener('input', () => {
        diceSliderValueSpan.textContent = diceMaxValueSlider.value;
        // If slider is changed, hide the assignment section until a new roll
        dicePunishmentAssignContainer.classList.add('hidden');
    });
}

/**
 * Rolls a dice with the given max value, displays the result, and sets up
 * the UI for assigning the rolled stripes to a selected person.
 * This is intended for AI-triggered rolls, and will pre-select the target person.
 * @param {number} maxValue The maximum value for the dice roll.
 * @param {object} targetPerson The person object suggested by the AI to pre-select.
 * @param {function} addStripeFn The function to call to add stripes to a person.
 * @param {Array} ledgerData The full array of people from the ledger.
 */
export function rollDiceAndAssign(maxValue, targetPerson, addStripeFn, ledgerData) {
    // Pass addStripeFn and ledgerData to initDiceRandomizer for internal storage
    initDiceRandomizer(ledgerData, addStripeFn); 

    // After initialization, re-check if the modal element itself is available
    const diceRandomizerModal = document.getElementById('dice-randomizer-modal');
    if (!diceRandomizerModal) {
        console.error("Dice randomizer modal element not found after initialization. Cannot display modal.");
        return;
    }

    // Set slider value and update display
    diceMaxValueSlider.value = maxValue;
    diceSliderValueSpan.textContent = maxValue;

    // Perform the automatic roll
    const finalDiceResult = rand(1, maxValue);
    diceResultsContainer.innerHTML = ''; // Clear previous result
    let resultDiv = document.createElement("div");
    resultDiv.className = `font-cinzel-decorative text-5xl font-bold mt-4 text-[#5c3d2e]`;
    resultDiv.textContent = finalDiceResult;
    diceResultsContainer.appendChild(resultDiv);

    // Show the assignment section
    dicePunishmentAssignContainer.classList.remove('hidden');
    // actualRolledValueSpan.textContent = finalDiceResult; // Removed as per user request

    // Populate the select dropdown with ledger names
    assignPersonSelect.innerHTML = '';
    ledgerData.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id; // Store person ID as value
        option.textContent = person.name;
        if (targetPerson && person.id === targetPerson.id) { // Pre-select the target person from AI judgment
            option.selected = true;
        }
        assignPersonSelect.appendChild(option);
    });

    // Set up the button to assign stripes
    assignStripesBtn.onclick = async () => {
        const selectedPersonId = assignPersonSelect.value;
        const stripesToAdd = finalDiceResult;

        if (selectedPersonId && stripesToAdd > 0) {
            if (_addStripeToPersonFn) { // Use the stored function
                for (let i = 0; i < stripesToAdd; i++) {
                    await _addStripeToPersonFn(selectedPersonId);
                }
                alert(`${stripesToAdd} stripes assigned to ${assignPersonSelect.options[assignPersonSelect.selectedIndex].text}!`);
                
                // Clear current selection and hide assignment section
                assignPersonSelect.value = ''; // Reset dropdown
                dicePunishmentAssignContainer.classList.add('hidden'); // Hide for next time
                diceResultsContainer.innerHTML = ''; // Clear dice result
                diceRandomizerModal.classList.add('hidden'); // Close the dice modal after assignment
            } else {
                console.error("addStripeToPerson function not available for assignment.");
                alert("Error: Cannot assign stripes. Function not found.");
            }
        } else {
            alert('Please select a person and ensure a rolled value exists.');
        }
    };

    // Ensure the dice randomizer modal is open to show the result
    console.log("Attempting to unhide dice randomizer modal from rollDiceAndAssign...");
    diceRandomizerModal.classList.remove('hidden');
    console.log("Modal unhide command sent by rollDiceAndAssign.");
}

// Old rollSpecificDice is deprecated with rollDiceAndAssign
export function rollSpecificDice(maxValue) {
    console.warn("rollSpecificDice is deprecated. Use rollDiceAndAssign for AI-triggered rolls, or rely on manual dice spin for interactive rolling.");
    // This function will now initialize and then trigger the manual spin.
    // It won't pre-fill names as it's not from AI context.
    initDiceRandomizer(window.ledgerDataCache || [], window.addStripeToPersonGlobal); // Pass ledgerDataCache and global addStripeToPerson if available.

    const diceRandomizerModal = document.getElementById('dice-randomizer-modal');
    if (!diceRandomizerModal) {
        console.error("Dice randomizer modal element not found for rollSpecificDice. Cannot display modal.");
        return;
    }
    diceMaxValueSlider.value = maxValue;
    diceSliderValueSpan.textContent = maxValue;
    diceRandomizerModal.classList.remove('hidden');

    // Trigger the manual dice spin logic, which will then show the assignment section
    handleDiceSpin(); 
}