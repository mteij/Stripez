// public/randomizer/randomizer.js

let wrap, spinBtn, resultsContainer, isSpinning;
let maxValueSlider, sliderValueSpan;

// Changed rand to be inclusive of max
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Corrected visual width of a tile based on CSS (content width + padding)
const tileVisualWidth = 120; // 80px content width + 20px left padding + 20px right padding from .roulette-tile CSS
const pallete = ["r18", "b8", "r19", "g2", "r20", "r21", "b9", "r10", "g3", "r11", "b4", "r12", "b5", "r13", "b6", "r14", "g0", "r15", "b7", "r16", "g1", "r17"];
const bets = {
    "green": [2, 3, 0, 1],
    "red": [18, 19, 20, 21, 10, 11, 12, 13, 14, 15, 16, 17],
    "black": [8, 9, 4, 5, 6, 7]
};

function spin_promise(color, number) {
    return new Promise((resolve, reject) => {
        // Find the index of the spun item in the original pallete
        const targetPaletteItem = color[0] + "" + number;
        const originalTargetIndex = pallete.indexOf(targetPaletteItem);

        if (originalTargetIndex === -1) {
            reject("Invalid color or number combination for pallete");
            return;
        }

        const numCircles = 3; // Reduced number of full rotations for smoother rendering
        const totalPalleteWidth = (pallete.length * 3) * tileVisualWidth; // Total width of duplicated palette

        // Target an index in the middle section of the extended palette for seamless looping
        const extendedTargetIndex = originalTargetIndex + pallete.length;

        // Calculate the base pixel position to land on the target tile in the extended palette
        let basePixels = extendedTargetIndex * tileVisualWidth;

        // Add randomization within the target tile to make it look less robotic
        basePixels += rand(10, tileVisualWidth - 10); // Random offset within the tile

        // Add multiple full rotations to make the animation longer and more dynamic
        let pixelsToSpin = basePixels + (totalPalleteWidth * numCircles);

        wrap.style.transition = "transform 5s cubic-bezier(0.1, 0.6, 0.1, 1)";
        wrap.style.transform = `translateX(-${pixelsToSpin}px)`;

        setTimeout(() => {
            // Reset transition to 'none' for instant snap
            wrap.style.transition = 'none';
            
            // Get the current container width to precisely center the target tile
            const containerWidth = wrap.parentElement.offsetWidth;
            
            // Calculate the exact center of the target tile in the extended palette
            const exactTargetTileCenter = (extendedTargetIndex * tileVisualWidth) + (tileVisualWidth / 2);
            // Calculate the snap offset to perfectly center the chosen tile under the marker
            const snapOffset = exactTargetTileCenter - (containerWidth / 2);

            // Snap to the final visible position, centering the target tile
            wrap.style.transform = `translateX(-${snapOffset}px)`;
            
            const result = { color: color, number: number };
            resolve(result);
        }, 5700);
    });
}

function spin() {
    if (isSpinning) return;
    isSpinning = true;
    spinBtn.disabled = true;
    spinBtn.textContent = "Spinning...";

    // Reset wrap position immediately to ensure animation starts from the initial visible state
    wrap.style.transition = 'none';
    wrap.style.transform = 'translateX(0)';

    let chosenColor;
    let chosenBetNumber;
    let validSpinFound = false;
    let attempts = 0;
    const maxAttempts = 50; // To prevent infinite loops if slider value is too restrictive

    const sliderValue = parseInt(maxValueSlider.value);
    console.log("Slider Max Value:", sliderValue); // Debugging

    // Loop to find a valid color and bet that respects the slider's max value
    while (!validSpinFound && attempts < maxAttempts) {
        // Step 1: Randomly choose a color category
        let r = rand(1, 1000);
        if (1 <= r && r < 30) chosenColor = "green";
        else if (30 <= r && r < 530) chosenColor = "red";
        else if (530 <= r && r < 1000) chosenColor = "black";

        // Step 2: Filter numbers for the chosen color based on slider's max value
        let eligibleNumbersForColor = bets[chosenColor].filter(num => num <= sliderValue);
        console.log("Attempt", attempts + 1, "Chosen Color:", chosenColor, "Eligible Numbers for Color:", eligibleNumbersForColor); // Debugging

        if (eligibleNumbersForColor.length > 0) {
            // Step 3: Pick a random number from the eligible ones
            chosenBetNumber = eligibleNumbersForColor[rand(0, eligibleNumbersForColor.length - 1)];
            
            // Step 4: Verify this number exists in the main 'pallete' for the chosen color
            const finalBetItemString = chosenColor[0] + "" + chosenBetNumber;
            if (pallete.includes(finalBetItemString)) {
                validSpinFound = true;
                console.log("Found valid bet:", chosenBetNumber, "for color:", chosenColor); // Debugging
            }
        }
        attempts++;
    }

    if (!validSpinFound) {
        console.warn(`Could not find a valid roulette outcome within slider range (${sliderValue}) after ${attempts} attempts. Choosing a random valid pallete item as fallback.`);
        // Fallback: if no valid number found within attempts, pick any random item from the entire pallete
        const fallbackItem = pallete[rand(0, pallete.length - 1)];
        chosenColor = fallbackItem[0] === 'r' ? 'red' : (fallbackItem[0] === 'b' ? 'black' : 'green');
        chosenBetNumber = parseInt(fallbackItem.substring(1));
        console.warn("Fallback chosen:", chosenColor, chosenBetNumber); // Debugging
    }

    spin_promise(chosenColor, chosenBetNumber).then((result) => {
        // Display the number that the roulette *actually* landed on (which now respects the slider's max)
        let colorBeted = document.createElement("div");
        colorBeted.setAttribute("class", "color-beted tile-" + result.color);
        colorBeted.innerHTML = result.number;
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

    // Populate the roulette wrap with tiles for animation, only if not already populated
    if (wrap.children.length === 0) {
        const numberOfReplications = 3; // Duplicate pallete for a seamless loop
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

    // Initialize slider value display
    sliderValueSpan.textContent = maxValueSlider.value;

    spinBtn.onclick = spin;

    // Add event listener for the slider to update its displayed value
    maxValueSlider.addEventListener('input', () => {
        sliderValueSpan.textContent = maxValueSlider.value;
    });
}