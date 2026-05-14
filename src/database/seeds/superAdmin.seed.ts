import * as bcrypt from 'bcrypt';
import { SuperAdminModel } from '../../api/models/superAdmin.model';
import { getDataSource } from '../config/ormconfig.default';

const SUPER_ADMINS = [
  {
    name: 'Super Admin',
    email: 'admin@libraryservice.com',
    password: 'Admin@1234',
  },
];

export const seedSuperAdmins = async (): Promise<void> => {
  try {
    const repo = getDataSource().getMongoRepository(SuperAdminModel);

    for (const admin of SUPER_ADMINS) {
      const existing = await repo.findOne({
        where: { email: admin.email } as any,
      });

      if (existing) {
        console.error(`⏭️ Super admin already exists: ${admin.email}`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(admin.password, 10);
      const now = new Date();
      const model = repo.create({
        name: admin.name,
        email: admin.email,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await repo.save(model);
      console.error(`Super admin seeded: ${admin.email}`);
    }
  } catch (error) {
    console.error('Super admin seed failed:', error);
  }
};
