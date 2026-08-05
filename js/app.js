import { db } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, deleteDoc, doc, 
    updateDoc, query, where, onSnapshot, orderBy, writeBatch 
} from "firebase/firestore";

console.log('🚀 App started');

// ===== المتغيرات العامة =====
let currentPersonId = null;
let currentDebtId = null;
let editingPerson = null;
let deleteTarget = null;
let deleteType = null;
let allPersons = [];
let isSaving = false;
let unsubscribePersons = null;
let unsubscribeDebts = null;

// ===== Toast Notifications =====
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.warn('Toast container not found');
        return;
    }
    
    const colors = {
        success: '#25D366',
        error: '#FC8181',
        warning: '#F6AD55'
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
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, 3500);
}

// ===== المودالات =====
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        console.warn(`Modal ${id} not found`);
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

// ===== اختبار الاتصال بقاعدة البيانات =====
async function testFirebaseConnection() {
    try {
        console.log('🔍 جاري اختبار الاتصال بـ Firebase...');
        const testRef = collection(db, "persons");
        const snapshot = await getDocs(testRef);
        console.log(`✅ Firebase متصل بنجاح! عدد العملاء: ${snapshot.size}`);
        return true;
    } catch (error) {
        console.error('❌ فشل الاتصال بـ Firebase:', error);
        console.error('📋 تفاصيل الخطأ:', error.message);
        showToast('❌ فشل الاتصال بقاعدة البيانات: ' + error.message, 'error');
        return false;
    }
}

