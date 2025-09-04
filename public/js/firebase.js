// public/js/firebase.js

// Import necessary Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, query, arrayUnion, arrayRemove, deleteDoc, writeBatch, serverTimestamp, getDoc, setDoc, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

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
const configCollectionRef = collection(db, 'config');
const activityLogCollectionRef = collection(db, 'activity_log');

// --- SECURE CALLABLE WRAPPER ---
const functionsClient = getFunctions(undefined, "europe-west4");
const schikkoActionCallable = httpsCallable(functionsClient, 'schikkoAction');
export const callSchikkoAction = async (action, data = {}) => {
  const sessionId = sessionStorage.getItem('schikkoSessionId');
  const res = await schikkoActionCallable({ action, sessionId, ...data });
  return res.data;
};

// --- DATABASE AND AUTH FUNCTIONS ---

/**
 * Sets up a real-time listener for a specified collection.
 * @param {string} collectionName - The name of the collection ('punishments', 'rules', or 'activity_log').
 * @param {Function} callback - The function to call with the updated data.
 */
const setupRealtimeListener = (collectionName, callback) => {
    let collRef;
    let q; // query variable
    switch (collectionName) {
        case 'rules':
            collRef = rulesCollectionRef;
            q = query(collRef);
            break;
        case 'activity_log':
            collRef = activityLogCollectionRef;
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            q = query(collRef, where("timestamp", ">=", thirtyDaysAgo));
            break;
        default:
            collRef = ledgerCollectionRef;
            q = query(collRef);
            break;
    }

    onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(data);
    }, (error) => console.error(`Error fetching ${collectionName}:`, error));
};

/**
 * Logs an action to the activity_log collection.
 * @param {string} action - A short code for the action (e.g., 'ADD_STRIPE').
 * @param {string} actor - 'Schikko' or 'Guest'.
 * @param {string} details - A human-readable description of the event.
 */
const logActivity = async (action, actor, details) => {
    try {
        await addDoc(activityLogCollectionRef, {
            action,
            actor,
            details,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};

const getCalendarConfig = async () => {
    const docRef = doc(db, 'config', 'calendar');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        return { url: null };
    }
};

const saveCalendarUrl = async (url) => {
    await callSchikkoAction('saveCalendarUrl', { url });
};

const getNicatDate = async () => {
    const docRef = doc(db, 'config', 'nicat');
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : { date: null };
};

const saveNicatDate = async (dateString) => {
    await callSchikkoAction('saveNicatDate', { dateString });
};

const addNameToLedger = async (name, userId) => {
    await callSchikkoAction('addPerson', { name });
};

const addStripeToPerson = async (docId, count = 1) => {
    await callSchikkoAction('addStripe', { docId, count });
};

const removeLastStripeFromPerson = async (person) => {
    if (!person?.id) return;
    await callSchikkoAction('removeLastStripe', { docId: person.id });
};

const renamePersonOnLedger = async (docId, newName) => {
    await callSchikkoAction('renamePerson', { docId, newName });
};

const deletePersonFromLedger = async (docId) => {
    await callSchikkoAction('deletePerson', { docId });
};

const addRuleToFirestore = async (text, order) => {
    await callSchikkoAction('addRule', { text, order });
};

const deleteRuleFromFirestore = async (docId) => {
    await callSchikkoAction('deleteRule', { docId });
};

const updateRuleOrderInFirestore = async (rule1, rule2) => {
    await callSchikkoAction('updateRuleOrder', { rule1, rule2 });
};

const updateRuleInFirestore = async (docId, newText, tags) => {
    await callSchikkoAction('updateRule', { docId, text: newText.trim(), tags });
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
        batch.update(docRef, { drunkStripes: arrayUnion(distinctTimestamp) }); // Changed to 'drunkStripes'
    }
    
    await batch.commit();
};

/**
 * Removes the last added drunk stripe from a person's document.
 * @param {object} person - The person object from the ledger.
 */
const removeLastDrunkStripeFromPerson = async (person) => {
    if (!person?.id) return;
    await callSchikkoAction('removeLastDrunkStripe', { docId: person.id });
};


// Export everything needed by other modules
export {
    auth,
    onAuthStateChanged,
    signInAnonymously,
    setupRealtimeListener,
    logActivity,
    addNameToLedger,
    addStripeToPerson,
    removeLastStripeFromPerson,
    renamePersonOnLedger,
    deletePersonFromLedger,
    addRuleToFirestore,
    deleteRuleFromFirestore,
    updateRuleOrderInFirestore,
    updateRuleInFirestore,
    addDrunkStripeToPerson, 
    removeLastDrunkStripeFromPerson,
    getCalendarConfig,
    saveCalendarUrl,
    getNicatDate,
    saveNicatDate
};