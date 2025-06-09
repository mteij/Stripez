// public/js/firebase.js

// Import necessary Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, query, arrayUnion, arrayRemove, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD2FN2MCUmoKl7geOIXnYTXhD6tyISDNbc",
    authDomain: "schikko-rules.firebaseapp.com",
    projectId: "schikko-rules",
    storageBucket: "schikko-rules.appspot.com",
    messagingSenderId: "1068996301922",
    appId: "1:1068996301922:web:caded5196923e393106d3b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const ledgerCollectionRef = collection(db, 'punishments');

// --- DATABASE AND AUTH FUNCTIONS ---

const setupRealtimeListener = (callback) => {
    onSnapshot(query(ledgerCollectionRef), (snapshot) => {
        const ledgerDataCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(ledgerDataCache);
    }, (error) => console.error("Error fetching ledger:", error));
};

const addNameToLedger = async (name, userId) => {
    await addDoc(ledgerCollectionRef, { name, stripes: [], addedBy: userId });
};

const addStripeToPerson = async (docId) => {
    const docRef = doc(db, 'punishments', docId);
    await updateDoc(docRef, { stripes: arrayUnion(new Date()) });
};

const removeLastStripeFromPerson = async (person) => {
    if (person && Array.isArray(person.stripes) && person.stripes.length > 0) {
        const docRef = doc(db, 'punishments', person.id);
        const sortedStripes = [...person.stripes].sort((a, b) => b.toMillis() - a.toMillis());
        const lastStripe = sortedStripes[0];
        await updateDoc(docRef, { stripes: arrayRemove(lastStripe) });
    }
};

const renamePersonOnLedger = async (docId, newName) => {
    const docRef = doc(db, 'punishments', docId);
    await updateDoc(docRef, { name: newName.trim() });
};

const deletePersonFromLedger = async (docId) => {
    const docRef = doc(db, 'punishments', docId);
    await deleteDoc(docRef).catch(error => console.error("Error removing document: ", error));
};

// Export everything needed by other modules
export {
    auth,
    onAuthStateChanged,
    signInAnonymously,
    setupRealtimeListener,
    addNameToLedger,
    addStripeToPerson,
    removeLastStripeFromPerson,
    renamePersonOnLedger,
    deletePersonFromLedger
};