import { ErrorData } from '../../api/controllers/responses/auth.response';

type PasswordRule = {
  code: string;
  message: string;
  validate: (password: string) => boolean;
};

const PASSWORD_RULES: PasswordRule[] = [
  {
    code: 'PASSWORD_MIN_LENGTH',
    message: 'Password must be at least 8 characters long',
    validate: (password) => password.length >= 8,
  },
  {
    code: 'PASSWORD_MAX_LENGTH',
    message: 'Password must be at most 64 characters long',
    validate: (password) => password.length <= 64,
  },
  {
    code: 'PASSWORD_UPPERCASE',
    message: 'Password must include at least one uppercase letter',
    validate: (password) => /[A-Z]/.test(password),
  },
  {
    code: 'PASSWORD_LOWERCASE',
    message: 'Password must include at least one lowercase letter',
    validate: (password) => /[a-z]/.test(password),
  },
  {
    code: 'PASSWORD_NUMBER',
    message: 'Password must include at least one number',
    validate: (password) => /\d/.test(password),
  },
  {
    code: 'PASSWORD_SPECIAL_CHARACTER',
    message: 'Password must include at least one special character',
    validate: (password) => /[^A-Za-z0-9]/.test(password),
  },
  {
    code: 'PASSWORD_SPACE',
    message: 'Password must not contain spaces',
    validate: (password) => !/\s/.test(password),
  },
];

export class PasswordStrengthComponent {
  static validate(password: string): ErrorData[] {
    return PASSWORD_RULES.filter((rule) => !rule.validate(password)).map((rule) => ({
      errorCode: rule.code,
      errorMessage: rule.message,
    }));
  }
}
