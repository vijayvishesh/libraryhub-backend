import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as ExcelJS from 'exceljs';
import { HttpError } from 'routing-controllers';
import { AddMemberRequest } from '../controllers/requests/member.request';
import {
  MemberBulkUploadRowResult,
  MemberBulkUploadStatus,
} from '../models/memberBulkUpload.model';
import { buildXlsx, sanitizeForExcel } from './excel.helper';

export type MemberUploadFile = {
  originalname: string;
  buffer: Buffer;
};

export type ParsedMemberUploadRow = {
  rowNumber: number;
  fullName: string | null;
  mobileNo: string | null;
  aadharId: string | null;
  email: string | null;
  duration: number | null;
  seatId: string | null;
  slotId: string | null;
  status: string | null;
  planAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
};

export const MEMBER_UPLOAD_COLUMNS = [
  { header: 'fullName', key: 'fullName' },
  { header: 'mobileNo', key: 'mobileNo' },
  { header: 'aadharId', key: 'aadharId' },
  { header: 'email', key: 'email' },
  { header: 'duration', key: 'duration' },
  { header: 'seatId', key: 'seatId' },
  { header: 'slotId', key: 'slotId' },
  { header: 'status', key: 'status' },
  { header: 'planAmount', key: 'planAmount' },
  { header: 'startDate', key: 'startDate' },
  { header: 'endDate', key: 'endDate' },
  { header: 'notes', key: 'notes' },
] as const;

const MEMBER_UPLOAD_REQUIRED_HEADERS = ['fullName', 'mobileNo', 'duration'] as const;

export const buildMemberUploadTemplate = async (): Promise<Buffer> =>
  buildXlsx(MEMBER_UPLOAD_COLUMNS as unknown as { header: string; key: string }[], [], 'Members');

export const buildMemberUploadReport = async (
  rows: MemberBulkUploadRowResult[],
): Promise<Buffer> => {
  const reportRows = rows.map(row => ({
    rowNumber: row.rowNumber,
    fullName: sanitizeForExcel(row.fullName),
    mobileNo: sanitizeForExcel(row.mobileNo),
    aadharId: sanitizeForExcel(row.aadharId),
    email: sanitizeForExcel(row.email),
    duration: sanitizeForExcel(row.duration),
    seatId: sanitizeForExcel(row.seatId),
    slotId: sanitizeForExcel(row.slotId),
    status: sanitizeForExcel(row.statusValue),
    planAmount: sanitizeForExcel(row.planAmount),
    startDate: sanitizeForExcel(row.startDate),
    endDate: sanitizeForExcel(row.endDate),
    notes: sanitizeForExcel(row.notes),
    uploadStatus: sanitizeForExcel(row.uploadStatus),
    errorMessage: sanitizeForExcel(row.errorMessage),
    memberId: sanitizeForExcel(row.memberId),
  }));

  return buildXlsx(
    [
      { header: 'rowNumber', key: 'rowNumber' },
      ...MEMBER_UPLOAD_COLUMNS,
      { header: 'uploadStatus', key: 'uploadStatus' },
      { header: 'errorMessage', key: 'errorMessage' },
      { header: 'memberId', key: 'memberId' },
    ] as unknown as { header: string; key: string }[],
    reportRows,
    'Upload Report',
  );
};

export const parseMemberUploadFile = async (
  file: MemberUploadFile,
): Promise<ParsedMemberUploadRow[]> => {
  const isXLSX = file.originalname.toLowerCase().endsWith('.xlsx');

  if (!isXLSX) {
    throw new HttpError(400, 'UPLOAD_FILE_MUST_BE_XLSX');
  }

  return parseXLSXFile(file);
};


