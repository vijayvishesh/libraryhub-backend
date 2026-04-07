import { connect } from 'mongoose';
// import { iwCategoriesModel } from '../../api/models/iwCategories.model';
// import { productsGroupModel } from '../../api/models/productsGroup.model';
// import { benchmarksModel } from '../../api/models/benchmarks.model';
// import { ObjectId } from 'mongodb';
// import { zoneRegionMappingModel } from '../../api/models/zoneRegionMapping.model';
// import { productsBenchmarkModel } from '../../api/models/productsBenchmark.model';
// import { ObjectId } from 'mongodb';
import { iwMonthlyTargetModel } from '../../api/models/iwMonthlyTarget.model';
import { env } from '../../env';
// Provided IDs and constants for iwMonthlyTarget

// import { iwMasterModel } from '../../api/models/iwMaster.model';

// const seedData = [
//   { name: '>3L', max: 1000000000, min: 300000, order: 1 },
//   { name: '1L-3L', max: 300000, min: 100000, order: 2 },
//   { name: '75k-1L', max: 100000, min: 75000, order: 3 },
//   { name: '50k-75k', max: 75000, min: 50000, order: 4 },
//   { name: '25k-50k', max: 50000, min: 25000, order: 5 },
//   { name: '5k-25k', max: 25000, min: 5000, order: 6 },
//   { name: '<5k', max: 5000, min: 0, order: 7 },
// ];

// function generatePartGroupData(count: number) {
//   const partGroups = [
//     'Air filter',
//     'Fuel Filter',
//     'Oil filter',
//     'CLUTCH',
//     'CLUTCH- BEARING',
//     'BRAKE',
//   ];

//   function generatePartNumber(prefix: string) {
//     return `${prefix}${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
//       10 + Math.random() * 90,
//     )}D${Math.floor(Math.random() * 10)}`;
//   }

//   return Array.from({ length: count }, (_, i) => {
//     const name = partGroups[i % partGroups.length];

//     return {
//       name,
//       rootPartNumberList: Array.from(
//         { length: Math.floor(Math.random() * 5) + 1 }, // 1–5 parts
//         () => ({
//           partName: name,
//           partNumber: generatePartNumber('PN-'),
//           partRootNumber: generatePartNumber('RP-'),
//           partDescription:
//             name === 'Air filter'
//               ? 'CLEANER ASSY, AIR'
//               : name === 'Fuel Filter'
//                 ? 'FILTER ASSY, FUEL'
//                 : name === 'Oil filter'
//                   ? 'FILTER ASSY, OIL'
//                   : name === 'CLUTCH'
//                     ? 'CLUTCH - COVER ASSY'
//                     : name === 'CLUTCH- BEARING'
//                       ? 'CLUTCH RELEASE BEARING'
//                       : 'BRAKE ASSY',
//         }),
//       ),
//     };
//   });
// }

// function generatePercentageTableData(count: number) {
//   function randomDate(start: Date, end: Date) {
//     return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
//   }

//   return Array.from({ length: count }, () => {
//     const startDate = randomDate(
//       new Date(new Date().getFullYear(), 0, 1),
//       new Date(new Date().getFullYear(), 6, 1),
//     );
//     const endDate = randomDate(startDate, new Date(startDate.getFullYear(), 11, 31));

//     return {
//       startDate,
//       endDate,
//       percentage: 80,
//     };
//   });
// }

// function generateZoneDocuments() {
//   const parentZones = [
//     { label: 'central', value: 'CENTRAL' },
//     { label: 'north', value: 'NORTH' },
//     { label: 'south', value: 'SOUTH' },
//     { label: 'east', value: 'EAST' },
//     { label: 'west', value: 'WEST' },
//   ];

//   const childZonesMap: Record<string, string[]> = {
//     CENTRAL: ['C1', 'C2'],
//     NORTH: ['N1', 'N2'],
//     SOUTH: ['S1', 'S2'],
//     EAST: ['E1', 'E2'],
//     WEST: ['W1', 'W2'],
//   };

