import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { readExcelRaw, mapDataToProducts, exportToExcel } from './services/xlsxService';
import { ProductItem } from './types';
import { ScannerListener } from './components/ScannerListener';
import { QuantityModal } from './components/QuantityModal';

export default function App() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Import State
  const [rawExcelData, setRawExcelData] = useState<any[][] | null>(null);
  const [originalHeaders, setOriginalHeaders] = useState<any[]>([]); // New: Store headers
  const [columnMapping, setColumnMapping] = useState({ codeIndex: 0, descIndex: 1, stockIndex: 2 });

  // Modal & Selection State
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Stats calculation
  const stats = useMemo(() => {
    return {
      total: products.length,
      scanned: products.filter(p => p.actualStock > 0).length,
      count: products.reduce((acc, curr) => acc + curr.actualStock, 0),
      newItems: products.filter(p => p.isNew).length
    };
  }, [products]);

  // Scroll to highlighted product when it changes
  useEffect(() => {
    if (highlightedId) {
        setTimeout(() => {
            const row = document.getElementById(`row-${highlightedId}`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }
  }, [highlightedId]);

  // Helper to refocus scanner input
  const refocusScanner = () => {
    setSearchTerm("");
    setTimeout(() => {
        searchInputRef.current?.focus();
    }, 100);
  };

  // Step 1: Read File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setFileName(file.name);
      const rawData = await readExcelRaw(file);
      
      if (rawData.length === 0) {
        setErrorMsg("Fișierul este gol.");
        return;
      }
      
      setRawExcelData(rawData);
      setProducts([]); 
      setErrorMsg(null);
      
      // Default guess for columns
      setColumnMapping({
        codeIndex: 0,
        descIndex: 1,
        stockIndex: rawData[0].length > 2 ? 2 : -1
      });

    } catch (err) {
      console.error(err);
      setErrorMsg("Eroare la citirea fișierului. Asigură-te că este un fișier Excel valid.");
    }
  };

  // Step 2: Confirm Mapping
  const handleConfirmMapping = () => {
    if (!rawExcelData) return;
    
    const items = mapDataToProducts(rawExcelData, columnMapping);
    if (items.length === 0) {
      setErrorMsg("Nu s-au putut extrage produse cu coloanele selectate. Verifică selecția.");
      return;
    }
    
    // Save the headers (row 0) to use later for export
    setOriginalHeaders(rawExcelData[0] || []);

    setProducts(items);
    setRawExcelData(null); 
    
    setTimeout(() => searchInputRef.current?.focus(), 500);
  };

  // Handle Export
  const handleExport = () => {
      exportToExcel(products, fileName, originalHeaders, columnMapping);
  };

  // Handle Scan Logic
  const handleScan = useCallback((barcode: string) => {
    const codeRaw = barcode.trim();
    if (!codeRaw) return;

    const scannedCodeLower = codeRaw.toLowerCase();

    // 1. Căutare EXACTĂ
    let found = products.find(p => p.code.toLowerCase() === scannedCodeLower);

    // 2. EXCEPȚIE PREFIX (Ex: 'P' de la Part Number)
    // Dacă nu am găsit exact, și codul scanat are cel puțin 2 caractere,
    // încercăm să eliminăm prima literă și să căutăm restul.
    if (!found && scannedCodeLower.length > 2) {
        const codeWithoutPrefix = scannedCodeLower.substring(1);
        // Căutăm produsul care are EXACT codul rămas (fără prefix)
        // Astfel, dacă scanezi "PCF280A" și în tabel ai "CF280A", îl va găsi.
        found = products.find(p => p.code.toLowerCase() === codeWithoutPrefix);
    }

    // 3. Căutare PARȚIALĂ (Fallback vechi)
    // Dacă tot nu am găsit, verificăm dacă vreun cod din tabel CONȚINE ce am scanat noi
    if (!found) {
        found = products.find(p => p.code.toLowerCase().includes(scannedCodeLower));
    }

    if (found) {
        setSelectedProduct(found);
        setHighlightedId(found.id);
        setIsModalOpen(true);
        setErrorMsg(null);
    } else {
        // Dacă ajungem aici, e un produs complet nou
        const newProduct: ProductItem = {
            id: `NEW_${Date.now()}_${codeRaw}`,
            code: codeRaw,
            description: "", 
            scripticStock: 0,
            actualStock: 0,
            rowOriginalIndex: 999999,
            originalData: [],
            isNew: true
        };
        setSelectedProduct(newProduct);
        setIsModalOpen(true);
        setErrorMsg(null);
    }
  }, [products]);

  // Handle Modal Confirmation
  const handleQuantityConfirm = (qtyToAdd: number, description?: string) => {
    if (selectedProduct) {
        setProducts(prev => {
            const index = prev.findIndex(p => p.id === selectedProduct.id);
            
            if (index !== -1) {
                // UPDATE EXISTING
                const newProducts = [...prev];
                newProducts[index] = {
                    ...newProducts[index],
                    actualStock: newProducts[index].actualStock + qtyToAdd
                };
                return newProducts;
            } else {
                // ADD NEW
                // Format Description: "Code - UserDescription"
                let finalDesc = "";
                const cleanCode = selectedProduct.code.trim();

                if (description && description.trim().length > 0) {
                    // Avoid double prefix if user typed it manually
                    if (description.startsWith(cleanCode)) {
                        finalDesc = description;
                    } else {
                        finalDesc = `${cleanCode} - ${description}`;
                    }
                } else {
                    finalDesc = `${cleanCode} - Produs Nou`;
                }
                
                const newProductEntry = {
                    ...selectedProduct,
                    description: finalDesc,
                    actualStock: qtyToAdd
                };
                
                setHighlightedId(newProductEntry.id);
                return [...prev, newProductEntry];
            }
        });
    }
    setIsModalOpen(false);
    setSelectedProduct(null);
    refocusScanner();
  };

  const handleModalCancel = () => {
      setIsModalOpen(false);
      setSelectedProduct(null);
      refocusScanner();
  };

  const updateStockManual = (id: string, delta: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, actualStock: Math.max(0, p.actualStock + delta) };
      }
      return p;
    }));
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const lower = searchTerm.toLowerCase();
    return products.filter(p => 
      p.code.toLowerCase().includes(lower) || 
      p.description.toLowerCase().includes(lower)
    );
  }, [products, searchTerm]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim().length > 0) {
      handleScan(searchTerm);
      setSearchTerm("");
    }
  };

  const getColLetter = (n: number) => String.fromCharCode(65 + n);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <ScannerListener onScan={handleScan} />

      {/* MODAL */}
      {selectedProduct && (
        <QuantityModal 
            product={selectedProduct}
            isOpen={isModalOpen}
            onConfirm={handleQuantityConfirm}
            onCancel={handleModalCancel}
        />
      )}

      {/* Header */}
      <header className="bg-blue-600 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">BookWay Inventory</h1>
            <p className="text-blue-100 text-sm">Gestionare Piese de Schimb</p>
          </div>
          
          {products.length > 0 && (
             <button 
             onClick={handleExport}
             className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition shadow-sm flex items-center gap-2"
           >
             Export Excel
           </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* VIEW 1: Initial Upload */}
        {!rawExcelData && products.length === 0 && (
          <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-xl bg-white p-10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Încarcă Fișierul de Stoc</h2>
            <p className="text-gray-500 mb-6 text-center max-w-md">Fișierul trebuie să fie format .xlsx.</p>
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition shadow-lg">
              Alege fișier Excel
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
            </label>
            {errorMsg && <p className="mt-4 text-red-500 font-medium">{errorMsg}</p>}
          </div>
        )}

        {/* VIEW 2: Column Selection Wizard */}
        {rawExcelData && products.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Configurare Import</h2>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <p className="text-sm text-yellow-800">
                    <strong>Important:</strong> Selectează coloana care conține codul produsului. Aplicația va încerca să extragă primul cod alfanumeric (cifre și litere) găsit în celulă.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Code Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Coloana cu COD</label>
                <select 
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={columnMapping.codeIndex}
                  onChange={(e) => setColumnMapping(prev => ({ ...prev, codeIndex: parseInt(e.target.value) }))}
                >
                  {rawExcelData[0].map((header: any, idx: number) => (
                    <option key={idx} value={idx}>
                       Coloana {getColLetter(idx)}: {String(header).substring(0, 30)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Coloana DESCRIERE</label>
                <select 
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={columnMapping.descIndex}
                  onChange={(e) => setColumnMapping(prev => ({ ...prev, descIndex: parseInt(e.target.value) }))}
                >
                  {rawExcelData[0].map((header: any, idx: number) => (
                    <option key={idx} value={idx}>
                       Coloana {getColLetter(idx)}: {String(header).substring(0, 30)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Coloana STOC (Opțional)</label>
                <select 
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={columnMapping.stockIndex}
                  onChange={(e) => setColumnMapping(prev => ({ ...prev, stockIndex: parseInt(e.target.value) }))}
                >
                  <option value={-1}>-- Fără stoc inițial (0) --</option>
                  {rawExcelData[0].map((header: any, idx: number) => (
                    <option key={idx} value={idx}>
                       Coloana {getColLetter(idx)}: {String(header).substring(0, 30)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview Table */}
            <div className="mb-6 overflow-x-auto border rounded-lg">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    {rawExcelData[0].map((header: any, idx: number) => (
                       <th key={idx} className={`px-4 py-2 border-b whitespace-nowrap ${
                         idx === columnMapping.codeIndex ? 'bg-blue-100 text-blue-800' : 
                         idx === columnMapping.descIndex ? 'bg-green-100 text-green-800' : 
                         idx === columnMapping.stockIndex ? 'bg-yellow-100 text-yellow-800' : ''
                       }`}>
                         {getColLetter(idx)}
                       </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawExcelData.slice(0, 5).map((row, rIdx) => (
                    <tr key={rIdx} className="bg-white border-b hover:bg-gray-50">
                       {row.map((cell: any, cIdx: number) => (
                         <td key={cIdx} className={`px-4 py-2 border-r max-w-xs truncate ${rIdx === 0 ? 'font-bold text-gray-900' : ''}`}>
                           {cell !== undefined && cell !== null ? String(cell) : ''}
                         </td>
                       ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-4">
              <button 
                onClick={() => { setRawExcelData(null); setFileName(""); }}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Anulează
              </button>
              <button 
                onClick={handleConfirmMapping}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md"
              >
                Confirmă Importul
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: Main App (Inventory) */}
        {products.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Sidebar Stats & Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Stats Card */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Statistici</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Total Produse</span>
                    <span className="font-mono font-bold text-lg">{stats.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Scanate (Linii)</span>
                    <span className="font-mono font-bold text-lg text-blue-600">{stats.scanned}</span>
                  </div>
                  {stats.newItems > 0 && (
                    <div className="flex justify-between items-center bg-purple-50 p-2 rounded -mx-2">
                        <span className="text-purple-700 font-medium">Produse Noi</span>
                        <span className="font-mono font-bold text-lg text-purple-600">{stats.newItems}</span>
                    </div>
                  )}
                   <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-gray-500">Total Bucăți</span>
                    <span className="font-mono font-bold text-lg text-green-600">{stats.count}</span>
                  </div>
                </div>
              </div>
              
               {errorMsg && (
                 <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm">
                    <p className="text-red-700 font-medium text-sm">{errorMsg}</p>
                 </div>
               )}

              <button 
                onClick={() => {
                  if(confirm("Ești sigur că vrei să începi un import nou? Datele curente se vor pierde.")) {
                    setProducts([]);
                    setRawExcelData(null);
                    setOriginalHeaders([]);
                  }
                }}
                className="w-full py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 text-sm"
              >
                Resetare / Import Nou
              </button>
            </div>

            {/* Main Table Area */}
            <div className="lg:col-span-3 space-y-4">
              
              {/* Search Bar */}
              <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200 flex gap-2">
                <div className="relative flex-grow">
                  <span className="absolute left-3 top-2.5 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    placeholder="Scanează sau caută codul..."
                    className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    autoFocus
                  />
                </div>
                <button 
                  onClick={() => setIsManualMode(!isManualMode)}
                  className={`px-4 py-2 rounded-md font-medium text-sm transition hidden md:block ${isManualMode ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {isManualMode ? 'Mod Manual' : 'Caută'}
                </button>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[70vh]">
                  <table className="w-full text-left border-collapse relative">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-4 border-b">Cod (Extras)</th>
                        <th className="px-6 py-4 border-b w-1/2">Descriere</th>
                        <th className="px-6 py-4 border-b text-center">Scriptic</th>
                        <th className="px-6 py-4 border-b text-center">Faptic</th>
                        <th className="px-6 py-4 border-b text-right">Acțiuni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((p) => {
                           const isDiscrepancy = p.actualStock !== p.scripticStock && !p.isNew;
                           const isHighlighted = p.id === highlightedId;
                           
                           let rowBg = '';
                           if (isHighlighted) {
                               rowBg = p.isNew ? 'bg-purple-100 ring-2 ring-inset ring-purple-400' : 'bg-yellow-100 ring-2 ring-inset ring-blue-400';
                           } else if (p.isNew) {
                               rowBg = 'bg-purple-50 hover:bg-purple-100 border-l-4 border-purple-400';
                           } else if (p.actualStock > 0) {
                               rowBg = 'bg-blue-50/30 hover:bg-gray-50';
                           } else {
                               rowBg = 'hover:bg-gray-50';
                           }

                           return (
                            <tr 
                                id={`row-${p.id}`}
                                key={p.id} 
                                className={`transition duration-300 ${rowBg}`}
                            >
                              <td className="px-6 py-3 font-mono text-sm font-bold text-gray-700">
                                  {p.code}
                                  {p.isNew && <span className="ml-2 text-[10px] bg-purple-200 text-purple-800 px-1 rounded">NOU</span>}
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-600">{p.description}</td>
                              <td className="px-6 py-3 text-center text-sm text-gray-400">{p.scripticStock}</td>
                              <td className="px-6 py-3 text-center">
                                <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                                  p.isNew 
                                    ? 'bg-purple-100 text-purple-800'
                                    : isDiscrepancy 
                                        ? (p.actualStock > p.scripticStock ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800')
                                        : (p.actualStock > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500')
                                }`}>
                                  {p.actualStock}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => updateStockManual(p.id, -1)}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Scade"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                  <button 
                                    onClick={() => updateStockManual(p.id, 1)}
                                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                                    title="Adaugă"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                           )
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                            Nu s-au găsit produse care să corespundă căutării.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}