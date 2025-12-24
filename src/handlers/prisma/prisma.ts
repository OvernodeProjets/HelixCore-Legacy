import { PrismaClient } from "@prisma/client";
import path from "path";
import settings from "../../storage/config.json";

const prisma = new PrismaClient({
  log: ["error"],
  datasources: {
    db: {
      url:
        settings.database?.url ||
        `file:${path.join(__dirname, "../../src/storage/database.db")}`,
    },
  },
});

export default prisma;
