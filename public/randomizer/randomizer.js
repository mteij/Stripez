// public/randomizer/randomizer.js

let wrap, spinBtn, resultsContainer, isSpinning;
let maxValueSlider, sliderValueSpan;

const tileVisualWidth = 120; // Corrected visual width from CSS

// Function to generate a random number (inclusive)
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Global variable to store the currently displayed palette and its colors
let currentExtendedPalette = [];
let currentPaletteMapping = {}; // Stores { number: colorPrefix } (e.g., {18: 'r', 2: 'g'})
let singlePaletteLength = 0; // Added: Stores the length of a single dynamically generated palette segment

// Function to determine color based on number (simplified for dynamic range)
function getNumberColor(number) {
    if (number === 0) return 'green'; // Green for 0
    if (number % 2 === 0) return 'black'; // Even numbers are black
    return 'red'; // Odd numbers are red
}

// Function to populate the roulette tiles dynamically based on maxNumber
function populateRouletteTiles(maxNumber) {
    wrap.innerHTML = ''; // Clear existing tiles

    const localPalette = [];
    currentPaletteMapping = {}; // Reset mapping

    // Generate numbers from 0 up to maxNumber
    for (let i = 0; i <= maxNumber; i++) {
        localPalette.push(i);
        currentPaletteMapping[i] = getNumberColor(i)[0]; // Store 'r', 'b', or 'g'
    }

    // If localPalette is empty (e.g., maxNumber is negative or 0), add a default 0
    if (localPalette.length === 0) {
        localPalette.push(0);
        currentPaletteMapping[0] = 'g';
        maxNumber = 0; // Adjust maxNumber to 0 if no numbers were generated
    }

    singlePaletteLength = localPalette.length; // Store the length of this single segment

    const numberOfReplications = 3; // Duplicate pallete for a seamless loop
    currentExtendedPalette = [];
    for (let i = 0; i < numberOfReplications; i++) {
        currentExtendedPalette.push(...localPalette);
    }

    currentExtendedPalette.forEach(number => {
        const tileDiv = document.createElement('div');
        const color = getNumberColor(number);
        
        tileDiv.className = `roulette-tile tile-${color}`;
        tileDiv.textContent = number;
        wrap.appendChild(tileDiv);
    });

    // Set the width of the wrap explicitly to contain all tiles
    wrap.style.width = `${currentExtendedPalette.length * tileVisualWidth}px`;
}

// Modified spin_promise to work with a targetNumber directly
function spin_promise(targetNumber) {
    return new Promise((resolve, reject) => {
        // Find the index of the target number in the currently displayed extended palette
        // We'll target the first occurrence in the middle replication for seamless looping
        const firstReplicationEndIndex = currentExtendedPalette.indexOf(targetNumber, singlePaletteLength); // Use singlePaletteLength here
        
        if (firstReplicationEndIndex === -1) {
            // This should ideally not happen if targetNumber is valid and pallete is extended
            console.error("Target number not found in extended palette during spin promise.");
            reject("Target number not found for animation.");
            return;
        }

        const numCircles = 3; // Number of *additional* full rotations for the spin effect
        const totalExtendedPaletteWidth = currentExtendedPalette.length * tileVisualWidth;

        // Calculate the base pixel position to land on the target tile (exact start of tile)
        let basePixels = firstReplicationEndIndex * tileVisualWidth;
        // Add randomness within the target tile to make it look less robotic
        basePixels += rand(10, tileVisualWidth - 10); 

        // Calculate the final absolute translateX value for the animation's end
        // This includes moving past some full cycles and then landing on the specific basePixels
        let pixelsToSpin = basePixels + (totalExtendedPaletteWidth * numCircles);

        wrap.style.transition = "transform 5s cubic-bezier(0.1, 0.6, 0.1, 1)";
        wrap.style.transform = `translateX(-${pixelsToSpin}px)`;

        setTimeout(() => {
            // After the animation, immediately snap to the equivalent position within the *first* segment
            wrap.style.transition = 'none';
            
            const containerWidth = wrap.parentElement.offsetWidth;
            // Calculate the exact center of the target tile in the *first* replication segment
            const exactTargetTileCenterInFirstSegment = (originalTargetIndex * tileVisualWidth) + (tileVisualWidth / 2);
            // Calculate the snap offset to perfectly center the chosen tile under the marker
            const snapOffset = exactTargetTileCenterInFirstSegment - (containerWidth / 2);

            wrap.style.transform = `translateX(-${snapOffset}px)`;
            
            resolve(targetNumber); // Resolve with the target number
        }, 5700);
    });
}

// Modified spin to use dynamic tiles
function spin() {
    if (isSpinning) return;
    isSpinning = true;
    spinBtn.disabled = true;
    spinBtn.textContent = "Spinning...";

    // DO NOT reset wrap.style.transform = 'translateX(0)'; here.
    // The animation should start from its current position for seamless looping.
    // The absolute transform will be calculated in spin_promise.

    const sliderValue = parseInt(maxValueSlider.value);
    console.log("Slider Max Value:", sliderValue);

    // Choose the final number to land on directly from the slider's range
    const finalSpinNumber = rand(0, sliderValue);
    console.log("Final number to spin for:", finalSpinNumber);

    spin_promise(finalSpinNumber).then((numberLandedOn) => {
        // Get the color for the landed number
        const colorPrefix = currentPaletteMapping[numberLandedOn];
        let colorClass = '';
        if (colorPrefix === 'g') colorClass = 'tile-green';
        else if (colorPrefix === 'r') colorClass = 'tile-red';
        else if (colorPrefix === 'b') colorClass = 'tile-black';

        let colorBeted = document.createElement("div");
        colorBeted.setAttribute("class", `color-beted ${colorClass}`);
        colorBeted.innerHTML = numberLandedOn; // Display the number that was spun
        resultsContainer.prepend(colorBeted);

        while (resultsContainer.children.length > 10) {
            resultsContainer.removeChild(resultsContainer.lastChild);
        }

        isSpinning = false;
        spinBtn.disabled = false;
        spinBtn.textContent = "Spin";
    }).catch(console.error);
}

export function initRandomizer() {
    wrap = document.querySelector('#randomizer-modal .roulette-container .wrap');
    spinBtn = document.getElementById('spin-btn');
    resultsContainer = document.getElementById('roulette-results');
    maxValueSlider = document.getElementById('max-value-slider');
    sliderValueSpan = document.getElementById('slider-value');
    isSpinning = false;

    if (!wrap || !spinBtn || !resultsContainer || !maxValueSlider || !sliderValueSpan) {
        console.error("Randomizer elements not found!");
        return;
    }

    // Initial population of roulette tiles based on default slider value
    populateRouletteTiles(parseInt(maxValueSlider.value));

    // Ensure the carousel is positioned correctly at the start, showing the second segment for seamless look.
    wrap.style.transform = `translateX(-${singlePaletteLength * tileVisualWidth}px)`;

    // Initialize slider value display
    sliderValueSpan.textContent = maxValueSlider.value;

    spinBtn.onclick = spin;

    // Add event listener for the slider to update its displayed value AND repopulate tiles
    maxValueSlider.addEventListener('input', () => {
        sliderValueSpan.textContent = maxValueSlider.value;
        populateRouletteTiles(parseInt(maxValueSlider.value)); // Repopulate tiles on slider change
    });
}