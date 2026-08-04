import { db } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, deleteDoc, doc, 
    updateDoc, query, where, onSnapshot 
} from "firebase/firestore";

let currentPersonId = null;
let currentDebtId = null;
let deleteTarget = null;
let deleteType = null;

console.log('🚀 تطبيق الديون بدأ العمل');

// ===== إدارة المودالات =====
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

// ===== Toast Notifications =====
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    const colors = {
        success: '#48bb78',
        error: '#fc8181',
        warning: '#ed8936'
    };
    
    toast.style.cssText = `
        padding: 14px 20px;
        border-radius: 12px;
        background: ${colors[type] || '#48bb78'};
        color: white;
        font-weight: 500;
        font-family: 'Tajawal', sans-serif;
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        animation: slideRight 0.4s ease;
        font-size: 0.95rem;
        margin-bottom: 8px;
        direction: rtl;
    `;
    
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, 3000);
};

// ===== إضافة شخص =====
window.openAddPersonModal = function() {
    const input = document.getElementById('personNameInput');
    if (input) input.value = '';
    
    const msg = document.getElementById('addPersonMessage');
    if (msg) {
        msg.className = 'message-box';
        msg.style.display = 'none';
    }
    
    openModal('addPersonModal');
    setTimeout(() => {
        const inp = document.getElementById('personNameInput');
        if (inp) inp.focus();
    }, 100);
};

window.closeAddPersonModal = function() {
    closeModal('addPersonModal');
};

window.addPerson = async function() {
    const nameInput = document.getElementById('personNameInput');
    const messageBox = document.getElementById('addPersonMessage');
    
    if (!nameInput) return;
    
    const name = nameInput.value.trim();
    
    if (messageBox) {
        messageBox.className = 'message-box';
        messageBox.style.display = 'none';
    }
    
    if (!name) {
        showMessage('الرجاء إدخال اسم الشخص', 'error', messageBox);
        nameInput.focus();
        return;
    }
    
    try {
        const q = query(collection(db, "persons"), where("name", "==", name));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            showMessage(`⚠️ "${name}" موجود مسبقاً!`, 'error', messageBox);
            nameInput.value = '';
            nameInput.focus();
            return;
        }
        
        await addDoc(collection(db, "persons"), {
            name: name,
            createdAt: new Date().toISOString()
        });
        
        showMessage(`✅ تم إضافة "${name}" بنجاح`, 'success', messageBox);
        nameInput.value = '';
        
        setTimeout(() => {
            closeModal('addPersonModal');
            window.showToast('✅ تم إضافة العميل بنجاح', 'success');
        }, 800);
        
    } catch (error) {
        console.error('❌ خطأ:', error);
        showMessage('❌ ' + error.message, 'error', messageBox);
        window.showToast('❌ خطأ في الإضافة', 'error');
    }
};

function showMessage(text, type, element) {
    if (!element) return;
    element.textContent = text;
    element.className = `message-box ${type} show`;
    element.style.display = 'block';
}

