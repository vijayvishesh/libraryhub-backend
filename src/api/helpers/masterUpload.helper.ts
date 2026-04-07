/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import * as path from 'path';
import { Readable } from 'stream';
import { env } from '../../env';
import { getS3Client } from '../../lib/aws/s3Client';
import { MasterUploadRepository } from '../repositories/masterUpload.repository';

export type UploadType = 'iwCategories' | 'productsGroup' | 'benchmarks' | 'targets' | 'pjp' | 'scheme' | 'coDealer';

export type CategoryRow = {
  name: string;
  min: number;
  max: number;
  order: number;
  startDate: string;
};

export type ProductsGroupRow = {
  partNum: string;
  rootPartNum: string;
  groupType: string;
  partDescription: string;
  startDate: string;
  partCategory: string;
};

export type TargetUploadRow = {
  rowNumber: number;
  dealerCode: string;
  locationCode: string;
  region: string;
  iwCode: string;
  iwName: string;
  target: number;
};

export type PjpUploadRow = {
  rowNumber: number;
  dealerCode: string;
  locationCode: string;
  region: string;
  iwCode: string;
  iwName: string;
  pjpDate: Date;
};

export type CoDealerUploadRow = {
  rowNumber: number;
  sNo: number;
  dlrName: string;
  state: string;
  dealerCode: string;
  partyCode: string;
  region: string;
  offtake: string;
  remarks: string;
};

export type RowError = {
  rowNumber: number;
  errors: string[];
};

export type UploadConfirmResult = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: RowError[];
};

export async function processMasterUploadData(
  uploadType: UploadType,
  fileName: string,
  s3Key: string,
  repository: MasterUploadRepository,
): Promise<{
  parsed: {
    totalRows: number;
    validRows: CategoryRow[] | ProductsGroupRow[];
    invalidRows: number;
    errors: RowError[];
  };
}> {
  const fileBuffer = await readFromS3(s3Key);

  if (uploadType === 'productsGroup') {
    const parsed = parseProductsGroupFile(fileName, fileBuffer);
    if (!parsed.validRows.length) {
      throw new Error('No valid rows found');
    }

    await repository.upsertProductsGroupUpload(parsed.validRows);
    await persistProcessedFile(uploadType, fileName, parsed.validRows);
    return { parsed };
  }

  const parsed = parseCategoryFile(fileName, fileBuffer);
  if (!parsed.validRows.length) {
    throw new Error('No valid rows found');
  }

  await repository.upsertIwCategories(
    parsed.validRows.map((row) => ({
      name: row.name,
      min: row.min,
      max: row.max,
      order: row.order,
    })),
  );

  await persistProcessedFile(uploadType, fileName, parsed.validRows);
  return { parsed };
}

export async function ensureS3ObjectExists(key: string): Promise<void> {
  if (!env.s3.bucket) {
    throw new Error('S3 bucket is not configured');
  }

  const client = getS3Client();
  try {
    await client.send(
      new HeadObjectCommand({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Bucket: env.s3.bucket,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Key: key,
      }),
    );
  } catch (error) {
    const message = (error as Error).message || '';
    if (message.toLowerCase().includes('notfound')) {
      throw new Error('S3 object not found');
    }
    if ((error as { name?: string })?.name === 'NotFound') {
      throw new Error('S3 object not found');
    }
    throw error;
  }
}

export function ensureAllowedExtension(type: UploadType, fileName: string): void {
  const extension = path.extname(fileName || '').toLowerCase();
  if (!extension) {
    throw new Error('File name must include an extension');
  }

  if (
    type === 'iwCategories' ||
    type === 'productsGroup' ||
    type === 'benchmarks' ||
    type === 'targets' ||
    type === 'pjp' ||
    type === 'coDealer'
  ) {
    if (extension !== '.csv') {
      throw new Error('Unsupported file format. Please upload .csv');
    }
    return;
  }
}

