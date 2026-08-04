import { db } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, deleteDoc, doc, 
    updateDoc, query, where, onSnapshot 
} from "firebase/firestore";

let currentPersonId = null;
let editingDebtId = null;

console.log('🚀 تطبيق الديون بدأ العمل');

// ===== إدارة الأشخاص =====

// إضافة شخص جديد
window.addPerson = async function() {
    const nameInput = document.getElementById('personName');
    const name = nameInput.value.trim();
    const messageBox = document.getElementById('addPersonMessage');
    
    // إخفاء الرسائل السابقة
    messageBox.className = 'message-box';
    messageBox.style.display = 'none';
    
    if (!name) {
        showMessage('الرجاء إدخال اسم الشخص', 'error');
        nameInput.focus();
        return;
    }
    
    try {
        console.log('➕ جاري إضافة:', name);
        
        // التحقق من وجود الشخص مسبقاً
        const q = query(collection(db, "persons"), where("name", "==", name));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            showMessage(`⚠️ الشخص "${name}" موجود مسبقاً!`, 'error');
            nameInput.value = '';
            nameInput.focus();
            return;
        }
        
        // إضافة الشخص
        await addDoc(collection(db, "persons"), {
            name: name,
            createdAt: new Date().toISOString()
        });
        
        console.log('✅ تم إضافة:', name);
        nameInput.value = '';
        showMessage(`✅ تم إضافة "${name}" بنجاح`, 'success');
        nameInput.focus();
        
        // التحديث التلقائي سيحدث عبر onSnapshot
        
    } catch (error) {
        console.error('❌ خطأ في إضافة الشخص:', error);
        showMessage('❌ حدث خطأ: ' + error.message, 'error');
    }
};

// عرض رسائل
function showMessage(text, type = 'success') {
    const messageBox = document.getElementById('addPersonMessage');
    messageBox.textContent = text;
    messageBox.className = `message-box ${type} show`;
    messageBox.style.display = 'block';
    
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 4000);
}