// ===== إضافة/تعديل عميل =====
window.openPersonModal = function(person = null) {
    if (isSaving) {
        showToast('⏳ يرجى الانتظار حتى انتهاء الحفظ', 'warning');
        return;
    }
    
    editingPerson = person;
    const modalTitle = document.getElementById('modalTitle');
    const nameInput = document.getElementById('personNameInput');
    const amountInput = document.getElementById('personAmountInput');
    const dateInput = document.getElementById('personDateInput');
    const messageBox = document.getElementById('personMessage');
    
    if (!modalTitle || !nameInput || !amountInput || !dateInput) {
        console.error('❌ عناصر النموذج غير موجودة');
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
    if (isSaving) {
        console.log('⏳ جاري الحفظ... يرجى الانتظار');
        showToast('⏳ جاري الحفظ...', 'warning');
        return;
    }
    
    const nameInput = document.getElementById('personNameInput');
    const amountInput = document.getElementById('personAmountInput');
    const dateInput = document.getElementById('personDateInput');
    const messageBox = document.getElementById('personMessage');
    const saveBtn = document.getElementById('btnSavePerson');
    
    if (!nameInput || !amountInput || !dateInput || !messageBox || !saveBtn) {
        console.error('❌ عناصر النموذج غير موجودة');
        return;
    }
    
    const name = nameInput.value.trim();
    const amount = amountInput.value.trim();
    const date = dateInput.value;
    
    messageBox.className = 'message-box';
    messageBox.style.display = 'none';
    messageBox.textContent = '';
    
    // === التحقق من المدخلات ===
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
    
    // === تعطيل الزر ===
    isSaving = true;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
    
    console.log('📝 جاري حفظ البيانات:', { name, amount, date });
    
    try {
        if (editingPerson) {
            // === تعديل عميل موجود ===
            console.log('✏️ تعديل عميل:', editingPerson.id);
            await updateDoc(doc(db, "persons", editingPerson.id), {
                name: name,
                amount: Number(amount),
                date: date,
                updatedAt: new Date().toISOString()
            });
            console.log('✅ تم تعديل العميل بنجاح');
            showToast('✅ تم تعديل العميل', 'success');
        } else {
            // === التحقق من الاسم المكرر ===
            console.log('🔍 التحقق من الاسم المكرر...');
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
            
            // === إضافة عميل جديد ===
            console.log('➕ إضافة عميل جديد...');
            const docRef = await addDoc(collection(db, "persons"), {
                name: name,
                amount: Number(amount),
                date: date,
                createdAt: new Date().toISOString()
            });
            console.log('✅ تم إضافة العميل، ID:', docRef.id);
            showToast(`✅ تم إضافة "${name}"`, 'success');
        }
        
        // === إغلاق المودال ===
        console.log('🔒 إغلاق المودال');
        closeModal('personModal');
        editingPerson = null;
        
        // === إعادة تعيين الحقول ===
        nameInput.value = '';
        amountInput.value = '';
        dateInput.value = new Date().toISOString().split('T')[0];
        
    } catch (error) {
        console.error('❌ خطأ في الحفظ:', error);
        console.error('📋 تفاصيل الخطأ:', error.message);
        console.error('📋 Stack Trace:', error.stack);
        
        messageBox.textContent = `❌ ${error.message}`;
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        showToast('❌ خطأ في الحفظ: ' + error.message, 'error');
    } finally {
        isSaving = false;
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ';
        console.log('🏁 انتهت عملية الحفظ');
    }
};

// ===== تحميل العملاء =====
function loadPersons() {
    console.log('📋 بدء تحميل العملاء...');
    const loading = document.getElementById('loadingIndicator');
    if (loading) loading.style.display = 'flex';
    
    const q = query(collection(db, "persons"), orderBy("createdAt", "desc"));
    
    // إلغاء الاشتراك السابق
    if (unsubscribePersons) {
        unsubscribePersons();
        unsubscribePersons = null;
    }
    
    unsubscribePersons = onSnapshot(q, async (snapshot) => {
        try {
            console.log('📦 تم استلام البيانات، عدد العملاء:', snapshot.size);
            const persons = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            allPersons = persons;
            
            // === تحديث الإحصائيات ===
            const totalPersonsEl = document.getElementById('totalPersons');
            if (totalPersonsEl) totalPersonsEl.textContent = persons.length;
            
            let totalDebts = 0;
            let totalAmount = 0;
            
            for (const person of persons) {
                const debtsQuery = query(collection(db, "debts"), where("personId", "==", person.id));
                const debtsSnapshot = await getDocs(debtsQuery);
                const debtCount = debtsSnapshot.size;
                totalDebts += debtCount;
                
                debtsSnapshot.docs.forEach(doc => {
                    totalAmount += Number(doc.data().amount || 0);
                });
            }
            
            const totalDebtsEl = document.getElementById('totalDebts');
            const totalAmountEl = document.getElementById('totalAmount');
            if (totalDebtsEl) totalDebtsEl.textContent = totalDebts;
            if (totalAmountEl) totalAmountEl.textContent = totalAmount.toLocaleString();
            
            // === عرض العملاء ===
            renderPersons(persons);
            
            if (loading) loading.style.display = 'none';
            
        } catch (error) {
            console.error('❌ خطأ في تحميل العملاء:', error);
            if (loading) loading.style.display = 'none';
            showToast('❌ خطأ في تحميل البيانات', 'error');
        }
    }, (error) => {
        console.error('❌ خطأ في الاشتراك:', error);
        if (loading) loading.style.display = 'none';
        showToast('❌ خطأ في الاتصال بقاعدة البيانات: ' + error.message, 'error');
    });
}

// ===== عرض العملاء =====
function renderPersons(persons) {
    const container = document.getElementById('chatList');
    if (!container) {
        console.warn('chatList container not found');
        return;
    }
    
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    let filtered = persons;
    if (searchQuery) {
        filtered = persons.filter(p => p.name && p.name.toLowerCase().includes(searchQuery));
    }
    
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
        const firstLetter = person.name ? person.name.charAt(0).toUpperCase() : '?';
        const amount = person.amount || 0;
        const date = person.date ? formatDate(person.date) : '';
        
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
    
    // === إضافة أحداث النقر ===
    container.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', function() {
            const id = this.dataset.id;
            const person = allPersons.find(p => p.id === id);
            if (person) {
                openClientDetails(person);
            }
        });
    });
}

// ===== تفاصيل العميل =====
window.openClientDetails = async function(person) {
    if (!person || !person.id) {
        console.error('❌ بيانات العميل غير صالحة');
        return;
    }
    
    currentPersonId = person.id;
    
    const clientName = document.getElementById('clientName');
    const clientAvatar = document.getElementById('clientAvatar');
    const clientTotalAmount = document.getElementById('clientTotalAmount');
    const clientDebtCount = document.getElementById('clientDebtCount');
    const debtAmountInput = document.getElementById('debtAmountInput');
    const debtDateInput = document.getElementById('debtDateInput');
    const debtMessage = document.getElementById('debtMessage');
    
    if (clientName) clientName.textContent = person.name || 'بدون اسم';
    if (clientAvatar) clientAvatar.textContent = person.name ? person.name.charAt(0).toUpperCase() : '?';
    if (clientTotalAmount) clientTotalAmount.textContent = '0';
    if (clientDebtCount) clientDebtCount.textContent = '0 ديون';
    
    if (clientName) {
        clientName.dataset.personId = person.id;
        clientName.dataset.personData = JSON.stringify(person);
    }
    
    if (debtAmountInput) debtAmountInput.value = '';
    if (debtDateInput) debtDateInput.value = new Date().toISOString().split('T')[0];
    if (debtMessage) {
        debtMessage.className = 'message-box';
        debtMessage.style.display = 'none';
        debtMessage.textContent = '';
    }
    
    currentDebtId = null;
    
    openModal('clientModal');
    loadDebts(person.id);
};

