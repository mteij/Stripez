// public/randomizer/randomizer.js

import { soundManager } from '../js/sounds.js';

// --- Shared Utility Functions ---
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// --- List Randomizer Logic ---
let shuffleListBtn, pickRandomItemBtn, listOutput;
let listPunishmentAssignContainer, listAssignAmountInput, listAssignStripesBtn;
let availableNames = [];
let _isSchikkoList = false;
let _addStripeToPersonListFn = null;
let _showAlertListFn = null;
let _ledgerDataList = [];
let selectedPersonForList = null;

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
        listOutput.classList.remove('hidden');
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
    listOutput.classList.remove('hidden');
}

function handleShuffleList() {
    if (availableNames.length === 0) {
        listOutput.innerHTML = '<span class="text-red-700">No names to shuffle. The ledger is empty.</span>';
        listOutput.classList.remove('hidden');
        return;
    }
    const shuffledNames = shuffleArray([...availableNames]);
    renderListOutput(shuffledNames, true);
    if (listPunishmentAssignContainer) listPunishmentAssignContainer.classList.add('hidden');
}

function handleListAssignStripes() {
    if (!selectedPersonForList || !_addStripeToPersonListFn || !_showAlertListFn) return;

    const stripesToAdd = parseInt(listAssignAmountInput.value) || 1;

    if (stripesToAdd < 1) {
        _showAlertListFn('Please enter a valid number of stripes.', 'Invalid Input');
        return;
    }

    // Add stripes
    for (let i = 0; i < stripesToAdd; i++) {
        _addStripeToPersonListFn(selectedPersonForList.id);
    }

    _showAlertListFn(`${stripesToAdd} stripes assigned to ${selectedPersonForList.name}!`, 'Success!');

    // Hide the modal
    document.getElementById('list-randomizer-modal').classList.add('hidden');
}

function handlePickRandomItem() {
    if (availableNames.length === 0) {
        listOutput.innerHTML = '<span class="text-red-700">No names to pick from. The ledger is empty.</span>';
        listOutput.classList.remove('hidden');
        return;
    }
    const randomIndex = rand(0, availableNames.length - 1);
    const selectedName = availableNames[randomIndex];
    selectedPersonForList = _ledgerDataList.find(p => p.name === selectedName);
    renderListOutput([selectedName], false);

    if (_isSchikkoList && listPunishmentAssignContainer) {
        listPunishmentAssignContainer.classList.remove('hidden');
    }
}

export function initListRandomizer(ledgerData, isSchikko = false, addStripeToPersonFn = null, showAlertFn = null) {
    shuffleListBtn = document.getElementById('shuffle-list-btn');
    pickRandomItemBtn = document.getElementById('pick-random-item-btn');
    listOutput = document.getElementById('list-output');
    listPunishmentAssignContainer = document.getElementById('list-punishment-assign-container');
    listAssignAmountInput = document.getElementById('list-assign-amount-input');
    listAssignStripesBtn = document.getElementById('list-assign-stripes-btn');

    if (!shuffleListBtn || !pickRandomItemBtn || !listOutput) {
        console.error("Name randomizer elements not found! Check IDs in index.html.");
        return;
    }

    availableNames = ledgerData.map(person => person.name);
    _ledgerDataList = ledgerData;
    _isSchikkoList = isSchikko;
    _addStripeToPersonListFn = addStripeToPersonFn;
    _showAlertListFn = showAlertFn;
    listOutput.classList.add('hidden');
    listOutput.innerHTML = '';
    if (listPunishmentAssignContainer) listPunishmentAssignContainer.classList.add('hidden');

    shuffleListBtn.onclick = handleShuffleList;
    pickRandomItemBtn.onclick = handlePickRandomItem;
    if (listAssignStripesBtn) {
        listAssignStripesBtn.onclick = handleListAssignStripes;
    }
}


// --- REVISED DICE RANDOMIZER LOGIC ---
let diceSpinBtn, addDiceBtn, diceListContainer, diceResultsContainer;
let dicePunishmentAssignContainer, assignPersonSelect, assignStripesBtn;

let _addStripeToPersonFn = null;
let _ledgerData = [];
let _showAlertFn = null;
let _isSchikko = false;

/**
 * Updates the entire dice UI based on the current state of the DOM.
 * It re-numbers labels and manages button visibility.
 */
