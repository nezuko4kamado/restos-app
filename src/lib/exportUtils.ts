import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Product, Supplier, Invoice } from '@/types';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
    lastAutoTable?: {
      finalY: number;
    };
  }
}

// ============================================================================
// PRODUCTS EXPORT
// ============================================================================

export const exportProductsToExcel = (products: Product[], suppliers: Supplier[]) => {
  // Create supplier lookup map
  const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

  // Prepare data for Excel
  const data = products.map(product => ({
    'Nome Prodotto': product.name,
    'Codice': product.id,
    'Fornitore': supplierMap.get(product.supplierId || product.supplier_id || '') || 'N/A',
    'Categoria': product.category || 'N/A',
    'Unità': product.unit || 'N/A',
    'Prezzo (€)': (Number(product.price) || 0).toFixed(2),
    'IVA (%)': product.vatRate || 0,
    'Sconto (%)': product.discountPercent || product.discount || 0,
    'Prezzo Finale (€)': ((Number(product.price) || 0) * (1 - (Number(product.discountPercent || product.discount) || 0) / 100)).toFixed(2),
    'Storico Prezzi': product.priceHistory?.length || 0,
    'Data Creazione': product.created_at ? new Date(product.created_at).toLocaleDateString('it-IT') : 'N/A'
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  const colWidths = [
    { wch: 30 }, // Nome Prodotto
    { wch: 15 }, // Codice
    { wch: 25 }, // Fornitore
    { wch: 15 }, // Categoria
    { wch: 10 }, // Unità
    { wch: 12 }, // Prezzo
    { wch: 10 }, // IVA
    { wch: 10 }, // Sconto
    { wch: 15 }, // Prezzo Finale
    { wch: 15 }, // Storico Prezzi
    { wch: 15 }  // Data Creazione
  ];
  ws['!cols'] = colWidths;

  // Add autofilter
  ws['!autofilter'] = { ref: `A1:K${data.length + 1}` };

  // Style header row
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = XLSX.utils.encode_col(C) + '1';
    if (!ws[address]) continue;
    ws[address].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'E0E7FF' } },
      alignment: { horizontal: 'center' }
    };
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Prodotti');

  // Generate filename with date
  const filename = `prodotti_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
};

export const exportProductsToPDF = (products: Product[], suppliers: Supplier[]) => {
  const doc = new jsPDF();
  const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Elenco Prodotti', 14, 20);

  // Add date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 14, 28);

  // Prepare table data
  const tableData = products.map(product => [
    product.name,
    supplierMap.get(product.supplierId || product.supplier_id || '') || 'N/A',
    product.category || 'N/A',
    `€${(Number(product.price) || 0).toFixed(2)}`,
    `${product.vatRate || 0}%`,
    `${product.discountPercent || product.discount || 0}%`,
    `€${((Number(product.price) || 0) * (1 - (Number(product.discountPercent || product.discount) || 0) / 100)).toFixed(2)}`
  ]);

  // Add table
  autoTable(doc, {
    startY: 35,
    head: [['Prodotto', 'Fornitore', 'Categoria', 'Prezzo', 'IVA', 'Sconto', 'Prezzo Finale']],
    body: tableData,
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
      0: { cellWidth: 40 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
    }
  });

  // Add footer with totals
  const finalY = doc.lastAutoTable?.finalY || 35;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Totale Prodotti: ${products.length}`, 14, finalY + 10);

  const totalValue = products.reduce((sum, p) => sum + p.price, 0);
  doc.text(`Valore Totale: €${(Number(totalValue) || 0).toFixed(2)}`, 14, finalY + 17);

  // Add page numbers
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

  // Save PDF
  const filename = `prodotti_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

// ============================================================================
// SUPPLIERS EXPORT - IMPROVED WITH INVOICE DETAILS
// ============================================================================

interface InvoiceDetail {
  'Fornitore': string;
  'Numero Fattura': string;
  'Data Fattura': string;
  'Importo (€)': string;
  'Numero Prodotti': number;
  'Note': string;
}

interface ProductDetail {
  'Fornitore': string;
  'Prodotto': string;
  'Categoria': string;
  'Prezzo (€)': string;
  'IVA (%)': number;
  'Sconto (%)': number;
  'Prezzo Finale (€)': string;
}

export const exportSuppliersToExcel = (
  suppliers: Supplier[],
  products: Product[],
  invoices: Invoice[]
) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Suppliers Summary
  const summaryData = suppliers.map(supplier => {
    const supplierProducts = products.filter(
      p => p.supplierId === supplier.id || p.supplier_id === supplier.id
    );
    const supplierInvoices = invoices.filter(
      inv => inv.supplierId === supplier.id || inv.supplier_id === supplier.id
    );
    const totalSpent = supplierInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    return {
      'Nome Fornitore': supplier.name,
      'Contatto': supplier.contact || 'N/A',
      'Telefono': supplier.phone || 'N/A',
      'Email': supplier.email || 'N/A',
      'Indirizzo': supplier.address || 'N/A',
      'Numero Prodotti': supplierProducts.length,
      'Numero Fatture': supplierInvoices.length,
      'Totale Speso (€)': (Number(totalSpent) || 0).toFixed(2),
      'Media Fattura (€)': supplierInvoices.length > 0 ? ((Number(totalSpent) || 0) / (supplierInvoices.length || 1)).toFixed(2) : '0.00',
      'Data Creazione': supplier.created_at ? new Date(supplier.created_at).toLocaleDateString('it-IT') : 'N/A'
    };
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [
    { wch: 30 }, // Nome Fornitore
    { wch: 20 }, // Contatto
    { wch: 18 }, // Telefono
    { wch: 25 }, // Email
    { wch: 35 }, // Indirizzo
    { wch: 15 }, // Numero Prodotti
    { wch: 15 }, // Numero Fatture
    { wch: 15 }, // Totale Speso
    { wch: 15 }, // Media Fattura
    { wch: 15 }  // Data Creazione
  ];
  wsSummary['!autofilter'] = { ref: `A1:J${summaryData.length + 1}` };
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Riepilogo Fornitori');

  // Sheet 2: Detailed Invoices per Supplier
  const detailedData: InvoiceDetail[] = [];
  
  suppliers.forEach(supplier => {
    const supplierInvoices = invoices.filter(
      inv => inv.supplierId === supplier.id || inv.supplier_id === supplier.id
    );
    
    supplierInvoices.forEach(invoice => {
      detailedData.push({
        'Fornitore': supplier.name,
        'Numero Fattura': invoice.invoiceNumber || invoice.invoice_number || 'N/A',
        'Data Fattura': invoice.date ? new Date(invoice.date).toLocaleDateString('it-IT') : 'N/A',
        'Importo (€)': (Number(invoice.amount) || 0).toFixed(2),
        'Numero Prodotti': Array.isArray(invoice.items) ? invoice.items.length : 0,
        'Note': invoice.notes || ''
      });
    });
  });

  if (detailedData.length > 0) {
    const wsDetailed = XLSX.utils.json_to_sheet(detailedData);
    wsDetailed['!cols'] = [
      { wch: 30 }, // Fornitore
      { wch: 20 }, // Numero Fattura
      { wch: 15 }, // Data Fattura
      { wch: 15 }, // Importo
      { wch: 15 }, // Numero Prodotti
      { wch: 40 }  // Note
    ];
    wsDetailed['!autofilter'] = { ref: `A1:F${detailedData.length + 1}` };
    XLSX.utils.book_append_sheet(wb, wsDetailed, 'Dettaglio Fatture');
  }

  // Sheet 3: Products per Supplier with Prices
  const productsData: ProductDetail[] = [];
  
  suppliers.forEach(supplier => {
    const supplierProducts = products.filter(
      p => p.supplierId === supplier.id || p.supplier_id === supplier.id
    );
    
    supplierProducts.forEach(product => {
      productsData.push({
        'Fornitore': supplier.name,
        'Prodotto': product.name,
        'Categoria': product.category || 'N/A',
        'Prezzo (€)': (Number(product.price) || 0).toFixed(2),
        'IVA (%)': product.vatRate || 0,
        'Sconto (%)': product.discountPercent || product.discount || 0,
        'Prezzo Finale (€)': ((Number(product.price) || 0) * (1 - (Number(product.discountPercent || product.discount) || 0) / 100)).toFixed(2)
      });
    });
  });

  if (productsData.length > 0) {
    const wsProducts = XLSX.utils.json_to_sheet(productsData);
    wsProducts['!cols'] = [
      { wch: 30 }, // Fornitore
      { wch: 30 }, // Prodotto
      { wch: 15 }, // Categoria
      { wch: 12 }, // Prezzo
      { wch: 10 }, // IVA
      { wch: 10 }, // Sconto
      { wch: 15 }  // Prezzo Finale
    ];
    wsProducts['!autofilter'] = { ref: `A1:G${productsData.length + 1}` };
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Prodotti per Fornitore');
  }

  // Generate filename with date
  const filename = `fornitori_completo_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
};

