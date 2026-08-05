import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, getDocs, deleteDoc, doc,
    updateDoc, query, where, onSnapshot, orderBy, writeBatch
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { exportBackup, importBackup } from './backup.js';

console.log('🚀 App started');

// ===== المتغيرات =====
let currentPersonId = null;
let currentDebtId = null;
let editingPerson = null;
let deleteTarget = null;
let deleteType = null;
let allPersons = [];
let isSaving = false;
let unsubscribePersons = null;
let unsubscribeDebts = null;

// ===== TOAST =====
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const colors = { success: '#25D366', error: '#FC8181', warning: '#F6AD55', info: '#34B7F1' };
    const toast = document.createElement('div');
    toast.style.cssText = `
        padding: 14px 20px; border-radius: 12px; background: ${colors[type] || '#25D366'};
        color: white; font-weight: 500; font-family: 'Inter', sans-serif;
        box-shadow: 0 8px 30px rgba(0,0,0,0.15); font-size: 0.9rem;
        margin-bottom: 8px; direction: rtl; animation: slideRight 0.4s ease;
        max-width: 350px; z-index: 9999;
    `;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

// ===== MODAL =====
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) { modal.style.display = 'none'; modal.classList.remove('active'); document.body.style.overflow = 'auto'; }
}

// ===== OPEN PERSON MODAL =====
window.openPersonModal = function(person = null) {
    console.log('📝 فتح مودال إضافة عميل');
    if (isSaving) { window.showToast('⏳ يرجى الانتظار', 'warning'); return; }
    editingPerson = person;
    const modalTitle = document.getElementById('modalTitle');
    const nameInput = document.getElementById('personNameInput');
    const amountInput = document.getElementById('personAmountInput');
    const dateInput = document.getElementById('personDateInput');
    const messageBox = document.getElementById('personMessage');
    messageBox.className = 'message-box';
    messageBox.style.display = 'none';
    messageBox.textContent = '';
    if (person) {
        modalTitle.innerHTML = '<i class="fas fa-user-edit"></i> تعديل العميل';
        nameInput.value = person.name || '';
        amountInput.value = person.amount || '';
        dateInput.value = person.date || new Date().toISOString().split('T')[0];
    } else {
        modalTitle.innerHTML = '<i class="fas fa-user-plus"></i> عميل جديد';
        nameInput.value = '';
        amountInput.value = '';
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    openModal('personModal');
    setTimeout(() => nameInput.focus(), 200);
};

// ===== SAVE PERSON =====
window.savePerson = async function() {
    console.log('💾 حفظ عميل');
    if (isSaving) { window.showToast('⏳ جاري الحفظ...', 'warning'); return; }
    const nameInput = document.getElementById('personNameInput');
    const amountInput = document.getElementById('personAmountInput');
    const dateInput = document.getElementById('personDateInput');
    const messageBox = document.getElementById('personMessage');
    const saveBtn = document.getElementById('btnSavePerson');
    const name = nameInput.value.trim();
    const amount = amountInput.value.trim();
    const date = dateInput.value;
    messageBox.className = 'message-box';
    messageBox.style.display = 'none';
    messageBox.textContent = '';

    if (!name) {
        messageBox.textContent = '⚠️ الرجاء إدخال اسم العميل';
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        nameInput.focus();
        return;
    }
    if (!amount || isNaN(amount) || Number(amount) < 0) {
        messageBox.textContent = '⚠️ الرجاء إدخال مبلغ صحيح';
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        amountInput.focus();
        return;
    }
    if (!date) {
        messageBox.textContent = '⚠️ الرجاء اختيار التاريخ';
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        dateInput.focus();
        return;
    }

    isSaving = true;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    try {
        const personData = { name, amount: Number(amount), date, userId: auth.currentUser?.uid || 'anonymous' };
        if (editingPerson) {
            await updateDoc(doc(db, "persons", editingPerson.id), { ...personData, updatedAt: new Date().toISOString() });
            window.showToast('✅ تم تعديل العميل', 'success');
        } else {
            const q = query(collection(db, "persons"), where("name", "==", name));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                messageBox.textContent = `⚠️ "${name}" موجود مسبقاً!`;
                messageBox.className = 'message-box error show';
                messageBox.style.display = 'block';
                nameInput.value = '';
                nameInput.focus();
                isSaving = false;
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
                return;
            }
            await addDoc(collection(db, "persons"), { ...personData, createdAt: new Date().toISOString() });
            window.showToast(`✅ تم إضافة "${name}"`, 'success');
        }
        closeModal('personModal');
        editingPerson = null;
        nameInput.value = '';
        amountInput.value = '';
        dateInput.value = new Date().toISOString().split('T')[0];
    } catch (error) {
        console.error('❌ Save error:', error);
        messageBox.textContent = `❌ ${error.message}`;
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        window.showToast('❌ خطأ في الحفظ: ' + error.message, 'error');
    } finally {
        isSaving = false;
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
    }
};