//   const documents: any[] = [];
//   const parentIdMap: Record<string, ObjectId> = {};

//   // create parents
//   parentZones.forEach(zone => {
//     const _id = new ObjectId();
//     parentIdMap[zone.value] = _id;

//     documents.push({
//       _id,
//       isZone: true,
//       label: zone.label,
//       value: zone.value,
//       parentZoneId: null,
//     });
//   });

//   // create children
//   Object.entries(childZonesMap).forEach(([parentValue, children]) => {
//     children.forEach(child => {
//       documents.push({

//         isZone: false,
//         label: child.toLowerCase(),
//         value: child,
//         parentZoneId: parentIdMap[parentValue],
//       });
//     });
//   });
//   return documents;
// }

// function generateIWTargetFromBenchmark() {
//   const benchmarkId = new ObjectId('6960ca42df3702aa05640e69');

//   const productGroups = {
//     'Air filter': new ObjectId('6960ce9b2083ec8ce53ce8b8'),
//     'Fuel Filter': new ObjectId('6960ce9b2083ec8ce53ce8bb'),
//     'Oil filter': new ObjectId('6960ce9b2083ec8ce53ce8bd'),
//     CLUTCH: new ObjectId('6960ce9b2083ec8ce53ce8c1'),
//     'CLUTCH- BEARING': new ObjectId('6960ce9b2083ec8ce53ce8c6'),
//     BRAKE: new ObjectId('6960ce9b2083ec8ce53ce8ca'),
//   };

//   const categories = [
//     { label: '>3L', id: new ObjectId('6960cb9c8de0b21305fce64d') },
//     { label: '1L-3L', id: new ObjectId('6960cb9c8de0b21305fce64e') },
//     { label: '75k-1L', id: new ObjectId('6960cb9c8de0b21305fce64f') },
//     { label: '50k-75k', id: new ObjectId('6960cb9c8de0b21305fce650') },
//     { label: '25k-50k', id: new ObjectId('6960cb9c8de0b21305fce651') },
//     { label: '5k-25k', id: new ObjectId('6960cb9c8de0b21305fce652') },
//     { label: '<5k', id: new ObjectId('6960cb9c8de0b21305fce653') },
//   ];

//   const benchmarkMatrix = {
//     '>3L': {
//       'Air filter': 22,
//       'Fuel Filter': 21,
//       'Oil filter': 36,
//       CLUTCH: 8,
//       'CLUTCH- BEARING': 5,
//       BRAKE: 22,
//     },
//     '1L-3L': {
//       'Air filter': 9,
//       'Fuel Filter': 4,
//       'Oil filter': 13,
//       CLUTCH: 5,
//       'CLUTCH- BEARING': 3,
//       BRAKE: 8,
//     },
//     '75k-1L': {
//       'Air filter': 4,
//       'Fuel Filter': 3,
//       'Oil filter': 10,
//       CLUTCH: 3,
//       'CLUTCH- BEARING': 2,
//       BRAKE: 4,
//     },
//     '50k-75k': {
//       'Air filter': 4,
//       'Fuel Filter': 2,
//       'Oil filter': 9,
//       CLUTCH: 3,
//       'CLUTCH- BEARING': 2,
//       BRAKE: 3,
//     },
//     '25k-50k': {
//       'Air filter': 3,
//       'Fuel Filter': 2,
//       'Oil filter': 6,
//       CLUTCH: 2,
//       'CLUTCH- BEARING': 1,
//       BRAKE: 2,
//     },
//     '5k-25k': {
//       'Air filter': 2,
//       'Fuel Filter': 1,
//       'Oil filter': 3,
//       CLUTCH: 1,
//       'CLUTCH- BEARING': 1,
//       BRAKE: 1,
//     },
//     '<5k': {
//       'Air filter': 1,
//       'Fuel Filter': 1,
//       'Oil filter': 1,
//       CLUTCH: 1,
//       'CLUTCH- BEARING': 1,
//       BRAKE: 1,
//     },
//   };

