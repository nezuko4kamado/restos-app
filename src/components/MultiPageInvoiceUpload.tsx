import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Upload, Camera, FileText, Check, AlertCircle, Plus, Image } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';

interface UploadedPage {
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface MultiPageInvoiceUploadProps {
  onFilesSelected: (files: File[]) => void;
  onConfirm: () => void;
  isProcessing: boolean;
  disabled?: boolean;
}

export function MultiPageInvoiceUpload({
  onFilesSelected,
  onConfirm,
  isProcessing,
  disabled = false
}: MultiPageInvoiceUploadProps) {
  const [pages, setPages] = useState<UploadedPage[]>([]);
  const { t } = useLanguage();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    await addFiles(files);
    event.target.value = '';
  };

  const addFiles = async (files: File[]) => {
    const newPages: UploadedPage[] = await Promise.all(
      files.map(async (file) => {
        let preview = '';
        if (file.type.startsWith('image/')) {
          preview = await fileToDataURL(file);
        }
        return { file, preview, status: 'pending' as const };
      })
    );

    const updatedPages = [...pages, ...newPages];
    setPages(updatedPages);
    onFilesSelected(updatedPages.map(p => p.file));

    if (newPages.length > 0) {
      toast.success(`${newPages.length} ${t('imagesUploaded') || 'foto aggiunta/e'} — ${t('total') || 'Totale'}: ${updatedPages.length}`);
    }
  };

  const handleRemovePage = (index: number) => {
    const newPages = pages.filter((_, i) => i !== index);
    setPages(newPages);
    onFilesSelected(newPages.map(p => p.file));
  };

  const handleConfirm = () => {
    if (pages.length === 0) {
      toast.error(t('pleaseUploadImage') || 'Carica almeno una pagina della fattura');
      return;
    }
    onConfirm();
  };

  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const isDisabled = disabled || isProcessing;

  const labelBtnClass = (extra = '') =>
    [
      'inline-flex items-center gap-2 px-4 py-2 rounded-md border-2 border-slate-200 bg-white hover:bg-slate-50 font-medium text-sm select-none',
      isDisabled ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer',
      extra,
    ].join(' ');

  return (
    <div className="space-y-4">
      {pages.length === 0 ? (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
          <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            {t('uploadInvoice') || 'Carica Fattura'}
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            {t('uploadInvoicePdfOrImage') || 'Puoi caricare piu pagine.'}
          </p>

          <div className="flex gap-3 justify-center flex-wrap">
            {/* Camera: capture=environment apre la fotocamera posteriore su Android/iOS */}
            <label className={labelBtnClass()}>
              <Camera className="h-4 w-4" />
              {t('takePhoto') || 'Scatta Foto'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                disabled={isDisabled}
                className="hidden"
              />
            </label>

            {/* Galleria: senza capture apre il selettore file */}
            <label className={labelBtnClass()}>
              <Image className="h-4 w-4" />
              {t('selectPhoto') || 'Seleziona Foto'}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                disabled={isDisabled}
                className="hidden"
              />
            </label>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-800">
                {t('uploadInvoice') || 'Pagine'} ({pages.length})
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {pages.map((page, index) => (
                <Card key={index} className="relative group overflow-hidden">
                  <div className="aspect-[3/4] bg-slate-100 relative">
                    {page.preview ? (
                      <img
                        src={page.preview}
                        alt={`${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="h-12 w-12 text-slate-400" />
                      </div>
                    )}

                    <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded">
                      {index + 1}
                    </div>

                    {page.status === 'completed' && (
                      <div className="absolute top-2 right-2 bg-green-600 text-white p-1 rounded-full">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    {page.status === 'error' && (
                      <div className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full">
                        <AlertCircle className="h-3 w-3" />
                      </div>
                    )}

                    {!isProcessing && (
                      <button
                        onClick={() => handleRemovePage(index)}
                        className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}

                    {isProcessing && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="text-white text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                          <p className="text-xs">{t('loading') || '...'}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-2 bg-white">
                    <p className="text-xs text-slate-600 truncate" title={page.file.name}>
                      {page.file.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(page.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </Card>
              ))}

              {!isProcessing && (
                <label className="relative overflow-hidden border-2 border-dashed border-indigo-300 hover:border-indigo-500 transition-colors bg-gradient-to-br from-indigo-50 to-purple-50 cursor-pointer rounded-lg block">
                  <div className="aspect-[3/4] flex flex-col items-center justify-center p-4 text-center">
                    <div className="bg-indigo-600 text-white p-4 rounded-full mb-3">
                      <Plus className="h-8 w-8" />
                    </div>
                    <p className="font-semibold text-indigo-700 text-sm">
                      {t('takePhoto') || 'Aggiungi'}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <label className={labelBtnClass('flex-1 justify-center border-indigo-300 hover:bg-indigo-50 py-3')}>
              <Camera className="h-5 w-5" />
              {t('takePhoto') || 'Scatta Altre Foto'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                disabled={isDisabled}
                className="hidden"
              />
            </label>

            <label className={labelBtnClass('flex-1 justify-center border-indigo-300 hover:bg-indigo-50 py-3')}>
              <Upload className="h-5 w-5" />
              {t('selectPhoto') || 'Aggiungi dalla Galleria'}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                disabled={isDisabled}
                className="hidden"
              />
            </label>
          </div>

          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
            <div className="flex gap-3">
              <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800 mb-1">
                  {t('invoiceUploadWithOCR') || 'Elaborazione multi-pagina'}
                </p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>{t('uploadInvoicePdfOrImage') || 'Tutti i prodotti vengono unificati in una singola fattura'}</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={handleConfirm}
            disabled={isDisabled || pages.length === 0}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            size="lg"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t('loading') || 'Elaborazione...'}
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                {t('invoiceUploadWithOCR') || 'Conferma'} ({pages.length})
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
