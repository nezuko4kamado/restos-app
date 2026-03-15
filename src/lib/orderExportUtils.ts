import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order, Product, Supplier, OrderItem } from '@/types';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
    };
  }
}

interface InvoiceDetail {
  'Fornitore': string;
  'Numero Fattura': string;
  'Data Fattura': string;
  'Importo (€)': string;
  'Numero Prodotti': number;
  'Note': string;
}

// ============================================================================
// SINGLE ORDER EXPORT
// ============================================================================

export const exportSingleOrderToExcel = (
  order: Order,
  products: Product[],
  suppliers: Supplier[]
) => {
  const supplier = suppliers.find(s => s.id === order.supplier_id);
  
  // Prepare order items data
  const itemsData = order.items.map((item, index) => {
    const product = products.find(p => p.id === item.product_id || p.id === item.productId);
    const unitDisplay = product?.unit && product.unit.toLowerCase() !== 'pz' ? ` ${product.unit}` : '';
    
    return {
      '#': index + 1,
      'Prodotto': product?.name || item.productName || 'N/A',
      'Codice': product?.code || '-',
      'Quantità': `${item.quantity}${unitDisplay}`,
      'Prezzo Unitario (€)': item.price.toFixed(2),
      'Subtotale (€)': (item.price * item.quantity).toFixed(2)
    };
  });
  
  // Calculate totals
  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Order Details
  const orderInfo = [
    { 'Campo': 'Numero Ordine', 'Valore': order.order_number || order.id },
    { 'Campo': 'Data', 'Valore': new Date(order.order_date || order.date).toLocaleDateString('it-IT') },
    { 'Campo': 'Fornitore', 'Valore': supplier?.name || 'N/A' },
    { 'Campo': 'Telefono', 'Valore': supplier?.phone || supplier?.mobile || 'N/A' },
    { 'Campo': 'Email', 'Valore': supplier?.email || 'N/A' },
    { 'Campo': 'Stato', 'Valore': order.status || 'pending' },
    { 'Campo': '', 'Valore': '' },
    { 'Campo': 'TOTALE ORDINE', 'Valore': `€${subtotal.toFixed(2)}` }
  ];
  
  const wsInfo = XLSX.utils.json_to_sheet(orderInfo);
  wsInfo['!cols'] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Dettagli Ordine');
  
  // Sheet 2: Items
  const wsItems = XLSX.utils.json_to_sheet(itemsData);
  wsItems['!cols'] = [
    { wch: 5 },  // #
    { wch: 40 }, // Prodotto
    { wch: 15 }, // Codice
    { wch: 12 }, // Quantità
    { wch: 18 }, // Prezzo Unitario
    { wch: 15 }  // Subtotale
  ];
  XLSX.utils.book_append_sheet(wb, wsItems, 'Prodotti');
  
  // Generate filename
  const orderNum = order.order_number || order.id.slice(0, 8);
  const filename = `ordine_${orderNum}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
};

export const exportSingleOrderToPDF = (
  order: Order,
  products: Product[],
  suppliers: Supplier[]
) => {
  const doc = new jsPDF();
  const supplier = suppliers.find(s => s.id === order.supplier_id);
  
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDINE', 14, 20);
  
  // Order info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° Ordine: ${order.order_number || order.id.slice(0, 8)}`, 14, 30);
  doc.text(`Data: ${new Date(order.order_date || order.date).toLocaleDateString('it-IT')}`, 14, 36);
  doc.text(`Stato: ${order.status || 'pending'}`, 14, 42);
  
  // Supplier info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Fornitore:', 14, 52);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(supplier?.name || 'N/A', 14, 58);
  if (supplier?.phone || supplier?.mobile) {
    doc.text(`Tel: ${supplier.phone || supplier.mobile}`, 14, 64);
  }
  if (supplier?.email) {
    doc.text(`Email: ${supplier.email}`, 14, 70);
  }
  
  // Items table
  const tableData = order.items.map((item, index) => {
    const product = products.find(p => p.id === item.product_id || p.id === item.productId);
    const unitDisplay = product?.unit && product.unit.toLowerCase() !== 'pz' ? ` ${product.unit}` : '';
    
    return [
      (index + 1).toString(),
      product?.name || item.productName || 'N/A',
      `${item.quantity}${unitDisplay}`,
      `€${item.price.toFixed(2)}`,
      `€${(item.price * item.quantity).toFixed(2)}`
    ];
  });
  
  autoTable(doc, {
    startY: 80,
    head: [['#', 'Prodotto', 'Quantità', 'Prezzo', 'Subtotale']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 80 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
    }
  });
  
  // Total
  const finalY = doc.lastAutoTable?.finalY || 80;
  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTALE: €${subtotal.toFixed(2)}`, 14, finalY + 10);
  
  // Save
  const orderNum = order.order_number || order.id.slice(0, 8);
  const filename = `ordine_${orderNum}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

