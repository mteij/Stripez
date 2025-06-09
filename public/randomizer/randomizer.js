// public/randomizer/randomizer.js - REWRITTEN FOR BOTH LIST AND DICE RANDOMIZERS

// --- Shared Utility Functions ---
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- List Randomizer Logic ---
let listInput, shuffleListBtn, pickRandomItemBtn, listOutput;

function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function getItemsFromInput() {
    const input = listInput.value.trim();
    if (!input) return [];
    return input.split('\n').map(item => item.trim()).filter(item => item !== '');
}

function renderListOutput(items, isShuffled = true) {
    if (items.length === 0) {
        listOutput.innerHTML = '<span class="text-red-700">No items to display.</span>';
        return;
    }

    let outputHTML = '';
    if (isShuffled) {
        outputHTML = '<h3>Shuffled List:</h3><ol class="list-output-ol">';
        items.forEach(item => {
            outputHTML += `<li>${item}</li>`;
        });
        outputHTML += '</ol>';
    } else {
        outputHTML = `<h3>Selected Item:</h3><p class="text-xl font-bold">${items[0]}</p>`;
    }
    listOutput.innerHTML = outputHTML;
}

function handleShuffleList() {
    const items = getItemsFromInput();
    if (items.length === 0) {
        listOutput.innerHTML = '<span class="text-red-700">Please enter items in the list.</span>';
        return;
    }
    const shuffledItems = shuffleArray([...items]);
    renderListOutput(shuffledItems, true);
}

function handlePickRandomItem() {
    const items = getItemsFromInput();
    if (items.length === 0) {
        listOutput.innerHTML = '<span class="text-red-700">Please enter items in the list.</span>';
        return;
    }
    const randomIndex = rand(0, items.length - 1);
    const selectedItem = items[randomIndex];
    renderListOutput([selectedItem], false);
}

export function initListRandomizer() {
    listInput = document.getElementById('list-input');
    shuffleListBtn = document.getElementById('shuffle-list-btn');
    pickRandomItemBtn = document.getElementById('pick-random-item-btn');
    listOutput = document.getElementById('list-output');

    if (!listInput || !shuffleListBtn || !pickRandomItemBtn || !listOutput) {
        console.error("List randomizer elements not found!");
        return;
    }

    shuffleListBtn.onclick = handleShuffleList;
    pickRandomItemBtn.onclick = handlePickRandomItem;
}


// --- Dice Randomizer Logic ---
let diceWrap, diceSpinBtn, diceResultsContainer, isDiceSpinning;
let diceMaxValueSlider, diceSliderValueSpan;

const diceTileVisualWidth = 120; // 80px content width + 20px padding on each side

// Fixed palette for the dice roulette visual
const dicePallete = ["r18", "b8", "r19", "g2", "r20", "r21", "b9", "r10", "g3", "r11", "b4", "r12", "b5", "r13", "b6", "r14", "g0", "r15", "b7", "r16", "g1", "r17"];

// Helper to determine color for the displayed number (0-50 range)
function getNumberColorForDiceDisplay(number) {
    if (number === 0) return 'green';
    if (number % 2 === 0) return 'black';
    return 'red';
}

// Populates the roulette tiles for the dice randomizer
function populateDiceRouletteTiles() {
    diceWrap.innerHTML = ''; // Clear existing tiles

    const numberOfReplications = 3; // Duplicate pallete for a seamless visual loop
    const extendedDicePallete = [];
    for (let i = 0; i < numberOfReplications; i++) {
        extendedDicePallete.push(...dicePallete);
    }

    extendedDicePallete.forEach(item => {
        const tileDiv = document.createElement('div');
        const colorPrefix = item[0];
        const number = item.substring(1);
        let colorClass = '';
        if (colorPrefix === 'r') colorClass = 'tile-red';
        else if (colorPrefix === 'b') colorClass = 'tile-black';
        else if (colorPrefix === 'g') colorClass = 'tile-green';

        tileDiv.className = `roulette-tile ${colorClass}`;
        tileDiv.textContent = number;
        diceWrap.appendChild(tileDiv);
    });

    diceWrap.style.width = `${extendedDicePallete.length * diceTileVisualWidth}px`;
}

// Generic spin animation for the dice roulette
function spinDiceAnimation() {
    return new Promise((resolve) => {
        const totalVisualWidth = diceWrap.offsetWidth;
        let pixelsToSpin = rand(totalVisualWidth * 2, totalVisualWidth * 4); // Spin 2-4 full lengths visually

        diceWrap.style.transition = "transform 5s cubic-bezier(0.1, 0.6, 0.1, 1)";
        diceWrap.offsetWidth; // Force reflow for transition to apply
        diceWrap.style.transform = `translateX(-${pixelsToSpin}px)`;

        setTimeout(() => {
            // After animation, immediately snap back to a consistent starting position
            diceWrap.style.transition = 'none';
            diceWrap.style.transform = 'translateX(0)';
            resolve();
        }, 5700); // Match CSS transition duration
    });
}

function handleDiceSpin() {
    if (isDiceSpinning) return;
    isDiceSpinning = true;
    diceSpinBtn.disabled = true;
    diceSpinBtn.textContent = "Spinning...";

    // Generate the random number based on the slider value
    const sliderValue = parseInt(diceMaxValueSlider.value);
    const finalDiceResult = rand(0, sliderValue);
    console.log("Dice spin result:", finalDiceResult);

    // Perform the visual animation, then display the result
    spinDiceAnimation().then(() => {
        let resultDiv = document.createElement("div");
        resultDiv.setAttribute("class", `color-beted tile-${getNumberColorForDiceDisplay(finalDiceResult)}`);
        resultDiv.innerHTML = finalDiceResult;
        diceResultsContainer.prepend(resultDiv);

        // Limit the number of results shown
        while (diceResultsContainer.children.length > 10) {
            diceResultsContainer.removeChild(diceResultsContainer.lastChild);
        }

        isDiceSpinning = false;
        diceSpinBtn.disabled = false;
        diceSpinBtn.textContent = "Spin";
    }).catch(console.error);
}

export function initDiceRandomizer() {
    diceWrap = document.querySelector('#dice-randomizer-modal .roulette-container .wrap');
    diceSpinBtn = document.getElementById('dice-spin-btn');
    diceResultsContainer = document.getElementById('dice-roulette-results');
    diceMaxValueSlider = document.getElementById('dice-max-value-slider');
    diceSliderValueSpan = document.getElementById('dice-slider-value');
    isDiceSpinning = false;

    if (!diceWrap || !diceSpinBtn || !diceResultsContainer || !diceMaxValueSlider || !diceSliderValueSpan) {
        console.error("Dice randomizer elements not found!");
        return;
    }

    // Populate tiles when modal opens
    populateDiceRouletteTiles();
    // Ensure initial position is correct
    diceWrap.style.transform = 'translateX(0)';

    diceSpinBtn.onclick = handleDiceSpin;

    // Update slider value display
    diceSliderValueSpan.textContent = diceMaxValueSlider.value;
    diceMaxValueSlider.addEventListener('input', () => {
        diceSliderValueSpan.textContent = diceMaxValueSlider.value;
    });
}