window.closeClientDetails = function() {
    closeModal('clientModal');
    currentPersonId = null;
    currentDebtId = null;
    if (unsubscribeDebts) {
        unsubscribeDebts();
        unsubscribeDebts = null;
    }
};

// ===== تحميل الديون =====
function loadDebts(personId) {
    if (!personId) {
        console.warn('⚠️ personId غير موجود');
        return;
    }
    
    const q = query(collection(db, "debts"), where("personId", "==", personId), orderBy("date", "desc"));
    
    // إلغاء الاشتراك السابق
    if (unsubscribeDebts) {
        unsubscribeDebts();
        unsubscribeDebts = null;
    }
    
    unsubscribeDebts = onSnapshot(q, (snapshot) => {
        try {
            const debts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const container = document.getElementById('debtsContainer');
            let total = 0;
            
            const clientDebtCount = document.getElementById('clientDebtCount');
            if (clientDebtCount) clientDebtCount.textContent = `${debts.length} ديون`;
            
            if (!container) return;
            
            if (debts.length === 0) {
                container.innerHTML = `
                    <div class="empty-debts">
                        <i class="fas fa-inbox"></i>
                        <p>لا يوجد ديون مسجلة</p>
                    </div>
                `;
                const clientTotalAmount = document.getElementById('clientTotalAmount');
                if (clientTotalAmount) clientTotalAmount.textContent = '0';
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
            const clientTotalAmount = document.getElementById('clientTotalAmount');
            if (clientTotalAmount) clientTotalAmount.textContent = total.toLocaleString();
            
            // === أحداث التعديل والحذف ===
            container.querySelectorAll('.btn-edit-debt').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const id = this.dataset.id;
                    const amount = this.dataset.amount;
                    const date = this.dataset.date;
                    editDebt(id, amount, date);
                });
            });
            
            container.querySelectorAll('.btn-delete-debt').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const id = this.dataset.id;
                    confirmDeleteDebt(id);
                });
            });
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الديون:', error);
        }
    }, (error) => {
        console.error('❌ خطأ في اشتراك الديون:', error);
        showToast('❌ خطأ في تحميل الديون', 'error');
    });
}

// ===== إضافة دين =====
window.addDebt = async function() {
    if (!currentPersonId) {
        showToast('⚠️ الرجاء اختيار عميل', 'warning');
        return;
    }
    
    const amountInput = document.getElementById('debtAmountInput');
    const dateInput = document.getElementById('debtDateInput');
    const messageBox = document.getElementById('debtMessage');
    const addBtn = document.getElementById('btnAddDebt');
    
    if (!amountInput || !dateInput || !messageBox || !addBtn) {
        console.error('❌ عناصر إضافة الدين غير موجودة');
        return;
    }
    
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
        
        amountInput.value = '';
        dateInput.value = new Date().toISOString().split('T')[0];
        amountInput.focus();
        
    } catch (error) {
        console.error('❌ خطأ في حفظ الدين:', error);
        messageBox.textContent = `❌ ${error.message}`;
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        showToast('❌ خطأ في حفظ الدين', 'error');
    } finally {
        addBtn.disabled = false;
        addBtn.innerHTML = '<i class="fas fa-plus"></i>';
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
    showToast('✏️ قم بتعديل المبلغ ثم اضغط +', 'warning');
};

// ===== حذف دين =====
window.confirmDeleteDebt = function(id) {
    deleteTarget = id;
    deleteType = 'debt';
    const confirmMessage = document.getElementById('confirmMessage');
    if (confirmMessage) confirmMessage.textContent = 'هل أنت متأكد من حذف هذا الدين؟';
    openModal('confirmModal');
};

// ===== حذف عميل =====
window.confirmDeletePerson = function() {
    deleteTarget = currentPersonId;
    deleteType = 'person';
    const clientName = document.getElementById('clientName');
    const name = clientName ? clientName.textContent : 'هذا العميل';
    const confirmMessage = document.getElementById('confirmMessage');
    if (confirmMessage) confirmMessage.textContent = `هل أنت متأكد من حذف "${name}" وكل ديونه؟`;
    openModal('confirmModal');
};