function updateDiceUI() {
    const diceRows = diceListContainer.querySelectorAll('.dice-row');
    const shouldShowRemove = diceRows.length > 1;

    diceRows.forEach((row, index) => {
        const label = row.querySelector('label');
        if (label) {
            label.textContent = `Die ${index + 1}:`;
        }

        const removeBtn = row.querySelector('.remove-dice-btn');
        if (removeBtn) {
            removeBtn.style.display = shouldShowRemove ? 'flex' : 'none';
        }
    });
}

/**
 * Creates and appends a new die row to the container.
 * @param {number} [value=6] - The default number of sides for the new die.
 */
function addDieRow(value = 6) {
    const newDieRow = document.createElement('div');
    // Added 'dice-row' class for easier and more specific selection
    newDieRow.className = 'dice-row flex items-center gap-2'; 

    newDieRow.innerHTML = `
        <label class="font-cinzel-decorative text-lg text-[#6f4e37] flex-shrink-0"></label>
        <input type="number" value="${value}" min="1" max="100" class="dice-max-value-input w-full text-center bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]">
        <button class="remove-dice-btn btn-ancient text-red-300 hover:text-red-100 text-base font-bold w-[44px] h-[44px] flex-shrink-0 flex items-center justify-center rounded-md" title="Remove Die">&times;</button>
    `;

    diceListContainer.appendChild(newDieRow);
    updateDiceUI(); // Update the entire UI after adding the new row
}

/**
 * Handles clicks within the dice list container, specifically for removing dice.
 * @param {Event} event - The click event.
 */
function handleRemoveDie(event) {
    // Use event delegation to find the specific button that was clicked.
    const removeBtn = event.target.closest('.remove-dice-btn');
    if (!removeBtn) {
        return; // Exit if the click was not on a remove button.
    }
    
    event.stopPropagation(); // Prevent the event from bubbling up.

    // Remove the entire parent row for the clicked button.
    removeBtn.closest('.dice-row').remove();
    
    // After removing, update the UI to re-number dice and hide the last remove button.
    updateDiceUI();
}

/**
 * The main function to roll all dice and handle assignment logic.
 */
function handleDiceSpin() {
    const diceInputs = diceListContainer.querySelectorAll('.dice-max-value-input');
    let totalResult = 0;
    const individualResults = [];

    diceInputs.forEach(input => {
        const maxValue = parseInt(input.value) || 0;
        if (maxValue > 0) {
            const result = rand(1, maxValue);
            individualResults.push(result);
            totalResult += result;
        }
    });

    diceResultsContainer.innerHTML = '';
    
    if (individualResults.length > 1) {
        const individualRollsText = individualResults.join(' + ');
        const individualDiv = document.createElement("div");
        individualDiv.className = `font-medieval-sharp text-2xl mt-4 text-[#6f4e37]`;
        individualDiv.textContent = `Rolls: ${individualRollsText}`;
        diceResultsContainer.appendChild(individualDiv);
    }
    
    const resultDiv = document.createElement("div");
    resultDiv.className = `font-cinzel-decorative text-5xl font-bold mt-2 text-[#5c3d2e]`;
    resultDiv.textContent = totalResult;
    diceResultsContainer.appendChild(resultDiv);

    if (_isSchikko) {
        dicePunishmentAssignContainer.classList.remove('hidden');
    }

    const currentSelection = assignPersonSelect.value;
    assignPersonSelect.innerHTML = '<option value="">Select a Transgressor...</option>';
    _ledgerData.forEach(person => {
        const option = document.createElement('option');
        option.value = person.id;
        option.textContent = person.name;
        assignPersonSelect.appendChild(option);
    });
    // Restore selection if it's still valid
    if (_ledgerData.some(p => p.id === currentSelection)) {
        assignPersonSelect.value = currentSelection;
    }


    assignStripesBtn.onclick = async () => {
        const selectedPersonId = assignPersonSelect.value;
        const stripesToAdd = totalResult;

        if (selectedPersonId && stripesToAdd >= 0) {
            if (_addStripeToPersonFn && _showAlertFn) {
                for (let i = 0; i < stripesToAdd; i++) {
                    await _addStripeToPersonFn(selectedPersonId);
                }
                await _showAlertFn(`${stripesToAdd} stripes assigned to ${assignPersonSelect.options[assignPersonSelect.selectedIndex].text}!`, "Success!");
                
                assignPersonSelect.value = '';
                dicePunishmentAssignContainer.classList.add('hidden');
                diceResultsContainer.innerHTML = '';
                document.getElementById('dice-randomizer-modal').classList.add('hidden');
            } else {
                if(_showAlertFn) await _showAlertFn("Error: Cannot assign stripes.", "Error");
            }
        } else {
            if(_showAlertFn) await _showAlertFn('Please select a person.', "Missing Information");
        }
    };
}

