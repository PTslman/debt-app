console.log('✅ Validation module loaded');

export const ValidationRules = {
    personName: {
        required: true,
        type: 'string',
        minLength: 2,
        maxLength: 100,
        pattern: /^[\u0621-\u064A\u0660-\u0669a-zA-Z0-9\s\-\.]+$/,
        message: 'اسم العميل غير صالح'
    },
    amount: {
        required: true,
        type: 'number',
        min: 0,
        max: 999999999999,
        message: 'المبلغ غير صالح'
    },
    date: {
        required: true,
        type: 'string',
        pattern: /^\d{4}-\d{2}-\d{2}$/,
        message: 'التاريخ غير صالح'
    },
    email: {
        required: true,
        type: 'string',
        pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        maxLength: 255,
        message: 'البريد الإلكتروني غير صالح'
    },
    password: {
        required: true,
        type: 'string',
        minLength: 8,
        maxLength: 100,
        message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'
    }
};

export function validate(data, rules) {
    const errors = {};
    const validData = {};
    for (const [field, rule] of Object.entries(rules)) {
        const value = data[field];
        if (rule.required && (value === undefined || value === null || value === '')) {
            errors[field] = `${field} مطلوب`;
            continue;
        }
        if (rule.type === 'string' && typeof value !== 'string') {
            errors[field] = `${field} يجب أن يكون نصاً`;
            continue;
        }
        if (rule.type === 'number' && (isNaN(value) || typeof value !== 'number')) {
            errors[field] = `${field} يجب أن يكون رقماً`;
            continue;
        }
        if (rule.minLength && value.length < rule.minLength) {
            errors[field] = `${field} يجب أن لا يقل عن ${rule.minLength} أحرف`;
            continue;
        }
        if (rule.maxLength && value.length > rule.maxLength) {
            errors[field] = `${field} يجب أن لا يتجاوز ${rule.maxLength} أحرف`;
            continue;
        }
        if (rule.min !== undefined && value < rule.min) {
            errors[field] = `${field} يجب أن يكون أكبر من ${rule.min}`;
            continue;
        }
        if (rule.max !== undefined && value > rule.max) {
            errors[field] = `${field} يجب أن يكون أقل من ${rule.max}`;
            continue;
        }
        if (rule.pattern && !rule.pattern.test(value)) {
            errors[field] = rule.message || `${field} غير صالح`;
            continue;
        }
        validData[field] = value;
    }
    return { valid: Object.keys(errors).length === 0, errors, data: validData };
}

export function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '').replace(/style=/gi, '').replace(/['"<>]/g, '').trim();
}

export default { validate, ValidationRules, sanitizeString };
console.log('✅ Validation module ready');
