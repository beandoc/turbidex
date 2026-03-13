// Firebase Configuration Template
// Replace the config object with your actual Firebase project settings
const firebaseConfig = {
    apiKey: "AIzaSyAsRTAK9ArNbCc94kXwZ2ydoNw8njhSjPU",
    authDomain: "turbidx.firebaseapp.com",
    projectId: "turbidx",
    storageBucket: "turbidx.firebasestorage.app",
    messagingSenderId: "882463079494",
    appId: "1:882463079494:web:4dd18a3bb51706e11e9e47",
    measurementId: "G-NV7LVFHBTM"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, addDoc, getDocs, doc, setDoc, query, where, orderBy, limit };
