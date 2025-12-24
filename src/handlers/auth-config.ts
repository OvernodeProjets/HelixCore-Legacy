import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Express } from "express";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import { Strategy as LocalStrategy } from "passport-local";
import Manager from "../handlers/manager";
import settings from "../storage/config.json";
import prisma from "./prisma/prisma";
import { IUser } from "./user";

const manager = new Manager();

const DEFAULT_RESOURCES = {
  cpu: 0,
  ram: 0,
  disk: 0,
  backup: 0,
  database: 0,
  allocation: 0,
  servers: 0,
};

function generateSecurePassword(length = 12): string {
  return crypto.randomBytes(length / 2).toString("hex");
}

function logAuthError(error: unknown, context?: string): void {
  console.error(
    `Authentication Error ${context ? `in ${context}` : ""}:`,
    error instanceof Error ? error.message : String(error)
  );
}

export function initPassport(app: Express) {
  app.use(passport.initialize());
  app.use(passport.session());

  // Discord Strategy
  passport.use(
    new DiscordStrategy(
      {
        clientID: settings.discord.clientID,
        clientSecret: settings.discord.clientSecret,
        callbackURL: settings.discord.callbackURL,
        scope: ["identify", "email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          if (!profile.email || !profile.username || !profile.id) {
            return done(null, false, {
              message: "Invalid profile data ",
            });
          }

          const [userFromPterodactyl, coinsData, resourcesData] =
            await Promise.all([
              manager.getUsersFromPterodactyl(profile.email),
              prisma.settingsAdmin.findFirst({
                where: { name: "user_coins" },
                select: { value: true },
              }),
              prisma.settingsAdmin.findFirst({
                where: { name: "resources" },
                select: { value: true },
              }),
            ]);

          const password = generateSecurePassword();

          let pterodactylUserId: string | null = null;
          if (userFromPterodactyl.data && userFromPterodactyl.data.length > 0) {
            pterodactylUserId = userFromPterodactyl.data[0].attributes.id;
          } else {
            try {
              const newUser: any = await manager.createUser({
                email: profile.email,
                username: profile.username,
                first_name: profile.username,
                last_name: profile.username,
                password: password,
              });

              if (newUser.status === 201) {
                console.log(newUser.data.attributes.id);
                pterodactylUserId = newUser.data.attributes.id;
                console.log(pterodactylUserId);
                console.log(newUser.data.attributes);
              }
            } catch (createError) {
              logAuthError(createError, "Pterodactyl user creation");
            }
          }

          // Fallback for resources and coins
          const coins = parseInt(coinsData?.value ?? "0", 10);
          const resourcesValue = resourcesData
            ? JSON.parse(resourcesData.value)
            : DEFAULT_RESOURCES;

          const pterodactylIDD = pterodactylUserId?.toString() ?? null;

          // Upsert user with comprehensive error handling
          let user = await prisma.user.upsert({
            where: { email: profile.email },
            update: {
              avatar: profile.avatar,
              pterodactylId: pterodactylIDD,
            },
            create: {
              email: profile.email,
              username: profile.username,
              password,
              avatar: profile.avatar,
              admin: false,
              provider: "discord",
              discord_id: profile.id,
              pterodactylId: pterodactylIDD,
              coins,
              resources: {
                create: {
                  cpu: resourcesValue.cpu,
                  ram: resourcesValue.ram,
                  disk: resourcesValue.disk,
                  backup: resourcesValue.backup,
                  database: resourcesValue.database,
                  allocation: resourcesValue.allocation,
                  servers: resourcesValue.servers,
                },
              },
            },
            include: { resources: true },
          });

          const user2: any = await manager.getUsersFromPterodactyl(
            profile.email
          );

          const pterodactylId = user2.data[0].attributes.id.toString();

          await prisma.user.update({
            where: { email: profile.email },
            data: {
              pterodactylId: pterodactylId,
            },
          });

          return done(null, formatUserData(user));
        } catch (error) {
          logAuthError(error, "Discord Authentication");
          return done(
            error instanceof Error ? error : new Error("Authentication failed")
          );
        }
      }
    )
  );

  // Local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) return done(null, false, { message: "User not found" });

          if (!user.password) {
            return done(null, false, { message: "Invalid user credentials" });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch)
            return done(null, false, { message: "Incorrect password" });

          return done(null, formatUserData(user));
        } catch (error) {
          logAuthError(error, "Local Authentication");
          return done(error);
        }
      }
    )
  );

  // Serialization and deserialization
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: { resources: true },
      });

      if (!user) {
        return done(new Error("User not found"));
      }

      done(null, formatUserData(user));
    } catch (error) {
      logAuthError(error, "User Deserialization");
      done(error);
    }
  });
}

function formatUserData(user: any): IUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    password: user.password,
    admin: user.admin,
    discord_id: user.discord_id,
    provider: user.provider,
    pterodactylId: user.pterodactylId,
    coins: user.coins,
    resources: {
      cpu: user.resources?.cpu ?? 0,
      ram: user.resources?.ram ?? 0,
      disk: user.resources?.disk ?? 0,
      backup: user.resources?.backup ?? 0,
      database: user.resources?.database ?? 0,
      allocation: user.resources?.allocation ?? 0,
      servers: user.resources?.servers ?? 0,
    },
  };
}
