import { LibrarySetupData } from '../../controllers/responses/library.response';

export type ListedLibrariesResult = {
  libraries: LibrarySetupData[];
  page: number;
  limit: number;
  total: number;
};