export function parseCoDealerFile(
  fileName: string,
  fileBuffer: Buffer,
): {
  totalRows: number;
  validRows: CoDealerUploadRow[];
  invalidRows: number;
  errors: RowError[];
} {
  const extension = path.extname(fileName || '').toLowerCase();
  let rows: string[][] = [];

  if (extension === '.csv') {
    const content = fileBuffer.toString('utf8');
    rows = parseDelimitedRows(content, detectCsvDelimiter(content));
  } else {
    throw new Error('Unsupported file format. Please upload .csv');
  }

  if (!rows.length) {
    throw new Error('No readable rows found in the uploaded file');
  }

  const requiredHeaders = ['sno', 'dlrname', 'state', 'dealercode', 'partycode', 'region', 'offtake', 'remarks'];

  let headerRowIndex = -1;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const normalized = rows[rowIndex].map((cell) => normalizeHeader(cell || '').replace(/\./g, ''));
    const hasAll = requiredHeaders.every((header) => normalized.includes(header));
    if (hasAll) {
      headerRowIndex = rowIndex;
      break;
    }
  }
  if (headerRowIndex < 0) {
    throw new Error(
      'Missing required headers. Needed: S.No, DLR_NAME, STATE, Dealer Code, Party Code, Region, Offtake, Remarks',
    );
  }

  const normalizedHeaders = rows[headerRowIndex].map((header) => normalizeHeader(header).replace(/\./g, ''));
  const sNoIndex = normalizedHeaders.indexOf('sno');
  const dlrNameIndex = normalizedHeaders.indexOf('dlrname');
  const stateIndex = normalizedHeaders.indexOf('state');
  const dealerCodeIndex = normalizedHeaders.indexOf('dealercode');
  const partyCodeIndex = normalizedHeaders.indexOf('partycode');
  const regionIndex = normalizedHeaders.indexOf('region');
  const offtakeIndex = normalizedHeaders.indexOf('offtake');
  const remarksIndex = normalizedHeaders.indexOf('remarks');

  if (
    sNoIndex < 0 ||
    dlrNameIndex < 0 ||
    stateIndex < 0 ||
    dealerCodeIndex < 0 ||
    partyCodeIndex < 0 ||
    regionIndex < 0 ||
    offtakeIndex < 0 ||
    remarksIndex < 0
  ) {
    throw new Error(
      'Missing required headers. Needed: S.No, DLR_NAME, STATE, Dealer Code, Party Code, Region, Offtake, Remarks',
    );
  }

  let totalRows = 0;
  let invalidRows = 0;
  const validRows: CoDealerUploadRow[] = [];
  const errors: RowError[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const sNoText = cleanCell(row[sNoIndex] || '');
    const dlrName = cleanCell(row[dlrNameIndex] || '');
    const state = cleanCell(row[stateIndex] || '');
    const dealerCode = cleanCell(row[dealerCodeIndex] || '');
    const partyCode = cleanCell(row[partyCodeIndex] || '');
    const region = cleanCell(row[regionIndex] || '');
    const offtakeText = cleanCell(row[offtakeIndex] || '');
    const remarks = cleanCell(row[remarksIndex] || '');

    const isBlankRow =
      !sNoText && !dlrName && !state && !dealerCode && !partyCode && !region && !offtakeText && !remarks;
    if (isBlankRow) {
      continue;
    }

    totalRows++;
    const rowErrors: string[] = [];

    const sNo = parseNumber(sNoText);
    if (!Number.isFinite(sNo)) {
      rowErrors.push('S.No must be a number');
    }
    if (!dlrName) {
      rowErrors.push('DLR_NAME is required');
    }
    if (!state) {
      rowErrors.push('STATE is required');
    }
    if (!dealerCode) {
      rowErrors.push('Dealer Code is required');
    }
    if (!partyCode) {
      rowErrors.push('Party Code is required');
    }
    if (!region) {
      rowErrors.push('Region is required');
    }
    if (!offtakeText) {
      rowErrors.push('Offtake is required');
    }

    if (rowErrors.length > 0) {
      invalidRows++;
      errors.push({ rowNumber: rowIndex + 1, errors: rowErrors });
      continue;
    }

    validRows.push({
      rowNumber: rowIndex + 1,
      sNo,
      dlrName,
      state,
      dealerCode,
      partyCode,
      region,
      offtake: offtakeText,
      remarks,
    });
  }

  return { totalRows, validRows, invalidRows, errors };
}

