console.log('🛡️ Security module loaded');

export const SECURITY = {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000,
    SESSION_TIMEOUT: 30 * 60 * 1000,
    MAX_DEBT_AMOUNT: 999999999999,
    MAX_NAME_LENGTH: 100,
    MIN_PASSWORD_LENGTH: 8,
    RATE_LIMIT: 100
};

export class SecurityManager {
    constructor() {
        this.sessionTimeout = null;
        this.loginAttempts = {};
        this.currentUser = null;
        this.auditLog = [];
        this.rateLimit = new Map();
    }

    startSessionTimer() {
        this.clearSessionTimer();
        this.sessionTimeout = setTimeout(() => {
            this.logAudit('SESSION_EXPIRED', {});
            console.log('⏰ Session expired');
        }, SECURITY.SESSION_TIMEOUT);
    }

    clearSessionTimer() {
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
            this.sessionTimeout = null;
        }
    }

    logAudit(action, data) {
        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
            action,
            timestamp: new Date().toISOString(),
            user: this.currentUser?.uid || 'anonymous',
            data: data || {}
        };
        this.auditLog.push(entry);
        console.log(`📋 Audit: ${action}`, entry);
        return entry;
    }

    checkRateLimit(userId, action) {
        const key = `${userId}_${action}`;
        const now = Date.now();
        const limit = this.rateLimit.get(key) || [];
        const recent = limit.filter(time => now - time < 60000);
        if (recent.length >= SECURITY.RATE_LIMIT) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }
        recent.push(now);
        this.rateLimit.set(key, recent);
        return true;
    }
}

export const securityManager = new SecurityManager();
console.log('✅ Security module ready');
