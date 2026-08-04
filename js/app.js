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
    document.getElementById(id).classList.add('active');
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.getElementById(id).style.display = 'none';
}

// ===== إضافة شخص =====
window.openAddPersonModal = function() {
    document.getElementById('personNameInput').value = '';
    document.getElementById('addPersonMessage').className = 'message-box';
    document.getElementById('addPersonMessage').style.display = 'none';
    openModal('addPersonModal');
    setTimeout(() => document.getElementById('personNameInput').focus(), 100);
};

window.closeAddPersonModal = function() {
    closeModal('addPersonModal');
};

window.addPerson = async function() {
    const nameInput = document.getElementById('personNameInput');
    const name = nameInput.value.trim();
    const messageBox = document.getElementById('addPersonMessage');
    
    messageBox.className = 'message-box';
    messageBox.style.display = 'none';
    
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
            showToast('✅ تم إضافة العميل بنجاح', 'success');
        }, 800);
        
    } catch (error) {
        console.error('❌ خطأ:', error);
        showMessage('❌ ' + error.message, 'error', messageBox);
    }
};

// ===== تحميل الأشخاص =====
function loadPersons() {
    const q = query(collection(db, "persons"));
    
    onSnapshot(q, async (snapshot) => {
        const persons = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        document.getElementById('totalPersons').textContent = persons.length;
        document.getElementById('personsCount').textContent = persons.length;
        
        const container = document.getElementById('personsContainer');
        
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
                <div class="person-card" onclick="openPersonDetails('${person.id}', '${person.name}')">
                    <button class="delete-person-btn" onclick="event.stopPropagation(); confirmDeletePerson('${person.id}', '${person.name}')">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="avatar">${firstLetter}</div>
                    <div class="person-name">${person.name}</div>
                    <div class="person-debts">${debtCount} دين</div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        document.getElementById('totalDebts').textContent = totalDebts;
        
    }, (error) => {
        console.error('❌ خطأ:', error);
        showToast('❌ خطأ في تحميل البيانات', 'error');
    });
}

// ===== حذف شخص =====
window.confirmDeletePerson = function(id, name) {
    deleteTarget = id;
    deleteType = 'person';
    document.getElementById('confirmMessage').textContent = `هل أنت متأكد من حذف "${name}" وكل ديونه؟`;
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
                closePersonDetails();
            }
            
            showToast('✅ تم حذف العميل وديونه', 'success');
        } else if (deleteType === 'debt') {
            await deleteDoc(doc(db, "debts", deleteTarget));
            showToast('✅ تم حذف الدين', 'success');
        }
        
        closeConfirmModal();
        deleteTarget = null;
        deleteType = null;
        
    } catch (error) {
        console.error('❌ خطأ:', error);
        showToast('❌ خطأ في الحذف', 'error');
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
    document.getElementById('selectedPersonName').innerHTML = `<i class="fas fa-user"></i> ${personName}`;
    
    // إعادة تعيين نموذج الدين
    document.getElementById('debtAmountInput').value = '';
    document.getElementById('debtDateInput').value = new Date().toISOString().split('T')[0];
    document.getElementById('debtMessage').className = 'message-box';
    document.getElementById('debtMessage').style.display = 'none';
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
        const debts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        debts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const container = document.getElementById('debtsContainer');
        let total = 0;
        
        document.getElementById('clientDebtCount').textContent = debts.length;
        
        if (debts.length === 0) {
            container.innerHTML = `
                <div class="empty-debts">
                    <i class="fas fa-inbox"></i>
                    <p>لا يوجد ديون مسجلة</p>
                </div>
            `;
            document.getElementById('clientTotalAmount').textContent = '0';
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
                        <button class="btn-edit-debt" onclick="editDebt('${debt.id}', '${debt.amount}', '${debt.date}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete-debt" onclick="confirmDeleteDebt('${debt.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        document.getElementById('clientTotalAmount').textContent = total.toLocaleString();
        
    }, (error) => {
        console.error('❌ خطأ:', error);
    });
}

// ===== إضافة دين =====
window.addDebt = async function() {
    if (!currentPersonId) {
        showToast('⚠️ الرجاء اختيار عميل', 'warning');
        return;
    }
    
    const amount = document.getElementById('debtAmountInput').value;
    const date = document.getElementById('debtDateInput').value;
    const messageBox = document.getElementById('debtMessage');
    
    messageBox.className = 'message-box';
    messageBox.style.display = 'none';
    
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
            showToast('✅ تم تعديل الدين', 'success');
            currentDebtId = null;
        } else {
            await addDoc(collection(db, "debts"), {
                personId: currentPersonId,
                amount: Number(amount),
                date: date,
                createdAt: new Date().toISOString()
            });
            showToast('✅ تم إضافة الدين', 'success');
        }
        
        document.getElementById('debtAmountInput').value = '';
        document.getElementById('debtDateInput').value = new Date().toISOString().split('T')[0];
        document.getElementById('debtAmountInput').focus();
        
    } catch (error) {
        console.error('❌ خطأ:', error);
        showMessage('❌ ' + error.message, 'error', messageBox);
    }
};

// ===== تعديل دين =====
window.editDebt = function(id, amount, date) {
    currentDebtId = id;
    document.getElementById('debtAmountInput').value = amount;
    document.getElementById('debtDateInput').value = date;
    document.getElementById('debtAmountInput').focus();
    document.getElementById('debtAmountInput').scrollIntoView({ behavior: 'smooth' });
    showToast('✏️ قم بتعديل المبلغ ثم اضغط إضافة', 'warning');
};

// ===== حذف دين =====
window.confirmDeleteDebt = function(id) {
    deleteTarget = id;
    deleteType = 'debt';
    document.getElementById('confirmMessage').textContent = 'هل أنت متأكد من حذف هذا الدين؟';
    openModal('confirmModal');
};

// ===== أدوات مساعدة =====
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString + 'T00:00:00').toLocaleDateString('ar-SY', options);
}

function showMessage(text, type, element) {
    element.textContent = text;
    element.className = `message-box ${type} show`;
    element.style.display = 'block';
}

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// ===== بدء التطبيق =====
document.addEventListener('DOMContentLoaded', () => {
    loadPersons();
    document.getElementById('debtDateInput').value = new Date().toISOString().split('T')[0];
    
    // Enter key events
    document.getElementById('personNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.addPerson();
    });
    
    document.getElementById('debtAmountInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.addDebt();
    });
    
    // إغلاق المودال عند الضغط خارجها
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (modal.id === 'addPersonModal') closeAddPersonModal();
                else if (modal.id === 'personDetailsModal') closePersonDetails();
                else if (modal.id === 'confirmModal') closeConfirmModal();
            }
        });
    });
});

// ===== Export functions =====
window.addPerson = window.addPerson;
window.openAddPersonModal = window.openAddPersonModal;
window.closeAddPersonModal = window.closeAddPersonModal;
window.openPersonDetails = window.openPersonDetails;
window.closePersonDetails = window.closePersonDetails;
window.addDebt = window.addDebt;
window.editDebt = window.editDebt;
window.confirmDeleteDebt = window.confirmDeleteDebt;
window.confirmDeletePerson = window.confirmDeletePerson;
window.confirmDelete = window.confirmDelete;
window.closeConfirmModal = window.closeConfirmModal;