export function parseTargetFile(
  fileName: string,
  fileBuffer: Buffer,
): {
  totalRows: number;
  validRows: TargetUploadRow[];
  invalidRows: number;
  errors: RowError[];
} {
  const extension = path.extname(fileName || '').toLowerCase();
  let rows: string[][] = [];

  if (extension === '.csv') {
    const content = fileBuffer.toString('utf8');
    rows = parseDelimitedRows(content, detectCsvDelimiter(content));
  } else {
    throw new Error('Unsupported file format. Please upload .csv');
  }

  if (!rows.length) {
    throw new Error('No readable rows found in the uploaded file');
  }

  const headerRowIndex = findHeaderRowIndex(rows, [
    'dealercode',
    'locationcode',
    'region',
    'iwcode',
    'iwname',
    'target',
  ]);
  if (headerRowIndex < 0) {
    throw new Error('Missing required headers. Needed: dealerCode, locationCode, region, iwCode, iwName, target');
  }

  const normalizedHeaders = rows[headerRowIndex].map((header) => normalizeHeader(header));
  const dealerCodeIndex = normalizedHeaders.indexOf('dealercode');
  const locationCodeIndex = normalizedHeaders.indexOf('locationcode');
  const regionIndex = normalizedHeaders.indexOf('region');
  const iwCodeIndex = normalizedHeaders.indexOf('iwcode');
  const iwNameIndex = normalizedHeaders.indexOf('iwname');
  const targetIndex = normalizedHeaders.indexOf('target');

  if (
    dealerCodeIndex < 0 ||
    locationCodeIndex < 0 ||
    regionIndex < 0 ||
    iwCodeIndex < 0 ||
    iwNameIndex < 0 ||
    targetIndex < 0
  ) {
    throw new Error('Missing required headers. Needed: dealerCode, locationCode, region, iwCode, iwName, target');
  }

  let totalRows = 0;
  let invalidRows = 0;
  const validRows: TargetUploadRow[] = [];
  const errors: RowError[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const dealerCode = cleanCell(row[dealerCodeIndex] || '');
    const locationCode = cleanCell(row[locationCodeIndex] || '');
    const region = cleanCell(row[regionIndex] || '');
    const iwCode = cleanCell(row[iwCodeIndex] || '');
    const iwName = cleanCell(row[iwNameIndex] || '');
    const targetText = cleanCell(row[targetIndex] || '');

    const isBlankRow = !dealerCode && !locationCode && !region && !iwCode && !iwName && !targetText;
    if (isBlankRow) {
      continue;
    }

    totalRows++;
    const rowErrors: string[] = [];

    if (!dealerCode) {
      rowErrors.push('dealerCode is required');
    }
    if (!locationCode) {
      rowErrors.push('locationCode is required');
    }
    if (!region) {
      rowErrors.push('region is required');
    }
    if (!iwCode) {
      rowErrors.push('iwCode is required');
    }
    if (!iwName) {
      rowErrors.push('iwName is required');
    }

    const target = parseNumber(targetText);
    if (!Number.isFinite(target)) {
      rowErrors.push('target must be a number');
    }

    if (rowErrors.length > 0) {
      invalidRows++;
      errors.push({ rowNumber: rowIndex + 1, errors: rowErrors });
      continue;
    }

    validRows.push({
      rowNumber: rowIndex + 1,
      dealerCode,
      locationCode,
      region,
      iwCode,
      iwName,
      target,
    });
  }

  return { totalRows, validRows, invalidRows, errors };
}

