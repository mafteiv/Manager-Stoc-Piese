import XLSX from 'xlsx';
import { ProductItem } from '../types';

// Helper to read file as ArrayBuffer
const readFile = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
};

// Step 1: Just read the raw data
export const readExcelRaw = async (file: File): Promise<any[][]> => {
  const data = await readFile(file);
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Get data as array of arrays
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  return jsonData;
};

// Helper: Extract Code from a messy string
// Updated to support Alphanumeric codes (e.g. CF280A, MLT-D101, etc)
const extractCleanCode = (rawValue: string): string => {
  if (!rawValue) return '';
  const str = String(rawValue).trim();
  
  // 1. Încercăm să găsim un cuvânt care conține cifre ȘI litere sau doar majuscule/cifre
  // Lungime intre 5 si 20 caractere (acopera majoritatea codurilor OEM)
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

  // Extract data starting from the row AFTER the header
  const products: ProductItem[] = rawData.slice(headerRowIndex + 1).map((row, index): ProductItem | null => {
    const rawCodeVal = row[codeIndex];
    
    // Extragem codul folosind logica nouă alfanumerică
    const code = extractCleanCode(rawCodeVal);
    
    if (!code || code.length < 3) return null;

    const description = row[descIndex] ? String(row[descIndex]).trim() : 'Fără descriere';
    
    // Parse stock safely
    let scripticStock = 0;
    if (stockIndex !== -1 && row[stockIndex] !== undefined) {
      const parsed = parseInt(String(row[stockIndex]), 10);
      scripticStock = isNaN(parsed) ? 0 : parsed;
    }

    return {
      id: `${code}_${index}`, // Internal ID
      code: code, // Cleaned Code
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

// Updated Export Function with Styling
export const exportToExcel = (
  products: ProductItem[], 
  fileName: string,
  originalHeaders: any[],
  mapping: { codeIndex: number; descIndex: number; stockIndex: number }
) => {
  
  // 1. Reconstruim Antetul (Header)
  const finalHeader = [...originalHeaders, "Stoc Faptic (Scanat)"];
  
  // 2. Reconstruim Datele (Rows)
  const finalData: any[][] = [finalHeader];
  const colCount = originalHeaders.length;

  products.forEach(p => {
    let rowData: any[] = [];

    if (!p.isNew) {
       // PRODUS EXISTENT
       rowData = [...p.originalData];
       while(rowData.length < colCount) {
         rowData.push("");
       }
    } else {
       // PRODUS NOU
       rowData = new Array(colCount).fill("");
       rowData[mapping.codeIndex] = p.code;
       rowData[mapping.descIndex] = p.description;
       if (mapping.stockIndex !== -1) {
         rowData[mapping.stockIndex] = 0;
       }
    }

    // 3. Adăugăm valoarea scanată
    rowData.push(p.actualStock);
    finalData.push(rowData);
  });

  // 4. Generăm worksheet-ul
  const worksheet = XLSX.utils.aoa_to_sheet(finalData);

  // --- APLICARE CULORI ---
  const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1");
  const lastColIdx = finalHeader.length - 1; // Indexul noii coloane (Stoc Faptic)
  const scripticColIdx = mapping.stockIndex; // Indexul coloanei scriptice (din fișierul original)

  // Parcurgem toate rândurile de date (sărim peste header - index 0)
  for (let R = 1; R <= range.e.r; ++R) {
    // 1. Găsim celula de Stoc Faptic (ultima coloană)
    const actualCellAddr = XLSX.utils.encode_cell({r: R, c: lastColIdx});
    const actualCell = worksheet[actualCellAddr];

    // 2. Găsim celula de Stoc Scriptic (dacă a fost mapată)
    let scripticVal = 0;
    if (scripticColIdx !== -1) {
        const scripticCellAddr = XLSX.utils.encode_cell({r: R, c: scripticColIdx});
        const scripticCell = worksheet[scripticCellAddr];
        if (scripticCell && scripticCell.v) {
            scripticVal = parseInt(String(scripticCell.v), 10) || 0;
        }
    }

    if (actualCell && actualCell.v !== undefined) {
        const actualVal = parseInt(String(actualCell.v), 10) || 0;
        
        let fillColor = null;

        // Logica cerută:
        // Mai mare decât scriptic -> ROȘU (Ex: surplus)
        if (actualVal > scripticVal) {
            fillColor = "FF9999"; // Roșu deschis
        } 
        // Mai mic decât scriptic -> VERDE (Ex: lipsă/ok dacă ne raportăm la consum) 
        // *Nota: Am respectat cerința ta: < scriptic = VERDE.
        else if (actualVal < scripticVal) {
            fillColor = "99FF99"; // Verde deschis
        }

        // Aplicăm stilul dacă e cazul
        if (fillColor) {
            actualCell.s = {
                fill: {
                    fgColor: { rgb: fillColor }
                },
                font: {
                    bold: true
                },
                alignment: {
                    horizontal: "center"
                }
            };
        }
    }
  }

  // 5. Generăm fișierul
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventar");

  const namePart = fileName.split('.')[0] || "inventar";
  const newFileName = `${namePart}_actualizat_${new Date().toISOString().slice(0,10)}.xlsx`;

  XLSX.writeFile(workbook, newFileName);
};