// تحميل قائمة الأشخاص (مع تحديث تلقائي)
function loadPersons() {
    const q = query(collection(db, "persons"));
    
    // استخدام onSnapshot للتحديث التلقائي
    onSnapshot(q, async (snapshot) => {
        console.log('📋 تحديث قائمة الأشخاص:', snapshot.size);
        
        const persons = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // تحديث العداد
        document.getElementById('personsCount').textContent = persons.length;
        
        const container = document.getElementById('personsContainer');
        
        if (persons.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-plus"></i>
                    <p>لا يوجد أشخاص مسجلين</p>
                    <small style="color:#a0aec0;">أضف شخصاً جديداً باستخدام النموذج أعلاه</small>
                </div>
            `;
            return;
        }
        
        let html = '';
        for (const person of persons) {
            // جلب عدد الديون لكل شخص
            const debtsQuery = query(collection(db, "debts"), where("personId", "==", person.id));
            const debtsSnapshot = await getDocs(debtsQuery);
            const debtCount = debtsSnapshot.size;
            
            // الحرف الأول من الاسم للصورة الرمزية
            const firstLetter = person.name.charAt(0).toUpperCase();
            
            html += `
                <div class="person-card" onclick="showPersonDetails('${person.id}', '${person.name}')">
                    <button class="delete-person" onclick="event.stopPropagation(); deletePerson('${person.id}')" title="حذف الشخص">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="avatar">${firstLetter}</div>
                    <div class="name">${person.name}</div>
                    <div class="debt-count">${debtCount} دين</div>
                </div>
            `;
        }
        container.innerHTML = html;
        
    }, (error) => {
        console.error('❌ خطأ في الاستماع للتحديثات:', error);
        document.getElementById('personsContainer').innerHTML = `
            <div class="empty-state" style="color:#fc8181;">
                <i class="fas fa-exclamation-circle"></i>
                <p>حدث خطأ في تحميل البيانات</p>
                <small>${error.message}</small>
            </div>
        `;
    });
}

// حذف شخص
window.deletePerson = async function(personId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا الشخص وكل ديونه؟')) return;
    
    try {
        // حذف جميع ديون الشخص
        const debtsQuery = query(collection(db, "debts"), where("personId", "==", personId));
        const debtsSnapshot = await getDocs(debtsQuery);
        
        for (const debtDoc of debtsSnapshot.docs) {
            await deleteDoc(doc(db, "debts", debtDoc.id));
        }
        
        // حذف الشخص
        await deleteDoc(doc(db, "persons", personId));
        
        // إذا كان الشخص مفتوحاً حالياً، أغلقه
        if (currentPersonId === personId) {
            closeDetails();
        }
        
        showToast('✅ تم حذف الشخص وديونه', 'success');
        
    } catch (error) {
        console.error('❌ خطأ في حذف الشخص:', error);
        showToast('❌ خطأ في حذف الشخص', 'error');
    }
};

// ===== إدارة الديون =====

// عرض تفاصيل الشخص
window.showPersonDetails = async function(personId, personName) {
    currentPersonId = personId;
    document.getElementById('selectedPersonName').textContent = personName;
    document.getElementById('personDetails').style.display = 'flex';
    document.body.style.overflow = 'hidden'; // منع التمرير خلف النافذة
    
    // إعادة تعيين نموذج الإضافة
    editingDebtId = null;
    document.querySelector('.add-debt-form h3').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة دين جديد';
    document.querySelector('.btn-add-debt').innerHTML = '<i class="fas fa-save"></i> إضافة';
    document.getElementById('debtAmount').value = '';
    document.getElementById('debtDate').value = new Date().toISOString().split('T')[0];
    
    await loadDebts(personId);
};

// إغلاق تفاصيل الشخص
window.closeDetails = function() {
    document.getElementById('personDetails').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentPersonId = null;
    editingDebtId = null;
};

// تحميل ديون شخص (مع تحديث تلقائي)
function loadDebts(personId) {
    const q = query(collection(db, "debts"), where("personId", "==", personId));
    
    onSnapshot(q, (snapshot) => {
        console.log('📋 تحديث قائمة الديون:', snapshot.size);
        
        const debts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // ترتيب حسب التاريخ (الأحدث أولاً)
        debts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const tbody = document.getElementById('debtListBody');
        const totalDebtsCount = document.getElementById('totalDebtsCount');
        const totalAmount = document.getElementById('totalAmount');
        
        if (debts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;color:#a0aec0;padding:40px;">
                        <i class="fas fa-inbox" style="font-size:2.5rem;display:block;margin-bottom:10px;"></i>
                        لا يوجد ديون مسجلة
                    </td>
                </tr>
            `;
            totalDebtsCount.textContent = '0';
            totalAmount.textContent = '0';
            return;
        }
        
        let total = 0;
        tbody.innerHTML = '';
        debts.forEach((debt, index) => {
            total += Number(debt.amount);
            tbody.innerHTML += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${Number(debt.amount).toLocaleString()}</strong></td>
                    <td>${formatDate(debt.date)}</td>
                    <td>
                        <div class="actions">
                            <button class="btn-edit" onclick="editDebt('${debt.id}', '${debt.amount}', '${debt.date}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-delete" onclick="deleteDebt('${debt.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        totalDebtsCount.textContent = debts.length;
        totalAmount.textContent = total.toLocaleString();
        
    }, (error) => {
        console.error('❌ خطأ في تحميل الديون:', error);
    });
}

// إضافة دين جديد
window.addDebt = async function() {
    if (!currentPersonId) {
        showToast('⚠️ الرجاء اختيار شخص أولاً', 'error');
        return;
    }
    
    const amount = document.getElementById('debtAmount').value;
    const date = document.getElementById('debtDate').value;
    
    if (!amount || !date) {
        showToast('⚠️ الرجاء إدخال المبلغ والتاريخ', 'error');
        return;
    }
    
    if (isNaN(amount) || Number(amount) <= 0) {
        showToast('⚠️ الرجاء إدخال مبلغ صحيح أكبر من 0', 'error');
        return;
    }
    
    try {
        if (editingDebtId) {
            // تعديل دين موجود
            await updateDoc(doc(db, "debts", editingDebtId), {
                amount: Number(amount),
                date: date
            });
            showToast('✅ تم تعديل الدين بنجاح', 'success');
            editingDebtId = null;
            document.querySelector('.add-debt-form h3').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة دين جديد';
            document.querySelector('.btn-add-debt').innerHTML = '<i class="fas fa-save"></i> إضافة';
        } else {
            // إضافة دين جديد
            await addDoc(collection(db, "debts"), {
                personId: currentPersonId,
                amount: Number(amount),
                date: date,
                createdAt: new Date().toISOString()
            });
            showToast('✅ تم إضافة الدين بنجاح', 'success');
        }
        
        // إعادة تعيين النموذج
        document.getElementById('debtAmount').value = '';
        document.getElementById('debtDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('debtAmount').focus();
        
    } catch (error) {
        console.error('❌ خطأ في حفظ الدين:', error);
        showToast('❌ خطأ في حفظ الدين: ' + error.message, 'error');
    }
};

// تعديل دين
window.editDebt = function(debtId, amount, date) {
    editingDebtId = debtId;
    document.getElementById('debtAmount').value = amount;
    document.getElementById('debtDate').value = date;
    document.querySelector('.add-debt-form h3').innerHTML = '<i class="fas fa-edit"></i> تعديل الدين';
    document.querySelector('.btn-add-debt').innerHTML = '<i class="fas fa-save"></i> تحديث';
    document.getElementById('debtAmount').focus();
    document.getElementById('debtAmount').scrollIntoView({ behavior: 'smooth' });
};

// حذف دين
window.deleteDebt = async function(debtId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا الدين؟')) return;
    
    try {
        await deleteDoc(doc(db, "debts", debtId));
        showToast('✅ تم حذف الدين بنجاح', 'success');
    } catch (error) {
        console.error('❌ خطأ في حذف الدين:', error);
        showToast('❌ خطأ في حذف الدين', 'error');
    }
};

// ===== أدوات مساعدة =====

// تنسيق التاريخ
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString + 'T00:00:00').toLocaleDateString('ar-SY', options);
}

// عرض تنبيه (Toast Notification)
function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    const colors = {
        success: '#48bb78',
        error: '#fc8181',
        warning: '#ed8936'
    };
    
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 9999;
        padding: 16px 25px;
        border-radius: 14px;
        background: ${colors[type] || '#48bb78'};
        color: white;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        font-weight: 500;
        font-family: 'Tajawal', sans-serif;
        max-width: 90%;
        animation: slideUp 0.4s ease;
        direction: rtl;
        font-size: 1em;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ===== بدء التطبيق =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ التطبيق جاهز للاستخدام');
    loadPersons();
    
    // إضافة حدث Enter لحقل الإدخال
    document.getElementById('personName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            window.addPerson();
        }
    });
    
    // إضافة حدث Enter لحقل المبلغ
    document.getElementById('debtAmount').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            window.addDebt();
        }
    });
    
    // تعيين التاريخ الحالي
    document.getElementById('debtDate').value = new Date().toISOString().split('T')[0];
});

// جعل الدوال عامة
window.addPerson = window.addPerson;
window.deletePerson = window.deletePerson;
window.showPersonDetails = window.showPersonDetails;
window.closeDetails = window.closeDetails;
window.addDebt = window.addDebt;
window.editDebt = window.editDebt;
window.deleteDebt = window.deleteDebt;
