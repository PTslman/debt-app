import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";

window.exportBackup = async function() {
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
        link.click();
        URL.revokeObjectURL(url);
        
        showToast('✅ تم تصدير النسخة الاحتياطية', 'success');
    } catch (error) {
        console.error('❌ خطأ:', error);
        showToast('❌ خطأ في التصدير', 'error');
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
        
        if (!confirm('⚠️ استعادة النسخة ستستبدل جميع البيانات. هل أنت متأكد؟')) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.persons || !data.debts) {
                alert('ملف غير صحيح!');
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
            setTimeout(() => location.reload(), 1000);
            
        } catch (error) {
            console.error('❌ خطأ:', error);
            showToast('❌ خطأ في الاستعادة', 'error');
        }
        input.remove();
    };
    
    document.body.appendChild(input);
    input.click();
};

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
