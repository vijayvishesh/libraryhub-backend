export interface UploadedSpreadsheetFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface IwCategoryImportRow {
  name: string;
  max: number;
  min: number;
  order?: number;
}

export interface IwCategoriesParsedData {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  duplicateRows: number;
  uniqueRows: IwCategoryImportRow[];
}

export interface IwCategoriesWriteSummary {
  inserted: number;
  updated: number;
  matched: number;
}

export interface IwCategoriesImportSummary extends IwCategoriesWriteSummary {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  duplicateRows: number;
  uniqueRows: number;
}
