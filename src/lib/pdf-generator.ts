import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Product, Supplier } from './types';

interface OrderItem {
  product_id: string;
  quantity: number;
}

interface OrderData {
  orderItems: OrderItem[];
  products: Product[];
  suppliers: Supplier[];
}

interface PDFTranslations {
  title: string;
  date: string;
  supplier: string;
  contact: string;
  products: string;
  quantity: string;
  unit: string;
  total: string;
}

export async function generateOrderPDF(orderData: OrderData, language: string = 'it'): Promise<void> {
  const { orderItems, products, suppliers } = orderData;

  // Group items by supplier
  const itemsBySupplier = orderItems.reduce((acc, item) => {
    const product = products.find(p => p.id === item.product_id);
    if (!product) return acc;
    
    const supplierId = product.supplier_id;
    if (!acc[supplierId]) {
      acc[supplierId] = [];
    }
    acc[supplierId].push(item);
    return acc;
  }, {} as Record<string, OrderItem[]>);

  // Create PDF with Unicode support
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  // Translations
  const translations: Record<string, PDFTranslations> = {
    it: {
      title: 'Ordine',
      date: 'Data',
      supplier: 'Fornitore',
      contact: 'Contatto',
      products: 'Prodotti',
      quantity: 'Quantita',
      unit: 'Unita',
      total: 'Totale Prodotti'
    },
    en: {
      title: 'Order',
      date: 'Date',
      supplier: 'Supplier',
      contact: 'Contact',
      products: 'Products',
      quantity: 'Quantity',
      unit: 'Unit',
      total: 'Total Products'
    },
    es: {
      title: 'Pedido',
      date: 'Fecha',
      supplier: 'Proveedor',
      contact: 'Contacto',
      products: 'Productos',
      quantity: 'Cantidad',
      unit: 'Unidad',
      total: 'Total Productos'
    },
    fr: {
      title: 'Commande',
      date: 'Date',
      supplier: 'Fournisseur',
      contact: 'Contact',
      products: 'Produits',
      quantity: 'Quantite',
      unit: 'Unite',
      total: 'Total Produits'
    },
    de: {
      title: 'Bestellung',
      date: 'Datum',
      supplier: 'Lieferant',
      contact: 'Kontakt',
      products: 'Produkte',
      quantity: 'Menge',
      unit: 'Einheit',
      total: 'Gesamt Produkte'
    },
    lt: {
      title: 'Uzsakymas',
      date: 'Data',
      supplier: 'Tiekejas',
      contact: 'Kontaktas',
      products: 'Produktai',
      quantity: 'Kiekis',
      unit: 'Vienetas',
      total: 'Viso Produktu'
    }
  };

  const t = translations[language] || translations.it;

  // Helper function to sanitize text for PDF (remove special characters that cause issues)
  const sanitizeText = (text: string): string => {
    if (!text) return '';
    // Replace problematic characters but keep basic Latin characters
    return text
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/[ÀÁÂÃÄÅ]/g, 'A')
      .replace(/[ÈÉÊË]/g, 'E')
      .replace(/[ÌÍÎÏ]/g, 'I')
      .replace(/[ÒÓÔÕÖ]/g, 'O')
      .replace(/[ÙÚÛÜ]/g, 'U')
      .replace(/[Ñ]/g, 'N')
      .replace(/[Ç]/g, 'C')
      .replace(/[ž]/g, 'z')
      .replace(/[š]/g, 's')
      .replace(/[ą]/g, 'a')
      .replace(/[ę]/g, 'e')
      .replace(/[ė]/g, 'e')
      .replace(/[į]/g, 'i')
      .replace(/[ų]/g, 'u')
      .replace(/[ū]/g, 'u')
      .replace(/[č]/g, 'c');
  };

  // Title
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(sanitizeText(t.title), margin, yPosition);
  yPosition += 10;

  // Date
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const currentDate = new Date().toLocaleDateString(language === 'en' ? 'en-US' : language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : language === 'lt' ? 'lt-LT' : 'it-IT');
  pdf.text(`${sanitizeText(t.date)}: ${currentDate}`, margin, yPosition);
  yPosition += 15;

  // Loop through suppliers
  Object.entries(itemsBySupplier).forEach(([supplierId, items], index) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    
    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = margin;
    }

    // Supplier header
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(147, 51, 234); // Purple
    pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 10, 'F');
    pdf.setTextColor(255, 255, 255);
    const supplierName = sanitizeText(supplier?.name || t.supplier);
    pdf.text(`${sanitizeText(t.supplier)}: ${supplierName}`, margin + 2, yPosition + 2);
    pdf.setTextColor(0, 0, 0);
    yPosition += 12;

    // Supplier contact info
    if (supplier) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      if (supplier.phone) {
        pdf.text(`${sanitizeText(t.contact)}: ${supplier.phone}`, margin, yPosition);
        yPosition += 5;
      }
      if (supplier.email) {
        pdf.text(`Email: ${supplier.email}`, margin, yPosition);
        yPosition += 5;
      }
      yPosition += 3;
    }

    // Products table header
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
    pdf.text(sanitizeText(t.products), margin + 2, yPosition + 5);
    pdf.text(sanitizeText(t.quantity), pageWidth - margin - 40, yPosition + 5);
    pdf.text(sanitizeText(t.unit), pageWidth - margin - 20, yPosition + 5);
    yPosition += 10;

    // Products
    pdf.setFont('helvetica', 'normal');
    items.forEach((item) => {
      const product = products.find(p => p.id === item.product_id);
      if (!product) return;

      // Check if we need a new page
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = margin;
      }

      const unitDisplay = product.unit && product.unit.toLowerCase() !== 'pz' ? sanitizeText(product.unit) : '';
      
      // Product name (truncate if too long)
      const maxWidth = pageWidth - 2 * margin - 50;
      let productName = sanitizeText(product.name);
      if (pdf.getTextWidth(productName) > maxWidth) {
        while (pdf.getTextWidth(productName + '...') > maxWidth && productName.length > 0) {
          productName = productName.slice(0, -1);
        }
        productName += '...';
      }

      pdf.text(productName, margin + 2, yPosition);
      pdf.text(item.quantity.toString(), pageWidth - margin - 40, yPosition);
      pdf.text(unitDisplay, pageWidth - margin - 20, yPosition);
      yPosition += 6;
    });

    yPosition += 5;

    // Total products for this supplier
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${sanitizeText(t.total)}: ${items.length}`, margin, yPosition);
    yPosition += 15;
  });

  // Save PDF
  const fileName = `ordine_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
}