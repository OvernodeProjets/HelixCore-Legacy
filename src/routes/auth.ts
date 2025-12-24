import bcrypt from "bcryptjs";
import { Request, Response, Router } from "express";
import passport from "passport";
import { isAuthenticated } from "../handlers/isAuthenticated";
import Manager from "../handlers/manager";
import prisma from "../handlers/prisma/prisma";
import { IUser } from "../handlers/user";

const router = Router();
const manager = new Manager();

router.get("/", (req: Request, res: Response) => {
  res.render("auth/index", { title: "Home" });
});

// Discord Authentication
router.get("/auth/discord", passport.authenticate("discord"));
router.get(
  "/auth/discord/callback",
  passport.authenticate("discord", {
    successRedirect: "/dashboard",
    failureRedirect: "/",
  })
);

router.get("/auth/register", (req: Request, res: Response) => {
  res.render("auth/register", { title: "Register" });
});

// Local Authentication
router.post("/auth/register", async (req: Request, res: Response) => {
  if (!req.body.email || !req.body.password || !req.body.username) {
    return res.redirect("/auth/register");
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        email: req.body.email,
      },
    });

    if (user) {
      return res.status(400).render("auth/register", {
        title: "Register",
        error: "Email already registered",
      });
    }

    const [coinsData, resourcesData] = await Promise.all([
      prisma.settingsAdmin.findFirst({
        where: { name: "user_coins" },
        select: { value: true },
      }),
      prisma.settingsAdmin.findFirst({
        where: { name: "resources" },
        select: { value: true },
      }),
    ]);

    const encryptedPassword = await bcrypt.hash(req.body.password, 10);
    const resourcesValue = JSON.parse(resourcesData!.value);

    const coins = parseInt(coinsData?.value ?? "0", 10);

    await manager.createUser({
      username: req.body.username,
      email: req.body.email,
      first_name: req.body.username,
      last_name: req.body.username,
      password: encryptedPassword,
    });

    const user2 = await manager.getUsersFromPterodactyl(req.body.email);

    await prisma.user.create({
      data: {
        email: req.body.email,
        username: req.body.username,
        password: encryptedPassword,
        admin: false,
        coins,
        provider: "local",
        pterodactylId: user2.data[0].attributes.id.toString(),
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
    });

    res.redirect("/");
  } catch (error) {
    console.error("Error registering user:", error);
    return res.redirect("/auth/register");
  }
});

router.post(
  "/auth/login",
  passport.authenticate("local"),
  async (req: Request, res: Response) => {
    res.redirect("/dashboard");
  }
);

router.get(
  "/auth/reset-password",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const user = req.user as IUser;

      if (!user || !user.email) return res.status(401).redirect("/");

      const userData = await prisma.user.findUnique({
        where: {
          email: user.email,
        },
      });

      const newPassword = Math.random().toString(36).slice(-10);
      await manager.updateUserPassword(userData, newPassword);

      res.status(200).json({ success: true, newPassword });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.redirect("/dashboard");
    }
  }
);

router.get(
  "/auth/logout",
  isAuthenticated,
  (req: Request, res: Response, next: any) => {
    if (!req.user) return res.redirect("/");
    req.logout((err) => {
      if (err) return next(err);
      res.redirect("/");
    });
  }
);

router.get("/auth/delete-account", isAuthenticated, async (req, res) => {
  try {
    const user = req.user as IUser;

    await prisma.resources.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await prisma.server.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });

    await manager.deleteUser(user);

    req.logout((err) => {
      if (err) {
        console.error("Error during logout:", err);
        return res.status(500).json({ error: "Error during logout" });
      }
      res.redirect("/");
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ error: "Error deleting account" });
  }
});

export default router;