export function parsePjpFile(
  fileName: string,
  fileBuffer: Buffer,
): {
  totalRows: number;
  validRows: PjpUploadRow[];
  invalidRows: number;
  errors: RowError[];
} {
  const extension = path.extname(fileName || '').toLowerCase();
  let rows: string[][] = [];

  if (extension === '.csv') {
    const content = fileBuffer.toString('utf8');
    rows = parseDelimitedRows(content, detectCsvDelimiter(content));
  } else {
    throw new Error('Unsupported file format. Please upload .csv');
  }

  if (!rows.length) {
    throw new Error('No readable rows found in the uploaded file');
  }

  const headerRowIndex = findHeaderRowIndex(rows, ['dealercode', 'locationcode', 'region', 'iwcode', 'iwname', 'pjp']);
  if (headerRowIndex < 0) {
    throw new Error('Missing required headers. Needed: dealerCode, locationCode, region, iwCode, iwName, pjp');
  }

  const normalizedHeaders = rows[headerRowIndex].map((header) => normalizeHeader(header));
  const dealerCodeIndex = normalizedHeaders.indexOf('dealercode');
  const locationCodeIndex = normalizedHeaders.indexOf('locationcode');
  const regionIndex = normalizedHeaders.indexOf('region');
  const iwCodeIndex = normalizedHeaders.indexOf('iwcode');
  const iwNameIndex = normalizedHeaders.indexOf('iwname');
  const pjpIndex = normalizedHeaders.indexOf('pjp');

  if (
    dealerCodeIndex < 0 ||
    locationCodeIndex < 0 ||
    regionIndex < 0 ||
    iwCodeIndex < 0 ||
    iwNameIndex < 0 ||
    pjpIndex < 0
  ) {
    throw new Error('Missing required headers. Needed: dealerCode, locationCode, region, iwCode, iwName, pjp');
  }

  let totalRows = 0;
  let invalidRows = 0;
  const validRows: PjpUploadRow[] = [];
  const errors: RowError[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const dealerCode = cleanCell(row[dealerCodeIndex] || '');
    const locationCode = cleanCell(row[locationCodeIndex] || '');
    const region = cleanCell(row[regionIndex] || '');
    const iwCode = cleanCell(row[iwCodeIndex] || '');
    const iwName = cleanCell(row[iwNameIndex] || '');
    const pjpText = cleanCell(row[pjpIndex] || '');

    const isBlankRow = !dealerCode && !locationCode && !region && !iwCode && !iwName && !pjpText;
    if (isBlankRow) {
      continue;
    }

    totalRows++;
    const rowErrors: string[] = [];

    if (!dealerCode) {
      rowErrors.push('dealerCode is required');
    }
    if (!locationCode) {
      rowErrors.push('locationCode is required');
    }
    if (!region) {
      rowErrors.push('region is required');
    }
    if (!iwCode) {
      rowErrors.push('iwCode is required');
    }
    if (!iwName) {
      rowErrors.push('iwName is required');
    }

    const pjpDate = parseDate(pjpText);
    if (!pjpDate) {
      rowErrors.push('pjp must be a valid date');
    }

    if (rowErrors.length > 0) {
      invalidRows++;
      errors.push({ rowNumber: rowIndex + 1, errors: rowErrors });
      continue;
    }

    validRows.push({
      rowNumber: rowIndex + 1,
      dealerCode,
      locationCode,
      region,
      iwCode,
      iwName,
      pjpDate: pjpDate!,
    });
  }

  return { totalRows, validRows, invalidRows, errors };
}

