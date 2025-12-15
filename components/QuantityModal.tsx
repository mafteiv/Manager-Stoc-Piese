import React, { useEffect, useRef, useState } from 'react';
import { ProductItem } from '../types';

interface QuantityModalProps {
  product: ProductItem;
  isOpen: boolean;
  onConfirm: (qty: number, description?: string) => void;
  onCancel: () => void;
}

export const QuantityModal: React.FC<QuantityModalProps> = ({ product, isOpen, onConfirm, onCancel }) => {
  // Pornim implicit cu "1" pentru viteză
  const [qty, setQty] = useState<string>("1");
  const [description, setDescription] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQty("1"); // Resetăm mereu la 1 când se deschide
      setDescription(product.description || "");
      
      // Focus logic
      setTimeout(() => {
        if (product.isNew) {
            // La produs nou, focus pe descriere
            descRef.current?.focus();
            descRef.current?.select();
        } else {
            // La produs existent, focus pe cantitate și SELECTĂM textul
            // Astfel userul poate da Enter direct (pt 1) sau scrie alt număr (înlocuind 1)
            inputRef.current?.focus();
            inputRef.current?.select();
        }
      }, 50);
    }
  }, [isOpen, product]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleSubmit = () => {
    const val = parseInt(qty, 10);
    // Dacă câmpul e gol sau invalid, presupunem 1
    const finalQty = isNaN(val) ? 1 : val;
    onConfirm(finalQty, description);
  };

  // Calculăm anticipat noul stoc pentru afișare vizuală
  const parsedQty = parseInt(qty, 10);
  const displayQty = isNaN(parsedQty) ? 0 : parsedQty;
  const newTotal = product.actualStock + displayQty;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div className={`bg-white rounded-lg sm:rounded-xl shadow-2xl w-full max-w-md p-3 sm:p-6 transform transition-all scale-100 border-t-4 sm:border-t-8 ${product.isNew ? 'border-purple-500' : 'border-blue-500'}`}>
        
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">
            {product.isNew ? 'Adăugare Produs Nou' : 'Confirmare Intrare'}
        </h2>
        
        <div className={`p-2 sm:p-3 rounded-lg border mb-3 sm:mb-4 ${product.isNew ? 'bg-purple-50 border-purple-100' : 'bg-blue-50 border-blue-100'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${product.isNew ? 'text-purple-600' : 'text-blue-600'}`}>
              {product.isNew ? 'Cod Scanat (Inexistent)' : 'Produs Găsit'}
          </p>
          <p className="font-mono text-base sm:text-lg font-bold text-gray-900 break-words">{product.code}</p>
          
          {!product.isNew && (
             <p className="text-sm text-gray-700 mt-1 leading-snug">{product.description}</p>
          )}
        </div>

        {/* Câmp descriere doar pentru produse noi */}
        {product.isNew && (
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Denumire Produs</label>
                <input 
                    ref={descRef}
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.focus()} 
                    placeholder="Ex: Toner HP 85A..."
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
                />
            </div>
        )}

        <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-3 sm:mb-4 bg-gray-50 p-2 rounded-lg">
            <div className="text-center">
                <span className="block text-[9px] sm:text-[10px] text-gray-500 uppercase">Scriptic</span>
                <span className="block text-lg font-bold text-gray-400">{product.scripticStock}</span>
            </div>
            <div className="text-center border-l border-r border-gray-200">
                <span className="block text-[9px] sm:text-[10px] text-gray-500 uppercase">Faptic Vechi</span>
                <span className="block text-lg font-bold text-blue-600">{product.actualStock}</span>
            </div>
             <div className="text-center bg-green-50 rounded">
                <span className="block text-[9px] sm:text-[10px] text-green-700 uppercase font-bold">Total Nou</span>
                <span className="block text-lg font-bold text-green-700">{newTotal}</span>
            </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Cantitate de adăugat</label>
          <div className="flex gap-2">
             <input
                ref={inputRef}
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="1"
                autoFocus={!product.isNew}
                className={`flex-1 border-2 rounded-lg p-2 sm:p-3 text-xl sm:text-2xl font-bold text-center focus:outline-none focus:ring-4 ${product.isNew ? 'border-purple-500 focus:ring-purple-500/20' : 'border-blue-500 focus:ring-blue-500/20'}`}
             />
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
             Apasă <kbd className="bg-gray-200 px-1 rounded border border-gray-300 font-bold">Enter</kbd> pentru a confirma 
             <span className="font-bold text-gray-900"> {displayQty} </span> buc.
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button 
            onClick={onCancel}
            tabIndex={-1} // Scoatem butonul de cancel din fluxul normal de Tab pentru viteză
            className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-sm sm:text-base text-gray-600 font-medium hover:bg-gray-100 transition"
          >
            Anulează
          </button>
          <button 
            onClick={handleSubmit}
            className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-sm sm:text-base text-white font-bold shadow-lg hover:shadow-xl transition transform active:scale-95 ${product.isNew ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Confirmă (Enter)
          </button>
        </div>
      </div>
    </div>
  );
};