/**
 * Initializes the dice randomizer, sets up the UI and attaches event listeners.
 * @param {Array} ledgerData - The current ledger data.
 * @param {Function} addStripeToPersonFn - Callback function to add stripes.
 * @param {Function} showAlertFn - Callback function to show alerts.
 * @param {boolean} isSchikko - Whether the user is logged in as Schikko.
 */
export function initDiceRandomizer(ledgerData = [], addStripeToPersonFn = null, showAlertFn = null, isSchikko = false) {
    // Get all DOM elements
    diceSpinBtn = document.getElementById('dice-spin-btn');
    diceResultsContainer = document.getElementById('dice-roulette-results');
    addDiceBtn = document.getElementById('add-dice-btn');
    diceListContainer = document.getElementById('dice-list-container');
    dicePunishmentAssignContainer = document.getElementById('dice-punishment-assign-container');
    assignPersonSelect = document.getElementById('assign-person-select');
    assignStripesBtn = document.getElementById('assign-stripes-btn');

    // Store callbacks
    _ledgerData = ledgerData;
    _addStripeToPersonFn = addStripeToPersonFn;
    _showAlertFn = showAlertFn;
    _isSchikko = isSchikko;

    // Check if all elements were found
    if (!diceSpinBtn || !diceListContainer) {
        console.error("One or more Dice Randomizer elements are missing from the DOM.");
        return;
    }

    // Reset UI state
    diceListContainer.innerHTML = '';
    diceResultsContainer.innerHTML = '';
    dicePunishmentAssignContainer.classList.add('hidden');

    // Add the first die
    addDieRow(20);

    // Set up event listeners, overwriting any previous ones to prevent duplicates.
    addDiceBtn.onclick = () => addDieRow(6);
    diceListContainer.onclick = handleRemoveDie;
    diceSpinBtn.onclick = handleDiceSpin;
}

/**
 * Opens and pre-configures the dice roller based on the Oracle's judgement.
 * @param {Array<number>} diceValues - An array of dice sides (e.g., [20, 6, 6]).
 * @param {object} targetPerson - The person object from the ledger.
 * @param {Function} addStripeFn - Callback function to add stripes.
 * @param {Array} ledgerData - The current ledger data.
 * @param {Function} showAlertFn - Callback function to show alerts.
 * @param {boolean} isSchikko - Whether the user is logged in as Schikko.
 */