//   return categories.flatMap(cat =>
//     Object.entries(productGroups).map(([groupName, groupId]) => ({
//       iwCategoryId: cat.id,
//       productGroupId: groupId,
//       target: benchmarkMatrix[cat.label][groupName],
//       date: new Date(),
//       benchmarkId,
//     })),
//   );
// }

// function generateDDTIWData(count: number) {
//   const ddtCodes = ['RJ01', 'RJ02', 'RJ03', 'RJ04'];
//   const ddtNames = [
//     'FRIENDS TRADING CORPORATION',
//     'SHREE AUTOMOBILES',
//     'MAHAVEER MOTORS',
//     'GANPATI TRADERS',
//   ];
//   const locCodes = ['JOD', 'BKN', 'JPR', 'UDA', 'AJM'];
//   const iwNames = [
//     'SHREE DEV MOTORS',
//     'GAJANAND MOTOR COMPANY',
//     'MAHAVEER AUTO',
//     'KRISHNA MOTORS',
//     'BALAJI AUTOMOBILES',
//   ];

//   return Array.from({ length: count }, (_, i) => ({
//     'DDT Code': ddtCodes[i % ddtCodes.length],
//     'DDT Name': ddtNames[i % ddtNames.length],
//     'IW Code': `WRJ02${100000 + i}`,
//     'IW Name': `${iwNames[i % iwNames.length]} ${i + 1}`,
//     'LOC Code': locCodes[i % locCodes.length],
//   }));
// }

// function generateVisitData(count: number) {
//   const zones = ['Central', 'North', 'South', 'East', 'West'];

//   const regions = ['C1', 'C2', 'N1', 'N2', 'S1', 'S2', 'E1', 'E2', 'W1', 'W2'];

//   const employees = [
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'BUNDU KHAN', mspin: 1070488 },
//     { name: 'BUNDU KHAN', mspin: 1070488 },
//     { name: 'BUNDU KHAN', mspin: 1070488 },
//     { name: 'BUNDU KHAN', mspin: 1070488 },
//     { name: 'BUNDU KHAN', mspin: 1070488 },
//     { name: 'BUNDU KHAN', mspin: 1070488 },
//     { name: 'BUNDU KHAN', mspin: 1070488 },

//     { name: 'RAM KUMAR', mspin: 1266079 },
//     { name: 'RAM KUMAR', mspin: 1266079 },
//     { name: 'RAM KUMAR', mspin: 1266079 },
//     { name: 'RAM KUMAR', mspin: 1266079 },
//     { name: 'RAM KUMAR', mspin: 1266079 },

//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },

//     { name: 'BUNDU KHAN', mspin: 1070488 },
//     { name: 'BUNDU KHAN', mspin: 1070488 },
//     { name: 'BUNDU KHAN', mspin: 1070488 },

//     { name: 'GIRWAR SINGH BHATI', mspin: 526538 },
//     { name: 'GIRWAR SINGH BHATI', mspin: 526538 },
//     { name: 'GIRWAR SINGH BHATI', mspin: 526538 },

//     { name: 'RAM KUMAR', mspin: 1266079 },
//     { name: 'RAM KUMAR', mspin: 1266079 },
//     { name: 'RAM KUMAR', mspin: 1266079 },

//     { name: 'GIRWAR SINGH BHATI', mspin: 526538 },
//     { name: 'GIRWAR SINGH BHATI', mspin: 526538 },

//     { name: 'BHANWAR SINGH DEVARA', mspin: 957545 },
//     { name: 'BHANWAR SINGH DEVARA', mspin: 957545 },
//     { name: 'BHANWAR SINGH DEVARA', mspin: 957545 },

//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },

//     { name: 'MANISH SODHA', mspin: 976256 },
//     { name: 'MANISH SODHA', mspin: 976256 },

//     { name: 'SETHI SINGH', mspin: 419633 },
//     { name: 'SETHI SINGH', mspin: 419633 },
//     { name: 'SETHI SINGH', mspin: 419633 },

//     { name: 'RAM KUMAR', mspin: 1266079 },

