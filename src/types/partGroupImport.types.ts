export interface UploadedSpreadsheetFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface PartGroupImportRow {
  partNumber: string;
  rootPartNumber: string;
  partDescription: string;
  partGroupName: string;
}

export interface PartGroupParsedData {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  duplicateRows: number;
  uniqueRows: PartGroupImportRow[];
}

export interface PartGroupWriteSummary {
  inserted: number;
  updated: number;
  matched: number;
}

export interface PartGroupImportSummary extends PartGroupWriteSummary {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  duplicateRows: number;
  uniqueRows: number;
}
