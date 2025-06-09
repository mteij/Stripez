// public/randomizer/randomizer.js

let wrap, spinBtn, resultsContainer, isSpinning;
let maxValueSlider, sliderValueSpan;

const tileVisualWidth = 120; // Corrected visual width from CSS

// Reverted to original fixed pallete and bets for visual roulette
const pallete = ["r18", "b8", "r19", "g2", "r20", "r21", "b9", "r10", "g3", "r11", "b4", "r12", "b5", "r13", "b6", "r14", "g0", "r15", "b7", "r16", "g1", "r17"];
const bets = {
    "green": [2, 3, 0, 1],
    "red": [18, 19, 20, 21, 10, 11, 12, 13, 14, 15, 16, 17],
    "black": [8, 9, 4, 5, 6, 7]
};

// Function to generate a random number (inclusive)
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to determine color for the displayed number, based on new simple rule
function getNumberColorForDisplay(number) {
    if (number === 0) return 'green';
    if (number % 2 === 0) return 'black';
    return 'red';
}

// Simplified populateRouletteTiles - uses fixed pallete
function populateRouletteTiles() {
    wrap.innerHTML = ''; // Clear existing tiles

    const numberOfReplications = 3; // Duplicate pallete for a seamless visual loop
    const extendedPallete = [];
    for (let i = 0; i < numberOfReplications; i++) {
        extendedPallete.push(...pallete);
    }

    extendedPallete.forEach(item => {
        const tileDiv = document.createElement('div');
        const colorPrefix = item[0];
        const number = item.substring(1);
        let colorClass = '';
        if (colorPrefix === 'r') colorClass = 'tile-red';
        else if (colorPrefix === 'b') colorClass = 'tile-black';
        else if (colorPrefix === 'g') colorClass = 'tile-green';

        tileDiv.className = `roulette-tile ${colorClass}`;
        tileDiv.textContent = number;
        wrap.appendChild(tileDiv);
    });

    // Set the width of the wrap explicitly to contain all tiles
    wrap.style.width = `${extendedPallete.length * tileVisualWidth}px`;
}

// Simplified spin_promise - generic visual spin
function spin_promise() {
    return new Promise((resolve) => {
        // Calculate a random target position for the visual spin
        const totalVisualWidth = wrap.offsetWidth;
        let pixelsToSpin = rand(totalVisualWidth * 2, totalVisualWidth * 4); // Spin 2-4 full lengths

        wrap.style.transition = "transform 5s cubic-bezier(0.1, 0.6, 0.1, 1)";
        wrap.offsetWidth; // Force reflow for transition to apply
        wrap.style.transform = `translateX(-${pixelsToSpin}px)`;

        setTimeout(() => {
            // After the animation, immediately snap back to a consistent starting position
            wrap.style.transition = 'none';
            wrap.style.transform = 'translateX(0)';
            resolve();
        }, 5700);
    });
}

// Modified spin function to decouple visual spin from number generation
function spin() {
    if (isSpinning) return;
    isSpinning = true;
    spinBtn.disabled = true;
    spinBtn.textContent = "Spinning...";

    // Generate the final number based on the slider's max value FIRST
    const sliderValue = parseInt(maxValueSlider.value);
    const finalSpinNumber = rand(0, sliderValue);
    console.log("Final number to be displayed:", finalSpinNumber, "based on Max Value:", sliderValue);

    // Perform the visual spin animation
    spin_promise().then(() => {
        // Display the generated number in the results
        let colorBeted = document.createElement("div");
        colorBeted.setAttribute("class", `color-beted tile-${getNumberColorForDisplay(finalSpinNumber)}`);
        colorBeted.innerHTML = finalSpinNumber;
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

    // Initial population of roulette tiles (using fixed pallete)
    populateRouletteTiles();

    // Ensure the carousel is positioned at the start.
    wrap.style.transform = 'translateX(0)';

    // Initialize slider value display
    sliderValueSpan.textContent = maxValueSlider.value;

    spinBtn.onclick = spin;

    // Add event listener for the slider to update its displayed value (no repopulation needed for visual roulette)
    maxValueSlider.addEventListener('input', () => {
        sliderValueSpan.textContent = maxValueSlider.value;
    });
}