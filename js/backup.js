import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";

// تصدير نسخة احتياطية
window.exportBackup = async function() {
    try {
        const personsSnapshot = await getDocs(collection(db, "persons"));
        const debtsSnapshot = await getDocs(collection(db, "debts"));
        
        const data = {
            exportedAt: new Date().toISOString(),
            version: "2.0",
            totalPersons: personsSnapshot.size,
            totalDebts: debtsSnapshot.size,
            persons: personsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })),
            debts: debtsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup-debts-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        showToast('✅ تم تصدير النسخة الاحتياطية بنجاح!', 'success');
    } catch (error) {
        console.error('❌ خطأ في التصدير:', error);
        showToast('❌ خطأ في تصدير النسخة الاحتياطية', 'error');
    }
};

// استعادة نسخة احتياطية
window.importBackup = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!confirm('⚠️ تحذير: استعادة النسخة ستستبدل جميع البيانات الحالية. هل أنت متأكد؟')) {
            return;
        }
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.persons || !data.debts) {
                alert('❌ ملف النسخة الاحتياطية غير صحيح!');
                return;
            }
            
            // حذف جميع البيانات الحالية
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
            
            showToast('✅ تم استعادة البيانات بنجاح!', 'success');
            setTimeout(() => location.reload(), 1000);
            
        } catch (error) {
            console.error('❌ خطأ في الاستعادة:', error);
            showToast('❌ خطأ في استعادة النسخة الاحتياطية', 'error');
        }
        
        input.remove();
    };
    
    document.body.appendChild(input);
    input.click();
};

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const colors = {
        success: '#48bb78',
        error: '#fc8181',
        warning: '#ed8936'
    };
    
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 9999;
        padding: 16px 25px;
        border-radius: 14px;
        background: ${colors[type] || '#48bb78'};
        color: white;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        font-weight: 500;
        font-family: 'Tajawal', sans-serif;
        max-width: 90%;
        animation: slideUp 0.4s ease;
        direction: rtl;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