//     { name: 'MANISH SODHA', mspin: 976256 },
//     { name: 'MANISH SODHA', mspin: 976256 },
//     { name: 'MANISH SODHA', mspin: 976256 },
//     { name: 'MANISH SODHA', mspin: 976256 },

//     { name: 'RAM KUMAR', mspin: 1266079 },

//     { name: 'GIRWAR SINGH BHATI', mspin: 526538 },
//     { name: 'GIRWAR SINGH BHATI', mspin: 526538 },

//     { name: 'AKBAR KHAN', mspin: 392374 },
//     { name: 'AKBAR KHAN', mspin: 392374 },
//     { name: 'AKBAR KHAN', mspin: 392374 },

//     { name: 'RAM KUMAR', mspin: 1266079 },

//     { name: 'AKBAR KHAN', mspin: 392374 },
//     { name: 'AKBAR KHAN', mspin: 392374 },
//     { name: 'AKBAR KHAN', mspin: 392374 },

//     { name: 'OM PRAKASH', mspin: 834919 },

//     { name: 'MANISH SODHA', mspin: 976256 },
//     { name: 'MANISH SODHA', mspin: 976256 },
//     { name: 'MANISH SODHA', mspin: 976256 },

//     { name: 'RAM KUMAR', mspin: 1266079 },

//     { name: 'MANISH SODHA', mspin: 976256 },
//     { name: 'MANISH SODHA', mspin: 976256 },
//     { name: 'MANISH SODHA', mspin: 976256 },

//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },

//     { name: 'SETHI SINGH', mspin: 419633 },
//     { name: 'SETHI SINGH', mspin: 419633 },
//     { name: 'SETHI SINGH', mspin: 419633 },
//     { name: 'SETHI SINGH', mspin: 419633 },
//     { name: 'SETHI SINGH', mspin: 419633 },

//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },

//     { name: 'RAM KUMAR', mspin: 1266079 },

//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },

//     { name: 'BUNDU KHAN', mspin: 1070488 },

//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },

//     { name: 'BUNDU KHAN', mspin: 1070488 },

//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },

//     { name: 'SETHI SINGH', mspin: 419633 },

//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },
//     { name: 'RADHAKISHAN SARAN', mspin: 1264170 },

//     { name: 'GIRWAR SINGH BHATI', mspin: 526538 },
//     { name: 'GIRWAR SINGH BHATI', mspin: 526538 },
//   ];

//   const partyTypes = ['TR', 'DL'];

//   const visitStatus = ['Successfull', 'Pending', 'Cancelled'];

//   function randomDate() {
//     const start = new Date(2025, 0, 1);

//     const end = new Date(2025, 11, 31);

//     return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
//   }

//   return Array.from({ length: count }, (_, i) => {
//     const date = randomDate();
//     const emp = employees[i % employees.length];
//     return {
//       Zone: zones[i % zones.length],
//       Region: regions[i % regions.length],
//       'DDT Loc CD': ['BKN', 'JOD', 'JPR', 'UDA'][i % 4],
//       MSPIN: emp.mspin,
//       Designation: 'Retail Executive',
//       'Party type': partyTypes[i % partyTypes.length],
//       'Visit Status': visitStatus[i % visitStatus.length],
//       'Visited On Date': date.toISOString().split('T')[0],
//       'Visited On Time': date.toTimeString().split(' ')[0],
//       'Visited By': emp.name,
//     };
//   });
// }

// function generateIWMasterData(ddtIwData: any[], visitData: any[]) {
//   return ddtIwData.map((row, index) => {
//     const visit = visitData[index % visitData.length];

//     return {
//       iwCode: row['IW Code'],
//       iwName: row['IW Name'],
//       ddtCode: row['DDT Code'],
//       ddtName: row['DDT Name'],
//       iwReason: 'Routine Visit',
//       iwZone: visit['Zone'],
//       iwLoc: row['LOC Code'],
//       iwType: visit['Party type'],
//       assignedDSE: visit['MSPIN'],
//       avgMonthlyRetail: Math.floor(100000 + Math.random() * 900000), // 6 digit random
//       iwCategoryId: new ObjectId(), // or map from your category table
//       lastVisitDate: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)),
//       lastVisitedBy: visit['Visited By'],
//     };
//   });
// }