// ============================================================================
// MULTIPLE ORDERS EXPORT
// ============================================================================

export const exportOrdersToExcel = (
  orders: Order[],
  products: Product[],
  suppliers: Supplier[]
) => {
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Orders Summary
  const summaryData = orders.map(order => {
    const supplier = suppliers.find(s => s.id === order.supplier_id);
    const total = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    return {
      'N° Ordine': order.order_number || order.id.slice(0, 8),
      'Data': new Date(order.order_date || order.date).toLocaleDateString('it-IT'),
      'Fornitore': supplier?.name || 'N/A',
      'N° Prodotti': order.items.length,
      'Totale (€)': total.toFixed(2),
      'Stato': order.status || 'pending'
    };
  });
  
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [
    { wch: 15 }, // N° Ordine
    { wch: 12 }, // Data
    { wch: 30 }, // Fornitore
    { wch: 12 }, // N° Prodotti
    { wch: 15 }, // Totale
    { wch: 12 }  // Stato
  ];
  wsSummary['!autofilter'] = { ref: `A1:F${summaryData.length + 1}` };
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Riepilogo Ordini');
  
  // Sheet 2: All Items
  const allItemsData: Record<string, string | number>[] = [];
  orders.forEach(order => {
    const supplier = suppliers.find(s => s.id === order.supplier_id);
    
    order.items.forEach(item => {
      const product = products.find(p => p.id === item.product_id || p.id === item.productId);
      const unitDisplay = product?.unit && product.unit.toLowerCase() !== 'pz' ? ` ${product.unit}` : '';
      
      allItemsData.push({
        'N° Ordine': order.order_number || order.id.slice(0, 8),
        'Data Ordine': new Date(order.order_date || order.date).toLocaleDateString('it-IT'),
        'Fornitore': supplier?.name || 'N/A',
        'Prodotto': product?.name || item.productName || 'N/A',
        'Codice': product?.code || '-',
        'Quantità': `${item.quantity}${unitDisplay}`,
        'Prezzo (€)': item.price.toFixed(2),
        'Subtotale (€)': (item.price * item.quantity).toFixed(2)
      });
    });
  });
  
  const wsItems = XLSX.utils.json_to_sheet(allItemsData);
  wsItems['!cols'] = [
    { wch: 15 }, // N° Ordine
    { wch: 12 }, // Data Ordine
    { wch: 30 }, // Fornitore
    { wch: 40 }, // Prodotto
    { wch: 15 }, // Codice
    { wch: 12 }, // Quantità
    { wch: 12 }, // Prezzo
    { wch: 15 }  // Subtotale
  ];
  wsItems['!autofilter'] = { ref: `A1:H${allItemsData.length + 1}` };
  XLSX.utils.book_append_sheet(wb, wsItems, 'Tutti i Prodotti');
  
  // Generate filename
  const filename = `ordini_completo_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
};

export const exportOrdersToPDF = (
  orders: Order[],
  products: Product[],
  suppliers: Supplier[]
) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ELENCO ORDINI', 14, 20);
  
  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 14, 28);
  
  // Summary table
  const summaryData = orders.map(order => {
    const supplier = suppliers.find(s => s.id === order.supplier_id);
    const total = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    return [
      order.order_number || order.id.slice(0, 8),
      new Date(order.order_date || order.date).toLocaleDateString('it-IT'),
      supplier?.name || 'N/A',
      order.items.length.toString(),
      `€${total.toFixed(2)}`,
      order.status || 'pending'
    ];
  });
  
  autoTable(doc, {
    startY: 35,
    head: [['N° Ordine', 'Data', 'Fornitore', 'Prodotti', 'Totale', 'Stato']],
    body: summaryData,
    theme: 'striped',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 50 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 25, halign: 'center' }
    }
  });
  
  // Totals
  const finalY = doc.lastAutoTable?.finalY || 35;
  const grandTotal = orders.reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
  }, 0);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Totale Ordini: ${orders.length}`, 14, finalY + 10);
  doc.text(`Valore Totale: €${grandTotal.toFixed(2)}`, 14, finalY + 17);
  
  // Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Pagina ${i} di ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // Save
  const filename = `ordini_completo_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};