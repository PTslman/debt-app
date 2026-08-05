// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBSQD0eam2rAczlUqnV4zIUjYey1Yyic_I",
    authDomain: "slx23m.firebaseapp.com",
    projectId: "slx23m",
    storageBucket: "slx23m.firebasestorage.app",
    messagingSenderId: "903745007698",
    appId: "1:903745007698:web:2c1aa9ab9aed95ad2eaf8b",
    measurementId: "G-71BB42PCEF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const db = getFirestore(app);
export const auth = getAuth(app);

console.log('🔥 Firebase initialized');
console.log('📁 Project ID:', firebaseConfig.projectId);
console.log('👤 Auth service ready');
console.log('📦 Firestore service ready');
