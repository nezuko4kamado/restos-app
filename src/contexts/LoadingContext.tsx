import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LoadingState {
  isOCRProcessing: boolean;
  ocrProgress: string;
  currentPage: number;
  totalPages: number;
  productsFound: number;
  currentState: 'extracting' | 'analyzing' | 'saving' | 'completed';
  supplierName: string;
}

interface LoadingContextType {
  loadingState: LoadingState;
  setOCRProcessing: (processing: boolean) => void;
  updateOCRProgress: (progress: Partial<LoadingState>) => void;
  resetOCRState: () => void;
}

const defaultLoadingState: LoadingState = {
  isOCRProcessing: false,
  ocrProgress: '',
  currentPage: 0,
  totalPages: 1,
  productsFound: 0,
  currentState: 'extracting',
  supplierName: ''
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loadingState, setLoadingState] = useState<LoadingState>(defaultLoadingState);

  const setOCRProcessing = (processing: boolean) => {
    setLoadingState(prev => ({
      ...prev,
      isOCRProcessing: processing
    }));
  };

  const updateOCRProgress = (progress: Partial<LoadingState>) => {
    setLoadingState(prev => ({
      ...prev,
      ...progress
    }));
  };

  const resetOCRState = () => {
    setLoadingState(defaultLoadingState);
  };

  return (
    <LoadingContext.Provider value={{
      loadingState,
      setOCRProcessing,
      updateOCRProgress,
      resetOCRState
    }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}