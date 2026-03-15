import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, FileText, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { extractDataFromImage } from '@/lib/ocrService';
import { extractDataFromPDF } from '@/lib/pdfService';
import { OCRResult, Product, Supplier, OrderItem } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface OCRUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'products' | 'suppliers' | 'order';
  onDataExtracted: (data: OCRResult) => void;
}

export default function OCRUploadDialog({
  isOpen,
  onClose,
  type,
  onDataExtracted,
}: OCRUploadDialogProps) {
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  const getTitle = () => {
    switch (type) {
      case 'products':
        return t.importFromPhoto;
      case 'suppliers':
        return t.importOrderFromPhotoPdf;
      case 'order':
        return t.importOrderFromPhotoPdf;
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'products':
        return t.uploadOrderDescription;
      case 'suppliers':
        return t.uploadOrderDescription;
      case 'order':
        return t.uploadOrderDescription;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSelectedFiles(files);
    setIsProcessing(true);

    try {
      let allProducts: Product[] = [];
      let allSuppliers: Supplier[] = [];
      let allOrderItems: OrderItem[] = [];
      let supplierInfo: Supplier | undefined = undefined;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileNum = i + 1;
        const totalFiles = files.length;

        setProcessingStatus(`${t.processingInProgress} ${fileNum}/${totalFiles}: ${file.name}`);
        console.log(`📄 Processing file ${fileNum}/${totalFiles}:`, file.name);

        let result: OCRResult;

        // Check file type and process accordingly
        if (file.type === 'application/pdf') {
          console.log('📄 PDF file detected, using extractDataFromPDF');
          result = await extractDataFromPDF(file, type);
        } else if (file.type.startsWith('image/')) {
          console.log('📸 Image file detected, using extractDataFromImage');
          
          // Show preview for first image
          if (i === 0) {
            const reader = new FileReader();
            reader.onload = (e) => setPreviewImage(e.target?.result as string);
            reader.readAsDataURL(file);
          }
          
          result = await extractDataFromImage(file, type);
        } else {
          console.warn('⚠️ Unsupported file type:', file.type);
          toast.error(`${file.name} - ${t.error}`);
          continue;
        }

        // Aggregate results
        if (type === 'products' && result.products) {
          allProducts = [...allProducts, ...result.products];
          if (result.supplier && !supplierInfo) {
            supplierInfo = result.supplier;
          }
        } else if (type === 'suppliers' && result.suppliers) {
          allSuppliers = [...allSuppliers, ...result.suppliers];
        } else if (type === 'order' && result.orderItems) {
          allOrderItems = [...allOrderItems, ...result.orderItems];
          if (result.supplier && !supplierInfo) {
            supplierInfo = result.supplier;
          }
        }
      }

      // Create final result
      const finalResult: OCRResult = {};
      
      if (type === 'products' && allProducts.length > 0) {
        finalResult.products = allProducts;
        finalResult.supplier = supplierInfo;
        toast.success(`✅ ${allProducts.length} ${t.products?.toLowerCase()} - ${files.length} ${t.invoices?.toLowerCase()}!`);
        onDataExtracted(finalResult);
        onClose();
      } else if (type === 'suppliers' && allSuppliers.length > 0) {
        finalResult.suppliers = allSuppliers;
        toast.success(`✅ ${allSuppliers.length} ${t.suppliers?.toLowerCase()} - ${files.length} ${t.invoices?.toLowerCase()}!`);
        onDataExtracted(finalResult);
        onClose();
      } else if (type === 'order' && allOrderItems.length > 0) {
        finalResult.orderItems = allOrderItems;
        finalResult.supplier = supplierInfo;
        toast.success(`✅ ${allOrderItems.length} ${t.products?.toLowerCase()} - ${files.length} ${t.invoices?.toLowerCase()}!`);
        onDataExtracted(finalResult);
        onClose();
      } else {
        toast.error(t.error);
      }
    } catch (error) {
      console.error('❌ Error during processing:', error);
      toast.error(error instanceof Error ? error.message : t.error);
    } finally {
      setIsProcessing(false);
      setPreviewImage(null);
      setSelectedFiles([]);
      setProcessingStatus('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {getDescription()}
          </div>

          {previewImage && (
            <div className="relative">
              <img
                src={previewImage}
                alt="Preview"
                className="w-full h-48 object-contain rounded-lg border"
              />
              {isProcessing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                  <div className="text-white text-center px-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="font-medium">{t.processingInProgress}</p>
                    {processingStatus && (
                      <p className="text-xs mt-2">{processingStatus}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {isProcessing && !previewImage && (
            <div className="border rounded-lg p-6 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="font-medium mb-2">{t.processingInProgress}</p>
              {processingStatus && (
                <p className="text-sm text-muted-foreground">{processingStatus}</p>
              )}
            </div>
          )}

          {!isProcessing && (
            <div>
              <Label htmlFor="ocr-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <div className="flex justify-center gap-4 mb-4">
                    <Camera className="h-10 w-10 text-muted-foreground" />
                    <FileText className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium mb-1">
                    {t.uploadInvoice}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t.uploadInvoicePdfOrImage}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-primary">
                    <Upload className="h-4 w-4" />
                    <span>{t.import}</span>
                  </div>
                </div>
              </Label>
              <Input
                id="ocr-upload"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                disabled={isProcessing}
                multiple
                className="hidden"
              />
            </div>
          )}

          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full"
          >
            {t.cancel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}