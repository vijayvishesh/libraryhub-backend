export interface SendMailOptions {
  to: string | string[];
  subject: string;
  template?: string; // template file name (without path)
  variables?: Record<string, unknown>; // variables to replace in template
  html?: string;
  text?: string;
  from?: string;
}
