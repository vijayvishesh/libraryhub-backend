import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { TimetableDay } from '../../models/studyTimetable.model';

const VALID_DAYS: TimetableDay[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

function RequiredIfEnabled(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'requiredIfEnabled',
      target: (object as any).constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          if (obj.enabled === true) {
            return value !== undefined && value !== null;
          }
          return true;
        },
        defaultMessage() {
          return 'minutesBefore is required when reminder is enabled';
        },
      },
    });
  };
}

export class ReminderRequest {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  @RequiredIfEnabled()
  minutesBefore?: number;
}

export class SubjectRequest {
  @IsString()
  @IsNotEmpty()
  subjectName!: string;

  @IsArray()
  @IsIn(VALID_DAYS, { each: true })
  days!: TimetableDay[];

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be in HH:mm format e.g. 09:00' })
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be in HH:mm format e.g. 11:00' })
  endTime!: string;

  @IsHexColor()
  color!: string;

  @ValidateNested()
  @Type(() => ReminderRequest)
  reminder!: ReminderRequest;
}

export class CreateStudyTimetableRequest {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectRequest)
  subjects!: SubjectRequest[];
}

export class UpdateStudyTimetableRequest {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectRequest)
  subjects?: SubjectRequest[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}