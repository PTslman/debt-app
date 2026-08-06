// ============================================================
// MAIN APPLICATION - FULLY FIXED
// ============================================================

import { db } from './firebase-config.js';
import {
    collection, addDoc, getDocs, deleteDoc, doc,
    updateDoc, query, where, onSnapshot, orderBy,
    serverTimestamp, Timestamp
} from "firebase/firestore";
import { exportBackup, importBackup } from './backup.js';

console.log('🚀 Application started');

// ============================================================
// STATE
// ============================================================

const state = {
    currentPersonId: null,
    currentDebtId: null,
    editingPerson: null,
    deleteTarget: null,
    deleteType: null,
    allPersons: [],
    isSaving: false,
    unsubscribePersons: null,
    unsubscribeDebts: null
};

// ============================================================
// TOAST
// ============================================================

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.warn('Toast container not found');
        return;
    }

    const colors = {
        success: '#25D366',
        error: '#FC8181',
        warning: '#F6AD55',
        info: '#34B7F1'
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
        padding: 14px 20px;
        border-radius: 12px;
        background: ${colors[type] || '#25D366'};
        color: white;
        font-weight: 500;
        font-family: 'Inter', sans-serif;
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        font-size: 0.9rem;
        margin-bottom: 8px;
        direction: rtl;
        animation: slideRight 0.4s ease;
        max-width: 350px;
        z-index: 9999;
    `;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

// ============================================================
// MODAL CONTROLS
// ============================================================

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// ============================================================
// PERSON OPERATIONS
// ============================================================

window.openPersonModal = function(person = null) {
    console.log('📝 Opening person modal');
    
    state.isSaving = false;
    state.editingPerson = person;
    
    const modalTitle = document.getElementById('modalTitle');
    const nameInput = document.getElementById('personNameInput');
    const amountInput = document.getElementById('personAmountInput');
    const dateInput = document.getElementById('personDateInput');
    const messageBox = document.getElementById('personMessage');
    const saveBtn = document.getElementById('btnSavePerson');

    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
    }

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

window.savePerson = async function() {
    console.log('💾 Save button clicked');
    
    if (state.isSaving) {
        window.showToast('⏳ جاري الحفظ...', 'warning');
        return;
    }

    const nameInput = document.getElementById('personNameInput');
    const amountInput = document.getElementById('personAmountInput');
    const dateInput = document.getElementById('personDateInput');
    const messageBox = document.getElementById('personMessage');
    const saveBtn = document.getElementById('btnSavePerson');

    if (!nameInput || !amountInput || !dateInput) {
        window.showToast('❌ خطأ في النموذج', 'error');
        return;
    }

    const name = nameInput.value.trim();
    const amount = amountInput.value.trim();
    const date = dateInput.value;

    messageBox.className = 'message-box';
    messageBox.style.display = 'none';
    messageBox.textContent = '';

    // Validation
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

    state.isSaving = true;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    try {
        const personData = {
            name: name,
            amount: Number(amount),
            date: date,
            userId: 'anonymous',
            createdAt: new Date().toISOString()
        };

        console.log('📤 Sending:', personData);

        if (state.editingPerson) {
            const personDoc = doc(db, "persons", state.editingPerson.id);
            await updateDoc(personDoc, {
                ...personData,
                updatedAt: new Date().toISOString()
            });
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
                state.isSaving = false;
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
                return;
            }

            const docRef = await addDoc(collection(db, "persons"), personData);
            console.log('✅ Added with ID:', docRef.id);
            window.showToast(`✅ تم إضافة "${name}"`, 'success');
        }

        closeModal('personModal');
        state.editingPerson = null;
        nameInput.value = '';
        amountInput.value = '';
        dateInput.value = new Date().toISOString().split('T')[0];

    } catch (error) {
        console.error('❌ Save error:', error);
        messageBox.textContent = `❌ ${error.message}`;
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        window.showToast('❌ خطأ في الحفظ', 'error');
    } finally {
        state.isSaving = false;
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
    }
};

// ============================================================
// LOAD PERSONS
// ============================================================

function loadPersons() {
    console.log('📋 Loading persons...');
    const loading = document.getElementById('loadingIndicator');
    if (loading) loading.style.display = 'flex';

    if (state.unsubscribePersons) {
        state.unsubscribePersons();
        state.unsubscribePersons = null;
    }

    const q = query(collection(db, "persons"), orderBy("createdAt", "desc"));

    state.unsubscribePersons = onSnapshot(q, 
        async (snapshot) => {
            try {
                const persons = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                state.allPersons = persons;
                document.getElementById('totalPersons').textContent = persons.length;

                let totalDebts = 0, totalAmount = 0;
                for (const person of persons) {
                    const debtsQuery = query(collection(db, "debts"), where("personId", "==", person.id));
                    const debtsSnapshot = await getDocs(debtsQuery);
                    totalDebts += debtsSnapshot.size;
                    debtsSnapshot.docs.forEach(d => {
                        totalAmount += Number(d.data().amount || 0);
                    });
                }

                document.getElementById('totalDebts').textContent = totalDebts;
                document.getElementById('totalAmount').textContent = totalAmount.toLocaleString();

                renderPersons(persons);
                if (loading) loading.style.display = 'none';
            } catch (error) {
                console.error('Error:', error);
                if (loading) loading.style.display = 'none';
            }
        },
        (error) => {
            console.error('Snapshot error:', error);
            if (loading) loading.style.display = 'none';
            window.showToast('❌ خطأ في تحميل البيانات', 'error');
        }
    );
}

// ============================================================
// RENDER PERSONS
// ============================================================

function renderPersons(persons) {
    const container = document.getElementById('chatList');
    if (!container) return;

    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

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
        const date = person.date ? new Date(person.date + 'T00:00:00').toLocaleDateString('ar-SY', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : '';

        html += `
            <div class="chat-item" data-id="${person.id}">
                <div class="chat-avatar">${firstLetter}</div>
                <div class="chat-info">
                    <div class="chat-name">${person.name || 'بدون اسم'}</div>
                    <div class="chat-preview">
                        <span class="amount">${Number(amount).toLocaleString()} ل.س</span>
                    </div>
                </div>
                <div class="chat-meta">
                    <span class="chat-date">${date}</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.chat-item').forEach(item => {
        item.onclick = function() {
            const person = state.allPersons.find(p => p.id === this.dataset.id);
            if (person) window.openClientDetails(person);
        };
    });
}

