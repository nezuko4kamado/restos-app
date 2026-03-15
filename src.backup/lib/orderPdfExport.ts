import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order, Product, Supplier } from '@/types';

interface OrderPDFOptions {
  order: Order;
  products: Product[];
  suppliers: Supplier[];
  orderNumber: string;
  orderDate: string;
}

/**
 * Export order to PDF with all details grouped by supplier
 */
export function exportOrderToPDF(options: OrderPDFOptions): void {
  const { order, products, suppliers, orderNumber, orderDate } = options;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PEDIDO / ORDER', pageWidth / 2, 20, { align: 'center' });
  
  // Order details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Número de Pedido / Order Number: ${orderNumber}`, 14, 35);
  doc.text(`Fecha / Date: ${orderDate}`, 14, 42);
  
  // Add line separator
  doc.setLineWidth(0.5);
  doc.line(14, 48, pageWidth - 14, 48);
  
  let yPosition = 58;
  
  // Group items by supplier
  const itemsBySupplier: Record<string, typeof order.items> = {};
  
  order.items.forEach(item => {
    const product = products.find(p => p.id === item.productId);
    const supplierId = product?.supplier_id || product?.supplierId || 'unknown';
    
    if (!itemsBySupplier[supplierId]) {
      itemsBySupplier[supplierId] = [];
    }
    itemsBySupplier[supplierId].push(item);
  });
  
  // Render each supplier section
  Object.entries(itemsBySupplier).forEach(([supplierId, items], index) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    // Supplier header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Proveedor / Supplier: ${supplier?.name || 'Unknown'}`, 14, yPosition);
    yPosition += 7;
    
    // Supplier contact info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (supplier?.phone) {
      doc.text(`Tel: ${supplier.phone}`, 14, yPosition);
      yPosition += 5;
    }
    if (supplier?.mobile) {
      doc.text(`Móvil / Mobile: ${supplier.mobile}`, 14, yPosition);
      yPosition += 5;
    }
    if (supplier?.email) {
      doc.text(`Email: ${supplier.email}`, 14, yPosition);
      yPosition += 5;
    }
    
    yPosition += 3;
    
    // Products table
    const tableData = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      const unit = product?.unit && product.unit.toLowerCase() !== 'pz' ? ` ${product.unit}` : '';
      
      return [
        `${item.quantity}${unit}`,
        product?.name || item.productName || 'Unknown Product',
        product?.code || '-'
      ];
    });
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Cantidad / Qty', 'Producto / Product', 'Código / Code']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        yPosition = data.cursor?.y || yPosition;
      }
    });
    
    yPosition += 10;
    
    // Add separator between suppliers
    if (index < Object.keys(itemsBySupplier).length - 1) {
      doc.setLineWidth(0.3);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, yPosition, pageWidth - 14, yPosition);
      yPosition += 10;
    }
  });
  
  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // Save PDF
  const fileName = `Pedido_${orderNumber}_${orderDate.replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
}

/**
 * Generate order number based on date
 */
export function generateOrderNumber(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-4);
  
  return `ORD-${year}${month}${day}-${timestamp}`;
}