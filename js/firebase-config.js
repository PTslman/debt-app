import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { getPerformance } from "firebase/performance";
import { getRemoteConfig } from "firebase/remote-config";
import { getAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

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
export const auth = getAuth(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export const performance = getPerformance(app);
export const remoteConfig = getRemoteConfig(app);

// App Check (للأمان)
try {
    const appCheck = getAppCheck(app);
    appCheck.provider = new ReCaptchaV3Provider('6Ld5X8QqAAAAAKXxZfXBHJX5n5RhTkY8WjEa-v8E');
} catch (e) {
    console.warn('App Check not available');
}

console.log('🔥 Firebase initialized');
