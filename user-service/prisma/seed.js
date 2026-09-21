require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const required = [
     'DATABASE_URL',
     'CARGOFLOW_ADMIN_EMAIL',
     'CARGOFLOW_ADMIN_PASSWORD',
     'CARGOFLOW_ADMIN_FIRST_NAME',
     'CARGOFLOW_ADMIN_LAST_NAME',
];

const missing = required.filter(key => !process.env[key]);
if (missing.length) {
     throw new Error(`Missing required Admin seed environment variables: ${missing.join(', ')}`);
}

const prisma = new PrismaClient({
     adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
     const email = process.env.CARGOFLOW_ADMIN_EMAIL.trim().toLowerCase();
     const password = await bcrypt.hash(process.env.CARGOFLOW_ADMIN_PASSWORD, 12);
     const user = await prisma.user.upsert({
          where: { email },
          update: {
               firstName: process.env.CARGOFLOW_ADMIN_FIRST_NAME.trim(),
               lastName: process.env.CARGOFLOW_ADMIN_LAST_NAME.trim(),
               password,
               emailVerified: true,
               role: 'ADMIN',
          },
          create: {
               email,
               firstName: process.env.CARGOFLOW_ADMIN_FIRST_NAME.trim(),
               lastName: process.env.CARGOFLOW_ADMIN_LAST_NAME.trim(),
               password,
               emailVerified: true,
               role: 'ADMIN',
          },
          select: { id: true, email: true, role: true },
     });
     console.log(`CargoFlow Admin ready: ${user.email} (${user.id})`);
}

main()
     .catch(error => {
          console.error(`Admin seed failed: ${error.message}`);
          process.exitCode = 1;
     })
     .finally(() => prisma.$disconnect());