// ===== LOAD PERSONS =====
function loadPersons() {
    console.log('📋 تحميل العملاء...');
    const loading = document.getElementById('loadingIndicator');
    if (loading) loading.style.display = 'flex';
    if (unsubscribePersons) { unsubscribePersons(); unsubscribePersons = null; }
    const q = query(collection(db, "persons"), orderBy("createdAt", "desc"));
    unsubscribePersons = onSnapshot(q, async (snapshot) => {
        const persons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allPersons = persons;
        document.getElementById('totalPersons').textContent = persons.length;
        let totalDebts = 0, totalAmount = 0;
        for (const person of persons) {
            const debtsQuery = query(collection(db, "debts"), where("personId", "==", person.id));
            const debtsSnapshot = await getDocs(debtsQuery);
            totalDebts += debtsSnapshot.size;
            debtsSnapshot.docs.forEach(d => { totalAmount += Number(d.data().amount || 0); });
        }
        document.getElementById('totalDebts').textContent = totalDebts;
        document.getElementById('totalAmount').textContent = totalAmount.toLocaleString();
        renderPersons(persons);
        if (loading) loading.style.display = 'none';
    }, (error) => {
        console.error('❌ Load error:', error);
        if (loading) loading.style.display = 'none';
        window.showToast('❌ خطأ في تحميل البيانات: ' + error.message, 'error');
    });
}

