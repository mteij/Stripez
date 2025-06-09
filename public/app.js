// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, query, arrayUnion, arrayRemove, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- START: PASTE YOUR FIREBASE CONFIGURATION HERE ---
const firebaseConfig = {
    apiKey: "AIzaSyD2FN2MCUmoKl7geOIXnYTXhD6tyISDNbc",
    authDomain: "schikko-rules.firebaseapp.com",
    projectId: "schikko-rules",
    storageBucket: "schikko-rules.appspot.com",
    messagingSenderId: "1068996301922",
    appId: "1:1068996301922:web:caded5196923e393106d3b"
};
// --- END: PASTE YOUR FIREBASE CONFIGURATION HERE ---

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUserId = null;
let ledgerDataCache = []; // Cache for holding ledger data
let stripeChart = null; // To hold the chart instance
let currentSortOrder = 'asc'; // 'asc' or 'desc'
let currentSearchTerm = '';

// --- DOM ELEMENTS ---
const newNameInput = document.getElementById('new-name-input');
const addNameBtn = document.getElementById('add-name-btn');
const punishmentListDiv = document.getElementById('punishment-list');
const loadingState = document.getElementById('loading-state');
const statsModal = document.getElementById('stats-modal');
const closeStatsModalBtn = document.getElementById('close-stats-modal');
const statsName = document.getElementById('stats-name');
const stripeChartCanvas = document.getElementById('stripe-chart').getContext('2d');
const searchInput = document.getElementById('search-input');
const sortAscBtn = document.getElementById('sort-asc-btn');
const sortDescBtn = document.getElementById('sort-desc-btn');


// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        setupRealtimeListener();
    } else {
        signInAnonymously(auth).catch((error) => console.error("Anonymous sign-in failed:", error));
    }
});

// --- RENDER & DISPLAY LOGIC ---

const renderLedger = () => {
    // 1. Filter data based on search term
    let viewData = ledgerDataCache.filter(person =>
        person.name.toLowerCase().includes(currentSearchTerm.toLowerCase())
    );

    // 2. Sort the filtered data
    viewData.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        return currentSortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    punishmentListDiv.innerHTML = '';

    if (viewData.length === 0) {
        const message = currentSearchTerm ? "No transgressors match your search." : "The ledger is clear. No transgressions recorded.";
        punishmentListDiv.innerHTML = `<div class="text-center text-xl text-[#6f4e37]">${message}</div>`;
        return;
    }

    viewData.forEach(person => {
        const stripeCount = Array.isArray(person.stripes) ? person.stripes.length : 0;
        let stripesHTML = '';
        for (let i = 0; i < stripeCount; i++) {
            stripesHTML += `<div class="punishment-stripe"></div>`;
        }

        const personDiv = document.createElement('div');
        personDiv.className = 'flex items-center justify-between bg-[#f5eeda] p-4 rounded-lg border-2 border-[#b9987e]';
        personDiv.innerHTML = `
            <div class="flex-grow cursor-pointer" data-action="show-stats" data-id="${person.id}">
                <p class="text-xl md:text-2xl font-bold text-[#5c3d2e]">${person.name}</p>
                <div class="mt-2 h-5">${stripesHTML}</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <button data-action="add-stripe" data-id="${person.id}" class="btn-ancient text-sm sm:text-base font-bold py-2 px-4 rounded-md">Add Stripe</button>
                <div class="relative">
                    <button data-action="toggle-menu" data-id="${person.id}" class="btn-ancient text-lg font-bold py-2 px-3 rounded-md">
                        &#x22EE;
                    </button>
                    <div id="menu-${person.id}" class="hidden absolute right-0 mt-2 w-52 bg-[#fdf8e9] border-2 border-[#8c6b52] rounded-md shadow-lg z-10">
                        <a href="#" data-action="remove-stripe" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Remove Last Stripe</a>
                        <a href="#" data-action="rename" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Rename</a>
                        <div class="border-t border-[#b9987e] my-1"></div>
                        <a href="#" data-action="delete" data-id="${person.id}" class="block px-4 py-2 text-md text-red-700 hover:bg-[#f5eeda] hover:text-red-800 font-bold">Delete Person</a>
                    </div>
                </div>
            </div>
        `;
        punishmentListDiv.appendChild(personDiv);
    });
};

const showStatsModal = (person) => {
    // ... (This function remains unchanged)
};


// --- FIRESTORE & DATA LOGIC ---

const setupRealtimeListener = () => {
    onSnapshot(query(ledgerCollectionRef), (snapshot) => {
        loadingState.style.display = 'none';
        ledgerDataCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderLedger();
    }, (error) => {
        console.error("Error fetching ledger:", error);
    });
};

const handleAddName = async () => { /* ... (Unchanged) */ };
const handleAddStripe = async (docId) => { /* ... (Unchanged) */ };
const handleRemoveStripe = async (docId) => { /* ... (Unchanged) */ };
const handleRename = async (docId) => { /* ... (Unchanged) */ };
const handleDeletePerson = async (docId) => { /* ... (Unchanged) */ };

// --- EVENT LISTENERS ---

// Listener for adding a new name
addNameBtn.addEventListener('click', handleAddName);

// Listeners for search and sort
searchInput.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value;
    renderLedger();
});

sortAscBtn.addEventListener('click', () => {
    currentSortOrder = 'asc';
    sortAscBtn.classList.add('opacity-50');
    sortDescBtn.classList.remove('opacity-50');
    renderLedger();
});

sortDescBtn.addEventListener('click', () => {
    currentSortOrder = 'desc';
    sortDescBtn.classList.add('opacity-50');
    sortAscBtn.classList.remove('opacity-50');
    renderLedger();
});


// Main listener for actions on the punishment list
punishmentListDiv.addEventListener('click', (e) => { /* ... (Unchanged) */ });

// Listener to close menus and modals
document.addEventListener('click', (e) => { /* ... (Unchanged) */ });
closeStatsModalBtn.addEventListener('click', () => { /* ... (Unchanged) */ });

// Set initial sort button state
sortAscBtn.classList.add('opacity-50');