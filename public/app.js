// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, query, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- START: PASTE YOUR FIREBASE CONFIGURATION HERE ---
// Replace this with the firebaseConfig object from your project's settings.
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

// --- AUTHENTICATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in.
        currentUserId = user.uid;
        console.log("Authenticated with user ID:", currentUserId);
        setupRealtimeListener();
    } else {
        // User is signed out, sign them in anonymously.
        signInAnonymously(auth).catch((error) => {
            console.error("Anonymous sign-in failed:", error);
            document.getElementById('loading-state').textContent = 'Error: Could not connect to the database.';
        });
    }
});

// --- DOM ELEMENTS ---
const newNameInput = document.getElementById('new-name-input');
const addNameBtn = document.getElementById('add-name-btn');
const punishmentListDiv = document.getElementById('punishment-list');
const loadingState = document.getElementById('loading-state');

// --- FIRESTORE COLLECTION REFERENCE ---
const ledgerCollectionRef = collection(db, 'punishments');

// --- FUNCTIONS ---

const renderLedger = (ledgerData) => {
    punishmentListDiv.innerHTML = ''; 
    if(ledgerData.length === 0) {
         punishmentListDiv.innerHTML = `<div class="text-center text-xl text-[#6f4e37]">The ledger is clear. No transgressions recorded.</div>`;
         return;
    }

    // Sort data alphabetically by name
    ledgerData.sort((a, b) => a.name.localeCompare(b.name));

    ledgerData.forEach(person => {
        const personDiv = document.createElement('div');
        personDiv.className = 'flex items-center justify-between bg-[#f5eeda] p-4 rounded-lg border-2 border-[#b9987e]';

        let stripesHTML = '';
        for (let i = 0; i < person.stripes; i++) {
            stripesHTML += `<div class="punishment-stripe"></div>`;
        }

        personDiv.innerHTML = `
            <div>
                <p class="text-xl md:text-2xl font-bold text-[#5c3d2e]">${person.name}</p>
                <div class="mt-2 h-5">${stripesHTML}</div>
            </div>
            <button data-id="${person.id}" class="add-stripe-btn btn-ancient text-sm sm:text-base font-bold py-2 px-4 rounded-md">Add Stripe</button>
        `;
        punishmentListDiv.appendChild(personDiv);
    });
};

const setupRealtimeListener = () => {
    const q = query(ledgerCollectionRef);
    onSnapshot(q, (snapshot) => {
        loadingState.style.display = 'none';
        const ledger = [];
        snapshot.forEach(doc => {
            ledger.push({ id: doc.id, ...doc.data() });
        });
        renderLedger(ledger);
    }, (error) => {
        console.error("Error fetching ledger:", error);
        punishmentListDiv.innerHTML = `<div class="text-center text-xl text-red-700">Failed to load the sacred ledger. Check database rules.</div>`;
    });
};

const handleAddName = async () => {
    const name = newNameInput.value.trim();
    if (name === '') {
        newNameInput.focus();
        return;
    }
    try {
        await addDoc(ledgerCollectionRef, { name: name, stripes: 0, addedBy: currentUserId });
        newNameInput.value = '';
    } catch (error) {
        console.error("Error adding document: ", error);
    }
};

const handleAddStripe = async (docId) => {
    if (!docId) return;
    const docRef = doc(db, 'punishments', docId);
    try {
        await updateDoc(docRef, { stripes: increment(1) });
    } catch (error) {
        console.error("Error updating document: ", error);
    }
};

// --- EVENT LISTENERS ---
addNameBtn.addEventListener('click', handleAddName);

// Use event delegation for the stripe buttons
punishmentListDiv.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('add-stripe-btn')) {
        const docId = e.target.getAttribute('data-id');
        handleAddStripe(docId);
    }
});
