// ============================================================
// MAIN APPLICATION - WITH FULL DEBUGGING
// ============================================================

import { db } from './firebase-config.js';
import {
    collection, addDoc, getDocs, deleteDoc, doc,
    updateDoc, query, where, onSnapshot, orderBy
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

window.isSaving = false;

// ============================================================
// TOAST
// ============================================================

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.warn('⚠️ Toast container not found');
        alert(message);
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
        console.log(`📂 Modal opened: ${id}`);
    } else {
        console.error(`❌ Modal not found: ${id}`);
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        console.log(`📂 Modal closed: ${id}`);
    }
}

// ============================================================
// TEST FIREBASE CONNECTION
// ============================================================

async function testFirebase() {
    try {
        console.log('🔍 Testing Firebase connection...');
        const testRef = collection(db, "persons");
        const snapshot = await getDocs(testRef);
        console.log('✅ Firebase connected! Documents:', snapshot.size);
        return true;
    } catch (error) {
        console.error('❌ Firebase connection failed:', error);
        console.error('❌ Error details:', error.message);
        window.showToast('❌ فشل الاتصال بقاعدة البيانات: ' + error.message, 'error');
        return false;
    }
}

// ============================================================
// PERSON OPERATIONS
// ============================================================

window.openPersonModal = function(person = null) {
    console.log('📝 Opening person modal');
    if (state.isSaving) {
        window.showToast('⏳ يرجى الانتظار', 'warning');
        return;
    }

    state.editingPerson = person;
    const modalTitle = document.getElementById('modalTitle');
    const nameInput = document.getElementById('personNameInput');
    const amountInput = document.getElementById('personAmountInput');
    const dateInput = document.getElementById('personDateInput');
    const messageBox = document.getElementById('personMessage');

    if (!modalTitle || !nameInput || !amountInput || !dateInput) {
        console.error('❌ Form elements not found');
        window.showToast('❌ خطأ في النموذج', 'error');
        return;
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
    console.log('💾 Saving person...');
    
    // التحقق من حالة الحفظ
    if (state.isSaving) {
        console.log('⏳ Already saving, please wait');
        window.showToast('⏳ جاري الحفظ...', 'warning');
        return;
    }

    // الحصول على العناصر
    const nameInput = document.getElementById('personNameInput');
    const amountInput = document.getElementById('personAmountInput');
    const dateInput = document.getElementById('personDateInput');
    const messageBox = document.getElementById('personMessage');
    const saveBtn = document.getElementById('btnSavePerson');

    if (!nameInput || !amountInput || !dateInput || !messageBox || !saveBtn) {
        console.error('❌ Form elements not found');
        window.showToast('❌ خطأ في النموذج', 'error');
        return;
    }

    const name = nameInput.value.trim();
    const amount = amountInput.value.trim();
    const date = dateInput.value;

    console.log('📝 Data to save:', { name, amount, date });

    messageBox.className = 'message-box';
    messageBox.style.display = 'none';
    messageBox.textContent = '';

    // ===== VALIDATION =====
    if (!name) {
        console.warn('⚠️ Name is empty');
        messageBox.textContent = '⚠️ الرجاء إدخال اسم العميل';
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        nameInput.focus();
        return;
    }

    if (!amount || isNaN(amount) || Number(amount) < 0) {
        console.warn('⚠️ Invalid amount:', amount);
        messageBox.textContent = '⚠️ الرجاء إدخال مبلغ صحيح';
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        amountInput.focus();
        return;
    }

    if (!date) {
        console.warn('⚠️ Date is empty');
        messageBox.textContent = '⚠️ الرجاء اختيار التاريخ';
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        dateInput.focus();
        return;
    }

    // ===== START SAVING =====
    state.isSaving = true;
    window.isSaving = true;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
    console.log('⏳ Saving started...');

    try {
        const personData = {
            name: name,
            amount: Number(amount),
            date: date,
            userId: 'anonymous',
            createdAt: new Date().toISOString()
        };

        console.log('📤 Sending to Firebase:', personData);

        if (state.editingPerson) {
            // ===== UPDATE =====
            console.log('✏️ Updating person:', state.editingPerson.id);
            await updateDoc(doc(db, "persons", state.editingPerson.id), {
                ...personData,
                updatedAt: new Date().toISOString()
            });
            console.log('✅ Person updated successfully');
            window.showToast('✅ تم تعديل العميل', 'success');
        } else {
            // ===== CHECK DUPLICATE =====
            console.log('🔍 Checking for duplicate name...');
            const q = query(collection(db, "persons"), where("name", "==", name));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                console.warn('⚠️ Duplicate name found:', name);
                messageBox.textContent = `⚠️ "${name}" موجود مسبقاً!`;
                messageBox.className = 'message-box error show';
                messageBox.style.display = 'block';
                nameInput.value = '';
                nameInput.focus();
                state.isSaving = false;
                window.isSaving = false;
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
                return;
            }

            // ===== ADD =====
            console.log('➕ Adding new person...');
            const docRef = await addDoc(collection(db, "persons"), personData);
            console.log('✅ Person added with ID:', docRef.id);
            window.showToast(`✅ تم إضافة "${name}"`, 'success');
        }

        // ===== CLOSE MODAL =====
        console.log('🔒 Closing modal');
        closeModal('personModal');
        state.editingPerson = null;
        nameInput.value = '';
        amountInput.value = '';
        dateInput.value = new Date().toISOString().split('T')[0];

        console.log('✅ Save completed successfully');

    } catch (error) {
        console.error('❌❌❌ SAVE ERROR ❌❌❌');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error code:', error.code);
        
        messageBox.textContent = `❌ ${error.message}`;
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        window.showToast('❌ خطأ في الحفظ: ' + error.message, 'error');
    } finally {
        state.isSaving = false;
        window.isSaving = false;
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
        console.log('🏁 Save process finished');
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

    state.unsubscribePersons = onSnapshot(q, async (snapshot) => {
        try {
            console.log('📦 Persons loaded:', snapshot.size);
            const persons = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            state.allPersons = persons;

            document.getElementById('totalPersons').textContent = persons.length;

            let totalDebts = 0;
            let totalAmount = 0;

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
            console.error('❌ Error processing persons:', error);
            if (loading) loading.style.display = 'none';
        }

    }, (error) => {
        console.error('❌ Snapshot error:', error);
        if (loading) loading.style.display = 'none';
        window.showToast('❌ خطأ في تحميل البيانات: ' + error.message, 'error');
    });
}

// ============================================================
// RENDER PERSONS
// ============================================================

function renderPersons(persons) {
    const container = document.getElementById('chatList');
    if (!container) {
        console.error('❌ chatList container not found');
        return;
    }

    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filtered = searchQuery ?
        persons.filter(p => p.name?.toLowerCase().includes(searchQuery)) :
        persons;

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
        const date = person.date ?
            new Date(person.date + 'T00:00:00').toLocaleDateString('ar-SY', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) :
            '';

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
    console.log('👤 Opening client details:', person?.name);
    if (!person?.id) {
        window.showToast('⚠️ بيانات العميل غير صالحة', 'error');
        return;
    }

    state.currentPersonId = person.id;

    const clientName = document.getElementById('clientName');
    const clientAvatar = document.getElementById('clientAvatar');
    const clientTotalAmount = document.getElementById('clientTotalAmount');
    const clientDebtCount = document.getElementById('clientDebtCount');

    if (clientName) {
        clientName.textContent = person.name || 'بدون اسم';
        clientName.dataset.personData = JSON.stringify(person);
    }
    if (clientAvatar) clientAvatar.textContent = person.name?.charAt(0).toUpperCase() || '?';
    if (clientTotalAmount) clientTotalAmount.textContent = '0';
    if (clientDebtCount) clientDebtCount.textContent = '0 ديون';

    const debtAmountInput = document.getElementById('debtAmountInput');
    const debtDateInput = document.getElementById('debtDateInput');
    const debtMessage = document.getElementById('debtMessage');

    if (debtAmountInput) debtAmountInput.value = '';
    if (debtDateInput) debtDateInput.value = new Date().toISOString().split('T')[0];
    if (debtMessage) {
        debtMessage.className = 'message-box';
        debtMessage.style.display = 'none';
        debtMessage.textContent = '';
    }

    state.currentDebtId = null;

    openModal('clientModal');
    loadDebts(person.id);
};

window.closeClientDetails = function() {
    console.log('🔒 Closing client details');
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

    const q = query(
        collection(db, "debts"),
        where("personId", "==", personId),
        orderBy("date", "desc")
    );

    state.unsubscribeDebts = onSnapshot(q, (snapshot) => {
        const debts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const container = document.getElementById('debtsContainer');
        let total = 0;

        document.getElementById('clientDebtCount').textContent = `${debts.length} ديون`;

        if (!container) return;

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
    console.log('➕ Adding debt...');
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

window.editDebt = function(id, amount, date) {
    console.log('✏️ Editing debt:', id);
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
    console.log('🗑️ Confirm delete debt:', id);
    state.deleteTarget = id;
    state.deleteType = 'debt';
    document.getElementById('confirmMessage').textContent = 'هل أنت متأكد من حذف هذا الدين؟';
    openModal('confirmModal');
};

window.confirmDeletePerson = function() {
    console.log('🗑️ Confirm delete person');
    state.deleteTarget = state.currentPersonId;
    state.deleteType = 'person';
    const name = document.getElementById('clientName').textContent;
    document.getElementById('confirmMessage').textContent = `هل أنت متأكد من حذف "${name}" وكل ديونه؟`;
    openModal('confirmModal');
};

window.confirmDelete = async function() {
    console.log('✅ Confirming delete...');
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
        console.error('❌ Delete error:', error);
        window.showToast('❌ خطأ في الحذف: ' + error.message, 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'حذف';
    }
};

window.closeConfirmModal = function() {
    console.log('🔒 Closing confirm modal');
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

    if (query.length > 0) {
        clearBtn.style.display = 'flex';
    } else {
        clearBtn.style.display = 'none';
    }

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
    console.log('🔄 Refreshing data...');
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
// INIT - ربط جميع الأزرار يدوياً
// ============================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('✅ DOM ready - ربط الأزرار يدوياً');

    // اختبار الاتصال بقاعدة البيانات
    const connected = await testFirebase();
    if (!connected) {
        window.showToast('⚠️ تأكد من اتصال الإنترنت وقواعد Firebase', 'warning');
    }

    // 1. زر الإضافة
    const fabBtn = document.getElementById('fabAddPerson');
    if (fabBtn) {
        fabBtn.onclick = function() {
            console.log('🟢 زر الإضافة ضغط');
            window.openPersonModal(null);
        };
        console.log('✅ زر الإضافة مرتبط');
    }

    // 2. زر الحفظ
    const saveBtn = document.getElementById('btnSavePerson');
    if (saveBtn) {
        saveBtn.onclick = function() {
            console.log('🟢 زر الحفظ ضغط');
            window.savePerson();
        };
        console.log('✅ زر الحفظ مرتبط');
    } else {
        console.error('❌ زر الحفظ غير موجود');
    }

    // 3. زر إضافة الدين
    const addDebtBtn = document.getElementById('btnAddDebt');
    if (addDebtBtn) {
        addDebtBtn.onclick = function() {
            console.log('🟢 زر إضافة الدين ضغط');
            window.addDebt();
        };
        console.log('✅ زر إضافة الدين مرتبط');
    }

    // 4. زر النسخ الاحتياطي
    const backupBtn = document.getElementById('btnBackup');
    if (backupBtn) {
        backupBtn.onclick = function() {
            console.log('🟢 زر النسخ الاحتياطي ضغط');
            window.exportBackup();
        };
        console.log('✅ زر النسخ الاحتياطي مرتبط');
    }

    // 5. زر الاستعادة
    const restoreBtn = document.getElementById('btnRestore');
    if (restoreBtn) {
        restoreBtn.onclick = function() {
            console.log('🟢 زر الاستعادة ضغط');
            window.importBackup();
        };
        console.log('✅ زر الاستعادة مرتبط');
    }

    // 6. زر التحديث
    const refreshBtn = document.getElementById('btnRefresh');
    if (refreshBtn) {
        refreshBtn.onclick = function() {
            console.log('🟢 زر التحديث ضغط');
            window.refreshData();
        };
        console.log('✅ زر التحديث مرتبط');
    }

    // 7. زر تعديل العميل
    const editClientBtn = document.getElementById('btnEditClient');
    if (editClientBtn) {
        editClientBtn.onclick = function() {
            console.log('🟢 زر تعديل العميل ضغط');
            const data = JSON.parse(document.getElementById('clientName').dataset.personData || '{}');
            if (data.id) {
                window.closeClientDetails();
                setTimeout(() => window.openPersonModal(data), 400);
            }
        };
        console.log('✅ زر تعديل العميل مرتبط');
    }

    // 8. زر حذف العميل
    const deleteClientBtn = document.getElementById('btnDeleteClient');
    if (deleteClientBtn) {
        deleteClientBtn.onclick = function() {
            console.log('🟢 زر حذف العميل ضغط');
            window.confirmDeletePerson();
        };
        console.log('✅ زر حذف العميل مرتبط');
    }

    // 9. زر تأكيد الحذف
    const confirmDeleteBtn = document.getElementById('btnConfirmDelete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.onclick = function() {
            console.log('🟢 زر تأكيد الحذف ضغط');
            window.confirmDelete();
        };
        console.log('✅ زر تأكيد الحذف مرتبط');
    }

    // 10. زر إلغاء الحذف
    const confirmCancelBtn = document.getElementById('btnConfirmCancel');
    if (confirmCancelBtn) {
        confirmCancelBtn.onclick = function() {
            console.log('🟢 زر إلغاء الحذف ضغط');
            window.closeConfirmModal();
        };
        console.log('✅ زر إلغاء الحذف مرتبط');
    }

    // 11. إغلاق مودال العميل
    const closeClientBtn = document.getElementById('closeClientModal');
    if (closeClientBtn) {
        closeClientBtn.onclick = function() {
            console.log('🟢 زر إغلاق مودال العميل ضغط');
            window.closeClientDetails();
        };
        console.log('✅ زر إغلاق مودال العميل مرتبط');
    }

    // 12. إغلاق مودال الإضافة
    const closePersonBtn = document.getElementById('closePersonModal');
    if (closePersonBtn) {
        closePersonBtn.onclick = function() {
            console.log('🟢 زر إغلاق مودال الإضافة ضغط');
            if (!state.isSaving) {
                closeModal('personModal');
            }
        };
        console.log('✅ زر إغلاق مودال الإضافة مرتبط');
    }

    // 13. إغلاق مودال التأكيد
    const closeConfirmBtn = document.getElementById('closeConfirmModalBtn');
    if (closeConfirmBtn) {
        closeConfirmBtn.onclick = function() {
            console.log('🟢 زر إغلاق مودال التأكيد ضغط');
            window.closeConfirmModal();
        };
        console.log('✅ زر إغلاق مودال التأكيد مرتبط');
    }

    // 14. بحث
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.oninput = function(e) {
            window.handleSearch(e);
        };
        console.log('✅ حقل البحث مرتبط');
    }

    // 15. مسح البحث
    const clearSearchBtn = document.getElementById('btnClearSearch');
    if (clearSearchBtn) {
        clearSearchBtn.onclick = function() {
            console.log('🟢 زر مسح البحث ضغط');
            window.clearSearch();
        };
        console.log('✅ زر مسح البحث مرتبط');
    }

    // 16. إغلاق المودال عند الضغط خارجها
    document.querySelectorAll('.modal').forEach(modal => {
        modal.onclick = function(e) {
            if (e.target === this) {
                if (this.id === 'personModal' && !state.isSaving) {
                    closeModal('personModal');
                } else if (this.id === 'clientModal') {
                    window.closeClientDetails();
                } else if (this.id === 'confirmModal') {
                    window.closeConfirmModal();
                }
            }
        };
    });

    // 17. Enter key
    const personNameInput = document.getElementById('personNameInput');
    if (personNameInput) {
        personNameInput.onkeypress = function(e) {
            if (e.key === 'Enter' && !state.isSaving) {
                console.log('🟢 Enter pressed - saving');
                window.savePerson();
            }
        };
    }

    const personAmountInput = document.getElementById('personAmountInput');
    if (personAmountInput) {
        personAmountInput.onkeypress = function(e) {
            if (e.key === 'Enter' && !state.isSaving) {
                console.log('🟢 Enter pressed - saving');
                window.savePerson();
            }
        };
    }

    const debtAmountInput = document.getElementById('debtAmountInput');
    if (debtAmountInput) {
        debtAmountInput.onkeypress = function(e) {
            if (e.key === 'Enter') {
                console.log('🟢 Enter pressed - adding debt');
                window.addDebt();
            }
        };
    }

    // تحميل البيانات
    loadPersons();

    console.log('✅ جميع الأزرار مرتبطة بنجاح!');
    console.log('🎯 التطبيق جاهز للاستخدام');
    console.log('📝 جرب إضافة عميل الآن');
});
