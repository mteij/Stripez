// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, query, arrayUnion, arrayRemove, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// --- DOM ELEMENTS ---
const newNameInput = document.getElementById('new-name-input');
const addNameBtn = document.getElementById('add-name-btn');
const punishmentListDiv = document.getElementById('punishment-list');
const loadingState = document.getElementById('loading-state');
const statsModal = document.getElementById('stats-modal');
const closeStatsModalBtn = document.getElementById('close-stats-modal');
const statsName = document.getElementById('stats-name');
const stripeChartCanvas = document.getElementById('stripe-chart').getContext('2d');

// --- FIRESTORE COLLECTION REFERENCE ---
const ledgerCollectionRef = collection(db, 'punishments');

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        console.log("Authenticated with user ID:", currentUserId);
        setupRealtimeListener();
    } else {
        signInAnonymously(auth).catch((error) => console.error("Anonymous sign-in failed:", error));
    }
});

// --- RENDER & DISPLAY LOGIC ---

const renderLedger = () => {
    punishmentListDiv.innerHTML = '';
    if (ledgerDataCache.length === 0) {
        punishmentListDiv.innerHTML = `<div class="text-center text-xl text-[#6f4e37]">The ledger is clear. No transgressions recorded.</div>`;
        return;
    }

    const sortedData = [...ledgerDataCache].sort((a, b) => a.name.localeCompare(b.name));

    sortedData.forEach(person => {
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
            <div class="relative">
                <button data-action="toggle-menu" data-id="${person.id}" class="btn-ancient text-lg font-bold py-2 px-3 rounded-md">
                    &#x22EE;
                </button>
                <div id="menu-${person.id}" class="hidden absolute right-0 mt-2 w-48 bg-[#fdf8e9] border-2 border-[#8c6b52] rounded-md shadow-lg z-10">
                    <a href="#" data-action="add-stripe" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Add Stripe</a>
                    <a href="#" data-action="remove-stripe" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Remove Stripe</a>
                    <a href="#" data-action="rename" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Rename</a>
                </div>
            </div>
        `;
        punishmentListDiv.appendChild(personDiv);
    });
};

const showStatsModal = (person) => {
    statsName.textContent = `Statistics for ${person.name}`;
    const stripeTimestamps = person.stripes.map(ts => ts.toDate());

    // Group stripes by date
    const stripesByDate = stripeTimestamps.reduce((acc, date) => {
        const dateString = date.toISOString().split('T')[0];
        acc[dateString] = (acc[dateString] || 0) + 1;
        return acc;
    }, {});

    const chartData = {
        labels: Object.keys(stripesByDate),
        datasets: [{
            label: 'Stripes per Day',
            data: Object.values(stripesByDate),
            backgroundColor: 'rgba(192, 57, 43, 0.7)',
            borderColor: 'rgba(127, 34, 25, 1)',
            borderWidth: 1
        }]
    };

    if (stripeChart) {
        stripeChart.destroy();
    }

    stripeChart = new Chart(stripeChartCanvas, {
        type: 'bar',
        data: chartData,
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    },
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Stripes'
                    },
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });

    statsModal.classList.remove('hidden');
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

const handleAddName = async () => {
    const name = newNameInput.value.trim();
    if (!name) return;
    await addDoc(ledgerCollectionRef, { name, stripes: [], addedBy: currentUserId });
    newNameInput.value = '';
};

const handleAddStripe = async (docId) => {
    const docRef = doc(db, 'punishments', docId);
    await updateDoc(docRef, { stripes: arrayUnion(serverTimestamp()) });
};

const handleRemoveStripe = async (docId) => {
    const person = ledgerDataCache.find(p => p.id === docId);
    if (person && Array.isArray(person.stripes) && person.stripes.length > 0) {
        const docRef = doc(db, 'punishments', docId);
        
        // Sort stripes by timestamp to find the most recent one.
        const sortedStripes = [...person.stripes].sort((a, b) => b.toMillis() - a.toMillis());
        const lastStripe = sortedStripes[0];
        
        // Use arrayRemove to delete the most recent stripe.
        await updateDoc(docRef, { stripes: arrayRemove(lastStripe) });
    }
};

const handleRename = async (docId) => {
    const person = ledgerDataCache.find(p => p.id === docId);
    if (!person) return;
    const newName = prompt("Enter the new name for " + person.name, person.name);
    if (newName && newName.trim() !== "") {
        const docRef = doc(db, 'punishments', docId);
        await updateDoc(docRef, { name: newName.trim() });
    }
};

// --- EVENT LISTENERS ---
addNameBtn.addEventListener('click', handleAddName);

punishmentListDiv.addEventListener('click', (e) => {
    e.preventDefault();
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;

    // Hide all open menus whenever an action is taken
    document.querySelectorAll('[id^="menu-"]').forEach(menu => menu.classList.add('hidden'));

    switch (action) {
        case 'toggle-menu':
            // Re-open the clicked one
            document.getElementById(`menu-${id}`)?.classList.toggle('hidden');
            break;
        case 'add-stripe':
            handleAddStripe(id);
            break;
        case 'remove-stripe':
            handleRemoveStripe(id);
            break;
        case 'rename':
            handleRename(id);
            break;
        case 'show-stats':
            const person = ledgerDataCache.find(p => p.id === id);
            if (person) showStatsModal(person);
            break;
    }
});

// Hide dropdown menus if clicking elsewhere
document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="toggle-menu"]') && !e.target.closest('[id^="menu-"]')) {
        document.querySelectorAll('[id^="menu-"]').forEach(menu => menu.classList.add('hidden'));
    }
});

closeStatsModalBtn.addEventListener('click', () => {
    statsModal.classList.add('hidden');
});