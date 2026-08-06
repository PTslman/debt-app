// ============================================================
// FIREBASE CONFIGURATION - CORRECT SETTINGS
// ============================================================

import { initializeApp } from "firebase/app";
import { 
    getFirestore, 
    enableIndexedDbPersistence,
    enableMultiTabIndexedDbPersistence,
    initializeFirestore,
    memoryLocalCache,
    persistentLocalCache,
    persistentMultipleTabManager
} from "firebase/firestore";
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

// تهيئة Firebase
const app = initializeApp(firebaseConfig);

// تهيئة Firestore مع إعدادات المزامنة الصحيحة
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true,
    useFetchStreams: true,
    ignoreUndefinedProperties: true
});

// تمكين التخزين المحلي للمزامنة دون اتصال
enableIndexedDbPersistence(db, {
    synchronizeTabs: true
}).then(() => {
    console.log('✅ IndexedDB persistence enabled');
}).catch((err) => {
    console.warn('⚠️ Persistence error:', err);
});

// تصدير الخدمات
export { db };
export const auth = getAuth(app);

console.log('🔥 Firebase initialized successfully');
console.log('📁 Project ID:', firebaseConfig.projectId);
console.log('📦 Firestore with persistence ready');
console.log('🔄 Sync enabled');