// ===== تأكيد الحذف =====
window.confirmDelete = async function() {
    if (!deleteTarget) {
        showToast('⚠️ لا يوجد عنصر للحذف', 'warning');
        return;
    }
    
    const confirmBtn = document.getElementById('btnConfirmDelete');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    try {
        if (deleteType === 'person') {
            // حذف كل الديون
            const debtsQuery = query(collection(db, "debts"), where("personId", "==", deleteTarget));
            const debtsSnapshot = await getDocs(debtsQuery);
            
            for (const debtDoc of debtsSnapshot.docs) {
                await deleteDoc(doc(db, "debts", debtDoc.id));
            }
            
            await deleteDoc(doc(db, "persons", deleteTarget));
            
            if (currentPersonId === deleteTarget) {
                closeClientDetails();
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
        console.error('❌ خطأ في الحذف:', error);
        showToast('❌ خطأ في الحذف: ' + error.message, 'error');
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'حذف';
        }
    }
};

window.closeConfirmModal = function() {
    closeModal('confirmModal');
    deleteTarget = null;
    deleteType = null;
};

// ===== أدوات مساعدة =====
function formatDate(dateString) {
    try {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString + 'T00:00:00').toLocaleDateString('ar-SY', options);
    } catch {
        return dateString;
    }
}

// ===== بحث =====
window.handleSearch = function(e) {
    const query = e.target.value;
    const clearBtn = document.getElementById('btnClearSearch');
    
    if (query && query.length > 0) {
        if (clearBtn) clearBtn.style.display = 'flex';
    } else {
        if (clearBtn) clearBtn.style.display = 'none';
    }
    
    renderPersons(allPersons);
};

window.clearSearch = function() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('btnClearSearch');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    renderPersons(allPersons);
};

// ===== تحديث يدوي =====
window.refreshData = function() {
    showToast('🔄 جاري التحديث...', 'warning');
    if (unsubscribePersons) {
        unsubscribePersons();
        unsubscribePersons = null;
    }
    loadPersons();
};

// ===== Backup =====
window.exportBackup = async function() {
    try {
        const personsSnapshot = await getDocs(collection(db, "persons"));
        const debtsSnapshot = await getDocs(collection(db, "debts"));
        
        const data = {
            exportedAt: new Date().toISOString(),
            version: "2.0",
            totalPersons: personsSnapshot.size,
            totalDebts: debtsSnapshot.size,
            persons: personsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            debts: debtsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup-debts-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('✅ تم تصدير النسخة الاحتياطية', 'success');
    } catch (error) {
        console.error('❌ خطأ في التصدير:', error);
        showToast('❌ خطأ في التصدير: ' + error.message, 'error');
    }
};

window.importBackup = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!confirm('⚠️ استعادة النسخة ستستبدل جميع البيانات. هل أنت متأكد؟')) {
            return;
        }
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.persons || !data.debts) {
                alert('❌ ملف غير صحيح!');
                return;
            }
            
            // حذف كل البيانات
            const personsSnapshot = await getDocs(collection(db, "persons"));
            const debtsSnapshot = await getDocs(collection(db, "debts"));
            const batch = writeBatch(db);
            
            for (const docSnapshot of debtsSnapshot.docs) {
                batch.delete(doc(db, "debts", docSnapshot.id));
            }
            for (const docSnapshot of personsSnapshot.docs) {
                batch.delete(doc(db, "persons", docSnapshot.id));
            }
            await batch.commit();
            
            // إضافة البيانات الجديدة
            for (const person of data.persons) {
                const { id, ...personData } = person;
                await addDoc(collection(db, "persons"), personData);
            }
            for (const debt of data.debts) {
                const { id, ...debtData } = debt;
                await addDoc(collection(db, "debts"), debtData);
            }
            
            showToast('✅ تم استعادة البيانات', 'success');
            setTimeout(() => location.reload(), 1500);
            
        } catch (error) {
            console.error('❌ خطأ في الاستعادة:', error);
            showToast('❌ خطأ في الاستعادة: ' + error.message, 'error');
        }
        input.remove();
    };
    
    document.body.appendChild(input);
    input.click();
};