export const exportSuppliersToPDF = (
  suppliers: Supplier[],
  products: Product[],
  invoices: Invoice[]
) => {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Elenco Fornitori Completo', 14, 20);

  // Add date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 14, 28);

  let currentY = 40;

  // For each supplier, create a detailed section
  suppliers.forEach((supplier, index) => {
    const supplierProducts = products.filter(
      p => p.supplierId === supplier.id || p.supplier_id === supplier.id
    );
    const supplierInvoices = invoices.filter(
      inv => inv.supplierId === supplier.id || inv.supplier_id === supplier.id
    );
    const totalSpent = supplierInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    // Add new page for each supplier (except first)
    if (index > 0) {
      doc.addPage();
      currentY = 20;
    }

    // Supplier Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(supplier.name, 14, currentY);
    currentY += 8;

    // Supplier Details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (supplier.phone) {
      doc.text(`Tel: ${supplier.phone}`, 14, currentY);
      currentY += 5;
    }
    if (supplier.email) {
      doc.text(`Email: ${supplier.email}`, 14, currentY);
      currentY += 5;
    }
    if (supplier.address) {
      doc.text(`Indirizzo: ${supplier.address}`, 14, currentY);
      currentY += 5;
    }
    currentY += 5;

    // Summary Stats
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Totale Speso: €${(Number(totalSpent) || 0).toFixed(2)} | Fatture: ${supplierInvoices.length} | Prodotti: ${supplierProducts.length}`, 14, currentY);
    currentY += 10;

    // Invoices Table
    if (supplierInvoices.length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Fatture:', 14, currentY);
      currentY += 5;

      const invoiceTableData = supplierInvoices.map(inv => [
        inv.invoiceNumber || inv.invoice_number || 'N/A',
        new Date(inv.date).toLocaleDateString('it-IT'),
        `€${(Number(inv.amount) || 0).toFixed(2)}`,
        Array.isArray(inv.items) ? inv.items.length.toString() : '0'
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['N° Fattura', 'Data', 'Importo', 'Prodotti']],
        body: invoiceTableData,
        theme: 'striped',
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9
        },
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 25, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : currentY + 10;
    }

    // Products Table
    if (supplierProducts.length > 0 && currentY < 250) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Prodotti:', 14, currentY);
      currentY += 5;

      const productTableData = supplierProducts.slice(0, 10).map(prod => [
        prod.name,
        prod.category || 'N/A',
        `€${(Number(prod.price) || 0).toFixed(2)}`,
        `${prod.vatRate || 0}%`
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Prodotto', 'Categoria', 'Prezzo', 'IVA']],
        body: productTableData,
        theme: 'striped',
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9
        },
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 35 },
          2: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 20, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      if (supplierProducts.length > 10) {
        currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 5 : currentY + 5;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(`... e altri ${supplierProducts.length - 10} prodotti`, 14, currentY);
      }
    }
  });

  // Add summary page at the end
  doc.addPage();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Riepilogo Generale', 14, 20);

  const summaryTableData = suppliers.map(supplier => {
    const supplierInvoices = invoices.filter(
      inv => inv.supplierId === supplier.id || inv.supplier_id === supplier.id
    );
    const totalSpent = supplierInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    return [
      supplier.name,
      supplierInvoices.length.toString(),
      `€${(Number(totalSpent) || 0).toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: 30,
    head: [['Fornitore', 'N° Fatture', 'Totale Speso']],
    body: summaryTableData,
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
      0: { cellWidth: 80 },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' }
    }
  });

  // Add totals
  const finalY = doc.lastAutoTable?.finalY || 30;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Totale Fornitori: ${suppliers.length}`, 14, finalY + 10);

  const totalProducts = products.length;
  doc.text(`Totale Prodotti: ${totalProducts}`, 14, finalY + 17);

  const totalSpent = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  doc.text(`Spesa Totale: €${(Number(totalSpent) || 0).toFixed(2)}`, 14, finalY + 24);

  // Add page numbers
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

  // Save PDF
  const filename = `fornitori_completo_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

