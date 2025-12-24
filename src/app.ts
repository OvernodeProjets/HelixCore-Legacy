// ╳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╳
//      HelixCore Dashboard - Open Source Project by Overnode Projects
//      Repository: https://github.com/OvernodeProjets/HelixCore
//
//      © 2024 Overnode Projects. Licensed under the MIT License with
//      additional clauses for attribution and resale. See LICENSE.
// ╳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╳

import compression from "compression";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import expressWs from "express-ws";
import fs from "fs-extra";
import path from "path";
import AfkWebSocketHandler from "./handlers/afkWebSocket";
import { initPassport } from "./handlers/auth-config";
import prisma from "./handlers/prisma/prisma";
import PrismaStore from "./handlers/prisma/prismaStore";
import ServerWebSocketHandler from "./handlers/server/serverWebSocket";
import { trackPageView } from "./handlers/statsMiddleware";
import settings from "./storage/config.json";

const app = express();
expressWs(app);
const port = settings.website.port || 3000;

// View engine setup
app.set("views", path.join(__dirname, "./../views"));
//app.set('view cache', settings.website.NODE_ENV === 'production');
app.set("view engine", "ejs");
app.set("view options", {
  rmWhitespace: settings.website.NODE_ENV === "production",
  compileDebug: settings.website.NODE_ENV !== "production",
});

// Set static folder
app.use(
  express.static(path.join(__dirname, "public/"), {
    maxAge: "1d",
    etag: true,
    lastModified: true,
    immutable: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Rate limit window
  max: 100, // Max requests per windowMs
  standardHeaders: true, // Enable the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => req.path.startsWith("/public/"), // Skip rate limiting for static files
});

// Track page views
app.use(trackPageView);

// Trust proxy setting
app.set("trust proxy", 1);

// Middleware setup
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// Rate limiting
app.use(limiter);

// Session configuration
app.use(
  session({
    store: new PrismaStore({
      ttl: 24 * 60 * 60 * 1000,
      cleanupInterval: 60 * 60 * 1000,
    }),
    secret: settings.website.secret || Math.random().toString(36).slice(2),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: settings.discord.callbackURL.startsWith("https"),
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  })
);

// HelixCore headers
app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "1st Gen HelixCore");
  res.setHeader("X-HelixCore", 'v1.0.0 - "Aurora Nexus"');
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Passport initialization
initPassport(app);

// Compression middleware
app.use(compression());

/**
 * Loads all routes from the `src/routes` directory and registers them to the given express app.
 * @param app The express app to register the routes to.
 */
const loadRoutes = (app: express.Express) => {
  const routesDir = path.join(__dirname, "routes");
  console.time("Total routes loading time");

  fs.readdirSync(routesDir)
    .filter((file) => file.endsWith(".js") || file.endsWith(".ts"))
    .forEach((file) => {
      try {
        console.time(`Route ${file}`);
        const route = require(path.join(routesDir, file));
        if (route && route.default) {
          app.use("/", route.default);
        } else {
          console.warn(
            `The route file ${file} does not have a default export.`
          );
        }
        console.timeEnd(`Route ${file}`);
      } catch (error) {
        console.error(`Failed to load route ${file}:`, error);
      }
    });

  console.timeEnd("Total routes loading time");
};

// Load routes
loadRoutes(app);

// Initialize WebSocket handler
const wsHandler = new AfkWebSocketHandler();
wsHandler.initialize(app);

// Initialize Pterodactyl WebSocket handler
const ServerWebSocket = new ServerWebSocketHandler();
ServerWebSocket.initialize(app);

// Initialize Settings
(async () => {
  /*
   * Initialize coins
   */
  const coins = await prisma.settingsAdmin.findMany({
    where: { name: "user_coins" },
  });
  if (coins.length === 0) {
    await prisma.settingsAdmin.createMany({
      data: [
        {
          name: "user_coins",
          value: "50",
        },
      ],
    });
  }
  /*
   * Initialize resources
   */
  const resources = await prisma.settingsAdmin.findMany({
    where: { name: "resources" },
  });
  if (resources.length === 0) {
    const resourcesValue = JSON.stringify({
      cpu: 100,
      ram: 1024,
      disk: 1024,
      backup: 0,
      database: 0,
      allocation: 0,
      servers: 1,
    });

    await prisma.settingsAdmin.createMany({
      data: [
        {
          name: "resources",
          value: resourcesValue,
        },
      ],
    });
  }
})();

// 404
app.use((req: Request, res: Response) => {
  res.status(404).render("404");
});

// 500
app.use((err: any, req: Request, res: Response) => {
  console.error(err.stack);
  res.status(500).render("500", { error: err.message });
});

// Start the server
app.listen(port, async () => {
  console.log(`Server is running on http://localhost:${port}`);
});
