import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { readExcelRaw, mapDataToProducts, exportToExcel } from './services/xlsxService';
import { createSession, subscribeToSession, updateSessionProducts, checkSessionExists } from './services/firebase';
import { ProductItem } from './types';
import { ScannerListener } from './components/ScannerListener';
import { QuantityModal } from './components/QuantityModal';

export default function App() {
  // --- STATE PRINCIPAL ---
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [appMode, setAppMode] = useState<'SETUP' | 'MAPPING' | 'ACTIVE'>('SETUP');
  
  // Cloud State
  const [sessionId, setSessionId] = useState("");
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [joinSessionId, setJoinSessionId] = useState("");

  // Import State
  const [fileName, setFileName] = useState<string>("");
  const [rawExcelData, setRawExcelData] = useState<any[][] | null>(null);
  const [originalHeaders, setOriginalHeaders] = useState<any[]>([]); 
  const [columnMapping, setColumnMapping] = useState({ codeIndex: 0, descIndex: 1, stockIndex: 2 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI State
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // --- EFECTE ---

  useEffect(() => {
    if (highlightedId) {
        // Așteptăm puțin ca DOM-ul să se randeze
        setTimeout(() => {
            const row = document.getElementById(`row-${highlightedId}`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Scoatem highlight-ul după 2 secunde
                setTimeout(() => setHighlightedId(null), 2000);
            }
        }, 100);
    }
  }, [highlightedId]);

  useEffect(() => {
    if (isCloudSyncing && sessionId) {
        const unsubscribe = subscribeToSession(sessionId, (data) => {
            if (data) {
                setProducts(data.products || []);
                setFileName(data.fileName);
                setOriginalHeaders(data.originalHeaders);
                setColumnMapping(data.columnMapping);
            }
        });
        return () => unsubscribe();
    }
  }, [isCloudSyncing, sessionId]);

  // --- ACTIUNI ---

  const handleStartCloudSession = async () => {
    if (!products.length) return;
    const newSessionId = Math.floor(1000 + Math.random() * 9000).toString();
    try {
        await createSession(newSessionId, products, fileName, originalHeaders, columnMapping);
        setSessionId(newSessionId);
        setIsCloudSyncing(true);
        setAppMode('ACTIVE');
    } catch (e: any) {
        setErrorMsg("Eroare Firebase: " + e.message);
    }
  };

  const handleJoinSession = async () => {
    if (!joinSessionId) return;
    setErrorMsg(null);
    try {
        const exists = await checkSessionExists(joinSessionId);
        if (exists) {
            setSessionId(joinSessionId);
            setIsCloudSyncing(true);
            setAppMode('ACTIVE');
        } else {
            setErrorMsg("Sesiunea nu există.");
        }
    } catch (e) {
        setErrorMsg("Eroare conexiune.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setErrorMsg(null);
    
    try {
      setFileName(file.name);
      // Citim fisierul
      const rawData = await readExcelRaw(file);
      
      if (!rawData || rawData.length === 0) { 
          throw new Error("Fișierul este gol sau nu a putut fi citit.");
      }
      
      setRawExcelData(rawData);
      setProducts([]); 
      
      // Auto-detectie coloane
      const headerRow = rawData[0] || [];
      const stockIdx = headerRow.length > 2 ? 2 : -1;
      
      setColumnMapping({ codeIndex: 0, descIndex: 1, stockIndex: stockIdx });
      setAppMode('MAPPING');
      console.log("✅ AppMode schimbat în MAPPING. RawData rows:", rawData.length);
      console.log("✅ Header row:", rawData[0]);
      console.log("✅ Column mapping:", { codeIndex: 0, descIndex: 1, stockIndex: stockIdx });
      
    } catch (err: any) { 
      console.error(err);
      setErrorMsg(`EROARE CRITICĂ: ${err.message}`); 
    }
  };

  const handleConfirmMapping = () => {
    if (!rawExcelData) return;
    try {
        const items = mapDataToProducts(rawExcelData, columnMapping);
        if (items.length === 0) {
            setErrorMsg("Nu s-au putut extrage produse. Verifică coloanele selectate.");
            return;
        }
        setOriginalHeaders(rawExcelData[0] || []);
        setProducts(items);
        setRawExcelData(null);
        // Pornim sesiunea imediat după mapare
        setTimeout(handleStartCloudSession, 100);
    } catch (err: any) {
        setErrorMsg(`Eroare la mapare: ${err.message}`);
    }
  };

  const pushUpdateToCloud = (newProducts: ProductItem[]) => {
      setProducts(newProducts);
      if (isCloudSyncing && sessionId) {
          updateSessionProducts(sessionId, newProducts).catch(console.error);
      }
  };

  const handleScan = useCallback((barcode: string) => {
    const codeRaw = barcode.trim();
    if (!codeRaw) return;
    const scannedCodeLower = codeRaw.toLowerCase();

    // Logică avansată de căutare
    let found = products.find(p => p.code.toLowerCase() === scannedCodeLower);
    
    // Fallback: căutare parțială sau fără prefixe comune
    if (!found && scannedCodeLower.length > 2) {
        found = products.find(p => p.code.toLowerCase() === scannedCodeLower.substring(1));
    }
    if (!found) {
        found = products.find(p => p.code.toLowerCase().includes(scannedCodeLower));
    }

    if (found) {
        setSelectedProduct(found);
        setHighlightedId(found.id);
        setIsModalOpen(true);
    } else {
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
    }
  }, [products]);

  const handleQuantityConfirm = (qtyToAdd: number, description?: string) => {
    if (selectedProduct) {
        const index = products.findIndex(p => p.id === selectedProduct.id);
        let newProducts = [...products];

        if (index !== -1) {
            newProducts[index] = {
                ...newProducts[index],
                actualStock: newProducts[index].actualStock + qtyToAdd
            };
        } else {
            let finalDesc = description?.trim() || `${selectedProduct.code} - Produs Nou`;
            const newProductEntry = { ...selectedProduct, description: finalDesc, actualStock: qtyToAdd };
            // Adăugăm la începutul listei pentru vizibilitate
            newProducts = [newProductEntry, ...newProducts];
            setHighlightedId(newProductEntry.id);
        }
        pushUpdateToCloud(newProducts);
    }
    setIsModalOpen(false);
    setSelectedProduct(null);
    setSearchTerm("");
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const updateStockManual = (id: string, delta: number) => {
    const newProducts = products.map(p => {
      if (p.id === id) return { ...p, actualStock: Math.max(0, p.actualStock + delta) };
      return p;
    });
    pushUpdateToCloud(newProducts);
  };

  const stats = useMemo(() => ({
    total: products.length,
    scanned: products.filter(p => p.actualStock > 0).length,
    count: products.reduce((acc, curr) => acc + curr.actualStock, 0),
    newItems: products.filter(p => p.isNew).length
  }), [products]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const lower = searchTerm.toLowerCase();
    return products.filter(p => p.code.toLowerCase().includes(lower) || p.description.toLowerCase().includes(lower));
  }, [products, searchTerm]);

  // Helper: Convertește index de coloană în literă (0 = A, 1 = B, etc.)
  const getColLetter = (index: number): string => {
    let letter = '';
    let num = index;
    while (num >= 0) {
      letter = String.fromCharCode((num % 26) + 65) + letter;
      num = Math.floor(num / 26) - 1;
    }
    return letter;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-800 font-sans overflow-hidden">
      <ScannerListener onScan={handleScan} />

      {selectedProduct && (
        <QuantityModal 
            product={selectedProduct}
            isOpen={isModalOpen}
            onConfirm={handleQuantityConfirm}
            onCancel={() => { setIsModalOpen(false); setSelectedProduct(null); }}
        />
      )}

      {/* HEADER */}
      <header className="bg-blue-600 text-white shadow-md z-30 shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <span>📦</span> BookWay Manager
            </h1>
            {isCloudSyncing ? (
                <div className="flex items-center gap-2 mt-1">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-xs bg-blue-800 px-2 py-0.5 rounded text-blue-100">
                        Sesiune: <strong className="text-white font-mono">{sessionId}</strong>
                    </span>
                </div>
            ) : (
                <p className="text-blue-200 text-xs">Mod Local (Offline)</p>
            )}
          </div>
          <div className="flex gap-2">
            {appMode === 'ACTIVE' && (
                <button 
                    onClick={() => exportToExcel(products, fileName, originalHeaders, columnMapping)} 
                    className="bg-white text-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold shadow hover:bg-blue-50 transition flex items-center gap-1"
                >
                    <span>💾</span> <span className="hidden md:inline">Export</span>
                </button>
            )}
             <button onClick={() => window.location.reload()} className="text-blue-200 hover:text-white px-2 text-sm">
                Ieșire
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 w-full max-w-7xl mx-auto">
        
        {/* VIEW 1: SETUP */}
        {appMode === 'SETUP' && (
            <div className="max-w-lg mx-auto grid gap-8 mt-10">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-blue-100 text-center transition hover:shadow-2xl">
                    <div className="text-5xl mb-4">🖥️</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">PC / Laptop</h2>
                    <p className="text-gray-500 mb-6">Încarcă fișierul Excel de la contabilitate pentru a genera o sesiune de scanare.</p>
                    
                    <label className="block w-full cursor-pointer bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 rounded-xl font-bold shadow-lg transition transform hover:scale-[1.02]">
                        📂 Încarcă Fișier Excel
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                    </label>
                    
                    {errorMsg && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 mt-6 text-left rounded">
                            <p className="text-red-800 font-bold text-sm">Eroare:</p>
                            <p className="text-red-600 text-xs mt-1 font-mono">{errorMsg}</p>
                        </div>
                    )}
                </div>

                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-300"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 font-bold text-sm">SAU CONECTEAZĂ-TE</span>
                    <div className="flex-grow border-t border-gray-300"></div>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 text-center">
                    <div className="text-5xl mb-4">📱</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Scanner / Zebra</h2>
                    <p className="text-gray-500 mb-6">Introdu codul sesiunii creat pe PC.</p>
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            placeholder="Cod Sesiune (ex: 1234)" 
                            className="flex-1 border-2 border-gray-300 rounded-xl p-3 text-center text-xl font-bold focus:border-blue-500 focus:outline-none"
                            value={joinSessionId}
                            onChange={(e) => setJoinSessionId(e.target.value)}
                        />
                        <button onClick={handleJoinSession} className="bg-green-600 hover:bg-green-700 text-white px-6 rounded-xl font-bold shadow-lg transition">START</button>
                    </div>
                </div>
            </div>
        )}

        {/* VIEW 2: MAPPING */}
        {appMode === 'MAPPING' && rawExcelData && (() => {
          try {
            console.log("🎨 Rendering MAPPING screen...");
            return (
              <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-6 border-b">
                  <h2 className="text-2xl font-bold text-gray-800">Configurare Coloane</h2>
                  <p className="text-gray-500 text-sm">Asociază coloanele din Excel cu câmpurile aplicației.</p>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <label className="block text-xs font-bold text-blue-600 uppercase mb-2">Coloana COD DE BARE</label>
                      <select className="w-full border-gray-300 border p-3 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" value={columnMapping.codeIndex} onChange={(e) => setColumnMapping({...columnMapping, codeIndex: +e.target.value})}>
                          {rawExcelData[0].map((h:any, i:number) => <option key={i} value={i}>Coloana {getColLetter(i)}: {h}</option>)}
                      </select>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Coloana DESCRIERE</label>
                      <select className="w-full border-gray-300 border p-3 rounded-lg bg-white shadow-sm outline-none" value={columnMapping.descIndex} onChange={(e) => setColumnMapping({...columnMapping, descIndex: +e.target.value})}>
                          {rawExcelData[0].map((h:any, i:number) => <option key={i} value={i}>Coloana {getColLetter(i)}: {h}</option>)}
                      </select>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Coloana STOC ACTUAL (Scriptic)</label>
                      <select className="w-full border-gray-300 border p-3 rounded-lg bg-white shadow-sm outline-none" value={columnMapping.stockIndex} onChange={(e) => setColumnMapping({...columnMapping, stockIndex: +e.target.value})}>
                          <option value={-1}>-- Fără Stoc --</option>
                          {rawExcelData[0].map((h:any, i:number) => <option key={i} value={i}>Coloana {getColLetter(i)}: {h}</option>)}
                      </select>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 flex justify-end gap-4 border-t">
                  <button onClick={() => { setRawExcelData(null); setAppMode('SETUP'); }} className="text-gray-500 font-bold hover:text-gray-700 px-4">Anulează</button>
                  <button onClick={handleConfirmMapping} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg transition transform hover:-translate-y-0.5">Confirmă și Începe</button>
                </div>
              </div>
            );
          } catch (error) {
            console.error("❌ Error rendering MAPPING screen:", error);
            return <div className="text-red-500 p-4">Eroare la afișarea ecranului de mapare: {String(error)}</div>;
          }
        })()}

        {/* VIEW 3: ACTIVE */}
        {appMode === 'ACTIVE' && (
             <div className="flex flex-col h-full gap-4">
                
                {/* Stats & Search Bar */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 shrink-0">
                    {/* Stats Card */}
                    <div className="md:col-span-4 bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex justify-around items-center">
                        <div className="text-center">
                            <span className="text-xs text-gray-400 uppercase font-bold">Total Linii</span>
                            <div className="text-xl font-bold text-gray-700">{stats.total}</div>
                        </div>
                        <div className="h-8 w-px bg-gray-200"></div>
                        <div className="text-center">
                            <span className="text-xs text-blue-500 uppercase font-bold">Scanate</span>
                            <div className="text-2xl font-bold text-blue-600">{stats.scanned}</div>
                        </div>
                        <div className="h-8 w-px bg-gray-200"></div>
                        <div className="text-center">
                            <span className="text-xs text-green-500 uppercase font-bold">Cantitate</span>
                            <div className="text-xl font-bold text-green-600">{stats.count}</div>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="md:col-span-8 flex gap-2">
                        <div className="relative flex-grow">
                            <input 
                                ref={searchInputRef}
                                type="text" 
                                className="w-full h-full p-3 pl-10 rounded-xl border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-lg" 
                                placeholder="Caută după nume sau scanează cod..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleScan(searchTerm)}
                            />
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
                        </div>
                        <button 
                            onClick={() => handleScan(searchTerm)} 
                            className="bg-blue-600 text-white px-6 rounded-xl font-bold shadow hover:bg-blue-700 transition"
                        >
                            Caută
                        </button>
                    </div>
                </div>

                {/* Table Area */}
                <div className="bg-white rounded-xl shadow border border-gray-200 flex-1 overflow-hidden flex flex-col">
                    <div className="overflow-auto flex-1 relative">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 text-xs font-bold uppercase text-gray-500 border-b">Cod Produs</th>
                                    <th className="p-3 text-xs font-bold uppercase text-gray-500 border-b w-1/2">Descriere</th>
                                    <th className="p-3 text-center text-xs font-bold uppercase text-gray-500 border-b">Scriptic</th>
                                    <th className="p-3 text-center text-xs font-bold uppercase text-gray-500 border-b bg-blue-50">Faptic</th>
                                    <th className="p-3 border-b"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredProducts.map(p => (
                                    <tr 
                                        key={p.id} 
                                        id={`row-${p.id}`} 
                                        className={`transition-colors duration-300 ${
                                            p.id === highlightedId 
                                                ? 'bg-yellow-200' 
                                                : p.actualStock > 0 
                                                    ? 'bg-blue-50/50 hover:bg-blue-100' 
                                                    : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        <td className="p-3 font-mono font-bold text-sm text-gray-700">
                                            {p.code}
                                            {p.isNew && <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded border border-purple-200">NOU</span>}
                                        </td>
                                        <td className="p-3 text-sm text-gray-600 font-medium">{p.description}</td>
                                        <td className="p-3 text-center text-gray-400 text-sm">{p.scripticStock}</td>
                                        <td className="p-3 text-center font-bold text-blue-700 bg-blue-50/30 text-lg">
                                            {p.actualStock > 0 ? p.actualStock : <span className="text-gray-300">-</span>}
                                        </td>
                                        <td className="p-3 text-right">
                                            <button 
                                                onClick={() => updateStockManual(p.id, 1)} 
                                                className="bg-white border border-green-200 text-green-600 w-8 h-8 rounded-full hover:bg-green-500 hover:text-white transition shadow-sm font-bold flex items-center justify-center text-lg pb-1"
                                            >
                                                +
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredProducts.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-10 text-center text-gray-400">
                                            Nu am găsit produse. Scanează un cod pentru a adăuga unul nou.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
             </div>
        )}

      </main>
    </div>
  );
}