// ===== RENDER PERSONS =====
function renderPersons(persons) {
    const container = document.getElementById('chatList');
    const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
    let filtered = searchQuery ? persons.filter(p => p.name?.toLowerCase().includes(searchQuery)) : persons;
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users empty-icon"></i>
                <h3>${searchQuery ? 'لا توجد نتائج' : 'لا يوجد عملاء'}</h3>
                <p>${searchQuery ? 'جرب بحثاً آخر' : 'اضغط على زر + لإضافة عميل جديد'}</p>
            </div>
        `;
        return;
    }
    let html = '';
    filtered.forEach(person => {
        const firstLetter = person.name?.charAt(0).toUpperCase() || '?';
        const amount = person.amount || 0;
        const date = person.date ? new Date(person.date + 'T00:00:00').toLocaleDateString('ar-SY', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
        html += `
            <div class="chat-item" data-id="${person.id}">
                <div class="chat-avatar">${firstLetter}</div>
                <div class="chat-info">
                    <div class="chat-name">${person.name || 'بدون اسم'}</div>
                    <div class="chat-preview"><span class="amount">${Number(amount).toLocaleString()} ل.س</span></div>
                </div>
                <div class="chat-meta"><span class="chat-date">${date}</span></div>
            </div>
        `;
    });
    container.innerHTML = html;
    container.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', function() {
            const person = allPersons.find(p => p.id === this.dataset.id);
            if (person) window.openClientDetails(person);
        });
    });
}

// ===== OPEN CLIENT DETAILS =====
window.openClientDetails = function(person) {
    console.log('👤 فتح تفاصيل العميل:', person.name);
    if (!person?.id) return;
    currentPersonId = person.id;
    document.getElementById('clientName').textContent = person.name || 'بدون اسم';
    document.getElementById('clientAvatar').textContent = person.name?.charAt(0).toUpperCase() || '?';
    document.getElementById('clientTotalAmount').textContent = '0';
    document.getElementById('clientDebtCount').textContent = '0 ديون';
    document.getElementById('clientName').dataset.personData = JSON.stringify(person);
    document.getElementById('debtAmountInput').value = '';
    document.getElementById('debtDateInput').value = new Date().toISOString().split('T')[0];
    document.getElementById('debtMessage').className = 'message-box';
    document.getElementById('debtMessage').style.display = 'none';
    currentDebtId = null;
    openModal('clientModal');
    loadDebts(person.id);
};

window.closeClientDetails = function() {
    console.log('🔒 إغلاق تفاصيل العميل');
    closeModal('clientModal');
    currentPersonId = null;
    currentDebtId = null;
    if (unsubscribeDebts) { unsubscribeDebts(); unsubscribeDebts = null; }
};

// ===== LOAD DEBTS =====
function loadDebts(personId) {
    if (unsubscribeDebts) { unsubscribeDebts(); unsubscribeDebts = null; }
    const q = query(collection(db, "debts"), where("personId", "==", personId), orderBy("date", "desc"));
    unsubscribeDebts = onSnapshot(q, (snapshot) => {
        const debts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('debtsContainer');
        let total = 0;
        document.getElementById('clientDebtCount').textContent = `${debts.length} ديون`;
        if (debts.length === 0) {
            container.innerHTML = `<div class="empty-debts"><i class="fas fa-inbox"></i><p>لا يوجد ديون مسجلة</p></div>`;
            document.getElementById('clientTotalAmount').textContent = '0';
            return;
        }
        let html = '';
        debts.forEach(debt => {
            total += Number(debt.amount);
            html += `
                <div class="debt-item">
                    <div class="debt-info">
                        <span class="debt-amount">${Number(debt.amount).toLocaleString()} ل.س</span>
                        <span class="debt-date">${new Date(debt.date + 'T00:00:00').toLocaleDateString('ar-SY', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div class="debt-actions">
                        <button class="btn-edit-debt" data-id="${debt.id}" data-amount="${debt.amount}" data-date="${debt.date}"><i class="fas fa-edit"></i></button>
                        <button class="btn-delete-debt" data-id="${debt.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        document.getElementById('clientTotalAmount').textContent = total.toLocaleString();
        container.querySelectorAll('.btn-edit-debt').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                window.editDebt(this.dataset.id, this.dataset.amount, this.dataset.date);
            });
        });
        container.querySelectorAll('.btn-delete-debt').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                window.confirmDeleteDebt(this.dataset.id);
            });
        });
    });
}

// ===== ADD DEBT =====
window.addDebt = async function() {
    console.log('➕ إضافة دين');
    if (!currentPersonId) { window.showToast('⚠️ الرجاء اختيار عميل', 'warning'); return; }
    const amountInput = document.getElementById('debtAmountInput');
    const dateInput = document.getElementById('debtDateInput');
    const messageBox = document.getElementById('debtMessage');
    const addBtn = document.getElementById('btnAddDebt');
    const amount = amountInput.value;
    const date = dateInput.value;
    messageBox.className = 'message-box';
    messageBox.style.display = 'none';
    messageBox.textContent = '';
    if (!amount || !date) {
        messageBox.textContent = '⚠️ الرجاء إدخال المبلغ والتاريخ';
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        return;
    }
    if (isNaN(amount) || Number(amount) <= 0) {
        messageBox.textContent = '⚠️ الرجاء إدخال مبلغ صحيح';
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        return;
    }
    addBtn.disabled = true;
    addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const debtData = { personId: currentPersonId, amount: Number(amount), date, userId: auth.currentUser?.uid || 'anonymous' };
        if (currentDebtId) {
            await updateDoc(doc(db, "debts", currentDebtId), debtData);
            window.showToast('✅ تم تعديل الدين', 'success');
            currentDebtId = null;
        } else {
            await addDoc(collection(db, "debts"), { ...debtData, createdAt: new Date().toISOString() });
            window.showToast('✅ تم إضافة الدين', 'success');
        }
        amountInput.value = '';
        dateInput.value = new Date().toISOString().split('T')[0];
        amountInput.focus();
    } catch (error) {
        console.error('❌ Add debt error:', error);
        messageBox.textContent = `❌ ${error.message}`;
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        window.showToast('❌ خطأ في حفظ الدين: ' + error.message, 'error');
    } finally {
        addBtn.disabled = false;
        addBtn.innerHTML = '<i class="fas fa-plus"></i>';
    }
};

