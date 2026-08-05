import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";

console.log('💾 Backup module loaded');

// ===== EXPORT BACKUP =====
window.exportBackup = async function() {
    console.log('📤 تصدير نسخة احتياطية...');
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
        
        if (window.showToast) {
            window.showToast('✅ تم تصدير النسخة الاحتياطية', 'success');
        } else {
            alert('✅ تم تصدير النسخة الاحتياطية');
        }
        console.log('✅ تم التصدير بنجاح');
        return true;
    } catch (error) {
        console.error('❌ Export error:', error);
        if (window.showToast) {
            window.showToast('❌ خطأ في التصدير: ' + error.message, 'error');
        } else {
            alert('❌ خطأ في التصدير: ' + error.message);
        }
        return false;
    }
};

// ===== IMPORT BACKUP =====
window.importBackup = function() {
    console.log('📥 استعادة نسخة احتياطية...');
    
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
            
            if (window.showToast) {
                window.showToast('✅ تم استعادة البيانات', 'success');
            } else {
                alert('✅ تم استعادة البيانات');
            }
            
            setTimeout(() => location.reload(), 1500);
            
        } catch (error) {
            console.error('❌ Restore error:', error);
            if (window.showToast) {
                window.showToast('❌ خطأ في الاستعادة: ' + error.message, 'error');
            } else {
                alert('❌ خطأ في الاستعادة: ' + error.message);
            }
        }
        input.remove();
    };
    
    document.body.appendChild(input);
    input.click();
};

console.log('✅ Backup module ready - functions exported to window');
