import type { SalesExecutiveIwWiseDataItem } from '../controllers/responses/dashboardSalesExecutive.response';

type ExcelColumn = {
  header: string;
  key: string;
};

type ProductMetrics = {
  target: number;
  achievement: number;
};

type ProductColumnDefinition = {
  key: string;
  normalizedName: string;
  header: string;
  order: number;
};

export type SalesExecutiveIwWiseExcelRow = {
  iwCode: string;
  iwName: string;
  target: number;
  achievement: number;
  percentage: number;
  noBillingIWGreaterThan5: number;
  noBillingIWTotal: number;
  products: Record<string, ProductMetrics>;
  isTotal?: boolean;
};

export type SalesExecutiveIwWiseExcelBuildResult = {
  transformedRows: SalesExecutiveIwWiseExcelRow[];
  productColumns: ProductColumnDefinition[];
  columns: ExcelColumn[];
  upperHeaderRow: string[];
  headerRow: string[];
  dataRows: Record<string, unknown>[];
  mergeConfig?: { startCol: number; groupSize: number; groupCount: number };
};

const PRODUCT_GROUP_SIZE = 2;

const BASE_COLUMNS: ExcelColumn[] = [
  { header: 'IW Code', key: 'iwCode' },
  { header: 'IW Name', key: 'iwName' },
  { header: 'Target', key: 'target' },
  { header: 'Achievement', key: 'achievement' },
  { header: 'Percentage', key: 'percentage' },
  { header: 'No Billing IW > 5k', key: 'noBillingIWGreaterThan5' },
  { header: 'No Billing IW Total', key: 'noBillingIWTotal' },
];

const KNOWN_PRODUCT_COLUMNS: ProductColumnDefinition[] = [
  { key: 'airFilter', normalizedName: 'AIR FILTER', header: 'Air Filter', order: 1 },
  { key: 'benchmark', normalizedName: 'BENCHMARK TOTAL', header: 'Benchmark Total', order: 2 },
  { key: 'brake', normalizedName: 'BRAKE', header: 'Brake', order: 3 },
  { key: 'clutch', normalizedName: 'CLUTCH', header: 'Clutch', order: 4 },
  {
    key: 'clutchBearing',
    normalizedName: 'CLUTCH BEARING',
    header: 'Clutch Bearing',
    order: 5,
  },
  { key: 'fuelFilter', normalizedName: 'FUEL FILTER', header: 'Fuel Filter', order: 6 },
  { key: 'oilFilter', normalizedName: 'OIL FILTER', header: 'Oil Filter', order: 7 },
];

const KNOWN_PRODUCT_COLUMN_BY_NORMALIZED = new Map(
  KNOWN_PRODUCT_COLUMNS.map((column) => [column.normalizedName, column]),
);

const toTwoDecimals = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
};

const toPercentage = (achievement: number, target: number): number => {
  if (!Number.isFinite(target) || target <= 0) {
    return 0;
  }
  if (!Number.isFinite(achievement)) {
    return 0;
  }
  return Math.round((achievement / target) * 100);
};

const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const createEmptyProducts = (productColumns: ProductColumnDefinition[]): Record<string, ProductMetrics> =>
  productColumns.reduce<Record<string, ProductMetrics>>((accumulator, column) => {
    accumulator[column.key] = {
      target: 0,
      achievement: 0,
    };
    return accumulator;
  }, {});

const buildProductKey = (normalizedName: string, usedKeys: Set<string>): string => {
  const parts = normalizedName.toLowerCase().split(' ').filter(Boolean);
  const baseKey =
    parts.map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))).join('') ||
    'product';

  let key = baseKey;
  let suffix = 2;
  while (usedKeys.has(key)) {
    key = `${baseKey}${suffix}`;
    suffix += 1;
  }
  usedKeys.add(key);
  return key;
};

const resolveProductColumn = (normalizedName: string, usedKeys: Set<string>): ProductColumnDefinition => {
  const predefinedColumn = KNOWN_PRODUCT_COLUMN_BY_NORMALIZED.get(normalizedName);
  if (predefinedColumn) {
    usedKeys.add(predefinedColumn.key);
    return predefinedColumn;
  }

  return {
    key: buildProductKey(normalizedName, usedKeys),
    normalizedName,
    header: toTitleCase(normalizedName),
    order: Number.MAX_SAFE_INTEGER,
  };
};

const buildProductColumns = (rows: SalesExecutiveIwWiseDataItem[]): ProductColumnDefinition[] => {
  const productColumnsByNormalized = new Map<string, ProductColumnDefinition>();
  const usedKeys = new Set<string>();

  KNOWN_PRODUCT_COLUMNS.forEach((column) => {
    productColumnsByNormalized.set(column.normalizedName, column);
    usedKeys.add(column.key);
  });

  rows.forEach((row) => {
    (row.products ?? []).forEach((product) => {
      const normalizedName = normalizeProductName(product.productName ?? '');
      if (!normalizedName || productColumnsByNormalized.has(normalizedName)) {
        return;
      }

      productColumnsByNormalized.set(normalizedName, resolveProductColumn(normalizedName, usedKeys));
    });
  });

  return Array.from(productColumnsByNormalized.values()).sort((left, right) => {
    if (left.order === right.order) {
      return left.header.localeCompare(right.header);
    }

    return left.order - right.order;
  });
};

