import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBSQD0eam2rAczlUqnV4zIUjYey1Yyic_I",
    authDomain: "slx23m.firebaseapp.com",
    projectId: "slx23m",
    storageBucket: "slx23m.firebasestorage.app",
    messagingSenderId: "903745007698",
    appId: "1:903745007698:web:2c1aa9ab9aed95ad2eaf8b",
    measurementId: "G-71BB42PCEF"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

console.log('🔥 Firebase initialized - Cloud Storage Only');
