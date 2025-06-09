// public/js/firebase.js

// Import necessary Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, query, arrayUnion, arrayRemove, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

const addRuleToFirestore = async (text, order) => {
    await addDoc(rulesCollectionRef, { text, order, createdAt: new Date() });
};

const deleteRuleFromFirestore = async (docId) => {
    const docRef = doc(db, 'rules', docId);
    await deleteDoc(docRef);
};

const updateRuleOrderInFirestore = async (rule1, rule2) => {
    const batch = writeBatch(db);

    const rule1Ref = doc(db, "rules", rule1.id);
    batch.update(rule1Ref, { order: rule2.order });

    const rule2Ref = doc(db, "rules", rule2.id);
    batch.update(rule2Ref, { order: rule1.order });

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
    updateRuleOrderInFirestore
};