export function parseCategoryFile(
  fileName: string,
  fileBuffer: Buffer,
): {
  totalRows: number;
  validRows: CategoryRow[];
  invalidRows: number;
  errors: RowError[];
} {
  const extension = path.extname(fileName || '').toLowerCase();
  let rows: string[][] = [];

  if (extension === '.csv') {
    const content = fileBuffer.toString('utf8');
    rows = parseDelimitedRows(content, detectCsvDelimiter(content));
  } else {
    throw new Error('Unsupported file format. Please upload .csv');
  }

  if (!rows.length) {
    throw new Error('No readable rows found in the uploaded file');
  }

  const normalizedHeaders = rows[0].map((header) => normalizeHeader(header));
  const nameIndex = normalizedHeaders.indexOf('name');
  const maxIndex = normalizedHeaders.indexOf('max');
  const minIndex = normalizedHeaders.indexOf('min');
  const orderIndex = normalizedHeaders.indexOf('order');
  const startDateIndex = normalizedHeaders.indexOf('startdate');

  if (nameIndex < 0 || maxIndex < 0 || minIndex < 0 || orderIndex < 0 || startDateIndex < 0) {
    throw new Error('Missing required headers. Needed: name, max, min, order, startDate');
  }

  let totalRows = 0;
  let invalidRows = 0;
  const validRows: CategoryRow[] = [];
  const errors: RowError[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const name = cleanCell(row[nameIndex] || '');
    const minText = cleanCell(row[minIndex] || '');
    const maxText = cleanCell(row[maxIndex] || '');
    const orderText = cleanCell(row[orderIndex] || '');
    const startDateText = cleanCell(row[startDateIndex] || '');

    const isBlankRow = !name && !minText && !maxText && !orderText && !startDateText;
    if (isBlankRow) {
      continue;
    }

    totalRows++;
    const rowErrors: string[] = [];

    if (!name) {
      rowErrors.push('name is required');
    }

    const min = parseNumber(minText);
    const max = parseNumber(maxText);
    if (!Number.isFinite(min)) {
      rowErrors.push('min must be a number');
    }
    if (!Number.isFinite(max)) {
      rowErrors.push('max must be a number');
    }
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
      rowErrors.push('min must be less than or equal to max');
    }

    const order = parseNumber(orderText);
    if (!Number.isFinite(order) || !Number.isInteger(order) || order < 0) {
      rowErrors.push('order must be an integer >= 0');
    }

    const startDate = parseDate(startDateText);
    if (!startDate) {
      rowErrors.push('startDate must be a valid date');
    }

    if (rowErrors.length > 0) {
      invalidRows++;
      errors.push({ rowNumber: rowIndex + 1, errors: rowErrors });
      continue;
    }

    validRows.push({
      name,
      min,
      max,
      order,
      startDate: startDate!.toISOString(),
    });
  }

  return { totalRows, validRows, invalidRows, errors };
}

export function parseProductsGroupFile(
  fileName: string,
  fileBuffer: Buffer,
): {
  totalRows: number;
  validRows: ProductsGroupRow[];
  invalidRows: number;
  errors: RowError[];
} {
  const extension = path.extname(fileName || '').toLowerCase();
  let rows: string[][] = [];

  if (extension === '.csv') {
    const content = fileBuffer.toString('utf8');
    rows = parseDelimitedRows(content, detectCsvDelimiter(content));
  } else {
    throw new Error('Unsupported file format. Please upload .csv');
  }

  if (!rows.length) {
    throw new Error('No readable rows found in the uploaded file');
  }

  const headerRowIndex = findHeaderRowIndex(rows, [
    'partnum',
    'rootpartnum',
    'grouptype',
    'partdescription',
    'startdate',
    'partcategory',
  ]);
  if (headerRowIndex < 0) {
    throw new Error(
      'Missing required headers. Needed: partNum, rootPartNum, groupType, partDescription, startDate, partCategory',
    );
  }

  const normalizedHeaders = rows[headerRowIndex].map((header) => normalizeHeader(header));
  const partNumIndex = normalizedHeaders.indexOf('partnum');
  const rootPartNumIndex = normalizedHeaders.indexOf('rootpartnum');
  const groupTypeIndex = normalizedHeaders.indexOf('grouptype');
  const partDescriptionIndex = normalizedHeaders.indexOf('partdescription');
  const startDateIndex = normalizedHeaders.indexOf('startdate');
  const partCategoryIndex = normalizedHeaders.indexOf('partcategory');

  if (
    partNumIndex < 0 ||
    rootPartNumIndex < 0 ||
    groupTypeIndex < 0 ||
    partDescriptionIndex < 0 ||
    startDateIndex < 0 ||
    partCategoryIndex < 0
  ) {
    throw new Error(
      'Missing required headers. Needed: partNum, rootPartNum, groupType, partDescription, startDate, partCategory',
    );
  }

  let totalRows = 0;
  let invalidRows = 0;
  const validRows: ProductsGroupRow[] = [];
  const errors: RowError[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const partNum = cleanCell(row[partNumIndex] || '');
    const rootPartNum = cleanCell(row[rootPartNumIndex] || '');
    const groupType = cleanCell(row[groupTypeIndex] || '');
    const partDescription = cleanCell(row[partDescriptionIndex] || '');
    const startDateText = cleanCell(row[startDateIndex] || '');
    const partCategory = cleanCell(row[partCategoryIndex] || '');

    const isBlankRow = !partNum && !rootPartNum && !groupType && !partDescription && !startDateText && !partCategory;
    if (isBlankRow) {
      continue;
    }

    totalRows++;
    const rowErrors: string[] = [];

    if (!partNum) {
      rowErrors.push('partNum is required');
    }
    if (!rootPartNum) {
      rowErrors.push('rootPartNum is required');
    }
    if (!groupType) {
      rowErrors.push('groupType is required');
    }
    if (!partDescription) {
      rowErrors.push('partDescription is required');
    }
    if (!partCategory) {
      rowErrors.push('partCategory is required');
    }

    const startDate = parseDate(startDateText);
    if (!startDate) {
      rowErrors.push('startDate must be a valid date');
    }

    if (rowErrors.length > 0) {
      invalidRows++;
      errors.push({ rowNumber: rowIndex + 1, errors: rowErrors });
      continue;
    }

    validRows.push({
      partNum,
      rootPartNum,
      groupType,
      partDescription,
      startDate: startDate!.toISOString(),
      partCategory,
    });
  }

  return { totalRows, validRows, invalidRows, errors };
}

