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

function handleDiceSpin() {
    // rand(min, max) is used. The slider's min is now 1, so no adjustment needed here.
    const sliderValue = parseInt(diceMaxValueSlider.value);
    const finalDiceResult = rand(1, sliderValue); // Min value is now 1 based on slider's 'min' attribute

    diceResultsContainer.innerHTML = ''; // Clear previous result
    let resultDiv = document.createElement("div");
    resultDiv.className = `font-cinzel-decorative text-5xl font-bold mt-4 text-[#5c3d2e]`;
    resultDiv.textContent = finalDiceResult;
    diceResultsContainer.appendChild(resultDiv);
}

export function initDiceRandomizer() {
    diceSpinBtn = document.getElementById('dice-spin-btn');
    diceResultsContainer = document.getElementById('dice-roulette-results');
    diceMaxValueSlider = document.getElementById('dice-max-value-slider');
    diceSliderValueSpan = document.getElementById('dice-slider-value');

    if (!diceSpinBtn || !diceResultsContainer || !diceMaxValueSlider || !diceSliderValueSpan) {
        console.error("Dice randomizer elements not found!");
        return;
    }

    // Clear previous results when initialized (modal opened)
    diceResultsContainer.innerHTML = '';

    diceSpinBtn.onclick = handleDiceSpin;

    // Update slider value display
    diceSliderValueSpan.textContent = diceMaxValueSlider.value;
    diceMaxValueSlider.addEventListener('input', () => {
        diceSliderValueSpan.textContent = diceMaxValueSlider.value;
    });
}

// New exported function to roll a specific dice value
export function rollSpecificDice(maxValue) {
    // Always call init to ensure elements are found and event listeners set up
    initDiceRandomizer();

    // Now, check if elements were successfully found by initDiceRandomizer
    if (!diceMaxValueSlider || !diceResultsContainer || !diceSliderValueSpan) {
        console.error("Dice randomizer elements are still not found after initialization. Cannot perform programmatic roll.");
        return;
    }

    // Set slider value and update display
    diceMaxValueSlider.value = maxValue;
    diceSliderValueSpan.textContent = maxValue;

    // Ensure the dice randomizer modal is open to show the result
    const diceRandomizerModal = document.getElementById('dice-randomizer-modal');
    if (diceRandomizerModal) {
        diceRandomizerModal.classList.remove('hidden');
    }
    // DO NOT call handleDiceSpin() here. The roll should only happen when the user clicks the button.
}