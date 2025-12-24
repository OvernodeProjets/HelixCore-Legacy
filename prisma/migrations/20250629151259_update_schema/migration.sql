-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PageView" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "userId" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ip" TEXT
);
INSERT INTO "new_PageView" ("id", "ip", "path", "timestamp", "userAgent", "userId") SELECT "id", "ip", "path", "timestamp", "userAgent", "userId" FROM "PageView";
DROP TABLE "PageView";
ALTER TABLE "new_PageView" RENAME TO "PageView";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discord_id" TEXT,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "avatar" TEXT,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "pterodactylId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("admin", "avatar", "coins", "createdAt", "discord_id", "email", "id", "password", "provider", "pterodactylId", "updatedAt", "username") SELECT "admin", "avatar", "coins", "createdAt", "discord_id", "email", "id", "password", "provider", "pterodactylId", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "new_UserActivity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_UserActivity" ("action", "id", "timestamp", "userId") SELECT "action", "id", "timestamp", "userId" FROM "UserActivity";
DROP TABLE "UserActivity";
ALTER TABLE "new_UserActivity" RENAME TO "UserActivity";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
