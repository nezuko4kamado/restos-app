import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Upload, Camera, FileText, Check, AlertCircle, Plus, Image } from 'lucide-react';
import { toast } from 'sonner';

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    await addFiles(files);
    // Reset input so the same file can be re-selected
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
      toast.success(`✅ ${newPages.length} foto aggiunta/e! Totale: ${updatedPages.length} pagine`);
    }
  };

  const handleRemovePage = (index: number) => {
    const newPages = pages.filter((_, i) => i !== index);
    setPages(newPages);
    onFilesSelected(newPages.map(p => p.file));
  };

  const handleConfirm = () => {
    if (pages.length === 0) {
      toast.error('Carica almeno una pagina della fattura');
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

  // Stile comune per i label-bottone
  const labelBtnClass = (extra = '') =>
    `inline-flex items-center gap-2 px-4 py-2 rounded-md border-2 border-slate-200 bg-white hover:bg-slate-50 cursor-pointer font-medium text-sm select-none ${isDisabled ? 'opacity-50 pointer-events-none' : ''} ${extra}`;

  return (
    <div className="space-y-4">
      {pages.length === 0 ? (
        /* ── Stato vuoto: nessuna foto ancora caricata ── */
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
          <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            Carica Fattura
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            Puoi caricare più pagine. Il sistema estrarrà tutti i prodotti automaticamente.
          </p>

          <div className="flex gap-3 justify-center flex-wrap">
            {/*
              📷 SCATTA FOTO
              capture="environment" → apre direttamente la fotocamera posteriore
              su Android WebView/TWA e iOS Safari.
              NON usare .click() via ref: su molte WebView viene bloccato.
              Il <label> che wrappa l'<input> è il metodo nativo garantito.
            */}
            <label className={labelBtnClass()}>
              <Camera className="h-4 w-4" />
              📷 Scatta Foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                disabled={isDisabled}
                className="hidden"
              />
            </label>

            {/*
              🖼️ SELEZIONA FOTO
              Senza capture → apre il selettore file / galleria foto.
              multiple → permette di selezionare più foto in una volta.
            */}
            <label className={labelBtnClass()}>
              <Image className="h-4 w-4" />
              🖼️ Seleziona Foto
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
        /* ── Stato con foto: mostra anteprima + azioni ── */
        <>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-800">
                Pagine Caricate ({pages.length})
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {pages.map((page, index) => (
                <Card key={index} className="relative group overflow-hidden">
                  <div className="aspect-[3/4] bg-slate-100 relative">
                    {page.preview ? (
                      <img
                        src={page.preview}
                        alt={`Pagina ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="h-12 w-12 text-slate-400" />
                      </div>
                    )}

                    {/* Badge numero pagina */}
                    <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded">
                      Pagina {index + 1}
                    </div>

                    {/* Badge stato */}
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

                    {/* Pulsante rimuovi */}
                    {!isProcessing && (
                      <button
                        onClick={() => handleRemovePage(index)}
                        className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                        title="Rimuovi pagina"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}

                    {/* Overlay elaborazione */}
                    {isProcessing && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="text-white text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                          <p className="text-xs">Elaborazione...</p>
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

              {/* Card "Aggiungi altra pagina" — usa label+input nativo */}
              {!isProcessing && (
                <label className="relative overflow-hidden border-2 border-dashed border-indigo-300 hover:border-indigo-500 transition-colors bg-gradient-to-br from-indigo-50 to-purple-50 cursor-pointer rounded-lg block">
                  <div className="aspect-[3/4] flex flex-col items-center justify-center p-4 text-center">
                    <div className="bg-indigo-600 text-white p-4 rounded-full mb-3">
                      <Plus className="h-8 w-8" />
                    </div>
                    <p className="font-semibold text-indigo-700 mb-1">
                      Aggiungi Pagina
                    </p>
                    <p className="text-xs text-indigo-600">
                      📷 Scatta foto
                    </p>
                  </div>
                  {/* capture="environment" → apre camera direttamente */}
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

          {/* Pulsanti azione: Scatta Altre Foto + Seleziona dalla Galleria */}
          <div className="flex gap-3 flex-wrap">
            <label className={labelBtnClass('flex-1 justify-center border-indigo-300 hover:bg-indigo-50 py-3')}>
              <Camera className="h-5 w-5" />
              📷 Scatta Altre Foto
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
              🖼️ Aggiungi dalla Galleria
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

          {/* Info elaborazione multi-pagina */}
          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
            <div className="flex gap-3">
              <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800 mb-1">
                  Come funziona l'elaborazione multi-pagina:
                </p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• <strong>Pagine intermedie:</strong> Vengono estratti solo i prodotti</li>
                  <li>• <strong>Ultima pagina:</strong> Vengono estratti prodotti + numero fattura + totale</li>
                  <li>• Tutti i prodotti vengono unificati in una singola fattura</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Pulsante conferma */}
          <Button
            onClick={handleConfirm}
            disabled={isDisabled || pages.length === 0}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            size="lg"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Elaborazione in corso...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Conferma e Processa ({pages.length} {pages.length === 1 ? 'pagina' : 'pagine'})
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}