async function readFromS3(key: string): Promise<Buffer> {
  if (!env.s3.bucket) {
    throw new Error('S3 bucket is not configured');
  }

  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Bucket: env.s3.bucket,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error('S3 object body is empty');
  }

  const body = response.Body as unknown;
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (typeof body === 'string') {
    return Buffer.from(body);
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (isReadable(body)) {
    return streamToBuffer(body);
  }
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> })?.transformToByteArray === 'function') {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }

  throw new Error('Unsupported S3 response body type');
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function isReadable(value: unknown): value is Readable {
  return !!value && typeof (value as Readable).pipe === 'function';
}

function parseDelimitedRows(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows.map((row) => row.map((cell) => cell.trim()));
}

function findHeaderRowIndex(rows: string[][], requiredHeaders: string[]): number {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const normalized = rows[rowIndex].map((cell) => normalizeHeader(cell || ''));
    const hasAll = requiredHeaders.every((header) => normalized.includes(header));
    if (hasAll) {
      return rowIndex;
    }
  }
  return -1;
}

function detectCsvDelimiter(content: string): string {
  const candidates = [',', ';', '\t', '|'];
  let bestDelimiter = ',';
  let bestScore = -1;

  for (const delimiter of candidates) {
    const sampleLine = content.split(/\r?\n/, 2)[0] || '';
    const score = sampleLine.split(delimiter).length;
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '');
}

function cleanCell(value: string): string {
  return (value || '').replace(/^\uFEFF/, '').trim();
}

function parseNumber(value: string): number {
  if (!value) {
    return Number.NaN;
  }
  const normalized = value.replace(/,/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slashMatch) {
    const day = Number.parseInt(slashMatch[1], 10);
    const month = Number.parseInt(slashMatch[2], 10);
    const yearRaw = Number.parseInt(slashMatch[3], 10);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    if (
      Number.isFinite(day) &&
      Number.isFinite(month) &&
      Number.isFinite(year) &&
      day >= 1 &&
      day <= 31 &&
      month >= 1 &&
      month <= 12
    ) {
      const date = new Date(year, month - 1, day, 12, 0, 0, 0);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const numeric = Number.parseFloat(trimmed);
  if (Number.isFinite(numeric) && trimmed.match(/^\d+(\.\d+)?$/)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const millis = excelEpoch.getTime() + numeric * 24 * 60 * 60 * 1000;
    const date = new Date(millis);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    date.setHours(12, 0, 0, 0);
    return date;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(12, 0, 0, 0);
  return date;
}

async function persistProcessedFile(
  type: UploadType,
  fileName: string,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (!env.s3.bucket) {
    throw new Error('S3 bucket is not configured');
  }

  const prefix = (env.s3.keyPrefix || 'master-reports').replace(/\/+$/g, '');
  const safeName = (fileName || `${type}.csv`).replace(/[^\w.\-]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extIndex = safeName.lastIndexOf('.');
  const baseName = extIndex > 0 ? safeName.slice(0, extIndex) : safeName;
  const processedKey = `${prefix}/${type}/processed/${baseName}_${timestamp}.json`;

  const payload = JSON.stringify({ type, rows });
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Bucket: env.s3.bucket,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Key: processedKey,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Body: payload,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ContentType: 'application/json',
    }),
  );
}
