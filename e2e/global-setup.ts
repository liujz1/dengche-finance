import { execFileSync } from "node:child_process";

export default async function globalSetup() {
  execFileSync("node", ["--import", "tsx", "prisma/seed.ts"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}
