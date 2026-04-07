import * as ExcelJS from 'exceljs';
import { Response } from 'express';

type CsvRow = Record<string, unknown>;
type XlsxColumn = {
  header: string;
  key: string;
};

type XlsxBuildOptions = {
  centerAlign?: boolean;
  boldHeader?: boolean;
  boldUpperHeader?: boolean;
  boldLastRow?: boolean;
};

const applyCenterAlignment = (worksheet: ExcelJS.Worksheet): void => {
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    row.alignment = { horizontal: 'center', vertical: 'middle' };
  });
};

const applyBoldToRow = (row?: ExcelJS.Row): void => {
  if (!row) {
    return;
  }
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { ...(cell.font ?? {}), bold: true };
  });
};

const getCellLength = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  return String(value).length;
};

export const buildXlsx = async (
  columns: XlsxColumn[],
  rows: CsvRow[],
  sheetName = 'Sheet1',
  options?: XlsxBuildOptions,
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  const maxColumnWidths = new Map<string, number>();
  for (const column of columns) {
    maxColumnWidths.set(column.key, column.header.length);
  }
  for (const row of rows) {
    for (const column of columns) {
      const length = getCellLength(row[column.key]);
      const current = maxColumnWidths.get(column.key) ?? 0;
      if (length > current) {
        maxColumnWidths.set(column.key, length);
      }
    }
  }

  worksheet.columns = columns.map((column) => {
    const width = Math.min(Math.max((maxColumnWidths.get(column.key) ?? 10) + 2, 10), 60);
    return {
      header: column.header,
      key: column.key,
      width,
    };
  });

  worksheet.addRows(rows);

  if (options?.boldHeader) {
    applyBoldToRow(worksheet.getRow(1));
  }
  if (options?.boldLastRow) {
    applyBoldToRow(worksheet.lastRow);
  }
  if (options?.centerAlign) {
    applyCenterAlignment(worksheet);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
};

export const buildXlsxWithUpperHeader = async (
  upperHeaderRow: (string | number | boolean | Date | null)[],
  headerRow: string[],
  columns: XlsxColumn[],
  rows: CsvRow[],
  sheetName = 'Sheet1',
  mergeConfig?: { startCol: number; groupSize: number; groupCount: number },
  options?: XlsxBuildOptions,
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  const maxColumnWidths = new Map<string, number>();
  columns.forEach((column, index) => {
    const headerLength = getCellLength(headerRow[index] ?? column.header);
    const upperHeaderLength = getCellLength(upperHeaderRow[index]);
    maxColumnWidths.set(column.key, Math.max(headerLength, upperHeaderLength));
  });
  for (const row of rows) {
    for (const column of columns) {
      const length = getCellLength(row[column.key]);
      const current = maxColumnWidths.get(column.key) ?? 0;
      if (length > current) {
        maxColumnWidths.set(column.key, length);
      }
    }
  }

  worksheet.columns = columns.map((column) => {
    const width = Math.min(Math.max((maxColumnWidths.get(column.key) ?? 10) + 2, 10), 60);
    return {
      key: column.key,
      width,
    };
  });

  worksheet.addRow(upperHeaderRow);
  worksheet.addRow(headerRow);
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).alignment = { horizontal: 'center', vertical: 'middle' };
  if (options?.boldUpperHeader) {
    applyBoldToRow(worksheet.getRow(1));
  }
  if (options?.boldHeader) {
    applyBoldToRow(worksheet.getRow(2));
  }

  if (mergeConfig) {
    for (let i = 0; i < mergeConfig.groupCount; i += 1) {
      const start = mergeConfig.startCol + i * mergeConfig.groupSize;
      const end = start + mergeConfig.groupSize - 1;
      worksheet.mergeCells(1, start, 1, end);
    }
  }
  const columnKeys = columns.map((column) => column.key);
  for (const row of rows) {
    worksheet.addRow(columnKeys.map((key) => row[key]));
  }

  if (options?.boldLastRow) {
    applyBoldToRow(worksheet.lastRow);
  }
  if (options?.centerAlign) {
    applyCenterAlignment(worksheet);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
};

export const sendXlsxDownload = (res: Response, filename: string, buffer: Buffer): Response => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(buffer);
};

export const sanitizeForExcel = (value: unknown): string | number | boolean | Date | null => {
  if (typeof value === 'string') {
    if (value.startsWith('=') || value.startsWith('+') || value.startsWith('-') || value.startsWith('@')) {
      return `'${value}`;
    }
  }
  return value as string | number | boolean | Date | null;
};
