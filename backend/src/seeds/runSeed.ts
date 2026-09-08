import { prisma } from '../db.js';
import { runSeed } from './seedContent.js';

async function main() {
  await runSeed(prisma as unknown as Parameters<typeof runSeed>[0]);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
