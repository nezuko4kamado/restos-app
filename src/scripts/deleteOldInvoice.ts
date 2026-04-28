import { supabase } from '../lib/supabase';

/**
 * Script per eliminare la vecchia fattura problematica dal database
 * Fattura ID: 4dc08f29-a6a9-454c-9f4e-e18b2c373cd4
 * Problema: Manca il campo supplier_id
 */

const OLD_INVOICE_ID = '4dc08f29-a6a9-454c-9f4e-e18b2c373cd4';

async function deleteOldInvoice() {
  console.log('🗑️ Inizio eliminazione fattura problematica...');
  console.log('📋 ID fattura:', OLD_INVOICE_ID);

  try {
    // Step 1: Verifica che la fattura esista
    console.log('\n1️⃣ Verifica esistenza fattura...');
    const { data: existingInvoice, error: checkError } = await supabase
      .from('invoices')
      .select('id, invoice_number, supplier_id, created_at')
      .eq('id', OLD_INVOICE_ID)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        console.log('✅ La fattura non esiste già nel database (già eliminata?)');
        return;
      }
      throw checkError;
    }

    console.log('📄 Fattura trovata:');
    console.log('   - ID:', existingInvoice.id);
    console.log('   - Numero:', existingInvoice.invoice_number);
    console.log('   - Supplier ID:', existingInvoice.supplier_id || 'MANCANTE ❌');
    console.log('   - Creata il:', existingInvoice.created_at);

    // Step 2: Conferma che è la fattura problematica (senza supplier_id)
    if (existingInvoice.supplier_id) {
      console.warn('⚠️ ATTENZIONE: Questa fattura ha un supplier_id. Potrebbe non essere quella problematica.');
      console.warn('   Eliminazione annullata per sicurezza.');
      return;
    }

    // Step 3: Elimina la fattura
    console.log('\n2️⃣ Eliminazione fattura...');
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', OLD_INVOICE_ID);

    if (deleteError) {
      throw deleteError;
    }

    console.log('✅ Fattura eliminata con successo!');

    // Step 4: Verifica che sia stata eliminata
    console.log('\n3️⃣ Verifica eliminazione...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('invoices')
      .select('id')
      .eq('id', OLD_INVOICE_ID);

    if (verifyError) throw verifyError;

    if (!verifyData || verifyData.length === 0) {
      console.log('✅ CONFERMATO: La fattura è stata eliminata definitivamente dal database');
    } else {
      console.error('❌ ERRORE: La fattura è ancora presente nel database!');
    }

  } catch (error) {
    console.error('❌ Errore durante l\'eliminazione:', error);
    throw error;
  }
}

// Esegui lo script
deleteOldInvoice()
  .then(() => {
    console.log('\n🎉 Script completato con successo!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script fallito:', error);
    process.exit(1);
  });