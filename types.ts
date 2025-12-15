export interface ProductItem {
  id: string; // Internal unique ID
  code: string; // Barcode / Product Code
  description: string;
  scripticStock: number; // Stoc din Excel
  actualStock: number; // Stoc numarat (scanat)
  rowOriginalIndex: number; // To preserve order or update specific rows
  originalData: any; // Keep original row data to preserve other columns
  isNew?: boolean; // Flag to identify items added during scanning session
}

export interface InventoryStats {
  totalItems: number;
  scannedItems: number;
  totalActualStock: number;
  discrepancies: number;
}