import { db } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, deleteDoc, doc, 
    updateDoc, query, where 
} from "firebase/firestore";

let currentPersonId = null;
let editingDebtId = null;

console.log('🚀 تطبيق الديون بدأ العمل');

// ===== التحقق من الاتصال =====
async function checkFirebase() {
    try {
        const testRef = collection(db, "persons");
        await getDocs(testRef);
        console.log('✅ Firebase متصل بنجاح');
        return true;
    } catch (error) {
        console.error('❌ خطأ في الاتصال:', error);
        showAlert('❌ فشل الاتصال بقاعدة البيانات', 'error');
        return false;
    }
}

// ===== إدارة الأشخاص =====

window.addPerson = async function() {
    const nameInput = document.getElementById('personName');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('الرجاء إدخال اسم الشخص');
        return;
    }
    
    try {
        console.log('➕ جاري إضافة:', name);
        
        const q = query(collection(db, "persons"), where("name", "==", name));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            alert('⚠️ هذا الشخص موجود مسبقاً!');
            return;
        }
        
        await addDoc(collection(db, "persons"), {
            name: name,
            createdAt: new Date().toISOString()
        });
        
        console.log('✅ تم إضافة:', name);
        nameInput.value = '';
        await loadPersons();
        showAlert(`✅ تم إضافة "${name}"`, 'success');
        
    } catch (error) {
        console.error('❌ خطأ:', error);
        showAlert('❌ خطأ: ' + error.message, 'error');
    }
};

