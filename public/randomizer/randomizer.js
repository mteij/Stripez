// public/randomizer/randomizer.js - REWRITTEN FOR LIST SHUFFLER/SELECTOR

let listInput, shuffleListBtn, pickRandomItemBtn, listOutput;

// Function to generate a random number (inclusive)
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Fisher-Yates (Knuth) Shuffle algorithm
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

// Function to get items from the textarea
function getItemsFromInput() {
    const input = listInput.value.trim();
    if (!input) return [];
    return input.split('\n').map(item => item.trim()).filter(item => item !== '');
}

// Function to render results
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

// Event handler for Shuffle List button
function handleShuffleList() {
    const items = getItemsFromInput();
    if (items.length === 0) {
        listOutput.innerHTML = '<span class="text-red-700">Please enter items in the list.</span>';
        return;
    }
    const shuffledItems = shuffleArray([...items]); // Create a copy to shuffle
    renderListOutput(shuffledItems, true);
}

// Event handler for Pick Random Item button
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

// Initialization function for the List Randomizer
export function initListRandomizer() {
    listInput = document.getElementById('list-input');
    shuffleListBtn = document.getElementById('shuffle-list-btn');
    pickRandomItemBtn = document.getElementById('pick-random-item-btn');
    listOutput = document.getElementById('list-output');

    if (!listInput || !shuffleListBtn || !pickRandomItemBtn || !listOutput) {
        console.error("List randomizer elements not found!");
        return;
    }

    // Attach event listeners
    shuffleListBtn.onclick = handleShuffleList;
    pickRandomItemBtn.onclick = handlePickRandomItem;
}

// --- Placeholder for old Dice Randomizer functions if they were still needed elsewhere ---
// In this setup, the dice randomizer is completely separate and its init function
// would be imported and called separately if desired. For now, it's assumed
// the previous dice randomizer logic is being replaced/deprecated by this new functionality.
// If you still want the dice randomizer functionality, its code needs to be
// in a separate file (e.g., 'diceRandomizer.js') and imported/initialized independently.
