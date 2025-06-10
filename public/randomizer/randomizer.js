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
        console.error("Name randomizer elements not found!");
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
let rolledStripesDisplay;
let actualRolledValueSpan;
let assignStripesBtn;

function handleDiceSpin() {
    // rand(min, max) is used. The slider's min is now 1, so no adjustment needed here.
    const sliderValue = parseInt(diceMaxValueSlider.value);
    const finalDiceResult = rand(1, sliderValue); // Min value is now 1 based on slider's 'min' attribute

    diceResultsContainer.innerHTML = ''; // Clear previous result
    let resultDiv = document.createElement("div");
    resultDiv.className = `font-cinzel-decorative text-5xl font-bold mt-4 text-[#5c3d2e]`;
    resultDiv.textContent = finalDiceResult;
    diceResultsContainer.appendChild(resultDiv);

    // After manual spin, hide punishment assignment section
    dicePunishmentAssignContainer.classList.add('hidden');
}

export function initDiceRandomizer() {
    diceSpinBtn = document.getElementById('dice-spin-btn');
    diceResultsContainer = document.getElementById('dice-roulette-results');
    diceMaxValueSlider = document.getElementById('dice-max-value-slider');
    diceSliderValueSpan = document.getElementById('dice-slider-value');

    // New elements
    dicePunishmentAssignContainer = document.getElementById('dice-punishment-assign-container');
    assignPersonSelect = document.getElementById('assign-person-select');
    rolledStripesDisplay = document.getElementById('rolled-stripes-display');
    actualRolledValueSpan = document.getElementById('actual-rolled-value');
    assignStripesBtn = document.getElementById('assign-stripes-btn');


    if (!diceSpinBtn || !diceResultsContainer || !diceMaxValueSlider || !diceSliderValueSpan ||
        !dicePunishmentAssignContainer || !assignPersonSelect || !rolledStripesDisplay || !actualRolledValueSpan || !assignStripesBtn) {
        console.error("Dice randomizer elements not found!");
        return;
    }

    // Clear previous results when initialized (modal opened)
    diceResultsContainer.innerHTML = '';
    dicePunishmentAssignContainer.classList.add('hidden'); // Ensure hidden on normal open

    diceSpinBtn.onclick = handleDiceSpin;

    // Update slider value display
    diceSliderValueSpan.textContent = diceMaxValueSlider.value;
    diceMaxValueSlider.addEventListener('input', () => {
        diceSliderValueSpan.textContent = diceMaxValueSlider.value;
        // If slider is changed, hide the assignment section until a new roll
        dicePunishmentAssignContainer.classList.add('hidden');
    });
}

// New exported function to roll a specific dice value and set up assignment
export function rollDiceAndAssign(maxValue, targetPerson, addStripeFn, ledgerData) {
    initDiceRandomizer(); // Ensure elements are found and event listeners set up

    // Now, check if elements were successfully found by initDiceRandomizer
    if (!diceMaxValueSlider || !diceResultsContainer || !diceSliderValueSpan ||
        !dicePunishmentAssignContainer || !assignPersonSelect || !rolledStripesDisplay || !actualRolledValueSpan || !assignStripesBtn) {
        console.error("Dice randomizer elements are still not found after initialization. Cannot perform programmatic roll and assignment setup.");
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
    actualRolledValueSpan.textContent = finalDiceResult;

    // Populate the select dropdown with ledger names
    assignPersonSelect.innerHTML = '';
    ledgerData.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id; // Store person ID as value
        option.textContent = person.name;
        if (person.id === targetPerson.id) { // Pre-select the target person from AI judgment
            option.selected = true;
        }
        assignPersonSelect.appendChild(option);
    });

    // Set up the button to assign stripes
    assignStripesBtn.onclick = async () => {
        const selectedPersonId = assignPersonSelect.value;
        const stripesToAdd = finalDiceResult;

        if (selectedPersonId && stripesToAdd > 0) {
            // Call the addStripeToPerson function from main.js (passed as addStripeFn)
            for (let i = 0; i < stripesToAdd; i++) {
                await addStripeFn(selectedPersonId);
            }
            alert(`${stripesToAdd} stripes assigned to ${assignPersonSelect.options[assignPersonSelect.selectedIndex].text}!`);
            // Optionally close the modal or hide the assignment section
            document.getElementById('dice-randomizer-modal').classList.add('hidden');
            dicePunishmentAssignContainer.classList.add('hidden'); // Hide for next time
            diceResultsContainer.innerHTML = ''; // Clear dice result
            // Clear current selection and hide assignment section
            assignPersonSelect.value = '';
        } else {
            alert('Please select a person and ensure a rolled value exists.');
        }
    };

    // Ensure the dice randomizer modal is open to show the result
    const diceRandomizerModal = document.getElementById('dice-randomizer-modal');
    if (diceRandomizerModal) {
        diceRandomizerModal.classList.remove('hidden');
    }
}

// Old rollSpecificDice is no longer needed with rollDiceAndAssign
export function rollSpecificDice(maxValue) {
    console.warn("rollSpecificDice is deprecated. Use rollDiceAndAssign for AI-triggered rolls.");
    initDiceRandomizer();
    if (!diceMaxValueSlider || !diceResultsContainer || !diceSliderValueSpan) {
        console.error("Dice randomizer elements are still not found after initialization. Cannot perform programmatic roll.");
        return;
    }
    diceMaxValueSlider.value = maxValue;
    diceSliderValueSpan.textContent = maxValue;
    const diceRandomizerModal = document.getElementById('dice-randomizer-modal');
    if (diceRandomizerModal) {
        diceRandomizerModal.classList.remove('hidden');
    }
    // Automatically perform the roll for direct calls for backward compatibility if needed
    // In the new flow, rollDiceAndAssign handles the roll
    handleDiceSpin(); 
}