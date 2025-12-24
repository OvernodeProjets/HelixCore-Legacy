import { Request, Response, Router } from "express";
import { isAdmin } from "../handlers/isAuthenticated";
import prisma from "../handlers/prisma/prisma";
import { IUser } from "../handlers/user";
import settings from "../storage/config.json";

const router = Router();

router.get("/admin", isAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;

    const [userCount, serverCount, resourceCount, pageViewCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.server.count(),
        prisma.resources.count(),
        prisma.pageView.count(),
      ]);

    res.render("admin/index", {
      name: settings.website.name,
      user,
      userCount,
      serverCount,
      resourceCount,
      pageViewCount,
    });
  } catch (error) {
    console.error("Error loading admin dashboard:", error);
    res.status(500).send("Error loading admin dashboard");
  }
});

export default router;