// List of iwMasterIDs to use for salesExecutives
const iwMasterIDs = [
  '6964c37272a5b7510f6710e3',
  '6964c37272a5b7510f6710e4',
  '6964c37272a5b7510f6710e5',
  '6964c37272a5b7510f6710e6',
  '6964c37272a5b7510f6710e7',
  '6964c37272a5b7510f6710e8',
  '6964c37272a5b7510f6710e9',
  '6964c37272a5b7510f6710ea',
  '6964c37272a5b7510f6710eb',
  '6964c37272a5b7510f6710ec',
  '6964c37272a5b7510f6710ed',
  '6964c37272a5b7510f6710ee',
  '6964c37272a5b7510f6710ef',
  '6964c37272a5b7510f6710f0',
  '6964c37272a5b7510f6710f1',
  '6964c37272a5b7510f6710f2',
  '6964c37272a5b7510f6710f3',
  '6964c37272a5b7510f6710f4',
  '6964c37272a5b7510f6710f5',
  '6964c37272a5b7510f6710f6',
  '6964c37272a5b7510f6710f7',
  '6964c37272a5b7510f6710f8',
  '6964c37272a5b7510f6710f9',
  '6964c37272a5b7510f6710fa',
  '6964c37272a5b7510f6710fb',
  '6964c37272a5b7510f6710fc',
  '6964c37272a5b7510f6710fd',
  '6964c37272a5b7510f6710fe',
  '6964c37272a5b7510f6710ff',
  '6964c37272a5b7510f671100',
  '6964c37272a5b7510f671101',
  '6964c37272a5b7510f671102',
  '6964c37272a5b7510f671103',
  '6964c37272a5b7510f671104',
  '6964c37272a5b7510f671105',
  '6964c37272a5b7510f671106',
  '6964c37272a5b7510f671107',
  '6964c37272a5b7510f671108',
  '6964c37272a5b7510f671109',
  '6964c37272a5b7510f67110a',
  '6964c37272a5b7510f67110b',
  '6964c37272a5b7510f67110c',
  '6964c37272a5b7510f67110d',
  '6964c37272a5b7510f67110e',
  '6964c37272a5b7510f67110f',
  '6964c37272a5b7510f671110',
  '6964c37272a5b7510f671111',
  '6964c37272a5b7510f671112',
  '6964c37272a5b7510f671113',
  '6964c37272a5b7510f671114',
  '6964c37272a5b7510f671115',
  '6964c37272a5b7510f671116',
  '6964c37272a5b7510f671117',
  '6964c37272a5b7510f671118',
  '6964c37272a5b7510f671119',
  '6964c37272a5b7510f67111a',
  '6964c37272a5b7510f67111b',
  '6964c37272a5b7510f67111c',
  '6964c37272a5b7510f67111d',
  '6964c37272a5b7510f67111e',
  '6964c37272a5b7510f67111f',
  '6964c37272a5b7510f671120',
  '6964c37272a5b7510f671121',
  '6964c37272a5b7510f671122',
  '6964c37272a5b7510f671123',
  '6964c37272a5b7510f671124',
  '6964c37272a5b7510f671125',
  '6964c37272a5b7510f671126',
  '6964c37272a5b7510f671127',
  '6964c37272a5b7510f671128',
  '6964c37272a5b7510f671129',
  '6964c37272a5b7510f67112a',
  '6964c37272a5b7510f67112b',
  '6964c37272a5b7510f67112c',
  '6964c37272a5b7510f67112d',
  '6964c37272a5b7510f67112e',
  '6964c37272a5b7510f67112f',
  '6964c37272a5b7510f671130',
  '6964c37272a5b7510f671131',
  '6964c37272a5b7510f671132',
  '6964c37272a5b7510f671133',
  '6964c37272a5b7510f671134',
  '6964c37272a5b7510f671135',
  '6964c37272a5b7510f671136',
  '6964c37272a5b7510f671137',
  '6964c37272a5b7510f671138',
  '6964c37272a5b7510f671139',
  '6964c37272a5b7510f67113a',
  '6964c37272a5b7510f67113b',
  '6964c37272a5b7510f67113c',
];