// ===== EDIT DEBT =====
window.editDebt = function(id, amount, date) {
    console.log('✏️ تعديل دين:', id);
    currentDebtId = id;
    document.getElementById('debtAmountInput').value = amount;
    document.getElementById('debtDateInput').value = date;
    document.getElementById('debtAmountInput').focus();
    window.showToast('✏️ قم بتعديل المبلغ ثم اضغط +', 'warning');
};

// ===== CONFIRM DELETE =====
window.confirmDeleteDebt = function(id) {
    console.log('🗑️ تأكيد حذف دين:', id);
    deleteTarget = id;
    deleteType = 'debt';
    document.getElementById('confirmMessage').textContent = 'هل أنت متأكد من حذف هذا الدين؟';
    openModal('confirmModal');
};

window.confirmDeletePerson = function() {
    console.log('🗑️ تأكيد حذف عميل');
    deleteTarget = currentPersonId;
    deleteType = 'person';
    const name = document.getElementById('clientName').textContent;
    document.getElementById('confirmMessage').textContent = `هل أنت متأكد من حذف "${name}" وكل ديونه؟`;
    openModal('confirmModal');
};

window.confirmDelete = async function() {
    console.log('✅ تأكيد الحذف');
    if (!deleteTarget) return;
    const confirmBtn = document.getElementById('btnConfirmDelete');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        if (deleteType === 'person') {
            const debtsQuery = query(collection(db, "debts"), where("personId", "==", deleteTarget));
            const debtsSnapshot = await getDocs(debtsQuery);
            for (const debtDoc of debtsSnapshot.docs) await deleteDoc(doc(db, "debts", debtDoc.id));
            await deleteDoc(doc(db, "persons", deleteTarget));
            if (currentPersonId === deleteTarget) window.closeClientDetails();
            window.showToast('✅ تم حذف العميل وديونه', 'success');
        } else if (deleteType === 'debt') {
            await deleteDoc(doc(db, "debts", deleteTarget));
            window.showToast('✅ تم حذف الدين', 'success');
        }
        window.closeConfirmModal();
        deleteTarget = null;
        deleteType = null;
    } catch (error) {
        console.error('❌ Delete error:', error);
        window.showToast('❌ خطأ في الحذف: ' + error.message, 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'حذف';
    }
};

window.closeConfirmModal = function() {
    console.log('🔒 إغلاق مودال التأكيد');
    closeModal('confirmModal');
    deleteTarget = null;
    deleteType = null;
};

// ===== SEARCH =====
window.handleSearch = function(e) {
    const query = e.target.value;
    const clearBtn = document.getElementById('btnClearSearch');
    if (query.length > 0) { clearBtn.style.display = 'flex'; } else { clearBtn.style.display = 'none'; }
    renderPersons(allPersons);
};

window.clearSearch = function() {
    document.getElementById('searchInput').value = '';
    document.getElementById('btnClearSearch').style.display = 'none';
    renderPersons(allPersons);
};

// ===== REFRESH =====
window.refreshData = function() {
    window.showToast('🔄 جاري التحديث...', 'warning');
    if (unsubscribePersons) { unsubscribePersons(); unsubscribePersons = null; }
    loadPersons();
};

// ===== EXPORT FUNCTIONS =====
window.exportBackup = exportBackup;
window.importBackup = importBackup;

