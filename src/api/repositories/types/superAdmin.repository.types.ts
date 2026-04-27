export type SuperAdminRecord = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateSuperAdminInput = {
  name: string;
  email: string;
  password: string;
};