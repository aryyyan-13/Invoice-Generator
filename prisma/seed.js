import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Seed Companies
  const companies = [
    {
      code: 'AVIONAUTICS',
      displayName: 'Avionautics',
      billingAddress: `B/414 Siddharth Bunglows, Near Rhythm Hospital,
Vadodara, Gujarat – 390022 Gujarat (INDIA)
M. No: - +91 8000218910 Email ID: - avionautics2021@gmail.com`,
      gstin: '24EVRPS3137L1ZW', // Gujarat (24)
      logoPath: '/logos/Avionautics_logo.svg',
      themePrimary: '#761E1D',
      themeSecondary: '#FFFFFF',
      themeAccent: '#E2E8F0',
      accountName: 'Avionautics Private Limited',
      accountNo: '72460200001398',
      ifsc: 'BARB0DBHALO',
      bankName: 'Bank of Baroda',
      upiId: 'grm.prashants-2@okaxis',
      invoicePrefix: 'AV',
    },
    {
      code: 'GMP',
      displayName: 'GMP International',
      billingAddress: 'Block C-2, Industrial Area Phase II, Noida, Uttar Pradesh - 201305',
      gstin: '09GQUPS9619M1ZC',
      logoPath: '/logos/GMP_logo.svg',
      themePrimary: '#000000',
      themeSecondary: '#FFFFFF',
      themeAccent: '#F3F4F6',
      accountName: 'GMP International Ltd.',
      accountNo: '004205001234',
      ifsc: 'ICIC0000042',
      bankName: 'ICICI Bank',
      upiId: 'gmpintl@icici',
      invoicePrefix: 'GMP',
    }
  ];

  for (const company of companies) {
    await prisma.company.upsert({
      where: { code: company.code },
      update: company,
      create: company
    });
    console.log(`Seeded company: ${company.displayName}`);
  }

  // 2. Seed common India HSN codes
  const hsnData = [
    { hsnCode: '84713010', taxRate: 18.0, description: 'Personal Computers / Laptops' },
    { hsnCode: '85171300', taxRate: 18.0, description: 'Smartphones' },
    { hsnCode: '85044090', taxRate: 18.0, description: 'Static Converters, Adapters, UPS' },
    { hsnCode: '90189099', taxRate: 12.0, description: 'Medical and Surgical Instruments' },
    { hsnCode: '30049099', taxRate: 12.0, description: 'Medicaments for Therapeutic Uses' },
    { hsnCode: '48201010', taxRate: 18.0, description: 'Registers, Notebooks, Account Books' },
    { hsnCode: '49011010', taxRate: 0.0, description: 'Printed Books, Brochures, Leaflets' },
    { hsnCode: '62034200', taxRate: 5.0, description: 'Mens Cotton Trousers, Breeches' }
  ];

  for (const hsn of hsnData) {
    await prisma.hsnDirectory.upsert({
      where: { hsnCode: hsn.hsnCode },
      update: hsn,
      create: hsn
    });
  }
  console.log(`Seeded ${hsnData.length} HSN codes.`);

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
