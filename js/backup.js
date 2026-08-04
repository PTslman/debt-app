import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";

// تصدير نسخة احتياطية
window.exportBackup = async function() {
    try {
        // جلب جميع الأشخاص والديون
        const personsSnapshot = await getDocs(collection(db, "persons"));
        const debtsSnapshot = await getDocs(collection(db, "debts"));
        
        const data = {
            exportedAt: new Date().toISOString(),
            version: "1.0",
            persons: personsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })),
            debts: debtsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
        };
        
        // تحويل إلى JSON
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // تحميل الملف
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup-debts-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        showAlert('تم تصدير النسخة الاحتياطية بنجاح!', 'success');
    } catch (error) {
        console.error('خطأ في تصدير النسخة الاحتياطية:', error);
        showAlert('حدث خطأ في تصدير النسخة الاحتياطية', 'error');
    }
};

// استعادة نسخة احتياطية
window.importBackup = function() {
    // إنشاء input مخفي لاختيار الملف
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!confirm('تحذير: استعادة النسخة ستستبدل جميع البيانات الحالية. هل أنت متأكد؟')) {
            return;
        }
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // التحقق من صحة البيانات
            if (!data.persons || !data.debts) {
                alert('ملف النسخة الاحتياطية غير صحيح!');
                return;
            }
            
            // حذف جميع البيانات الحالية
            const personsSnapshot = await getDocs(collection(db, "persons"));
            const debtsSnapshot = await getDocs(collection(db, "debts"));
            
            const batch = writeBatch(db);
            
            // حذف الديون الحالية
            for (const docSnapshot of debtsSnapshot.docs) {
                batch.delete(doc(db, "debts", docSnapshot.id));
            }
            
            // حذف الأشخاص الحاليين
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
            
            showAlert('تم استعادة البيانات بنجاح!', 'success');
            location.reload(); // إعادة تحميل الصفحة
        } catch (error) {
            console.error('خطأ في استعادة النسخة الاحتياطية:', error);
            showAlert('حدث خطأ في استعادة النسخة الاحتياطية', 'error');
        }
        
        input.remove();
    };
    
    document.body.appendChild(input);
    input.click();
};

// عرض تنبيه مساعد
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
    alertDiv.textContent = message;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.opacity = '0';
        alertDiv.style.transition = 'opacity 0.3s';
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
                          }
