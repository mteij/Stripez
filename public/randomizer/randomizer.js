// public/randomizer/randomizer.js - REWRITTEN FOR BOTH LIST AND DICE RANDOMIZERS

// --- Shared Utility Functions ---
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- List Randomizer Logic ---
let shuffleListBtn, pickRandomItemBtn, listOutput;
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
}

function handleShuffleList() {
    if (availableNames.length === 0) {
        listOutput.innerHTML = '<span class="text-red-700">No names to shuffle. The ledger is empty.</span>';
        return;
    }
    const shuffledNames = shuffleArray([...availableNames]);
    renderListOutput(shuffledNames, true);
}

function handlePickRandomItem() {
    if (availableNames.length === 0) {
        listOutput.innerHTML = '<span class="text-red-700">No names to pick from. The ledger is empty.</span>';
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

    // Initial render based on current names
    if (availableNames.length > 0) {
        renderListOutput(availableNames, true); // Display shuffled list initially
    } else {
        listOutput.innerHTML = '<span class="text-xl text-[#6f4e37]">The ledger is clear. No names available for randomization.</span>';
    }

    shuffleListBtn.onclick = handleShuffleList;
    pickRandomItemBtn.onclick = handlePickRandomItem;
}


// --- Dice Randomizer Logic ---
let diceSpinBtn, diceResultsContainer;
let diceMaxValueSlider, diceSliderValueSpan;

function handleDiceSpin() {
    const sliderValue = parseInt(diceMaxValueSlider.value);
    const finalDiceResult = rand(1, sliderValue > 0 ? sliderValue : 1); // Ensure at least 1 as max value

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

    diceSpinBtn.onclick = handleDiceSpin;

    // Update slider value display
    diceSliderValueSpan.textContent = diceMaxValueSlider.value;
    diceMaxValueSlider.addEventListener('input', () => {
        diceSliderValueSpan.textContent = diceMaxValueSlider.value;
    });
}