export async function rollDiceAndAssign(diceValues, targetPerson, addStripeFn, ledgerData, showAlertFn, isSchikko = false) {
    // The alert has been removed from here as per your request.
    const diceRandomizerModal = document.getElementById('dice-randomizer-modal');
    if (diceRandomizerModal) {
        // Signal to the global click handler not to immediately close the dice modal
        try { window.__openingDiceModal = true; } catch (_) {}

        // Initialize the dice roller with a clean slate
        initDiceRandomizer(ledgerData, addStripeFn, showAlertFn, isSchikko);

        // Then customize it based on the Oracle's decree
        const diceListContainer = document.getElementById('dice-list-container');
        if (diceListContainer && Array.isArray(diceValues) && diceValues.length > 0) {
            diceListContainer.innerHTML = ''; // Clear the default die added by init
            diceValues.forEach(val => {
                addDieRow(val); // Use the new function to add each required die
            });
        }
        
        // Pre-select the person in the assignment dropdown
        const assignPersonSelect = document.getElementById('assign-person-select');
        if (assignPersonSelect) {
            // Populate the dropdown first, as initDiceRandomizer doesn't do it.
            assignPersonSelect.innerHTML = '<option value="">Select a Transgressor...</option>';
            ledgerData.forEach(person => {
                const option = document.createElement('option');
                option.value = person.id;
                option.textContent = person.name;
                assignPersonSelect.appendChild(option);
            });
            // Now, set the value to the target person.
            assignPersonSelect.value = targetPerson.id;
        }

        // Force the modal open, on top, and focus it
        diceRandomizerModal.classList.remove('hidden');
        try { diceRandomizerModal.style.display = 'flex'; } catch (_) {}
        try { diceRandomizerModal.style.zIndex = '1000'; } catch (_) {}
        try { diceRandomizerModal.setAttribute('aria-hidden', 'false'); } catch (_) {}
        try {
            const focusEl = document.getElementById('dice-spin-btn') || diceRandomizerModal;
            focusEl.focus();
        } catch (_) {}

        // Clear the guard on the next tick
        setTimeout(() => { try { window.__openingDiceModal = false; } catch (_) {} }, 0);
    } else {
        // Fallback: try to locate and show the modal even if the element reference is missing
        const modal = document.querySelector('#dice-randomizer-modal');
        if (modal) {
            try { window.__openingDiceModal = true; } catch (_) {}
            modal.classList.remove('hidden');
            try { modal.style.display = 'flex'; } catch (_) {}
            setTimeout(() => { try { window.__openingDiceModal = false; } catch (_) {} }, 0);
        }
    }
}
// --- Punishment Wheel (MVP) ---
// Public initializer: initWheelRandomizer(ledgerData, isSchikko, addStripeFn, showAlertFn, { logActivity, removeLastStripeFn })
let wheelCanvas, wheelCtx, wheelSpinBtn, wheelResultEl;
let wheelAssignContainer, wheelAssignSelect, wheelAssignApplyBtn;
let wheelModalEl, wheelCloseBtn;
let _ledgerDataWheel = [];
let _isSchikkoWheel = false;
let _addStripeWheelFn = null;
let _showAlertWheelFn = null;
let _logActivityWheel = async () => {};
let _removeLastStripeWheelFn = null;
let _ensureSessionFn = null;

const TWO_PI = Math.PI * 2;
const DEFAULT_WHEEL_SLICES = [
  // Heavier weight on small, predictable outcomes
  { label: '+1 Stripe', type: 'stripes', amount: 1 },
  { label: '+1 Stripe', type: 'stripes', amount: 1 },
  { label: '+1 Stripe', type: 'stripes', amount: 1 },
  { label: '+2 Stripes', type: 'stripes', amount: 2 },
  { label: '+2 Stripes', type: 'stripes', amount: 2 },
  { label: '+3 Stripes', type: 'stripes', amount: 3 },

  // Small dice with one higher outlier
  { label: 'Roll d4', type: 'dice', value: 4 },
  { label: 'Roll d6', type: 'dice', value: 6 },
  { label: 'Roll d8', type: 'dice', value: 8 },
  { label: 'Roll d12', type: 'dice', value: 12 }, // single higher exception

  // Social twist and control
  { label: 'Give 1', type: 'stripes', amount: 1 },
  { label: 'Re-roll', type: 'reroll' },
];

const WHEEL_COLORS = [
  '#c0392b', '#8c6b52', '#34495e', '#b9987e', '#2c3e50', '#a58467', '#d35400'
];

// Animation state
let currentRotation = 0;  // radians
let spinning = false;
let slices = DEFAULT_WHEEL_SLICES.slice();
let lastTickTime = 0;
let tickInterval = 0;

