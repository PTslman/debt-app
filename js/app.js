import { db } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, deleteDoc, doc, 
    updateDoc, query, where 
} from "firebase/firestore";

let currentPersonId = null;
let editingDebtId = null;

// ===== إدارة الأشخاص =====

// إضافة شخص جديد
window.addPerson = async function() {
    const nameInput = document.getElementById('personName');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('الرجاء إدخال اسم الشخص');
        return;
    }
    
    try {
        // التحقق من وجود الشخص مسبقاً
        const q = query(collection(db, "persons"), where("name", "==", name));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            alert('هذا الشخص موجود مسبقاً!');
            return;
        }
        
        await addDoc(collection(db, "persons"), {
            name: name,
            createdAt: new Date().toISOString()
        });
        
        nameInput.value = '';
        loadPersons();
        showAlert('تم إضافة الشخص بنجاح', 'success');
    } catch (error) {
        console.error('خطأ في إضافة الشخص:', error);
        showAlert('حدث خطأ في إضافة الشخص', 'error');
    }
};

// تحميل قائمة الأشخاص
async function loadPersons() {
    try {
        const snapshot = await getDocs(collection(db, "persons"));
        const persons = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        const container = document.getElementById('personsContainer');
        
        if (persons.length === 0) {
            container.innerHTML = '<p style="color:#718096;text-align:center;">لا يوجد أشخاص. أضف شخصاً جديداً!</p>';
            return;
        }
        
        container.innerHTML = '<div class="persons-grid">';
        for (const person of persons) {
            // حساب عدد الديون لكل شخص
            const debtsQuery = query(collection(db, "debts"), where("personId", "==", person.id));
            const debtsSnapshot = await getDocs(debtsQuery);
            const debtCount = debtsSnapshot.size;
            
            container.innerHTML += `
                <div class="person-card" onclick="showPersonDetails('${person.id}', '${person.name}')">
                    <button class="delete-person" onclick="event.stopPropagation(); deletePerson('${person.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="name">${person.name}</div>
                    <div class="debt-count">${debtCount} دين</div>
                </div>
            `;
        }
        container.innerHTML += '</div>';
    } catch (error) {
        console.error('خطأ في تحميل الأشخاص:', error);
        showAlert('حدث خطأ في تحميل الأشخاص', 'error');
    }
}

// حذف شخص مع كل ديونه
window.deletePerson = async function(personId) {
    if (!confirm('هل أنت متأكد من حذف هذا الشخص وكل ديونه؟')) return;
    
    try {
        // حذف جميع ديون الشخص
        const debtsQuery = query(collection(db, "debts"), where("personId", "==", personId));
        const debtsSnapshot = await getDocs(debtsQuery);
        
        for (const debtDoc of debtsSnapshot.docs) {
            await deleteDoc(doc(db, "debts", debtDoc.id));
        }
        
        // حذف الشخص
        await deleteDoc(doc(db, "persons", personId));
        
        if (currentPersonId === personId) {
            closeDetails();
        }
        
        loadPersons();
        showAlert('تم حذف الشخص وديونه بنجاح', 'success');
    } catch (error) {
        console.error('خطأ في حذف الشخص:', error);
        showAlert('حدث خطأ في حذف الشخص', 'error');
    }
};

// ===== إدارة الديون =====

// عرض تفاصيل الشخص
window.showPersonDetails = async function(personId, personName) {
    currentPersonId = personId;
    document.getElementById('selectedPersonName').textContent = personName;
    document.getElementById('personDetails').style.display = 'block';
    
    // إعادة تعيين حقل التعديل
    editingDebtId = null;
    document.querySelector('.add-debt-form h3').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة دين جديد';
    document.querySelector('.btn-add-debt').innerHTML = '<i class="fas fa-save"></i> إضافة';
    document.getElementById('debtAmount').value = '';
    document.getElementById('debtDate').value = '';
    
    await loadDebts(personId);
};

// إغلاق تفاصيل الشخص
window.closeDetails = function() {
    document.getElementById('personDetails').style.display = 'none';
    currentPersonId = null;
    editingDebtId = null;
};

// تحميل ديون شخص
async function loadDebts(personId) {
    try {
        const q = query(collection(db, "debts"), where("personId", "==", personId));
        const snapshot = await getDocs(q);
        const debts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // ترتيب حسب التاريخ (الأحدث أولاً)
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
        console.error('خطأ في تحميل الديون:', error);
        showAlert('حدث خطأ في تحميل الديون', 'error');
    }
}

// إضافة دين جديد
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
            // تعديل دين موجود
            await updateDoc(doc(db, "debts", editingDebtId), {
                amount: Number(amount),
                date: date
            });
            showAlert('تم تعديل الدين بنجاح', 'success');
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
            showAlert('تم إضافة الدين بنجاح', 'success');
        }
        
        document.getElementById('debtAmount').value = '';
        document.getElementById('debtDate').value = '';
        await loadDebts(currentPersonId);
        loadPersons(); // تحديث عدد الديون
    } catch (error) {
        console.error('خطأ في حفظ الدين:', error);
        showAlert('حدث خطأ في حفظ الدين', 'error');
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
};

// حذف دين
window.deleteDebt = async function(debtId) {
    if (!confirm('هل أنت متأكد من حذف هذا الدين؟')) return;
    
    try {
        await deleteDoc(doc(db, "debts", debtId));
        showAlert('تم حذف الدين بنجاح', 'success');
        await loadDebts(currentPersonId);
        loadPersons(); // تحديث عدد الديون
    } catch (error) {
        console.error('خطأ في حذف الدين:', error);
        showAlert('حدث خطأ في حذف الدين', 'error');
    }
};

// ===== أدوات مساعدة =====

// عرض تنبيه
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.display = 'block';
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
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.opacity = '0';
        alertDiv.style.transition = 'opacity 0.3s';
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
}

// تحميل البيانات عند بدء التشغيل
loadPersons();

// تعيين التاريخ الحالي افتراضياً
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('debtDate').value = today;
});
