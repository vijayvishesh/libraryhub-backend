import { IsIn, IsOptional, IsString } from 'class-validator';
import { LIBRARY_SLOT_TYPE_ENUM } from '../../constants/library.constants';

export class OwnerDashboardQueryRequest {
  @IsOptional()
  @IsString()
  @IsIn([...LIBRARY_SLOT_TYPE_ENUM])
  slotId?: string;
}
