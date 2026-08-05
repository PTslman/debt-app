console.log('🔐 Encryption module loaded');

const ENCRYPTION_KEY = 'debt-app-secure-key-2024';

export function encryptData(data, key = ENCRYPTION_KEY) {
    try {
        const jsonString = JSON.stringify(data);
        const encoded = btoa(jsonString);
        let encrypted = '';
        for (let i = 0; i < encoded.length; i++) {
            const charCode = encoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            encrypted += String.fromCharCode(charCode);
        }
        return btoa(encrypted);
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

export function decryptData(encrypted, key = ENCRYPTION_KEY) {
    try {
        const decoded = atob(encrypted);
        let decrypted = '';
        for (let i = 0; i < decoded.length; i++) {
            const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            decrypted += String.fromCharCode(charCode);
        }
        const jsonString = atob(decrypted);
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

export function generateSecureId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const uuid = crypto.randomUUID ? crypto.randomUUID().substring(0, 8) : Math.random().toString(36).substring(2, 10);
    return `${timestamp}_${random}_${uuid}`;
}

export default { encryptData, decryptData, generateSecureId, ENCRYPTION_KEY };
console.log('✅ Encryption module ready');
