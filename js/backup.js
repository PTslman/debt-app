import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";

console.log('📦 تحميل backup.js');

// ===== تصدير نسخة احتياطية =====
window.exportBackup = async function() {
    console.log('📤 بدء تصدير النسخة الاحتياطية');
    
    try {
        const personsSnapshot = await getDocs(collection(db, "persons"));
        const debtsSnapshot = await getDocs(collection(db, "debts"));
        
        const data = {
            exportedAt: new Date().toISOString(),
            version: "2.0",
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
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        if (window.showToast) {
            window.showToast('✅ تم تصدير النسخة الاحتياطية', 'success');
        } else {
            alert('✅ تم تصدير النسخة الاحتياطية');
        }
        
        console.log('✅ تم التصدير بنجاح');
        
    } catch (error) {
        console.error('❌ خطأ في التصدير:', error);
        if (window.showToast) {
            window.showToast('❌ خطأ في تصدير النسخة', 'error');
        } else {
            alert('❌ خطأ في التصدير: ' + error.message);
        }
    }
};

// ===== استعادة نسخة احتياطية =====
window.importBackup = function() {
    console.log('📥 بدء استعادة النسخة الاحتياطية');
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!confirm('⚠️ استعادة النسخة ستستبدل جميع البيانات الحالية. هل أنت متأكد؟')) {
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
            
            if (window.showToast) {
                window.showToast('✅ تم استعادة البيانات بنجاح!', 'success');
            } else {
                alert('✅ تم استعادة البيانات بنجاح!');
            }
            
            setTimeout(() => location.reload(), 1500);
            
        } catch (error) {
            console.error('❌ خطأ في الاستعادة:', error);
            if (window.showToast) {
                window.showToast('❌ خطأ في استعادة النسخة', 'error');
            } else {
                alert('❌ خطأ في الاستعادة: ' + error.message);
            }
        }
        
        input.remove();
    };
    
    document.body.appendChild(input);
    input.click();
};

console.log('✅ backup.js جاهز');