// ===== تحميل الأشخاص =====
function loadPersons() {
    const q = query(collection(db, "persons"));
    
    onSnapshot(q, async (snapshot) => {
        try {
            const persons = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const totalPersons = document.getElementById('totalPersons');
            const personsCount = document.getElementById('personsCount');
            if (totalPersons) totalPersons.textContent = persons.length;
            if (personsCount) personsCount.textContent = persons.length;
            
            const container = document.getElementById('personsContainer');
            if (!container) return;
            
            if (persons.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-user-plus"></i>
                        <p>لا يوجد عملاء</p>
                        <small style="color:#a0aec0;">اضغط على زر + لإضافة عميل</small>
                    </div>
                `;
                return;
            }
            
            let html = '';
            let totalDebts = 0;
            
            for (const person of persons) {
                const debtsQuery = query(collection(db, "debts"), where("personId", "==", person.id));
                const debtsSnapshot = await getDocs(debtsQuery);
                const debtCount = debtsSnapshot.size;
                totalDebts += debtCount;
                
                const firstLetter = person.name.charAt(0).toUpperCase();
                
                html += `
                    <div class="person-card" onclick="window.openPersonDetails('${person.id}', '${person.name}')">
                        <button class="delete-person-btn" onclick="event.stopPropagation(); window.confirmDeletePerson('${person.id}', '${person.name}')">
                            <i class="fas fa-times"></i>
                        </button>
                        <div class="avatar">${firstLetter}</div>
                        <div class="person-name">${person.name}</div>
                        <div class="person-debts">${debtCount} دين</div>
                    </div>
                `;
            }
            
            container.innerHTML = html;
            
            const totalDebtsEl = document.getElementById('totalDebts');
            if (totalDebtsEl) totalDebtsEl.textContent = totalDebts;
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الأشخاص:', error);
        }
    }, (error) => {
        console.error('❌ خطأ:', error);
        window.showToast('❌ خطأ في تحميل البيانات', 'error');
    });
}

// ===== حذف شخص =====
window.confirmDeletePerson = function(id, name) {
    deleteTarget = id;
    deleteType = 'person';
    const msg = document.getElementById('confirmMessage');
    if (msg) msg.textContent = `هل أنت متأكد من حذف "${name}" وكل ديونه؟`;
    openModal('confirmModal');
};

window.confirmDelete = async function() {
    if (!deleteTarget) return;
    
    try {
        if (deleteType === 'person') {
            const debtsQuery = query(collection(db, "debts"), where("personId", "==", deleteTarget));
            const debtsSnapshot = await getDocs(debtsQuery);
            
            for (const debtDoc of debtsSnapshot.docs) {
                await deleteDoc(doc(db, "debts", debtDoc.id));
            }
            
            await deleteDoc(doc(db, "persons", deleteTarget));
            
            if (currentPersonId === deleteTarget) {
                window.closePersonDetails();
            }
            
            window.showToast('✅ تم حذف العميل وديونه', 'success');
        } else if (deleteType === 'debt') {
            await deleteDoc(doc(db, "debts", deleteTarget));
            window.showToast('✅ تم حذف الدين', 'success');
        }
        
        window.closeConfirmModal();
        deleteTarget = null;
        deleteType = null;
        
    } catch (error) {
        console.error('❌ خطأ:', error);
        window.showToast('❌ خطأ في الحذف', 'error');
    }
};

window.closeConfirmModal = function() {
    closeModal('confirmModal');
    deleteTarget = null;
    deleteType = null;
};

// ===== تفاصيل الشخص =====
window.openPersonDetails = async function(personId, personName) {
    currentPersonId = personId;
    const nameEl = document.getElementById('selectedPersonName');
    if (nameEl) nameEl.innerHTML = `<i class="fas fa-user"></i> ${personName}`;
    
    const amountInput = document.getElementById('debtAmountInput');
    const dateInput = document.getElementById('debtDateInput');
    if (amountInput) amountInput.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    const msg = document.getElementById('debtMessage');
    if (msg) {
        msg.className = 'message-box';
        msg.style.display = 'none';
    }
    
    currentDebtId = null;
    
    openModal('personDetailsModal');
    loadDebts(personId);
};

window.closePersonDetails = function() {
    closeModal('personDetailsModal');
    currentPersonId = null;
    currentDebtId = null;
};

// ===== تحميل الديون =====
function loadDebts(personId) {
    const q = query(collection(db, "debts"), where("personId", "==", personId));
    
    onSnapshot(q, (snapshot) => {
        try {
            const debts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            debts.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const container = document.getElementById('debtsContainer');
            let total = 0;
            
            const debtCountEl = document.getElementById('clientDebtCount');
            if (debtCountEl) debtCountEl.textContent = debts.length;
            
            if (!container) return;
            
            if (debts.length === 0) {
                container.innerHTML = `
                    <div class="empty-debts">
                        <i class="fas fa-inbox"></i>
                        <p>لا يوجد ديون مسجلة</p>
                    </div>
                `;
                const totalEl = document.getElementById('clientTotalAmount');
                if (totalEl) totalEl.textContent = '0';
                return;
            }
            
            let html = '';
            debts.forEach((debt) => {
                total += Number(debt.amount);
                html += `
                    <div class="debt-item">
                        <div class="debt-info">
                            <span class="debt-amount">${Number(debt.amount).toLocaleString()} ل.س</span>
                            <span class="debt-date">${formatDate(debt.date)}</span>
                        </div>
                        <div class="debt-actions">
                            <button class="btn-edit-debt" onclick="window.editDebt('${debt.id}', '${debt.amount}', '${debt.date}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-delete-debt" onclick="window.confirmDeleteDebt('${debt.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            const totalEl = document.getElementById('clientTotalAmount');
            if (totalEl) totalEl.textContent = total.toLocaleString();
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الديون:', error);
        }
    }, (error) => {
        console.error('❌ خطأ:', error);
    });
}

// ===== إضافة دين =====
window.addDebt = async function() {
    if (!currentPersonId) {
        window.showToast('⚠️ الرجاء اختيار عميل', 'warning');
        return;
    }
    
    const amountInput = document.getElementById('debtAmountInput');
    const dateInput = document.getElementById('debtDateInput');
    const messageBox = document.getElementById('debtMessage');
    
    if (!amountInput || !dateInput) return;
    
    const amount = amountInput.value;
    const date = dateInput.value;
    
    if (messageBox) {
        messageBox.className = 'message-box';
        messageBox.style.display = 'none';
    }
    
    if (!amount || !date) {
        showMessage('الرجاء إدخال المبلغ والتاريخ', 'error', messageBox);
        return;
    }
    
    if (isNaN(amount) || Number(amount) <= 0) {
        showMessage('الرجاء إدخال مبلغ صحيح', 'error', messageBox);
        return;
    }
    
    try {
        if (currentDebtId) {
            await updateDoc(doc(db, "debts", currentDebtId), {
                amount: Number(amount),
                date: date
            });
            window.showToast('✅ تم تعديل الدين', 'success');
            currentDebtId = null;
        } else {
            await addDoc(collection(db, "debts"), {
                personId: currentPersonId,
                amount: Number(amount),
                date: date,
                createdAt: new Date().toISOString()
            });
            window.showToast('✅ تم إضافة الدين', 'success');
        }
        
        if (amountInput) amountInput.value = '';
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        if (amountInput) amountInput.focus();
        
    } catch (error) {
        console.error('❌ خطأ:', error);
        showMessage('❌ ' + error.message, 'error', messageBox);
        window.showToast('❌ خطأ في حفظ الدين', 'error');
    }
};

// ===== تعديل دين =====
window.editDebt = function(id, amount, date) {
    currentDebtId = id;
    const amountInput = document.getElementById('debtAmountInput');
    const dateInput = document.getElementById('debtDateInput');
    if (amountInput) amountInput.value = amount;
    if (dateInput) dateInput.value = date;
    if (amountInput) {
        amountInput.focus();
        amountInput.scrollIntoView({ behavior: 'smooth' });
    }
    window.showToast('✏️ قم بتعديل المبلغ ثم اضغط إضافة', 'warning');
};

// ===== حذف دين =====
window.confirmDeleteDebt = function(id) {
    deleteTarget = id;
    deleteType = 'debt';
    const msg = document.getElementById('confirmMessage');
    if (msg) msg.textContent = 'هل أنت متأكد من حذف هذا الدين؟';
    openModal('confirmModal');
};

// ===== أدوات مساعدة =====
function formatDate(dateString) {
    try {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString + 'T00:00:00').toLocaleDateString('ar-SY', options);
    } catch {
        return dateString;
    }
}

