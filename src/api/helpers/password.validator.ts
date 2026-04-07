import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function isStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') {
            return false;
          }

          // Password strength requirements
          const minLength = 8;
          const hasUpperCase = /[A-Z]/.test(value);
          const hasLowerCase = /[a-z]/.test(value);
          const hasNumbers = /\d/.test(value);
          const hasNonalphas = /\W/.test(value);

          return value.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character`;
        },
      },
    });
  };
}
