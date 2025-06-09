// public/randomizer/randomizer.js

let wrap, spinBtn, resultsContainer, isSpinning;
let maxValueSlider, sliderValueSpan;

// Changed rand to be inclusive of max
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const width = 80; // Placeholder width, actual tile width might vary with content/padding
const pallete = ["r18", "b8", "r19", "g2", "r20", "r21", "b9", "r10", "g3", "r11", "b4", "r12", "b5", "r13", "b6", "r14", "g0", "r15", "b7", "r16", "g1", "r17"];
const bets = {
    "green": [2, 3, 0, 1],
    "red": [18, 19, 20, 21, 10, 11, 12, 13, 14, 15, 16, 17],
    "black": [8, 9, 4, 5, 6, 7]
};

function spin_promise(color, number) {
    return new Promise((resolve, reject) => {
        // Find the index of the spun item in the pallete
        const targetPaletteItem = color[0] + "" + number;
        const targetIndex = pallete.indexOf(targetPaletteItem);

        if (targetIndex === -1) {
            reject("Invalid color or number combination for pallete");
            return;
        }

        // Calculate pixels for transform (adjusting for centering)
        // We want the targetIndex to land in the center.
        // Assuming each tile is 'width' pixels, and the wrap is flex.
        // To center, we need to move the carousel such that the target tile is under the controller.
        // The controller is at 50% of the roulette-container.
        // The total width of the wrap is pallete.length * width.
        // We need to move by `(targetIndex * width) - (wrap.offsetWidth / 2) + (width / 2)`
        // Adding many circles to ensure continuous spinning visual effect.
        const numCircles = 15;
        const totalSpinDistance = (pallete.length * width * numCircles) + (targetIndex * width) + (width / 2);

        // Adjust for visual centering (rough estimate, might need fine-tuning with CSS)
        // This 'magic number' (-40) was from original, let's keep it for relative adjustment.
        // But for transform, we need to calculate based on actual element widths.
        // For now, let's just aim for the target index's start + half width to center.
        let pixels = targetIndex * width; // Start of the target tile
        pixels = rand(pixels + (width / 4), pixels + (width * 3 / 4)); // Randomize position within the tile
        pixels += (pallete.length * width * numCircles); // Add full rotations

        wrap.style.transition = "transform 5s cubic-bezier(0.1, 0.6, 0.1, 1)";
        wrap.style.transform = `translateX(-${pixels}px)`;

        setTimeout(() => {
            // Reset transform for continuous spinning visually on next spin without jumping
            wrap.style.transition = 'none';
            // Snap to a position that looks like the start of a new spin,
            // but is effectively at the "beginning" of the relevant segment.
            // This is complex for a seamless loop; simply reset to relative position for now.
            // A more robust solution involves cloning elements or complex CSS.
            wrap.style.transform = `translateX(-${pixels % (pallete.length * width)}px)`;

            const result = { color: color, number: number };
            resolve(result);
        }, 5700); // Wait for animation to finish
    });
}

function spin() {
    if (isSpinning) return;
    isSpinning = true;
    spinBtn.disabled = true;
    spinBtn.textContent = "Spinning...";

    // Reset wrap position immediately to avoid seeing the "snap"
    wrap.style.transition = 'none';
    wrap.style.transform = 'translateX(0)';

    let color;
    let r = rand(1, 1000);
    if (1 <= r && r < 30) color = "green";
    else if (30 <= r && r < 530) color = "red";
    else if (530 <= r && r < 1000) color = "black";
    
    // Choose a bet from the selected color group
    let bet = bets[color][rand(0, bets[color].length - 1)]; // Adjusted rand to be inclusive of array length for index

    spin_promise(color, bet).then((result) => {
        // Generate a new random number based on the slider's max value for display
        const finalRandomNumber = rand(0, parseInt(maxValueSlider.value));

        let colorBeted = document.createElement("div");
        // Use the color from the roulette spin for the display div
        colorBeted.setAttribute("class", "color-beted tile-" + result.color);
        // Display the new random number generated using the slider's max value
        colorBeted.innerHTML = finalRandomNumber;
        resultsContainer.prepend(colorBeted); // Add to the start of the list

        // Limit the number of results shown
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

    // Populate the roulette wrap with tiles for animation
    if (wrap.children.length === 0) { // Only populate if empty
        pallete.forEach(item => {
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
    }

    // Initialize slider value display
    sliderValueSpan.textContent = maxValueSlider.value;

    spinBtn.onclick = spin;

    // Add event listener for the slider to update its displayed value
    maxValueSlider.addEventListener('input', () => {
        sliderValueSpan.textContent = maxValueSlider.value;
    });
}