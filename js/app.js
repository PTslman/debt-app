import { db } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, deleteDoc, doc, 
    updateDoc, query, where, onSnapshot, orderBy 
} from "firebase/firestore";

console.log('🚀 App started');

// ===== المتغيرات =====
let currentPersonId = null;
let currentDebtId = null;
let editingPerson = null;
let deleteTarget = null;
let deleteType = null;
let allPersons = [];

// ===== Toast =====
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const colors = {
        success: '#25D366',
        error: '#FC8181',
        warning: '#F6AD55'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
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
    `;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== المودالات =====
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

// ===== إضافة/تعديل عميل =====
function openPersonModal(person = null) {
    editingPerson = person;
    const modalTitle = document.getElementById('modalTitle');
    const nameInput = document.getElementById('personNameInput');
    const amountInput = document.getElementById('personAmountInput');
    const dateInput = document.getElementById('personDateInput');
    const messageBox = document.getElementById('personMessage');
    
    messageBox.className = 'message-box';
    messageBox.style.display = 'none';
    
    if (person) {
        modalTitle.innerHTML = '<i class="fas fa-user-edit"></i> تعديل العميل';
        nameInput.value = person.name;
        amountInput.value = person.amount || '';
        dateInput.value = person.date || new Date().toISOString().split('T')[0];
    } else {
        modalTitle.innerHTML = '<i class="fas fa-user-plus"></i> عميل جديد';
        nameInput.value = '';
        amountInput.value = '';
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    openModal('personModal');
    setTimeout(() => nameInput.focus(), 100);
}

async function savePerson() {
    const nameInput = document.getElementById('personNameInput');
    const amountInput = document.getElementById('personAmountInput');
    const dateInput = document.getElementById('personDateInput');
    const messageBox = document.getElementById('personMessage');
    
    const name = nameInput.value.trim();
    const amount = amountInput.value.trim();
    const date = dateInput.value;
    
    messageBox.className = 'message-box';
    messageBox.style.display = 'none';
    
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
    
    try {
        if (editingPerson) {
            // تعديل عميل موجود
            await updateDoc(doc(db, "persons", editingPerson.id), {
                name: name,
                amount: Number(amount),
                date: date,
                updatedAt: new Date().toISOString()
            });
            showToast('✅ تم تعديل العميل', 'success');
        } else {
            // إضافة عميل جديد
            const q = query(collection(db, "persons"), where("name", "==", name));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                messageBox.textContent = `⚠️ "${name}" موجود مسبقاً!`;
                messageBox.className = 'message-box error show';
                messageBox.style.display = 'block';
                nameInput.value = '';
                nameInput.focus();
                return;
            }
            
            await addDoc(collection(db, "persons"), {
                name: name,
                amount: Number(amount),
                date: date,
                createdAt: new Date().toISOString()
            });
            showToast(`✅ تم إضافة "${name}"`, 'success');
        }
        
        closeModal('personModal');
        editingPerson = null;
        
    } catch (error) {
        console.error('Error:', error);
        messageBox.textContent = `❌ ${error.message}`;
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        showToast('❌ خطأ في الحفظ', 'error');
    }
}

// ===== تحميل العملاء =====
function loadPersons() {
    const q = query(collection(db, "persons"), orderBy("createdAt", "desc"));
    
    onSnapshot(q, async (snapshot) => {
        try {
            const persons = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            allPersons = persons;
            
            // تحديث الإحصائيات
            document.getElementById('totalPersons').textContent = persons.length;
            
            let totalDebts = 0;
            let totalAmount = 0;
            
            for (const person of persons) {
                const debtsQuery = query(collection(db, "debts"), where("personId", "==", person.id));
                const debtsSnapshot = await getDocs(debtsQuery);
                const debtCount = debtsSnapshot.size;
                totalDebts += debtCount;
                
                // حساب إجمالي المبلغ من الديون
                debtsSnapshot.docs.forEach(doc => {
                    totalAmount += Number(doc.data().amount || 0);
                });
            }
            
            document.getElementById('totalDebts').textContent = totalDebts;
            document.getElementById('totalAmount').textContent = totalAmount.toLocaleString();
            
            // عرض العملاء
            renderPersons(persons);
            
        } catch (error) {
            console.error('Error loading persons:', error);
        }
    }, (error) => {
        console.error('Snapshot error:', error);
        showToast('❌ خطأ في تحميل البيانات', 'error');
    });
}

function renderPersons(persons) {
    const container = document.getElementById('chatList');
    const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
    
    // تصفية حسب البحث
    let filtered = persons;
    if (searchQuery) {
        filtered = persons.filter(p => p.name.toLowerCase().includes(searchQuery));
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
        const firstLetter = person.name.charAt(0).toUpperCase();
        const debtCount = person._debtCount || 0;
        const amount = person.amount || 0;
        const date = person.date ? formatDate(person.date) : '';
        
        html += `
            <div class="chat-item" data-id="${person.id}">
                <div class="chat-avatar">${firstLetter}</div>
                <div class="chat-info">
                    <div class="chat-name">${person.name}</div>
                    <div class="chat-preview">
                        <span class="amount">${Number(amount).toLocaleString()} ل.س</span>
                        <span>•</span>
                        <span>${debtCount} دين</span>
                    </div>
                </div>
                <div class="chat-meta">
                    <span class="chat-date">${date}</span>
                    ${debtCount > 0 ? `<span class="chat-badge">${debtCount}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // إضافة أحداث النقر
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
async function openClientDetails(person) {
    currentPersonId = person.id;
    
    // تحديث معلومات العميل
    document.getElementById('clientName').textContent = person.name;
    document.getElementById('clientAvatar').textContent = person.name.charAt(0).toUpperCase();
    document.getElementById('clientTotalAmount').textContent = '0';
    document.getElementById('clientDebtCount').textContent = '0 ديون';
    
    // تخزين بيانات العميل للتعديل
    document.getElementById('clientName').dataset.personId = person.id;
    document.getElementById('clientName').dataset.personData = JSON.stringify(person);
    
    // إعادة تعيين نموذج الدين
    document.getElementById('debtAmountInput').value = '';
    document.getElementById('debtDateInput').value = new Date().toISOString().split('T')[0];
    document.getElementById('debtMessage').className = 'message-box';
    document.getElementById('debtMessage').style.display = 'none';
    currentDebtId = null;
    
    openModal('clientModal');
    loadDebts(person.id);
}

function closeClientDetails() {
    closeModal('clientModal');
    currentPersonId = null;
    currentDebtId = null;
}

// ===== تحميل الديون =====
function loadDebts(personId) {
    const q = query(collection(db, "debts"), where("personId", "==", personId), orderBy("date", "desc"));
    
    onSnapshot(q, (snapshot) => {
        try {
            const debts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const container = document.getElementById('debtsContainer');
            let total = 0;
            
            document.getElementById('clientDebtCount').textContent = `${debts.length} ديون`;
            
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
            
            // أحداث التعديل والحذف
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
            console.error('Error loading debts:', error);
        }
    }, (error) => {
        console.error('Debts snapshot error:', error);
    });
}

// ===== إضافة دين =====
async function addDebt() {
    if (!currentPersonId) {
        showToast('⚠️ الرجاء اختيار عميل', 'warning');
        return;
    }
    
    const amountInput = document.getElementById('debtAmountInput');
    const dateInput = document.getElementById('debtDateInput');
    const messageBox = document.getElementById('debtMessage');
    
    const amount = amountInput.value;
    const date = dateInput.value;
    
    messageBox.className = 'message-box';
    messageBox.style.display = 'none';
    
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
        console.error('Error:', error);
        messageBox.textContent = `❌ ${error.message}`;
        messageBox.className = 'message-box error show';
        messageBox.style.display = 'block';
        showToast('❌ خطأ في حفظ الدين', 'error');
    }
}

// ===== تعديل دين =====
function editDebt(id, amount, date) {
    currentDebtId = id;
    document.getElementById('debtAmountInput').value = amount;
    document.getElementById('debtDateInput').value = date;
    document.getElementById('debtAmountInput').focus();
    document.getElementById('debtAmountInput').scrollIntoView({ behavior: 'smooth' });
    showToast('✏️ قم بتعديل المبلغ ثم اضغط +', 'warning');
}

// ===== حذف دين =====
function confirmDeleteDebt(id) {
    deleteTarget = id;
    deleteType = 'debt';
    document.getElementById('confirmMessage').textContent = 'هل أنت متأكد من حذف هذا الدين؟';
    openModal('confirmModal');
}

// ===== حذف عميل =====
function confirmDeletePerson() {
    deleteTarget = currentPersonId;
    deleteType = 'person';
    const name = document.getElementById('clientName').textContent;
    document.getElementById('confirmMessage').textContent = `هل أنت متأكد من حذف "${name}" وكل ديونه؟`;
    openModal('confirmModal');
}

// ===== تأكيد الحذف =====
async function confirmDelete() {
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
        console.error('Error:', error);
        showToast('❌ خطأ في الحذف', 'error');
    }
}

function closeConfirmModal() {
    closeModal('confirmModal');
    deleteTarget = null;
    deleteType = null;
}

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
function handleSearch(e) {
    const query = e.target.value;
    const clearBtn = document.getElementById('btnClearSearch');
    
    if (query.length > 0) {
        clearBtn.style.display = 'flex';
    } else {
        clearBtn.style.display = 'none';
    }
    
    renderPersons(allPersons);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('btnClearSearch').style.display = 'none';
    renderPersons(allPersons);
}

// ===== Backup =====
async function exportBackup() {
    try {
        const personsSnapshot = await getDocs(collection(db, "persons"));
        const debtsSnapshot = await getDocs(collection(db, "debts"));
        
        const data = {
            exportedAt: new Date().toISOString(),
            version: "2.0",
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
        console.error('Export error:', error);
        showToast('❌ خطأ في التصدير', 'error');
    }
}

function importBackup() {
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
            console.error('Restore error:', error);
            showToast('❌ خطأ في الاستعادة', 'error');
        }
        input.remove();
    };
    
    document.body.appendChild(input);
    input.click();
}

// ===== ربط الأحداث =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM ready');
    
    // زر إضافة عميل
    document.getElementById('fabAddPerson').addEventListener('click', () => openPersonModal(null));
    
    // زر حفظ عميل
    document.getElementById('btnSavePerson').addEventListener('click', savePerson);
    
    // زر إضافة دين
    document.getElementById('btnAddDebt').addEventListener('click', addDebt);
    
    // إغلاق المودالات
    document.getElementById('closePersonModal').addEventListener('click', () => closeModal('personModal'));
    document.getElementById('closeClientModal').addEventListener('click', closeClientDetails);
    document.getElementById('btnConfirmCancel').addEventListener('click', closeConfirmModal);
    document.getElementById('btnConfirmDelete').addEventListener('click', confirmDelete);
    
    // تعديل وحذف العميل
    document.getElementById('btnEditClient').addEventListener('click', () => {
        const personData = JSON.parse(document.getElementById('clientName').dataset.personData || '{}');
        if (personData.id) {
            closeClientDetails();
            setTimeout(() => openPersonModal(personData), 300);
        }
    });
    document.getElementById('btnDeleteClient').addEventListener('click', confirmDeletePerson);
    
    // بحث
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('btnClearSearch').addEventListener('click', clearSearch);
    
    // Backup
    document.getElementById('btnBackup').addEventListener('click', exportBackup);
    document.getElementById('btnRestore').addEventListener('click', importBackup);
    
    // Enter key
    document.getElementById('personNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') savePerson();
    });
    document.getElementById('personAmountInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') savePerson();
    });
    document.getElementById('debtAmountInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addDebt();
    });
    
    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (modal.id === 'personModal') closeModal('personModal');
                else if (modal.id === 'clientModal') closeClientDetails();
                else if (modal.id === 'confirmModal') closeConfirmModal();
            }
        });
    });
    
    // تحميل البيانات
    loadPersons();
});

console.log('✅ App ready');