function drawWheel(rotation = 0) {
  if (!wheelCtx || !wheelCanvas) return;
  const { width, height } = wheelCanvas;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 6;

  wheelCtx.clearRect(0, 0, width, height);

  const arc = TWO_PI / slices.length;

  // Draw segments
  for (let i = 0; i < slices.length; i++) {
    const start = rotation + i * arc;
    const end = start + arc;

    // segment
    wheelCtx.beginPath();
    wheelCtx.moveTo(cx, cy);
    wheelCtx.arc(cx, cy, radius, start, end, false);
    wheelCtx.closePath();
    wheelCtx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    wheelCtx.fill();

    // separator line
    wheelCtx.strokeStyle = 'rgba(0,0,0,0.15)';
    wheelCtx.lineWidth = 2;
    wheelCtx.beginPath();
    wheelCtx.moveTo(cx, cy);
    wheelCtx.lineTo(cx + Math.cos(start) * radius, cy + Math.sin(start) * radius);
    wheelCtx.stroke();

    // label - rotated sideways (tangential)
    const mid = start + arc / 2;
    const rx = cx + Math.cos(mid) * (radius * 0.65);
    const ry = cy + Math.sin(mid) * (radius * 0.65);
    wheelCtx.save();
    wheelCtx.translate(rx, ry);
    // Rotate text to be tangent to the circle (sideways, not radial)
    wheelCtx.rotate(mid);
    wheelCtx.textAlign = 'center';
    wheelCtx.textBaseline = 'middle';
    wheelCtx.fillStyle = '#fdf8e9';

    // Prepare text for sideways display
    const raw = String(slices[i].label || '');
    
    // Adaptive font size based on label length
    let fontSize = 14;
    if (raw.length > 10) { fontSize = 12; }
    if (raw.length > 15) { fontSize = 10; }
    wheelCtx.font = `bold ${fontSize}px "Cinzel Decorative", serif`;

    // Draw text sideways (tangential to the circle)
    wheelCtx.fillText(raw, 0, 0);

    wheelCtx.restore();
  }

  // Center hub
  wheelCtx.beginPath();
  wheelCtx.arc(cx, cy, 18, 0, TWO_PI);
  wheelCtx.fillStyle = '#5c3d2e';
  wheelCtx.fill();
  wheelCtx.strokeStyle = '#b9987e';
  wheelCtx.lineWidth = 3;
  wheelCtx.stroke();
}

function normalizeAngle(a) {
  let x = a % TWO_PI;
  if (x < 0) x += TWO_PI;
  return x;
}

// Pointer is visually at the top (12 o'clock). Canvas 0 rad is 3 o'clock.
// The slice at angle (3π/2) after applying rotation is the winner.
function getSliceIndexAtPointer(rotation) {
  const arc = TWO_PI / slices.length;
  const pointerAngle = Math.PI * 1.5; // 12 o'clock
  const effective = normalizeAngle(pointerAngle - rotation);
  let idx = Math.floor(effective / arc);
  if (idx < 0) idx = 0;
  if (idx >= slices.length) idx = slices.length - 1;
  return idx;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

async function spinOnce(onDone) {
  if (spinning) return;
  spinning = true;

  // Initialize sound on first interaction
  soundManager.init();

  // Add spinning animation class to wheel container
  const wheelContainer = document.querySelector('.wheel-container');
  if (wheelContainer) {
    wheelContainer.classList.add('spinning');
  }

  const turns = 1.5 + Math.random() * 1.0; // 1.5–2.5 turns (faster)
  const extra = Math.random() * TWO_PI;  // random offset
  const target = currentRotation + turns * TWO_PI + extra;
  const duration = 1200 + Math.random() * 400; // ~1.2–1.6s (much faster)

  // Calculate tick intervals for sound effects - fewer ticks for faster spin
  const totalRotation = turns * TWO_PI + extra;
  const tickCount = 18; // Fewer ticks for faster spin
  tickInterval = totalRotation / tickCount;
  lastTickTime = 0;

  const startTime = performance.now();
  function frame(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const eased = easeOutCubic(t);
    const prevRotation = currentRotation;
    currentRotation = currentRotation + (target - currentRotation) * eased;
    
    // Play tick sounds at intervals
    if (currentRotation - prevRotation > tickInterval) {
      const intensity = Math.max(0.3, 1 - t * 0.6); // Decrease intensity as wheel slows, but keep minimum
      soundManager.playWheelTick(intensity);
      lastTickTime = currentRotation;
    }
    
    drawWheel(currentRotation);
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      // snap to final target to avoid drift
      currentRotation = target;
      drawWheel(currentRotation);
      spinning = false;
      
      // Remove spinning animation class immediately
      if (wheelContainer) {
        wheelContainer.classList.remove('spinning');
      }
      
      // Call onDone immediately without delay
      if (typeof onDone === 'function') {
        // Use setTimeout with 0 to ensure it runs on next frame for better responsiveness
        setTimeout(onDone, 0);
      }
    }
  }
  requestAnimationFrame(frame);
}

function populateAssignSelect() {
  if (!wheelAssignSelect) return;
  const current = wheelAssignSelect.value;
  wheelAssignSelect.innerHTML = '<option value="">Select a Transgressor...</option>';
  _ledgerDataWheel.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    wheelAssignSelect.appendChild(opt);
  });
  if (_ledgerDataWheel.some(p => p.id === current)) {
    wheelAssignSelect.value = current;
  }
}