// Helper to get employees from generateVisitData
// function getUniqueEmployeesFromVisitData(count = 90) {
//   const visitData = generateVisitData(count);
//   const seen = new Set();
//   const employees = [];
//   for (const v of visitData) {
//     if (!seen.has(v.MSPIN)) {
//       employees.push({ mspin: v.MSPIN, name: v['Visited By'] });
//       seen.add(v.MSPIN);
//     }
//   }
//   return employees;
// }

// function generateSalesExecutivesData() {
//   const employees = getUniqueEmployeesFromVisitData(iwMasterIDs.length);
//   return iwMasterIDs.map((id, idx) => {
//     const emp = employees[idx % employees.length];
//     // Random assignedOnDate in last 2 years
//     const now = Date.now();
//     const assignedOnDate = new Date(
//       now - Math.floor(Math.random() * 2 * 365 * 24 * 60 * 60 * 1000),
//     );
//     // 50% chance to have removedOnDate, after assignedOnDate
//     let removedOnDate = undefined;
//     if (Math.random() < 0.5) {
//       removedOnDate = new Date(
//         assignedOnDate.getTime() + Math.floor(Math.random() * (now - assignedOnDate.getTime())),
//       );
//     }
//     return {
//       iwMasterID: id,
//       salesExecutiveId: String(emp.mspin),
//       salesExecutiveName: emp.name,
//       assignedOnDate,
//       removedOnDate,
//     };
//   });
// }
const iwMonthlyTargetIwIds = iwMasterIDs;
const iwMonthlyTargetIwCodes = [
  'WRJ02100000',
  'WRJ02100001',
  'WRJ02100002',
  'WRJ02100003',
  'WRJ02100004',
  'WRJ02100005',
  'WRJ02100006',
  'WRJ02100007',
  'WRJ02100008',
  'WRJ02100009',
  'WRJ02100010',
  'WRJ02100011',
  'WRJ02100012',
  'WRJ02100013',
  'WRJ02100014',
  'WRJ02100015',
  'WRJ02100016',
  'WRJ02100017',
  'WRJ02100018',
  'WRJ02100019',
  'WRJ02100020',
  'WRJ02100021',
  'WRJ02100022',
  'WRJ02100023',
  'WRJ02100024',
  'WRJ02100025',
  'WRJ02100026',
  'WRJ02100027',
  'WRJ02100028',
  'WRJ02100029',
  'WRJ02100030',
  'WRJ02100031',
  'WRJ02100032',
  'WRJ02100033',
  'WRJ02100034',
  'WRJ02100035',
  'WRJ02100036',
  'WRJ02100037',
  'WRJ02100038',
  'WRJ02100039',
  'WRJ02100040',
  'WRJ02100041',
  'WRJ02100042',
  'WRJ02100043',
  'WRJ02100044',
  'WRJ02100045',
  'WRJ02100046',
  'WRJ02100047',
  'WRJ02100048',
  'WRJ02100049',
  'WRJ02100050',
  'WRJ02100051',
  'WRJ02100052',
  'WRJ02100053',
  'WRJ02100054',
  'WRJ02100055',
  'WRJ02100056',
  'WRJ02100057',
  'WRJ02100058',
  'WRJ02100059',
  'WRJ02100060',
  'WRJ02100061',
  'WRJ02100062',
  'WRJ02100063',
  'WRJ02100064',
  'WRJ02100065',
  'WRJ02100066',
  'WRJ02100067',
  'WRJ02100068',
  'WRJ02100069',
  'WRJ02100070',
  'WRJ02100071',
  'WRJ02100072',
  'WRJ02100073',
  'WRJ02100074',
  'WRJ02100075',
  'WRJ02100076',
  'WRJ02100077',
  'WRJ02100078',
  'WRJ02100079',
  'WRJ02100080',
  'WRJ02100081',
  'WRJ02100082',
  'WRJ02100083',
  'WRJ02100084',
  'WRJ02100085',
  'WRJ02100086',
  'WRJ02100087',
  'WRJ02100088',
  'WRJ02100089',
];
const productGroupIds = [
  '6960ce9b2083ec8ce53ce8b8',
  '6960ce9b2083ec8ce53ce8bb',
  '6960ce9b2083ec8ce53ce8bd',
  '6960ce9b2083ec8ce53ce8c1',
  '6960ce9b2083ec8ce53ce8c6',
  '6960ce9b2083ec8ce53ce8ca',
];
const productBenchmarkIds = [
  '6960e3816150952ab3d3247c',
  '6960e3816150952ab3d3247d',
  '6960e3816150952ab3d3247e',
  '6960e3816150952ab3d3247f',
  '6960e3816150952ab3d32480',
  '6960e3816150952ab3d32481',
  '6960e3816150952ab3d32482',
  '6960e3816150952ab3d32483',
  '6960e3816150952ab3d32484',
  '6960e3816150952ab3d32485',
  '6960e3816150952ab3d32486',
  '6960e3816150952ab3d32487',
  '6960e3816150952ab3d32488',
  '6960e3816150952ab3d32489',
  '6960e3816150952ab3d3248a',
  '6960e3816150952ab3d3248b',
  '6960e3816150952ab3d3248c',
  '6960e3816150952ab3d3248d',
  '6960e3816150952ab3d3248e',
  '6960e3816150952ab3d3248f',
  '6960e3816150952ab3d32490',
  '6960e3816150952ab3d32491',
  '6960e3816150952ab3d32492',
  '6960e3816150952ab3d32493',
  '6960e3816150952ab3d32494',
  '6960e3816150952ab3d32495',
  '6960e3816150952ab3d32496',
  '6960e3816150952ab3d32497',
  '6960e3816150952ab3d32498',
  '6960e3816150952ab3d32499',
  '6960e3816150952ab3d3249a',
  '6960e3816150952ab3d3249b',
  '6960e3816150952ab3d3249c',
  '6960e3816150952ab3d3249d',
  '6960e3816150952ab3d3249e',
  '6960e3816150952ab3d3249f',
  '6960e3816150952ab3d324a0',
  '6960e3816150952ab3d324a1',
  '6960e3816150952ab3d324a2',
  '6960e3816150952ab3d324a3',
  '6960e3816150952ab3d324a4',
  '6960e3816150952ab3d324a5',
];
const targets = [
  776295, 593255, 611772, 548341, 496712, 569975, 447275, 353930, 389706, 283179, 318244, 277790, 110306, 807000,
  387088, 271055, 153987, 264967, 261700, 185121, 159332, 244445, 223776, 229080, 176031, 320626, 184339, 236296,
  158059, 125239, 159140, 128980, 118664, 138615, 210713, 154757, 159161, 158632, 186152, 148654, 137095, 142797,
  135209, 15824, 125546, 122118, 156730, 130713, 99561, 98457, 129715, 89049, 107210, 82711, 186532, 80427, 131534,
  212400, 91994, 97397, 99309, 100668, 100124, 95672, 59677, 71778, 95765, 78577, 107414, 115726, 104261, 68069, 76885,
  74347, 89663, 97910, 73564, 41747, 77615, 72038, 107628, 70335, 136049, 80610, 78032, 132711, 108630,
];
const modifiedTargets = [
  786000, 669000, 571000, 555000, 515000, 477000, 438000, 370000, 423000, 296000, 312000, 286000, 230000, 443000,
  273000, 265000, 245000, 268000, 256000, 227000, 202000, 228000, 201000, 207000, 166000, 226000, 167000, 175000,
  172000, 152000, 160000, 120000, 159000, 139000, 174000, 154000, 145000, 147000, 147000, 113000, 133000, 109000,
  128000, 119000, 122000, 117000, 125000, 121000, 100000, 112000, 107000, 94000, 117000, 89000, 124000, 96000, 123000,
  126000, 105000, 99000, 86000, 108000, 101000, 87000, 98000, 79000, 92000, 90000, 94000, 98000, 81000, 75000, 81000,
  84000, 98000, 78000, 83000, 85000, 79000, 92000, 77000, 114000, 80000, 75000, 89000, 86000,
];
const targetModifiedBy = [
  'CHHATRAPATI AUTOZ',
  'KRISHNA MARUTI CENTER AJMER',
  'MARWAR MARUTI',
  'DADA DARBAR MOTOR',
  'BEAWAR MOTORS',
  'BHARAT MOTORS',
  'RADHA KRISHNA AUTOMOBILE AND SERVICE',
  'KOHINOOR MOTORS',
  'GAJANAND ENTERPRISES',
  'JAIPUR AUTO CAR REPAIR MERTA CITY',
  'BALAJI TRADING AND MOTOR GARAGE  BHINMAL',
  'PARIHAR MOTORS REPARING',
  'R K Motor and Car Works',
  'MULCHAND DANTING PENTING',
  'MAA BALASHATI AUTOMOBILES PARBATSAR',
  'EKAM MOTORS KEKRI',
  'SHREE BALAJI MOTORS',
  'MAHALAXMI CAR CARE NAGAUR',
  'VARDHMAN AUTO MOBILE PALI',
  'RAMGARIYA AUTO MOBILE',
  'TANU SHREE MOTORS',
  'APNA AUTO MARUTI CARE AJMER',
  'KANCHAN SHREE MOTORS',
  'NEW P S MOTORS BALOTRA',
  'G N MOTOR PALI',
  '...',
]; // truncated, fill as needed
function randomDate2025() {
  const start = new Date(2025, 0, 1);
  const end = new Date(2025, 11, 31);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function generateIwMonthlyTargetData() {
  const data = [];
  for (let i = 0; i < 90; i++) {
    const isProduct = i < 45;
    const base = {
      iwId: iwMonthlyTargetIwIds[i % iwMonthlyTargetIwIds.length],
      iwCode: iwMonthlyTargetIwCodes[i % iwMonthlyTargetIwCodes.length],
      date: randomDate2025(),
      year: 2025,
      month: Math.floor(Math.random() * 12) + 1,
      target: targets[i % targets.length],
      modifiedTarget: modifiedTargets[i % modifiedTargets.length],
      targetModifiedBy: targetModifiedBy[i % targetModifiedBy.length],
      targetModifiedDate: randomDate2025(),
      isProduct,
      productGroupId: null,
      targetAchieved: targets[i % targets.length],
      productBenchmarkId: null,
    };
    if (isProduct) {
      base.productGroupId = productGroupIds[i % productGroupIds.length];
      base.productBenchmarkId = productBenchmarkIds[i % productBenchmarkIds.length];
      // For isProduct true, set target and modifiedTarget as per user
      const productTargets = [0, 22, 22, 22, 0, 22, 22, 22, 22];
      base.target = productTargets[i % productTargets.length];
      base.modifiedTarget = 0;
    }
    data.push(base);
  }
  return data;
}
async function seed() {
  try {
    await connect(env.db.DB_URL);
    // await iwCategoriesModel.insertMany(seedData);
    // await productsGroupModel.insertMany(generatePartGroupData(6));
    // await benchmarksModel.insertMany(generatePercentageTableData(1));
    // await zoneRegionMappingModel.insertMany(generateZoneDocuments());
    // await productsBenchmarkModel.insertMany(generateIWTargetFromBenchmark());
    // await iwMasterModel.insertMany(
    //   generateIWMasterData(generateDDTIWData(90), generateVisitData(90)),
    // );
    // await salesExecutivesModel.insertMany(generateSalesExecutivesData());
    await iwMonthlyTargetModel.insertMany(generateIwMonthlyTargetData());
    // eslint-disable-next-line no-console
    console.log('seeded data insert successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seed();