// ===== بدء التطبيق =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ التطبيق جاهز');
    loadPersons();
    
    const dateInput = document.getElementById('debtDateInput');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    // Enter key events
    const personInput = document.getElementById('personNameInput');
    if (personInput) {
        personInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.addPerson();
        });
    }
    
    const debtInput = document.getElementById('debtAmountInput');
    if (debtInput) {
        debtInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.addDebt();
        });
    }
    
    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (modal.id === 'addPersonModal') window.closeAddPersonModal();
                else if (modal.id === 'personDetailsModal') window.closePersonDetails();
                else if (modal.id === 'confirmModal') window.closeConfirmModal();
            }
        });
    });
});

// ربط الدوال للنافذة بشكل صريح
window.openAddPersonModal = window.openAddPersonModal;
window.closeAddPersonModal = window.closeAddPersonModal;
window.addPerson = window.addPerson;
window.openPersonDetails = window.openPersonDetails;
window.closePersonDetails = window.closePersonDetails;
window.addDebt = window.addDebt;
window.editDebt = window.editDebt;
window.confirmDeleteDebt = window.confirmDeleteDebt;
window.confirmDeletePerson = window.confirmDeletePerson;
window.confirmDelete = window.confirmDelete;
window.closeConfirmModal = window.closeConfirmModal;
window.showToast = window.showToast;

console.log('✅ جميع الدوال مربوطة للنافذة');
