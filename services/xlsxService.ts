import { read, utils, writeFile } from 'xlsx';
import { ProductItem } from '../types';

// Helper to read file as ArrayBuffer
const readFile = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = (e) => reject(new Error("Eroare la citirea fizică a fișierului."));
    reader.readAsArrayBuffer(file);
  });
};

// Step 1: Just read the raw data
export const readExcelRaw = async (file: File): Promise<any[][]> => {
  try {
    console.log("Începere citire fișier...");
    const data = await readFile(file);
    
    // Folosim funcția 'read' importată direct, nu prin obiectul XLSX
    // Aceasta rezolvă problemele de împachetare din Vite/Production
    const workbook = read(data, { type: 'array' });
    
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("Fișierul Excel nu are nicio foaie de lucru.");
    
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Get data as array of arrays
    const jsonData = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    return jsonData;
  } catch (error) {
    console.error("XLSX Read Error:", error);
    // Aruncăm o eroare mai clară
    throw new Error(error instanceof Error ? error.message : "Eroare necunoscută la procesarea Excel");
  }
};

// Helper: Extract Code from a messy string
const extractCleanCode = (rawValue: string): string => {
  if (!rawValue) return '';
  const str = String(rawValue).trim();
  
  // Încercăm să găsim un cuvânt care conține cifre ȘI litere sau doar majuscule/cifre
  const potentialCodes = str.match(/([a-zA-Z0-9\-\.]{5,20})/g);
  
  if (potentialCodes && potentialCodes.length > 0) {
     return potentialCodes[0];
  }

  // Fallback
  return str.split(' ')[0].trim();
};

// Step 2: Map data based on user selected columns
export const mapDataToProducts = (
  rawData: any[][], 
  mapping: { codeIndex: number; descIndex: number; stockIndex: number },
  headerRowIndex: number = 0
): ProductItem[] => {
  if (rawData.length <= headerRowIndex + 1) return [];

  const { codeIndex, descIndex, stockIndex } = mapping;

  const products: ProductItem[] = rawData.slice(headerRowIndex + 1).map((row, index): ProductItem | null => {
    // Verificare existență rând
    if (!row) return null;

    const rawCodeVal = row[codeIndex];
    const code = extractCleanCode(rawCodeVal);
    
    if (!code || code.length < 3) return null;

    const description = row[descIndex] ? String(row[descIndex]).trim() : 'Fără descriere';
    
    let scripticStock = 0;
    if (stockIndex !== -1 && row[stockIndex] !== undefined) {
      const parsed = parseInt(String(row[stockIndex]), 10);
      scripticStock = isNaN(parsed) ? 0 : parsed;
    }

    return {
      id: `${code}_${index}`, 
      code: code, 
      description: description,
      scripticStock: scripticStock,
      actualStock: 0, 
      rowOriginalIndex: index + headerRowIndex + 1,
      originalData: row,
      isNew: false
    };
  }).filter((p): p is ProductItem => p !== null);

  return products;
};

// Updated Export Function
export const exportToExcel = (
  products: ProductItem[], 
  fileName: string,
  originalHeaders: any[],
  mapping: { codeIndex: number; descIndex: number; stockIndex: number }
) => {
  const finalHeader = [...originalHeaders, "Stoc Faptic (Scanat)"];
  const finalData: any[][] = [finalHeader];
  const colCount = originalHeaders.length;

  products.forEach(p => {
    let rowData: any[] = [];
    if (!p.isNew) {
       rowData = [...p.originalData];
       while(rowData.length < colCount) {
         rowData.push("");
       }
    } else {
       rowData = new Array(colCount).fill("");
       rowData[mapping.codeIndex] = p.code;
       rowData[mapping.descIndex] = p.description;
       if (mapping.stockIndex !== -1) {
         rowData[mapping.stockIndex] = 0;
       }
    }
    rowData.push(p.actualStock);
    finalData.push(rowData);
  });

  const worksheet = utils.aoa_to_sheet(finalData);

  // --- APLICARE CULORI (Dacă avem stiluri disponibile) ---
  if (worksheet['!ref']) {
      const range = utils.decode_range(worksheet['!ref']);
      const lastColIdx = finalHeader.length - 1; 
      const scripticColIdx = mapping.stockIndex; 

      for (let R = 1; R <= range.e.r; ++R) {
        const actualCellAddr = utils.encode_cell({r: R, c: lastColIdx});
        const actualCell = worksheet[actualCellAddr];

        let scripticVal = 0;
        if (scripticColIdx !== -1) {
            const scripticCellAddr = utils.encode_cell({r: R, c: scripticColIdx});
            const scripticCell = worksheet[scripticCellAddr];
            if (scripticCell && scripticCell.v) {
                scripticVal = parseInt(String(scripticCell.v), 10) || 0;
            }
        }

        if (actualCell && actualCell.v !== undefined) {
            const actualVal = parseInt(String(actualCell.v), 10) || 0;
            // Placeholder pentru logică viitoare de stilizare
        }
      }
  }

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Inventar");

  const namePart = fileName.split('.')[0] || "inventar";
  const newFileName = `${namePart}_actualizat_${new Date().toISOString().slice(0,10)}.xlsx`;

  writeFile(workbook, newFileName);
};