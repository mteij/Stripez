// public/js/firebase.js

// Import necessary Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, query, arrayUnion, arrayRemove, deleteDoc, writeBatch, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Added getDoc

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
    await addDoc(ledgerCollectionRef, { name, stripes: [], drunkenStripes: [], addedBy: userId }); // Added drunkenStripes array
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
 * Adds 'count' drunken stripes to a person's document and fulfills normal stripes.
 * @param {string} docId - The document ID of the person.
 * @param {number} count - The number of drunken stripes to add/fulfill.
 */
const addDrunkenStripeToPerson = async (docId, count) => {
    const docRef = doc(db, 'punishments', docId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        console.error("Document does not exist for ID:", docId);
        return;
    }
    const person = docSnap.data();

    let currentStripes = [...(person.stripes || [])];
    let currentDrunkenStripes = [...(person.drunkenStripes || [])];

    const stripesToFulfill = Math.min(count, currentStripes.length); // Fulfill up to the available normal stripes

    if (stripesToFulfill === 0) {
        console.warn("No normal stripes to fulfill.");
        return;
    }

    // Sort existing stripes by timestamp to remove the oldest ones first
    currentStripes.sort((a, b) => a.toMillis() - b.toMillis());
    currentStripes.splice(0, stripesToFulfill); // Remove the oldest 'stripesToFulfill' normal stripes
    
    // Add new timestamps to drunkenStripes for the fulfilled amount
    const newDrunkenTimestamps = Array.from({ length: stripesToFulfill }, () => new Date());
    currentDrunkenStripes = currentDrunkenStripes.concat(newDrunkenTimestamps);

    const batch = writeBatch(db);
    batch.update(docRef, {
        stripes: currentStripes,
        drunkenStripes: currentDrunkenStripes
    });
    await batch.commit();
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
    addDrunkenStripeToPerson // Export the new function
};