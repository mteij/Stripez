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
        const targetPaletteItem = color[0] + "" + number;
        const targetIndex = pallete.indexOf(targetPaletteItem);

        if (targetIndex === -1) {
            reject("Invalid color or number combination for pallete");
            return;
        }

        const numCircles = 15; // Number of full rotations
        const totalPalleteWidth = pallete.length * tileVisualWidth;

        // Calculate the base position to land on the target tile
        let basePixels = targetIndex * tileVisualWidth;

        // Add randomization within the target tile to make it look less robotic
        // From start of tile to end of tile (tileVisualWidth)
        basePixels += rand(10, tileVisualWidth - 10); // Random offset within the tile

        // Add multiple full rotations to make the animation longer and more dynamic
        let pixelsToSpin = basePixels + (totalPalleteWidth * numCircles);

        wrap.style.transition = "transform 5s cubic-bezier(0.1, 0.6, 0.1, 1)";
        wrap.style.transform = `translateX(-${pixelsToSpin}px)`;

        setTimeout(() => {
            // Reset transition to 'none' for instant snap
            wrap.style.transition = 'none';
            // Snap to the final visible position (modulo totalPalleteWidth)
            wrap.style.transform = `translateX(-${basePixels % totalPalleteWidth}px)`;
            
            const result = { color: color, number: number }; // result.number is the one from pallete
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
    // This is crucial to prevent the 'disappearing' effect or jumping.
    wrap.style.transition = 'none';
    wrap.style.transform = 'translateX(0)';


    let color;
    let r = rand(1, 1000);
    if (1 <= r && r < 30) color = "green";
    else if (30 <= r && r < 530) color = "red";
    else if (530 <= r && r < 1000) color = "black";
    
    // Select a 'bet' number from the fixed roulette palette.
    // This number dictates which visual tile the roulette animation aims for.
    let bet = bets[color][rand(0, bets[color].length - 1)];

    spin_promise(color, bet).then((result) => {
        // After the roulette animation completes, generate the FINAL displayed number
        // based on the slider's maximum value. This directly addresses the user's
        // concern about numbers being higher than the slider's maximum.
        const finalDisplayedNumber = rand(0, parseInt(maxValueSlider.value));

        let colorBeted = document.createElement("div");
        colorBeted.setAttribute("class", "color-beted tile-" + result.color);
        colorBeted.innerHTML = finalDisplayedNumber; // Display the slider-constrained number
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