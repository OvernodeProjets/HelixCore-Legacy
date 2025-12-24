import express, { Request, Response } from "express";
import { isAuthenticated } from "../handlers/isAuthenticated";
import Manager from "../handlers/manager";
import { IUser } from "../handlers/user";
import settings from "../storage/config.json";

const manager = new Manager();
const router = express.Router();

router.get("/store", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;

    if (!user || !user.email) return res.status(401).redirect("/");

    const servers = await manager.getServer(user.email);

    const historys = await manager.getHistory(user.id);

    res.render("store", {
      user,
      name: settings.website.name,
      url: manager.provider.url,
      servers,
      historys,
    });
  } catch (error) {
    console.error("Error loading store page:", error);
    res.status(500).redirect("/");
  }
});

export default router;
