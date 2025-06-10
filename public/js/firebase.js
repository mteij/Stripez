// public/js/firebase.js

// Import necessary Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, query, arrayUnion, arrayRemove, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 

// Firebase configuration. These placeholders will be replaced by GitHub Actions
// during the build/deploy process using a string replacement utility.
const firebaseConfig = {
    apiKey: "VITE_FIREBASE_API_KEY",
    authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
    projectId: "VITE_FIREBASE_PROJECT_ID",
    storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
    appId: "VITE_FIREBASE_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- COLLECTION REFERENCES ---
const ledgerCollectionRef = collection(db, 'punishments');
const rulesCollectionRef = collection(db, 'rules');

// --- DATABASE AND AUTH FUNCTIONS ---

/**
 * Sets up a real-time listener for a specified collection.
 * @param {string} collectionName - The name of the collection ('punishments' or 'rules').
 * @param {Function} callback - The function to call with the updated data.
 */
const setupRealtimeListener = (collectionName, callback) => {
    const collRef = collectionName === 'rules' ? rulesCollectionRef : ledgerCollectionRef;
    onSnapshot(query(collRef), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => console.error("Error fetching ledger:", error));
};

const addNameToLedger = async (name, userId) => {
    await addDoc(ledgerCollectionRef, { name, stripes: [], drunkenStripes: [], addedBy: userId }); 
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

const addRuleToFirestore = async (text, order) => {
    await addDoc(rulesCollectionRef, { text, order, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
};

const deleteRuleFromFirestore = async (docId) => {
    const docRef = doc(db, 'rules', docId);
    await deleteDoc(docRef);
};

const updateRuleOrderInFirestore = async (rule1, rule2) => {
    const batch = writeBatch(db);

    const rule1Ref = doc(db, "rules", rule1.id);
    batch.update(rule1Ref, { order: rule2.order, updatedAt: serverTimestamp() });

    const rule2Ref = doc(db, "rules", rule2.id);
    batch.update(rule2Ref, { order: rule1.order, updatedAt: serverTimestamp() });

    await batch.commit();
};

// New function to update rule text
const updateRuleTextInFirestore = async (docId, newText) => {
    const docRef = doc(db, 'rules', docId);
    await updateDoc(docRef, { text: newText.trim(), updatedAt: serverTimestamp() });
};

/**
 * Adds 'count' drunk stripes to a person's document.
 * Ensures each timestamp is distinct to prevent deduplication by Firestore.
 * @param {string} docId - The document ID of the person.
 * @param {number} count - The number of drunk stripes to add.
 */
const addDrunkStripeToPerson = async (docId, count) => { 
    const docRef = doc(db, 'punishments', docId);
    const batch = writeBatch(db); 

    for (let i = 0; i < count; i++) {
        // Create a distinct timestamp for each stripe.
        // Adding 'i' milliseconds ensures uniqueness even if calls are very fast.
        const distinctTimestamp = new Date(Date.now() + i); 
        batch.update(docRef, { drunkenStripes: arrayUnion(distinctTimestamp) }); 
    }
    
    await batch.commit();
};

/**
 * Removes the last added drunk stripe from a person's document.
 * @param {object} person - The person object from the ledger.
 */
const removeLastDrunkStripeFromPerson = async (person) => {
    if (person && Array.isArray(person.drunkenStripes) && person.drunkenStripes.length > 0) {
        const docRef = doc(db, 'punishments', person.id);
        // Sort by timestamp (most recent first) to remove the last one added
        const sortedDrunkStripes = [...person.drunkenStripes].sort((a, b) => b.toMillis() - a.toMillis());
        const lastDrunkStripe = sortedDrunkStripes[0];
        await updateDoc(docRef, { drunkenStripes: arrayRemove(lastDrunkStripe) });
    }
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
    deletePersonFromLedger,
    addRuleToFirestore,
    deleteRuleFromFirestore,
    updateRuleOrderInFirestore,
    updateRuleTextInFirestore,
    addDrunkStripeToPerson, 
    removeLastDrunkStripeFromPerson // New: Export the new function
};