const buildTransformedRow = (
  row: SalesExecutiveIwWiseDataItem,
  productColumns: ProductColumnDefinition[],
  productColumnByNormalized: Map<string, ProductColumnDefinition>,
): SalesExecutiveIwWiseExcelRow => {
  const normalizedProducts = createEmptyProducts(productColumns);

  (row.products ?? []).forEach((product) => {
    const normalizedName = normalizeProductName(product.productName ?? '');
    if (!normalizedName) {
      return;
    }

    const productColumn = productColumnByNormalized.get(normalizedName);
    if (!productColumn) {
      return;
    }

    normalizedProducts[productColumn.key].target = toTwoDecimals(
      normalizedProducts[productColumn.key].target + (product.target ?? 0),
    );
    normalizedProducts[productColumn.key].achievement = toTwoDecimals(
      normalizedProducts[productColumn.key].achievement + (product.achievement ?? 0),
    );
  });

  const target = toTwoDecimals(row.target ?? 0);
  const achievement = toTwoDecimals(row.achievement ?? 0);

  return {
    iwCode: row.iwCode,
    iwName: row.iwName,
    target,
    achievement,
    percentage: toPercentage(achievement, target),
    noBillingIWGreaterThan5: row.noBillingIWGreaterThan5 ?? 0,
    noBillingIWTotal: row.noBillingIWTotal ?? 0,
    products: normalizedProducts,
  };
};

const buildTotalRow = (
  rows: SalesExecutiveIwWiseExcelRow[],
  productColumns: ProductColumnDefinition[],
): SalesExecutiveIwWiseExcelRow => {
  const totalProducts = createEmptyProducts(productColumns);

  const totals = rows.reduce(
    (accumulator, row) => {
      accumulator.target = toTwoDecimals(accumulator.target + (row.target ?? 0));
      accumulator.achievement = toTwoDecimals(accumulator.achievement + (row.achievement ?? 0));
      accumulator.noBillingIWGreaterThan5 += row.noBillingIWGreaterThan5 ?? 0;
      accumulator.noBillingIWTotal += row.noBillingIWTotal ?? 0;

      productColumns.forEach((column) => {
        const productMetrics = row.products[column.key] ?? { target: 0, achievement: 0 };
        totalProducts[column.key].target = toTwoDecimals(
          totalProducts[column.key].target + (productMetrics.target ?? 0),
        );
        totalProducts[column.key].achievement = toTwoDecimals(
          totalProducts[column.key].achievement + (productMetrics.achievement ?? 0),
        );
      });

      return accumulator;
    },
    {
      target: 0,
      achievement: 0,
      noBillingIWGreaterThan5: 0,
      noBillingIWTotal: 0,
    },
  );

  return {
    iwCode: 'TOTAL',
    iwName: '',
    target: totals.target,
    achievement: totals.achievement,
    percentage: toPercentage(totals.achievement, totals.target),
    noBillingIWGreaterThan5: totals.noBillingIWGreaterThan5,
    noBillingIWTotal: totals.noBillingIWTotal,
    products: totalProducts,
    isTotal: true,
  };
};

export const normalizeProductName = (name: string): string =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const transformSalesExecutiveIwWiseExcelRows = (
  rows: SalesExecutiveIwWiseDataItem[],
): {
  transformedRows: SalesExecutiveIwWiseExcelRow[];
  productColumns: ProductColumnDefinition[];
} => {
  const productColumns = buildProductColumns(rows);
  const productColumnByNormalized = new Map(productColumns.map((column) => [column.normalizedName, column]));

  const transformedRows = rows.map((row) => buildTransformedRow(row, productColumns, productColumnByNormalized));

  if (transformedRows.length === 0) {
    return {
      transformedRows,
      productColumns,
    };
  }

  return {
    transformedRows: [...transformedRows, buildTotalRow(transformedRows, productColumns)],
    productColumns,
  };
};

export const buildSalesExecutiveIwWiseExcelResponse = (
  rows: SalesExecutiveIwWiseDataItem[],
): SalesExecutiveIwWiseExcelBuildResult => {
  const { transformedRows, productColumns } = transformSalesExecutiveIwWiseExcelRows(rows);

  const productExcelColumns = productColumns.flatMap((column) => [
    { header: 'Target', key: `${column.key}_target` },
    { header: 'Achievement', key: `${column.key}_achievement` },
  ]);

  const dataRows = transformedRows.map((row) => {
    const record: Record<string, unknown> = {
      iwCode: row.iwCode,
      iwName: row.iwName,
      target: row.target,
      achievement: row.achievement,
      percentage: row.percentage,
      noBillingIWGreaterThan5: row.noBillingIWGreaterThan5,
      noBillingIWTotal: row.noBillingIWTotal,
    };

    productColumns.forEach((column) => {
      const productMetrics = row.products[column.key] ?? { target: 0, achievement: 0 };
      record[`${column.key}_target`] = productMetrics.target;
      record[`${column.key}_achievement`] = productMetrics.achievement;
    });

    return record;
  });

  return {
    transformedRows,
    productColumns,
    columns: [...BASE_COLUMNS, ...productExcelColumns],
    upperHeaderRow: [
      ...BASE_COLUMNS.map(() => ''),
      ...productColumns.flatMap((column) => [column.header, column.header]),
    ],
    headerRow: [
      ...BASE_COLUMNS.map((column) => column.header),
      ...productColumns.flatMap(() => ['Target', 'Achievement']),
    ],
    dataRows,
    mergeConfig:
      productColumns.length > 0
        ? {
            startCol: BASE_COLUMNS.length + 1,
            groupSize: PRODUCT_GROUP_SIZE,
            groupCount: productColumns.length,
          }
        : undefined,
  };
};