/**
 * Initialize the Punishment Wheel modal and logic.
 * @param {Array} ledgerData
 * @param {boolean} isSchikko
 * @param {Function} addStripeFn (docId, count)
 * @param {Function} showAlertFn (msg, title?)
 * @param {Object} opts { logActivity?: fn, removeLastStripeFn?: fn(person) }
 */
export function initWheelRandomizer(ledgerData = [], isSchikko = false, addStripeFn = null, showAlertFn = null, opts = {}) {
  // Cache callbacks and state
  _ledgerDataWheel = Array.isArray(ledgerData) ? ledgerData : [];
  _isSchikkoWheel = !!isSchikko;
  _addStripeWheelFn = addStripeFn;
  _showAlertWheelFn = showAlertFn || (async () => {});
  _logActivityWheel = typeof opts.logActivity === 'function' ? opts.logActivity : (async () => {});
  _removeLastStripeWheelFn = typeof opts.removeLastStripeFn === 'function' ? opts.removeLastStripeFn : null;
  _ensureSessionFn = typeof opts.ensureSessionFn === 'function' ? opts.ensureSessionFn : null;

  // DOM
  wheelModalEl = document.getElementById('wheel-randomizer-modal');
  wheelCloseBtn = document.getElementById('close-wheel-randomizer-modal');
  wheelCanvas = document.getElementById('wheel-canvas');
  wheelSpinBtn = document.getElementById('wheel-spin-btn');
  wheelResultEl = document.getElementById('wheel-result');
  wheelAssignContainer = document.getElementById('wheel-punishment-assign-container');
  wheelAssignSelect = document.getElementById('wheel-assign-person-select');
  wheelAssignApplyBtn = document.getElementById('wheel-assign-apply-btn');

  if (!wheelCanvas || !wheelSpinBtn) {
    console.error('Wheel UI elements missing. Check index.html IDs.');
    return;
  }
  wheelCtx = wheelCanvas.getContext('2d');

  // Reset UI
  currentRotation = Math.random() * TWO_PI;
  spinning = false;
  wheelResultEl.textContent = '';
  if (!_isSchikkoWheel && wheelAssignContainer) {
    wheelAssignContainer.classList.add('hidden'); // hide apply UI for non-Schikko
  } else {
    wheelAssignContainer.classList.add('hidden'); // start hidden until a result exists
  }
  drawWheel(currentRotation);

  if (wheelCloseBtn) {
    wheelCloseBtn.onclick = (e) => {
      e.stopPropagation();
      if (wheelModalEl) wheelModalEl.classList.add('hidden');
    };
  }

  wheelSpinBtn.onclick = async (e) => {
    e.stopPropagation();
    if (spinning) return;
    
    // Disable button during spin
    wheelSpinBtn.disabled = true;
    wheelResultEl.textContent = '';
    
    await spinOnce(async () => {
      // Re-enable button after spin
      wheelSpinBtn.disabled = false;
      const idx = getSliceIndexAtPointer(currentRotation);
      const outcome = slices[idx];
      const actor = _isSchikkoWheel ? 'Schikko' : 'Guest';
      await _logActivityWheel('WHEEL_SPIN', actor, `Wheel result: ${outcome.label}`);

      // Reroll auto-behavior (snappier)
      if (outcome.type === 'reroll') {
        wheelResultEl.textContent = 'Re-roll!';
        setTimeout(() => { if (!spinning && wheelSpinBtn) wheelSpinBtn.click(); }, 80);
        return;
      }

      // Show result text
      wheelResultEl.textContent = `Result: ${outcome.label}`;

      // For non-Schikko, do not allow applying or prompting any protected actions.
      // Show the result only; no permission error, no assignment UI.
      if (!_isSchikkoWheel) {
        return;
      }

      // Prepare assignment UI for Schikko
      populateAssignSelect();
      wheelAssignContainer.classList.remove('hidden');

      // Apply logic
      wheelAssignApplyBtn.onclick = async (ev) => {
        try { ev && ev.stopPropagation && ev.stopPropagation(); } catch (_) {}
        try { ev && ev.preventDefault && ev.preventDefault(); } catch (_) {}

        const personId = wheelAssignSelect.value;
        const person = _ledgerDataWheel.find(p => p.id === personId);
        if (!person) {
          if (_showAlertWheelFn) await _showAlertWheelFn('Please select a person to apply the outcome to.', 'Missing Selection');
          return;
        }

        // Proactively ensure Schikko session is valid (UI can be stale)
        if (typeof _ensureSessionFn === 'function') {
          const ok = await _ensureSessionFn();
          if (!ok) {
            if (_showAlertWheelFn) await _showAlertWheelFn('Schikko login required to apply outcomes.', 'Permission Required');
            return;
          }
        }

        // Ensure a valid Schikko session token is present before calling protected endpoints
        try {
          const sid = localStorage.getItem('schikkoSessionId');
          if (!sid) {
            if (_showAlertWheelFn) await _showAlertWheelFn('Schikko login required to apply outcomes.', 'Permission Required');
            return;
          }
        } catch (_) {}

        // stripes
        if (outcome.type === 'stripes') {
          try {
            const count = Math.max(1, Number(outcome.amount || 1));
            if (typeof _addStripeWheelFn !== 'function') throw new Error('Add stripe handler not available');
            await _addStripeWheelFn(person.id, count);
            await _logActivityWheel('WHEEL_SPIN', 'Schikko', `Applied ${count} stripe(s) to ${person.name} via wheel (${outcome.label}).`);
            if (_showAlertWheelFn) await _showAlertWheelFn(`${count} stripe(s) assigned to ${person.name}!`, 'Success');
            // Close after success
            if (wheelModalEl) wheelModalEl.classList.add('hidden');
            wheelAssignContainer.classList.add('hidden');
            wheelResultEl.textContent = '';
          } catch (e) {
            if (_showAlertWheelFn) await _showAlertWheelFn(`Failed to apply stripes: ${e?.message || 'Unknown error'}`, 'Error');
          }
          return;
        }

        // dice
        if (outcome.type === 'dice') {
          const values = [Number(outcome.value || 6)];
          if (values[0] > 0) {
            // Hide wheel before showing dice to avoid stacked overlays
            // Also set a guard flag so the document-level click handler won't immediately close the dice modal.
            try { window.__openingDiceModal = true; } catch (_) {}
            if (wheelModalEl) wheelModalEl.classList.add('hidden');
            try {
              // Defer to next tick so any bubbling/capture listeners complete before opening modal
              await new Promise(resolve => setTimeout(resolve, 0));
              // Dispatch an app-level event that main.js listens to, to open the dice modal reliably
              window.dispatchEvent(new CustomEvent('open-dice-modal', { detail: { diceValues: values, personId: person.id } }));
              await _logActivityWheel('WHEEL_SPIN', 'Schikko', `Invoked dice roll (${values.map(v => 'd' + v).join(', ')}) for ${person.name} via wheel.`);
            } catch (e) {
              if (_showAlertWheelFn) await _showAlertWheelFn(`Failed to open dice roller: ${e?.message || 'Unknown error'}`, 'Error');
            } finally {
              try { window.__openingDiceModal = false; } catch (_) {}
            }
          }
          return;
        }

        // mercy
        if (outcome.type === 'mercy') {
          try {
            if (typeof _removeLastStripeWheelFn !== 'function') throw new Error('Remove stripe handler not available');
            await _removeLastStripeWheelFn(person);
            await _logActivityWheel('WHEEL_SPIN', 'Schikko', `Granted mercy to ${person.name} (removed last stripe).`);
            if (_showAlertWheelFn) await _showAlertWheelFn(`Mercy granted to ${person.name}. Removed last stripe.`, 'Mercy');
            if (wheelModalEl) wheelModalEl.classList.add('hidden');
            wheelAssignContainer.classList.add('hidden');
            wheelResultEl.textContent = '';
          } catch (e) {
            if (_showAlertWheelFn) await _showAlertWheelFn(`Failed to remove stripe: ${e?.message || 'Unknown error'}`, 'Error');
          }
          return;
        }

        // Fallback
        if (_showAlertWheelFn) await _showAlertWheelFn('Outcome acknowledged.', 'Noted');
        if (wheelModalEl) wheelModalEl.classList.add('hidden');
        wheelAssignContainer.classList.add('hidden');
        wheelResultEl.textContent = '';
      };
    });
  };
}