async function loadPersons() {
    try {
        console.log('📋 جاري تحميل الأشخاص...');
        const snapshot = await getDocs(collection(db, "persons"));
        console.log('👥 عدد الأشخاص:', snapshot.size);
        
        const persons = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        const container = document.getElementById('personsContainer');
        
        if (persons.length === 0) {
            container.innerHTML = '<p style="color:#718096;text-align:center;padding:20px;">📭 لا يوجد أشخاص. أضف شخصاً جديداً!</p>';
            return;
        }
        
        let html = '<div class="persons-grid">';
        for (const person of persons) {
            const debtsQuery = query(collection(db, "debts"), where("personId", "==", person.id));
            const debtsSnapshot = await getDocs(debtsQuery);
            const debtCount = debtsSnapshot.size;
            
            html += `
                <div class="person-card" onclick="showPersonDetails('${person.id}', '${person.name}')">
                    <button class="delete-person" onclick="event.stopPropagation(); deletePerson('${person.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="name">${person.name}</div>
                    <div class="debt-count">${debtCount} دين</div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
        console.log('✅ تم تحميل الأشخاص');
        
    } catch (error) {
        console.error('❌ خطأ في التحميل:', error);
        document.getElementById('personsContainer').innerHTML = `
            <p style="color:#fc8181;text-align:center;padding:20px;">
                ❌ خطأ في تحميل البيانات<br>
                <small style="color:#718096;">${error.message}</small>
            </p>
        `;
    }
}

window.deletePerson = async function(personId) {
    if (!confirm('هل أنت متأكد من حذف هذا الشخص وكل ديونه؟')) return;
    
    try {
        const debtsQuery = query(collection(db, "debts"), where("personId", "==", personId));
        const debtsSnapshot = await getDocs(debtsQuery);
        
        for (const debtDoc of debtsSnapshot.docs) {
            await deleteDoc(doc(db, "debts", debtDoc.id));
        }
        
        await deleteDoc(doc(db, "persons", personId));
        
        if (currentPersonId === personId) {
            closeDetails();
        }
        
        await loadPersons();
        showAlert('✅ تم حذف الشخص وديونه', 'success');
    } catch (error) {
        console.error('❌ خطأ في الحذف:', error);
        showAlert('❌ خطأ في الحذف', 'error');
    }
};

// ===== إدارة الديون =====

window.showPersonDetails = async function(personId, personName) {
    currentPersonId = personId;
    document.getElementById('selectedPersonName').textContent = personName;
    document.getElementById('personDetails').style.display = 'block';
    
    editingDebtId = null;
    document.querySelector('.add-debt-form h3').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة دين جديد';
    document.querySelector('.btn-add-debt').innerHTML = '<i class="fas fa-save"></i> إضافة';
    document.getElementById('debtAmount').value = '';
    document.getElementById('debtDate').value = '';
    
    await loadDebts(personId);
};

window.closeDetails = function() {
    document.getElementById('personDetails').style.display = 'none';
    currentPersonId = null;
    editingDebtId = null;
};

async function loadDebts(personId) {
    try {
        const q = query(collection(db, "debts"), where("personId", "==", personId));
        const snapshot = await getDocs(q);
        const debts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        debts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const tbody = document.getElementById('debtListBody');
        
        if (debts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#718096;">لا يوجد ديون لهذا الشخص</td></tr>';
            document.getElementById('totalAmount').textContent = '0';
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
                    <td>${debt.date}</td>
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
        
        document.getElementById('totalAmount').textContent = total.toLocaleString();
    } catch (error) {
        console.error('❌ خطأ في تحميل الديون:', error);
    }
}

window.addDebt = async function() {
    if (!currentPersonId) {
        alert('الرجاء اختيار شخص أولاً');
        return;
    }
    
    const amount = document.getElementById('debtAmount').value;
    const date = document.getElementById('debtDate').value;
    
    if (!amount || !date) {
        alert('الرجاء إدخال المبلغ والتاريخ');
        return;
    }
    
    if (isNaN(amount) || Number(amount) <= 0) {
        alert('الرجاء إدخال مبلغ صحيح أكبر من 0');
        return;
    }
    
    try {
        if (editingDebtId) {
            await updateDoc(doc(db, "debts", editingDebtId), {
                amount: Number(amount),
                date: date
            });
            showAlert('✅ تم تعديل الدين', 'success');
            editingDebtId = null;
            document.querySelector('.add-debt-form h3').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة دين جديد';
            document.querySelector('.btn-add-debt').innerHTML = '<i class="fas fa-save"></i> إضافة';
        } else {
            await addDoc(collection(db, "debts"), {
                personId: currentPersonId,
                amount: Number(amount),
                date: date,
                createdAt: new Date().toISOString()
            });
            showAlert('✅ تم إضافة الدين', 'success');
        }
        
        document.getElementById('debtAmount').value = '';
        document.getElementById('debtDate').value = '';
        await loadDebts(currentPersonId);
        await loadPersons();
    } catch (error) {
        console.error('❌ خطأ في حفظ الدين:', error);
        showAlert('❌ خطأ في حفظ الدين', 'error');
    }
};

window.editDebt = function(debtId, amount, date) {
    editingDebtId = debtId;
    document.getElementById('debtAmount').value = amount;
    document.getElementById('debtDate').value = date;
    document.querySelector('.add-debt-form h3').innerHTML = '<i class="fas fa-edit"></i> تعديل الدين';
    document.querySelector('.btn-add-debt').innerHTML = '<i class="fas fa-save"></i> تحديث';
    document.getElementById('debtAmount').focus();
};

window.deleteDebt = async function(debtId) {
    if (!confirm('هل أنت متأكد من حذف هذا الدين؟')) return;
    
    try {
        await deleteDoc(doc(db, "debts", debtId));
        showAlert('✅ تم حذف الدين', 'success');
        await loadDebts(currentPersonId);
        await loadPersons();
    } catch (error) {
        console.error('❌ خطأ في حذف الدين:', error);
        showAlert('❌ خطأ في حذف الدين', 'error');
    }
};

// ===== أدوات مساعدة =====

window.refreshData = function() {
    loadPersons();
    if (currentPersonId) {
        loadDebts(currentPersonId);
    }
    showAlert('🔄 تم تحديث البيانات', 'success');
};

function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.padding = '15px 25px';
    alertDiv.style.borderRadius = '12px';
    alertDiv.style.background = type === 'success' ? '#48bb78' : '#fc8181';
    alertDiv.style.color = 'white';
    alertDiv.style.boxShadow = '0 5px 20px rgba(0,0,0,0.2)';
    alertDiv.style.fontWeight = '500';
    alertDiv.style.animation = 'slideIn 0.3s ease';
    alertDiv.style.maxWidth = '90%';
    alertDiv.style.fontFamily = "'Tajawal', sans-serif";
    alertDiv.textContent = message;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.opacity = '0';
        alertDiv.style.transition = 'opacity 0.3s';
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
}

// ===== بدء التطبيق =====
document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('debtDate').value = today;
    
    await checkFirebase();
    await loadPersons();
    
    console.log('✅ التطبيق جاهز للاستخدام');
});