// ============================================================
// CLIENT DETAILS
// ============================================================

window.openClientDetails = function(person) {
    if (!person?.id) return;
    
    state.currentPersonId = person.id;

    document.getElementById('clientName').textContent = person.name || 'بدون اسم';
    document.getElementById('clientAvatar').textContent = person.name?.charAt(0).toUpperCase() || '?';
    document.getElementById('clientTotalAmount').textContent = '0';
    document.getElementById('clientDebtCount').textContent = '0 ديون';
    document.getElementById('clientName').dataset.personData = JSON.stringify(person);

    document.getElementById('debtAmountInput').value = '';
    document.getElementById('debtDateInput').value = new Date().toISOString().split('T')[0];
    document.getElementById('debtMessage').className = 'message-box';
    document.getElementById('debtMessage').style.display = 'none';

    state.currentDebtId = null;
    openModal('clientModal');
    loadDebts(person.id);
};

window.closeClientDetails = function() {
    closeModal('clientModal');
    state.currentPersonId = null;
    state.currentDebtId = null;
    if (state.unsubscribeDebts) {
        state.unsubscribeDebts();
        state.unsubscribeDebts = null;
    }
};

// ============================================================
// LOAD DEBTS
// ============================================================

function loadDebts(personId) {
    if (state.unsubscribeDebts) {
        state.unsubscribeDebts();
        state.unsubscribeDebts = null;
    }

    const q = query(collection(db, "debts"), where("personId", "==", personId), orderBy("date", "desc"));

    state.unsubscribeDebts = onSnapshot(q, (snapshot) => {
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
                        <button class="btn-edit-debt" data-id="${debt.id}" data-amount="${debt.amount}" data-date="${debt.date}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete-debt" data-id="${debt.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        document.getElementById('clientTotalAmount').textContent = total.toLocaleString();

        container.querySelectorAll('.btn-edit-debt').forEach(btn => {
            btn.onclick = function(e) {
                e.stopPropagation();
                window.editDebt(this.dataset.id, this.dataset.amount, this.dataset.date);
            };
        });

        container.querySelectorAll('.btn-delete-debt').forEach(btn => {
            btn.onclick = function(e) {
                e.stopPropagation();
                window.confirmDeleteDebt(this.dataset.id);
            };
        });
    });
}

// ============================================================
// DEBT OPERATIONS
// ============================================================

window.addDebt = async function() {
    if (!state.currentPersonId) {
        window.showToast('⚠️ الرجاء اختيار عميل', 'warning');
        return;
    }

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
        const debtData = {
            personId: state.currentPersonId,
            amount: Number(amount),
            date: date,
            userId: 'anonymous'
        };

        if (state.currentDebtId) {
            await updateDoc(doc(db, "debts", state.currentDebtId), debtData);
            window.showToast('✅ تم تعديل الدين', 'success');
            state.currentDebtId = null;
        } else {
            await addDoc(collection(db, "debts"), {
                ...debtData,
                createdAt: new Date().toISOString()
            });
            window.showToast('✅ تم إضافة الدين', 'success');
        }

        amountInput.value = '';
        dateInput.value = new Date().toISOString().split('T')[0];
        amountInput.focus();

    } catch (error) {
        console.error('Add debt error:', error);
        messageBox.textContent = `❌ ${error.message}`;
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        window.showToast('❌ خطأ في حفظ الدين', 'error');
    } finally {
        addBtn.disabled = false;
        addBtn.innerHTML = '<i class="fas fa-plus"></i>';
    }
};

window.editDebt = function(id, amount, date) {
    state.currentDebtId = id;
    document.getElementById('debtAmountInput').value = amount;
    document.getElementById('debtDateInput').value = date;
    document.getElementById('debtAmountInput').focus();
    window.showToast('✏️ قم بتعديل المبلغ ثم اضغط +', 'warning');
};