// ============================================================================
// STATISTICS EXPORT
// ============================================================================

interface StatisticsData {
  totalSpent: number;
  averageMonthlySpent: number;
  totalInvoices: number;
  averageInvoiceAmount: number;
  highestMonth: { month: string; amount: number };
  monthlyData: Array<{ month: string; amount: number; count: number }>;
  supplierBreakdown: Array<{ supplier: string; amount: number; percentage: number }>;
}

export const exportStatisticsToExcel = (
  invoices: Invoice[],
  suppliers: Supplier[],
  stats: StatisticsData
) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary Statistics
  const summaryData = [
    { 'Metrica': 'Spesa Totale', 'Valore': `€${(Number(stats.totalSpent) || 0).toFixed(2)}` },
    { 'Metrica': 'Media Mensile', 'Valore': `€${(Number(stats.averageMonthlySpent) || 0).toFixed(2)}` },
    { 'Metrica': 'Numero Fatture', 'Valore': stats.totalInvoices.toString() },
    { 'Metrica': 'Importo Medio Fattura', 'Valore': `€${(Number(stats.averageInvoiceAmount) || 0).toFixed(2)}` },
    { 'Metrica': 'Mese con Spesa Più Alta', 'Valore': stats.highestMonth.month },
    { 'Metrica': 'Importo Mese Più Alto', 'Valore': `€${(Number(stats.highestMonth.amount) || 0).toFixed(2)}` }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Riepilogo');

  // Sheet 2: Monthly Breakdown
  const monthlyData = stats.monthlyData.map(m => ({
    'Mese': m.month,
    'Numero Fatture': m.count,
    'Importo Totale (€)': (Number(m.amount) || 0).toFixed(2),
    'Importo Medio (€)': ((Number(m.amount) || 0) / (Number(m.count) || 1)).toFixed(2)
  }));

  const wsMonthly = XLSX.utils.json_to_sheet(monthlyData);
  wsMonthly['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'Mensile');

  // Sheet 3: Supplier Breakdown
  const supplierData = stats.supplierBreakdown.map(s => ({
    'Fornitore': s.supplier,
    'Importo (€)': (Number(s.amount) || 0).toFixed(2),
    'Percentuale (%)': (Number(s.percentage) || 0).toFixed(1)
  }));

  const wsSupplier = XLSX.utils.json_to_sheet(supplierData);
  wsSupplier['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSupplier, 'Per Fornitore');

  // Generate filename with date
  const filename = `statistiche_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
};

export const exportStatisticsToPDF = (
  invoices: Invoice[],
  suppliers: Supplier[],
  stats: StatisticsData
) => {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Statistiche Fatture', 14, 20);

  // Add date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 14, 28);

  let currentY = 40;

  // Summary Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Riepilogo Generale', 14, currentY);
  currentY += 10;

  const summaryData = [
    ['Spesa Totale', `€${(Number(stats.totalSpent) || 0).toFixed(2)}`],
    ['Media Mensile', `€${(Number(stats.averageMonthlySpent) || 0).toFixed(2)}`],
    ['Numero Fatture', stats.totalInvoices.toString()],
    ['Importo Medio Fattura', `€${(Number(stats.averageInvoiceAmount) || 0).toFixed(2)}`],
    ['Mese con Spesa Più Alta', `${stats.highestMonth.month} - €${(Number(stats.highestMonth.amount) || 0).toFixed(2)}`]
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Metrica', 'Valore']],
    body: summaryData,
    theme: 'plain',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 10,
      cellPadding: 4
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
      1: { cellWidth: 100, halign: 'right' }
    }
  });

  currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 15 : currentY + 15;

  // Monthly Breakdown Section
  if (currentY > 250) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Andamento Mensile', 14, currentY);
  currentY += 10;

  const monthlyTableData = stats.monthlyData.map(m => [
    m.month,
    m.count.toString(),
    `€${(Number(m.amount) || 0).toFixed(2)}`,
    `€${((Number(m.amount) || 0) / (Number(m.count) || 1)).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Mese', 'N° Fatture', 'Totale', 'Media']],
    body: monthlyTableData,
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
      0: { cellWidth: 50 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 50, halign: 'right' }
    }
  });

  currentY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 15 : currentY + 15;

  // Supplier Breakdown Section
  if (currentY > 250 || stats.supplierBreakdown.length > 10) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Ripartizione per Fornitore', 14, currentY);
  currentY += 10;

  const supplierTableData = stats.supplierBreakdown.map(s => [
    s.supplier,
    `€${(Number(s.amount) || 0).toFixed(2)}`,
    `${(Number(s.percentage) || 0).toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Fornitore', 'Importo', '%']],
    body: supplierTableData,
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
      0: { cellWidth: 100 },
      1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 30, halign: 'center' }
    }
  });

  // Add page numbers
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

  // Save PDF
  const filename = `statistiche_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};