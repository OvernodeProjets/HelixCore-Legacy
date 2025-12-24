import axios from "axios";
import { Request, Response, Router } from "express";
import { isAuthenticated } from "../handlers/isAuthenticated";
import Manager from "../handlers/manager";
import { IUser } from "../handlers/user";
import settings from "../storage/config.json";

const router = Router();
const manager = new Manager();

router.get(
  "/dashboard",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const user = req.user as IUser;
      if (!user?.email) return res.status(401).redirect("/");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const [servers, max, existing] = await Promise.all(
        [
          manager.getServer(user.email),
          manager.getMaxResources(user.email),
          manager.getUsedResources(user.email),
        ].map((p) =>
          p.catch((e) => {
            console.error(e);
            return null;
          })
        )
      );

      clearTimeout(timeout);

      if (!servers || !max || !existing) {
        throw new Error("Failed to fetch required data");
      }

      res.render("dashboard", {
        name: settings.website.name,
        user,
        servers,
        url: manager.provider.url,
        max,
        existing,
      });
    } catch (error) {
      console.error("Error fetching servers:", error);
      res.status(500).send("Error fetching data from provider.");
    }
  }
);

router.get("/terms", (req: Request, res: Response) => {
  res.render("terms");
});

router.get(
  "/autologin",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const user = req.user as IUser;

      if (!user?.email || !user?.password) {
        res.status(401).json({ error: "Missing credentials" });
        return;
      }

      if (user.provider === "local") {
        res.status(401).json({ error: "Local users cannot use auto-login" });
        return;
      }

      const loginUrl = `${
        settings.provider.url
      }/auth/auto-login?email=${encodeURIComponent(
        user.email
      )}&password=${encodeURIComponent(user.password)}`;

      res.redirect(loginUrl);
      // return res.json({ redirectUrl: loginUrl });
    } catch (error) {
      console.error("Error during auto-login:", error);
      res.status(500).json({ error: "Error during auto-login" });
      return;
    }
  }
);

router.get("/panel", isAuthenticated, async (req: Request, res: Response) => {
  res.redirect(`${manager.provider.url}/`);
});

router.get(
  "/credentials",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const user = req.user as IUser;

      if (!user || !user.email) return res.status(401).redirect("/");

      const servers = await manager.getServer(user.email);

      if (!servers || servers.length === 0) {
        return res.render("credentials", {
          user,
          name: settings.website.name,
          url: manager.provider.url,
          password: null,
          servers,
        });
      }

      //https://pterodactyl.file.properties/api/client/servers/1a7ce997
      const serversDetails = (
        await axios.get(
          `${manager.provider.url}/api/client/servers/${servers[0].attributes.identifier}`,
          {
            headers: {
              Authorization: `Bearer ${manager.provider.client_key}`,
              Accept: "application/json",
            },
          }
        )
      ).data;
      res.render("credentials", {
        user,
        name: settings.website.name,
        url: manager.provider.url,
        password: null,
        servers,
        serversDetails,
      });
    } catch (error) {
      console.error("Error fetching credentials:", error);
      res.status(500).json({ error: "Error fetching credentials" });
      return;
    }
  }
);

export default router;