// ===== تهيئة التطبيق =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ DOM ready');
    console.log('📋 تهيئة التطبيق...');
    
    // === اختبار الاتصال ===
    const connected = await testFirebaseConnection();
    if (!connected) {
        showToast('⚠️ تأكد من اتصال الإنترنت وقواعد Firebase', 'warning');
    }
    
    // === ربط الأحداث ===
    // زر إضافة عميل
    const fabBtn = document.getElementById('fabAddPerson');
    if (fabBtn) {
        fabBtn.addEventListener('click', () => openPersonModal(null));
    }
    
    // زر حفظ عميل
    const saveBtn = document.getElementById('btnSavePerson');
    if (saveBtn) {
        saveBtn.addEventListener('click', savePerson);
    }
    
    // زر إضافة دين
    const addDebtBtn = document.getElementById('btnAddDebt');
    if (addDebtBtn) {
        addDebtBtn.addEventListener('click', addDebt);
    }
    
    // إغلاق المودالات
    const closePersonBtn = document.getElementById('closePersonModal');
    if (closePersonBtn) {
        closePersonBtn.addEventListener('click', () => {
            if (!isSaving) closeModal('personModal');
        });
    }
    
    const closeClientBtn = document.getElementById('closeClientModal');
    if (closeClientBtn) {
        closeClientBtn.addEventListener('click', closeClientDetails);
    }
    
    const closeConfirmBtn = document.getElementById('closeConfirmModalBtn');
    if (closeConfirmBtn) {
        closeConfirmBtn.addEventListener('click', closeConfirmModal);
    }
    
    const confirmCancelBtn = document.getElementById('btnConfirmCancel');
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', closeConfirmModal);
    }
    
    const confirmDeleteBtn = document.getElementById('btnConfirmDelete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDelete);
    }
    
    // تعديل وحذف العميل
    const editClientBtn = document.getElementById('btnEditClient');
    if (editClientBtn) {
        editClientBtn.addEventListener('click', () => {
            const clientName = document.getElementById('clientName');
            if (clientName) {
                const personData = JSON.parse(clientName.dataset.personData || '{}');
                if (personData.id) {
                    closeClientDetails();
                    setTimeout(() => openPersonModal(personData), 400);
                }
            }
        });
    }
    
    const deleteClientBtn = document.getElementById('btnDeleteClient');
    if (deleteClientBtn) {
        deleteClientBtn.addEventListener('click', confirmDeletePerson);
    }
    
    // بحث
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    const clearSearchBtn = document.getElementById('btnClearSearch');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
    }
    
    // Backup و تحديث
    const backupBtn = document.getElementById('btnBackup');
    if (backupBtn) {
        backupBtn.addEventListener('click', exportBackup);
    }
    
    const restoreBtn = document.getElementById('btnRestore');
    if (restoreBtn) {
        restoreBtn.addEventListener('click', importBackup);
    }
    
    const refreshBtn = document.getElementById('btnRefresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }
    
    // === Enter key ===
    const personNameInput = document.getElementById('personNameInput');
    if (personNameInput) {
        personNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !isSaving) savePerson();
        });
    }
    
    const personAmountInput = document.getElementById('personAmountInput');
    if (personAmountInput) {
        personAmountInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !isSaving) savePerson();
        });
    }
    
    const debtAmountInput = document.getElementById('debtAmountInput');
    if (debtAmountInput) {
        debtAmountInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addDebt();
        });
    }
    
    // === إغلاق المودال عند الضغط خارجها ===
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (modal.id === 'personModal' && !isSaving) {
                    closeModal('personModal');
                } else if (modal.id === 'clientModal') {
                    closeClientDetails();
                } else if (modal.id === 'confirmModal') {
                    closeConfirmModal();
                }
            }
        });
    });
    
    // === تحميل البيانات ===
    loadPersons();
    
    console.log('✅ التطبيق جاهز للاستخدام');
});

// ===== تصدير الدوال للنافذة =====
window.openPersonModal = openPersonModal;
window.savePerson = savePerson;
window.openClientDetails = openClientDetails;
window.closeClientDetails = closeClientDetails;
window.addDebt = addDebt;
window.editDebt = editDebt;
window.confirmDeleteDebt = confirmDeleteDebt;
window.confirmDeletePerson = confirmDeletePerson;
window.confirmDelete = confirmDelete;
window.closeConfirmModal = closeConfirmModal;
window.handleSearch = handleSearch;
window.clearSearch = clearSearch;
window.refreshData = refreshData;
window.exportBackup = exportBackup;
window.importBackup = importBackup;
window.showToast = showToast;

console.log('✅ جميع الدوال مصدرة للنافذة');
