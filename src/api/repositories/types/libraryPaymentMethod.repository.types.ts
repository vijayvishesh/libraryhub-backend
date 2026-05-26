import { PaymentMethodConfig, PaymentMethodType } from '../../models/libraryPaymentMethod.model';

export type LibraryPaymentMethodRecord = {
  id: string;
  libraryId: string;
  ownerId: string;
  methods: PaymentMethodConfig[];
  createdAt: Date;
  updatedAt: Date;
};

export type UpdatePaymentMethodInput = {
  type: PaymentMethodType;
  enabled: boolean;
  label?: string;
};

export type UpdateQrCodeInput = {
  type: PaymentMethodType;
  qrCodeUrl: string;
};