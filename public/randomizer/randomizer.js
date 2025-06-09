// public/randomizer/randomizer.js

let wrap, spinBtn, resultsContainer, isSpinning;

const width = 80;
const pallete = ["r18", "b8", "r19", "g2", "r20", "r21", "b9", "r10", "g3", "r11", "b4", "r12", "b5", "r13", "b6", "r14", "g0", "r15", "b7", "r16", "g1", "r17"];
const bets = {
    "green": [2, 3, 0, 1],
    "red": [18, 19, 20, 21, 10, 11, 12, 13, 14, 15, 16, 17],
    "black": [8, 9, 4, 5, 6, 7]
};

function rand(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function spin_promise(color, number) {
    return new Promise((resolve, reject) => {
        if (
            (color === "green" || color === "g") && (number >= 0 && number <= 3) ||
            (color === "black" || color === "b") && (number >= 4 && number <= 9) ||
            (color === "red" || color === "r") && (number >= 10 && number <= 21)
        ) {
            let index, pixels, circles;

            color = color[0];
            index = pallete.indexOf(color + "" + number);
            pixels = width * index;
            circles = 1760 * 15; // 15 circles

            pixels -= 40; // Adjust for centering
            pixels = rand(pixels + 2, pixels + 78);
            
            pixels += circles;

            wrap.style.transition = "background-position 5s cubic-bezier(0.1, 0.6, 0.1, 1)";
            wrap.style.backgroundPosition = `-${pixels}px`;

            setTimeout(() => {
                const result = { color: color, number: number };
                resolve(result);
            }, 5700); // Wait for animation to finish
        } else {
            reject("Invalid color or number");
        }
    });
}

function spin() {
    if (isSpinning) return;
    isSpinning = true;
    spinBtn.disabled = true;
    spinBtn.textContent = "Spinning...";

    let color;
    let r = rand(1, 1000);
    if (1 <= r && r < 30) color = "green";
    else if (30 <= r && r < 530) color = "red";
    else if (530 <= r && r < 1000) color = "black";
    
    let bet = bets[color][rand(0, bets[color].length)];

    spin_promise(color, bet).then((result) => {
        let colorBeted = document.createElement("div");
        colorBeted.setAttribute("class", "color-beted " + result.color);
        colorBeted.innerHTML = result.number;
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
    isSpinning = false;

    if (!wrap || !spinBtn || !resultsContainer) {
        console.error("Randomizer elements not found!");
        return;
    }

    spinBtn.onclick = spin;
}