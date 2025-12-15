import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { readExcelRaw, mapDataToProducts, exportToExcel } from './services/xlsxService';
import { createSession, subscribeToSession, updateSessionProducts, checkSessionExists, InventorySession } from './services/firebase';
import { ProductItem } from './types';
import { ScannerListener } from './components/ScannerListener';
import { QuantityModal } from './components/QuantityModal';

export default function App() {
  // --- STATE PRINCIPAL ---
  const [products, setProducts] = useState<ProductItem[]>([]);
  
  // Mod de lucru: 'SETUP' (alegere) | 'MAPPING' (excel) | 'ACTIVE' (lucru)
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
  const [isManualMode, setIsManualMode] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // --- EFECTE PENTRU SINCRONIZARE ---

  // Scroll la produs
  useEffect(() => {
    if (highlightedId) {
        setTimeout(() => {
            const row = document.getElementById(`row-${highlightedId}`);
            if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
  }, [highlightedId]);

  // Listener Cloud
  useEffect(() => {
    if (isCloudSyncing && sessionId) {
        const unsubscribe = subscribeToSession(sessionId, (data) => {
            // Actualizăm datele locale când vine ceva din cloud
            setProducts(data.products);
            setFileName(data.fileName);
            setOriginalHeaders(data.originalHeaders);
            setColumnMapping(data.columnMapping);
        });
        return () => unsubscribe();
    }
  }, [isCloudSyncing, sessionId]);

  // --- ACTIUNI ---

  // 1. Start Cloud Session (Desktop)
  const handleStartCloudSession = async () => {
    if (!products.length) return;
    
    // Generăm un ID simplu (ex: 4 cifre aleatorii sau un nume)
    const newSessionId = Math.floor(1000 + Math.random() * 9000).toString();
    
    try {
        await createSession(newSessionId, products, fileName, originalHeaders, columnMapping);
        setSessionId(newSessionId);
        setIsCloudSyncing(true);
        setAppMode('ACTIVE');
    } catch (e) {
        setErrorMsg("Eroare la conectarea cu serverul (Firebase). Verifică configurația.");
        console.error(e);
    }
  };

  // 2. Join Session (Zebra)
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
            setErrorMsg("Sesiunea nu există. Verifică codul.");
        }
    } catch (e) {
        setErrorMsg("Eroare conexiune internet.");
    }
  };

  // 3. Upload File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setFileName(file.name);
      const rawData = await readExcelRaw(file);
      if (rawData.length === 0) { setErrorMsg("Fișier gol."); return; }
      setRawExcelData(rawData);
      setProducts([]); 
      setErrorMsg(null);
      setColumnMapping({ codeIndex: 0, descIndex: 1, stockIndex: rawData[0].length > 2 ? 2 : -1 });
      setAppMode('MAPPING');
    } catch (err) { setErrorMsg("Eroare fișier Excel."); }
  };

  // 4. Confirm Mapping
  const handleConfirmMapping = () => {
    if (!rawExcelData) return;
    const items = mapDataToProducts(rawExcelData, columnMapping);
    setOriginalHeaders(rawExcelData[0] || []);
    setProducts(items);
    setRawExcelData(null);
    // Întrebăm utilizatorul dacă vrea Cloud sau Local
    // Pentru simplitate, mergem direct în pasul de "Creare sesiune Cloud"
    // Dar o facem automat în handleStartCloudSession apelat din UI
  };

  // 5. Update Stock Logic (Local + Cloud push)
  const pushUpdateToCloud = (newProducts: ProductItem[]) => {
      setProducts(newProducts);
      if (isCloudSyncing && sessionId) {
          // Trimitem în cloud (fără să așteptăm, "fire and forget" pt UI rapid)
          updateSessionProducts(sessionId, newProducts).catch(console.error);
      }
  };

  const handleScan = useCallback((barcode: string) => {
    // Logica de scanare identică, dar apelăm pushUpdateToCloud la final
    const codeRaw = barcode.trim();
    if (!codeRaw) return;
    const scannedCodeLower = codeRaw.toLowerCase();

    let found = products.find(p => p.code.toLowerCase() === scannedCodeLower);
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
            newProducts = [...newProducts, newProductEntry];
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

  // --- RENDER ---
  const getColLetter = (n: number) => String.fromCharCode(65 + n);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <ScannerListener onScan={handleScan} />

      {selectedProduct && (
        <QuantityModal 
            product={selectedProduct}
            isOpen={isModalOpen}
            onConfirm={handleQuantityConfirm}
            onCancel={() => { setIsModalOpen(false); setSelectedProduct(null); }}
        />
      )}

      {/* Header */}
      <header className="bg-blue-600 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-lg md:text-xl font-bold">BookWay Inventory</h1>
            {isCloudSyncing ? (
                <div className="flex items-center gap-2 bg-blue-700 px-2 py-1 rounded text-xs md:text-sm">
                    <span className="animate-pulse w-2 h-2 bg-green-400 rounded-full"></span>
                    <span>Sesiune Activă: <strong>{sessionId}</strong></span>
                </div>
            ) : (
                <p className="text-blue-100 text-xs">Mod Local</p>
            )}
          </div>
          
          <div className="flex gap-2">
            {appMode === 'ACTIVE' && (
                <button onClick={() => exportToExcel(products, fileName, originalHeaders, columnMapping)} className="bg-white text-blue-600 px-3 py-1.5 rounded text-sm font-bold shadow hover:bg-blue-50">
                    Export Excel
                </button>
            )}
             <button onClick={() => window.location.reload()} className="text-blue-200 hover:text-white px-2">
                Ieșire
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* VIEW 1: SETUP SCREEN */}
        {appMode === 'SETUP' && (
            <div className="max-w-md mx-auto grid gap-6 mt-10">
                {/* CARD 1: DESKTOP */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                        🖥️ Sunt pe Desktop
                    </h2>
                    <p className="text-gray-500 text-sm mb-4">Încarcă Excelul aici pentru a crea o sesiune de scanare.</p>
                    
                    <label className="block w-full cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-lg font-bold transition">
                        Încarcă Fișier Excel
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                    </label>
                    {errorMsg && <p className="text-red-500 text-sm mt-2">{errorMsg}</p>}
                </div>

                <div className="flex items-center justify-center text-gray-400 font-bold">- SAU -</div>

                {/* CARD 2: ZEBRA */}
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                        📱 Sunt pe Zebra
                    </h2>
                    <p className="text-gray-500 text-sm mb-4">Introdu codul sesiunii generat pe Desktop.</p>
                    
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            placeholder="Cod Sesiune (ex: 1234)" 
                            className="flex-1 border-2 border-gray-300 rounded-lg p-2 text-center text-lg font-bold focus:border-blue-500 focus:outline-none"
                            value={joinSessionId}
                            onChange={(e) => setJoinSessionId(e.target.value)}
                        />
                        <button 
                            onClick={handleJoinSession}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 rounded-lg font-bold"
                        >
                            Start
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* VIEW 2: MAPPING (Doar pe Desktop apare) */}
        {appMode === 'MAPPING' && rawExcelData && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
             <h2 className="text-2xl font-bold mb-4">Confirmare Coloane</h2>
             {/* ... Selectorii de coloane (simplificat pt brevitate, logica e aceeasi) ... */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                    <label className="text-xs font-bold text-gray-500">Coloana COD</label>
                    <select className="w-full border p-2 rounded" value={columnMapping.codeIndex} onChange={(e) => setColumnMapping({...columnMapping, codeIndex: +e.target.value})}>
                         {rawExcelData[0].map((h:any, i:number) => <option key={i} value={i}>{getColLetter(i)}: {h}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500">Coloana DESCRIERE</label>
                    <select className="w-full border p-2 rounded" value={columnMapping.descIndex} onChange={(e) => setColumnMapping({...columnMapping, descIndex: +e.target.value})}>
                         {rawExcelData[0].map((h:any, i:number) => <option key={i} value={i}>{getColLetter(i)}: {h}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500">Coloana STOC (Opțional)</label>
                    <select className="w-full border p-2 rounded" value={columnMapping.stockIndex} onChange={(e) => setColumnMapping({...columnMapping, stockIndex: +e.target.value})}>
                         <option value={-1}>Fără Stoc</option>
                         {rawExcelData[0].map((h:any, i:number) => <option key={i} value={i}>{getColLetter(i)}: {h}</option>)}
                    </select>
                </div>
             </div>

             <div className="flex justify-end gap-4 mt-6">
                <button onClick={() => { setRawExcelData(null); setAppMode('SETUP'); }} className="text-gray-500">Anulează</button>
                <button onClick={() => {
                    handleConfirmMapping(); 
                    // După confirmare, lansăm automat sesiunea Cloud
                    setTimeout(handleStartCloudSession, 100); 
                }} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">
                    Creează Sesiune Cloud
                </button>
             </div>
          </div>
        )}

        {/* VIEW 3: ACTIVE WORK */}
        {appMode === 'ACTIVE' && (
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Stats Sidebar */}
                <div className="lg:col-span-1 space-y-4">
                     <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
                        <p className="text-xs text-gray-500 uppercase font-bold">Cod Sesiune (pt Zebra)</p>
                        <p className="text-4xl font-mono font-bold text-blue-600 tracking-wider my-2">{sessionId}</p>
                        <p className="text-xs text-gray-400">Introduceți acest cod pe celălalt dispozitiv.</p>
                     </div>
                     
                     <div className="bg-white p-4 rounded-xl shadow-sm border">
                        <div className="flex justify-between mb-2"><span>Total:</span> <strong>{stats.total}</strong></div>
                        <div className="flex justify-between mb-2"><span>Scanate:</span> <strong className="text-blue-600">{stats.scanned}</strong></div>
                        <div className="flex justify-between"><span>Cantitate:</span> <strong className="text-green-600">{stats.count}</strong></div>
                     </div>
                </div>

                {/* Main List */}
                <div className="lg:col-span-3">
                     <div className="bg-white p-2 rounded-lg shadow-sm border flex gap-2 mb-4">
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            className="flex-grow p-2 outline-none" 
                            placeholder="Caută / Scanează..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleScan(searchTerm)}
                        />
                        <button onClick={() => handleScan(searchTerm)} className="bg-blue-600 text-white px-4 rounded font-bold">Caută</button>
                     </div>
                     
                     {/* Tabel simplificat */}
                     <div className="bg-white rounded-lg shadow border overflow-hidden">
                        <div className="overflow-x-auto max-h-[60vh]">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="p-3 text-xs uppercase text-gray-500">Cod</th>
                                        <th className="p-3 text-xs uppercase text-gray-500">Descriere</th>
                                        <th className="p-3 text-center text-xs uppercase text-gray-500">S</th>
                                        <th className="p-3 text-center text-xs uppercase text-gray-500">F</th>
                                        <th className="p-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredProducts.map(p => (
                                        <tr key={p.id} id={`row-${p.id}`} className={p.id === highlightedId ? 'bg-yellow-100' : p.actualStock > 0 ? 'bg-blue-50' : ''}>
                                            <td className="p-3 font-mono font-bold text-sm">{p.code}</td>
                                            <td className="p-3 text-sm">{p.description}</td>
                                            <td className="p-3 text-center text-gray-400 text-sm">{p.scripticStock}</td>
                                            <td className="p-3 text-center font-bold">{p.actualStock}</td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => updateStockManual(p.id, 1)} className="bg-green-100 text-green-700 p-1 rounded hover:bg-green-200 text-xs font-bold px-2">+</button>
                                            </td>
                                        </tr>
                                    ))}
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