// ===== AUTH STATE =====
onAuthStateChanged(auth, (user) => {
    console.log('👤 Auth state changed:', user ? user.email : 'no user');
    if (user) {
        document.getElementById('headerSubtitle').textContent = `👤 ${user.email}`;
        document.getElementById('btnLogout').style.display = 'flex';
        loadPersons();
    } else {
        document.getElementById('headerSubtitle').textContent = '🔒 غير مسجل';
        document.getElementById('btnLogout').style.display = 'none';
        document.getElementById('chatList').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-lock empty-icon"></i>
                <h3>الرجاء تسجيل الدخول</h3>
                <p>قم بتسجيل الدخول لعرض العملاء</p>
            </div>
        `;
    }
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM ready - ربط الأحداث');

    // FAB Button
    const fabBtn = document.getElementById('fabAddPerson');
    if (fabBtn) {
        fabBtn.addEventListener('click', function() { window.openPersonModal(null); });
        console.log('✅ زر الإضافة مرتبط');
    }

    // Save Person
    const saveBtn = document.getElementById('btnSavePerson');
    if (saveBtn) {
        saveBtn.addEventListener('click', window.savePerson);
        console.log('✅ زر الحفظ مرتبط');
    }

    // Add Debt
    const addDebtBtn = document.getElementById('btnAddDebt');
    if (addDebtBtn) {
        addDebtBtn.addEventListener('click', window.addDebt);
        console.log('✅ زر إضافة الدين مرتبط');
    }

    // Close Modals
    const closePersonBtn = document.getElementById('closePersonModal');
    if (closePersonBtn) {
        closePersonBtn.addEventListener('click', function() { if (!isSaving) closeModal('personModal'); });
    }

    const closeClientBtn = document.getElementById('closeClientModal');
    if (closeClientBtn) {
        closeClientBtn.addEventListener('click', window.closeClientDetails);
    }

    const closeConfirmBtn = document.getElementById('closeConfirmModalBtn');
    if (closeConfirmBtn) {
        closeConfirmBtn.addEventListener('click', window.closeConfirmModal);
    }

    const confirmCancelBtn = document.getElementById('btnConfirmCancel');
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', window.closeConfirmModal);
    }

    const confirmDeleteBtn = document.getElementById('btnConfirmDelete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', window.confirmDelete);
    }

    // Edit/Delete Client
    const editClientBtn = document.getElementById('btnEditClient');
    if (editClientBtn) {
        editClientBtn.addEventListener('click', function() {
            const data = JSON.parse(document.getElementById('clientName').dataset.personData || '{}');
            if (data.id) { window.closeClientDetails(); setTimeout(() => window.openPersonModal(data), 400); }
        });
    }

    const deleteClientBtn = document.getElementById('btnDeleteClient');
    if (deleteClientBtn) {
        deleteClientBtn.addEventListener('click', window.confirmDeletePerson);
    }

    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', window.handleSearch);
    }

    const clearSearchBtn = document.getElementById('btnClearSearch');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', window.clearSearch);
    }

    // Backup/Refresh
    const backupBtn = document.getElementById('btnBackup');
    if (backupBtn) {
        backupBtn.addEventListener('click', window.exportBackup);
        console.log('✅ زر النسخ الاحتياطي مرتبط');
    }

    const restoreBtn = document.getElementById('btnRestore');
    if (restoreBtn) {
        restoreBtn.addEventListener('click', window.importBackup);
        console.log('✅ زر الاستعادة مرتبط');
    }

    const refreshBtn = document.getElementById('btnRefresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', window.refreshData);
    }

    // Logout
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            auth.signOut().then(() => {
                window.showToast('✅ تم تسجيل الخروج', 'success');
                document.getElementById('headerSubtitle').textContent = '🔒 غير مسجل';
                this.style.display = 'none';
            });
        });
    }

    // Enter Key
    const personNameInput = document.getElementById('personNameInput');
    if (personNameInput) {
        personNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !isSaving) window.savePerson();
        });
    }

    const personAmountInput = document.getElementById('personAmountInput');
    if (personAmountInput) {
        personAmountInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !isSaving) window.savePerson();
        });
    }

    const debtAmountInput = document.getElementById('debtAmountInput');
    if (debtAmountInput) {
        debtAmountInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') window.addDebt();
        });
    }

    // Close modal on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                if (this.id === 'personModal' && !isSaving) closeModal('personModal');
                else if (this.id === 'clientModal') window.closeClientDetails();
                else if (this.id === 'confirmModal') window.closeConfirmModal();
            }
        });
    });

    console.log('✅ جميع الأزرار مرتبطة وجاهزة للاستخدام');
});

console.log('✅ App ready - all functions exported to window');