// ============================================================
// DELETE OPERATIONS
// ============================================================

window.confirmDeleteDebt = function(id) {
    state.deleteTarget = id;
    state.deleteType = 'debt';
    document.getElementById('confirmMessage').textContent = 'هل أنت متأكد من حذف هذا الدين؟';
    openModal('confirmModal');
};

window.confirmDeletePerson = function() {
    state.deleteTarget = state.currentPersonId;
    state.deleteType = 'person';
    const name = document.getElementById('clientName').textContent;
    document.getElementById('confirmMessage').textContent = `هل أنت متأكد من حذف "${name}" وكل ديونه؟`;
    openModal('confirmModal');
};

window.confirmDelete = async function() {
    if (!state.deleteTarget) return;

    const confirmBtn = document.getElementById('btnConfirmDelete');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        if (state.deleteType === 'person') {
            const debtsQuery = query(collection(db, "debts"), where("personId", "==", state.deleteTarget));
            const debtsSnapshot = await getDocs(debtsQuery);

            for (const debtDoc of debtsSnapshot.docs) {
                await deleteDoc(doc(db, "debts", debtDoc.id));
            }

            await deleteDoc(doc(db, "persons", state.deleteTarget));

            if (state.currentPersonId === state.deleteTarget) {
                window.closeClientDetails();
            }

            window.showToast('✅ تم حذف العميل وديونه', 'success');
        } else if (state.deleteType === 'debt') {
            await deleteDoc(doc(db, "debts", state.deleteTarget));
            window.showToast('✅ تم حذف الدين', 'success');
        }

        window.closeConfirmModal();
        state.deleteTarget = null;
        state.deleteType = null;

    } catch (error) {
        console.error('Delete error:', error);
        window.showToast('❌ خطأ في الحذف', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'حذف';
    }
};

window.closeConfirmModal = function() {
    closeModal('confirmModal');
    state.deleteTarget = null;
    state.deleteType = null;
};

// ============================================================
// SEARCH
// ============================================================

window.handleSearch = function(e) {
    const query = e.target.value;
    const clearBtn = document.getElementById('btnClearSearch');
    clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
    renderPersons(state.allPersons);
};

window.clearSearch = function() {
    document.getElementById('searchInput').value = '';
    document.getElementById('btnClearSearch').style.display = 'none';
    renderPersons(state.allPersons);
};

// ============================================================
// REFRESH
// ============================================================

window.refreshData = function() {
    window.showToast('🔄 جاري التحديث...', 'warning');
    if (state.unsubscribePersons) {
        state.unsubscribePersons();
        state.unsubscribePersons = null;
    }
    loadPersons();
};

// ============================================================
// EXPOSE FUNCTIONS
// ============================================================

window.exportBackup = exportBackup;
window.importBackup = importBackup;

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM ready');

    // ربط جميع الأزرار
    document.getElementById('fabAddPerson').onclick = () => window.openPersonModal(null);
    document.getElementById('btnSavePerson').onclick = () => window.savePerson();
    document.getElementById('btnAddDebt').onclick = () => window.addDebt();
    document.getElementById('btnBackup').onclick = () => window.exportBackup();
    document.getElementById('btnRestore').onclick = () => window.importBackup();
    document.getElementById('btnRefresh').onclick = () => window.refreshData();

    document.getElementById('btnEditClient').onclick = function() {
        const data = JSON.parse(document.getElementById('clientName').dataset.personData || '{}');
        if (data.id) {
            window.closeClientDetails();
            setTimeout(() => window.openPersonModal(data), 400);
        }
    };

    document.getElementById('btnDeleteClient').onclick = () => window.confirmDeletePerson();
    document.getElementById('btnConfirmDelete').onclick = () => window.confirmDelete();
    document.getElementById('btnConfirmCancel').onclick = () => window.closeConfirmModal();
    document.getElementById('closeClientModal').onclick = () => window.closeClientDetails();
    document.getElementById('closePersonModal').onclick = () => {
        if (!state.isSaving) closeModal('personModal');
    };
    document.getElementById('closeConfirmModalBtn').onclick = () => window.closeConfirmModal();

    document.getElementById('searchInput').oninput = (e) => window.handleSearch(e);
    document.getElementById('btnClearSearch').onclick = () => window.clearSearch();

    // Enter key
    document.getElementById('personNameInput').onkeypress = (e) => {
        if (e.key === 'Enter' && !state.isSaving) window.savePerson();
    };
    document.getElementById('personAmountInput').onkeypress = (e) => {
        if (e.key === 'Enter' && !state.isSaving) window.savePerson();
    };
    document.getElementById('debtAmountInput').onkeypress = (e) => {
        if (e.key === 'Enter') window.addDebt();
    };

    // Close modal on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.onclick = function(e) {
            if (e.target === this) {
                if (this.id === 'personModal' && !state.isSaving) closeModal('personModal');
                else if (this.id === 'clientModal') window.closeClientDetails();
                else if (this.id === 'confirmModal') window.closeConfirmModal();
            }
        };
    });

    loadPersons();
    console.log('✅ Application ready');
});
