import { auth } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
    updateEmail,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    GoogleAuthProvider,
    signInWithPopup,
    sendEmailVerification,
    setPersistence,
    browserLocalPersistence
} from "firebase/auth";

console.log('🔐 Auth module loaded');

export const login = async (email, password) => {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Login successful:', result.user.email);
        return result;
    } catch (error) {
        console.error('❌ Login error:', error);
        throw error;
    }
};

export const register = async (email, password, displayName) => {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) await updateProfile(result.user, { displayName });
        await sendEmailVerification(result.user);
        console.log('✅ Register successful:', result.user.email);
        return result;
    } catch (error) {
        console.error('❌ Register error:', error);
        throw error;
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
        console.log('✅ Logout successful');
        return true;
    } catch (error) {
        console.error('❌ Logout error:', error);
        throw error;
    }
};

export const resetPassword = async (email) => {
    try {
        await sendPasswordResetEmail(auth, email);
        console.log('✅ Password reset email sent');
        return true;
    } catch (error) {
        console.error('❌ Reset password error:', error);
        throw error;
    }
};

export const changePassword = async (currentPassword, newPassword) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        console.log('✅ Password changed');
        return true;
    } catch (error) {
        console.error('❌ Change password error:', error);
        throw error;
    }
};

export { auth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence };
console.log('✅ Auth module ready');