const parseXLSXFile = async (file: MemberUploadFile): Promise<ParsedMemberUploadRow[]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer as never);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new HttpError(400, 'UPLOAD_FILE_EMPTY');
  }

  const headerMap = new Map<string, number>();
  worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = normalizeHeader(extractCellPrimitive(cell.value));
    if (header) {
      headerMap.set(header, colNumber);
    }
  });

  const missingHeaders = MEMBER_UPLOAD_REQUIRED_HEADERS.filter(
    header => !headerMap.has(normalizeHeader(header)),
  );
  if (missingHeaders.length > 0) {
    throw new HttpError(400, `MISSING_UPLOAD_HEADERS: ${missingHeaders.join(', ')}`);
  }

  const parsedRows: ParsedMemberUploadRow[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const parsedRow: ParsedMemberUploadRow = {
      rowNumber,
      fullName: getUploadStringCell(row, headerMap, 'fullName'),
      mobileNo: getUploadStringCell(row, headerMap, 'mobileNo'),
      aadharId: getUploadStringCell(row, headerMap, 'aadharId'),
      email: getUploadStringCell(row, headerMap, 'email'),
      duration: getUploadNumberCell(row, headerMap, 'duration'),
      seatId: getUploadStringCell(row, headerMap, 'seatId'),
      slotId: getUploadStringCell(row, headerMap, 'slotId'),
      status: getUploadStringCell(row, headerMap, 'status'),
      planAmount: getUploadNumberCell(row, headerMap, 'planAmount'),
      startDate: getUploadDateCell(row, headerMap, 'startDate'),
      endDate: getUploadDateCell(row, headerMap, 'endDate'),
      notes: getUploadStringCell(row, headerMap, 'notes'),
    };

    if (isParsedUploadRowEmpty(parsedRow)) {
      continue;
    }

    parsedRows.push(parsedRow);
  }

  if (parsedRows.length === 0) {
    throw new HttpError(400, 'UPLOAD_FILE_EMPTY');
  }

  return parsedRows;
};

export const buildValidatedUploadPayload = async (
  row: ParsedMemberUploadRow,
): Promise<AddMemberRequest> => {
  const payload = plainToInstance(AddMemberRequest, {
    fullName: row.fullName ?? undefined,
    mobileNo: row.mobileNo ?? undefined,
    aadharId: row.aadharId ?? undefined,
    email: row.email ?? undefined,
    duration: row.duration ?? undefined,
    seatId: row.seatId ?? undefined,
    slotId: row.slotId ?? undefined,
    status: row.status ?? undefined,
    planAmount: row.planAmount ?? undefined,
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    notes: row.notes ?? undefined,
  });

  const errors = await validate(payload, {
    validationError: { target: false },
  });

  if (errors.length > 0) {
    const messages = errors.flatMap(error => Object.values(error.constraints ?? {}));
    throw new HttpError(400, messages.join(', '));
  }

  return payload;
};

export const resolveMemberBulkUploadStatus = (
  successCount: number,
  failedCount: number,
): MemberBulkUploadStatus => {
  if (failedCount === 0) {
    return 'success';
  }

  if (successCount === 0) {
    return 'failed';
  }

  return 'partial_success';
};

export const getMemberUploadErrorMessage = (error: unknown): string => {
  if (error instanceof HttpError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'MEMBER_UPLOAD_ROW_FAILED';
};

const getUploadStringCell = (
  row: ExcelJS.Row,
  headerMap: Map<string, number>,
  header: string,
): string | null => {
  const columnNumber = headerMap.get(normalizeHeader(header));
  if (!columnNumber) {
    return null;
  }

  const value = extractCellPrimitive(row.getCell(columnNumber).value);
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const getUploadNumberCell = (
  row: ExcelJS.Row,
  headerMap: Map<string, number>,
  header: string,
): number | null => {
  const columnNumber = headerMap.get(normalizeHeader(header));
  if (!columnNumber) {
    return null;
  }

  const value = extractCellPrimitive(row.getCell(columnNumber).value);
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const normalized = Number(String(value).trim());
  return Number.isFinite(normalized) ? normalized : Number.NaN;
};

const getUploadDateCell = (
  row: ExcelJS.Row,
  headerMap: Map<string, number>,
  header: string,
): string | null => {
  const columnNumber = headerMap.get(normalizeHeader(header));
  if (!columnNumber) {
    return null;
  }

  const value = extractCellPrimitive(row.getCell(columnNumber).value);
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return normalizeSpreadsheetDate(value);
};

const extractCellPrimitive = (
  value: ExcelJS.CellValue,
): string | number | boolean | Date | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => ('text' in item ? item.text : '')).join('');
  }

  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }
    if ('result' in value) {
      return extractCellPrimitive(value.result as ExcelJS.CellValue);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map(item => item.text).join('');
    }
  }

  return null;
};

const normalizeSpreadsheetDate = (value: string | number | boolean | Date): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const millis = excelEpoch.getTime() + value * 24 * 60 * 60 * 1000;
    return new Date(millis).toISOString().slice(0, 10);
  }

  return String(value).trim();
};

const normalizeHeader = (value: string | number | boolean | Date | null): string => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
};

const isParsedUploadRowEmpty = (row: ParsedMemberUploadRow): boolean =>
  ![
    row.fullName,
    row.mobileNo,
    row.aadharId,
    row.email,
    row.duration,
    row.seatId,
    row.slotId,
    row.status,
    row.planAmount,
    row.startDate,
    row.endDate,
    row.notes,
  ].some(value => value !== null && value !== undefined && value !== '');
