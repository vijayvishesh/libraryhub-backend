import { PaymentMethodConfig, PaymentMethodType } from '../../models/libraryPaymentMethod.model';

export type LibraryPaymentMethodResult = {
  id: string;
  libraryId: string;
  methods: PaymentMethodConfig[];
};

export type UpdatePaymentMethodsPayload = {
  type: PaymentMethodType;
  enabled: boolean;
  label?: string;
}[];