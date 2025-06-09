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
let ledgerDataCache = [];
let stripeChart = null;
let currentSortOrder = 'asc';
let currentSearchTerm = '';

// --- DOM ELEMENTS ---
const punishmentListDiv = document.getElementById('punishment-list');
const loadingState = document.getElementById('loading-state');
const statsModal = document.getElementById('stats-modal');
const closeStatsModalBtn = document.getElementById('close-stats-modal');
const statsName = document.getElementById('stats-name');
const stripeChartCanvas = document.getElementById('stripe-chart').getContext('2d');
const mainInput = document.getElementById('main-input');
const addBtn = document.getElementById('add-btn');
const sortSelect = document.getElementById('sort-select');
const sortButtonText = document.getElementById('sort-button-text');

// --- FIRESTORE COLLECTION REFERENCE ---
const ledgerCollectionRef = collection(db, 'punishments');

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
    let viewData = [...ledgerDataCache];
    const term = currentSearchTerm.toLowerCase();

    if (term) {
        viewData = viewData.filter(person => person.name.toLowerCase().includes(term));
    }

    viewData.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();

        if (term) {
            const aStartsWith = nameA.startsWith(term);
            const bStartsWith = nameB.startsWith(term);
            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;
        }

        switch (currentSortOrder) {
            case 'stripes_desc':
                return (b.stripes?.length || 0) - (a.stripes?.length || 0);
            case 'stripes_asc':
                return (a.stripes?.length || 0) - (b.stripes?.length || 0);
            case 'desc':
                return nameB.localeCompare(nameA);
            case 'asc':
            default:
                return nameA.localeCompare(nameB);
        }
    });

    punishmentListDiv.innerHTML = '';
    if (viewData.length === 0) {
        const message = term ? "No transgressors match your search." : "The ledger is clear. No transgressions recorded.";
        punishmentListDiv.innerHTML = `<div class="text-center text-xl text-[#6f4e37]">${message}</div>`;
        return;
    }

    viewData.forEach(person => {
        const stripeCount = person.stripes?.length || 0;
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
                    <button data-action="toggle-menu" data-id="${person.id}" class="btn-ancient text-lg font-bold py-2 px-3 rounded-md">&#x22EE;</button>
                    <div id="menu-${person.id}" class="hidden absolute right-0 mt-2 w-52 bg-[#fdf8e9] border-2 border-[#8c6b52] rounded-md shadow-lg z-10">
                        <a href="#" data-action="remove-stripe" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Remove Last Stripe</a>
                        <a href="#" data-action="rename" data-id="${person.id}" class="block px-4 py-2 text-md text-[#5c3d2e] hover:bg-[#f5eeda]">Rename</a>
                        <div class="border-t border-[#b9987e] my-1"></div>
                        <a href="#" data-action="delete" data-id="${person.id}" class="block px-4 py-2 text-md text-red-700 hover:bg-[#f5eeda] hover:text-red-800 font-bold">Delete Person</a>
                    </div>
                </div>
            </div>`;
        punishmentListDiv.appendChild(personDiv);
    });
};

const showStatsModal = (person) => {
    statsName.textContent = `Statistics for ${person.name}`;

    const stripeTimestamps = person.stripes.map(ts => ts.toDate()).sort((a, b) => a - b);

    const cumulativeData = stripeTimestamps.map((ts, index) => ({
        x: ts,
        y: index + 1
    }));
    
    if (stripeTimestamps.length > 0) {
        cumulativeData.unshift({ x: stripeTimestamps[0], y: 0 });
    }

    const chartData = {
        datasets: [{
            label: 'Total Stripes Over Time',
            data: cumulativeData,
            borderColor: 'rgba(192, 57, 43, 1)',
            backgroundColor: 'rgba(192, 57, 43, 0.2)',
            fill: true,
            tension: 0.4 // This makes the line curved and smooth
        }]
    };

    if (stripeChart) stripeChart.destroy();

    stripeChart = new Chart(stripeChartCanvas, {
        type: 'line',
        data: chartData,
        options: {
            scales: {
                x: {
                    type: 'time',
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Total Stripes'
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
    }, (error) => console.error("Error fetching ledger:", error));
};

const handleAddName = async () => {
    const name = mainInput.value.trim();
    if (!name) return;
    const exists = ledgerDataCache.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        alert(`"${name}" is already on the ledger.`);
        return;
    }
    await addDoc(ledgerCollectionRef, { name, stripes: [], addedBy: currentUserId });
    mainInput.value = '';
    currentSearchTerm = '';
    renderLedger();
};

const handleAddStripe = async (docId) => {
    const docRef = doc(db, 'punishments', docId);
    try {
        await updateDoc(docRef, { stripes: arrayUnion(new Date()) });
    } catch (error) {
        console.error("Error adding stripe:", error);
    }
};

const handleRemoveStripe = async (docId) => {
    const person = ledgerDataCache.find(p => p.id === docId);
    if (person && Array.isArray(person.stripes) && person.stripes.length > 0) {
        const docRef = doc(db, 'punishments', docId);
        const sortedStripes = [...person.stripes].sort((a, b) => b.toMillis() - a.toMillis());
        const lastStripe = sortedStripes[0];
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

const handleDeletePerson = async (docId) => {
    const person = ledgerDataCache.find(p => p.id === docId);
    if (!person) return;
    if (confirm(`Are you sure you want to remove "${person.name}" from the ledger? This action cannot be undone.`)) {
        const docRef = doc(db, 'punishments', docId);
        await deleteDoc(docRef).catch(error => console.error("Error removing document: ", error));
    }
};

// --- EVENT LISTENERS ---
mainInput.addEventListener('input', () => {
    currentSearchTerm = mainInput.value;
    renderLedger();
});

mainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleAddName();
    }
});

addBtn.addEventListener('click', handleAddName);

sortSelect.addEventListener('change', (e) => {
    currentSortOrder = e.target.value;
    const selectedOptionText = e.target.options[e.target.selectedIndex].text;
    sortButtonText.textContent = `Sort: ${selectedOptionText}`;
    renderLedger();
});

punishmentListDiv.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    e.preventDefault();
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (action !== 'toggle-menu') {
        document.querySelectorAll('[id^="menu-"]').forEach(menu => menu.classList.add('hidden'));
    }
    switch (action) {
        case 'toggle-menu':
            document.getElementById(`menu-${id}`)?.classList.toggle('hidden');
            break;
        case 'add-stripe': handleAddStripe(id); break;
        case 'remove-stripe': handleRemoveStripe(id); break;
        case 'rename': handleRename(id); break;
        case 'delete': handleDeletePerson(id); break;
        case 'show-stats':
            const person = ledgerDataCache.find(p => p.id === id);
            if (person) showStatsModal(person);
            break;
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="toggle-menu"]') && !e.target.closest('[id^="menu-"]')) {
        document.querySelectorAll('[id^="menu-"]').forEach(menu => menu.classList.add('hidden'));
    }
});

closeStatsModalBtn.addEventListener('click', () => statsModal.classList.add('hidden'));