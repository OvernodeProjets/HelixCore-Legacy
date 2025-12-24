import { Request, Response, Router } from "express";
import { isAuthenticated } from "../handlers/isAuthenticated";
import Manager from "../handlers/manager";
import { IUser } from "../handlers/user";
import settings from "../storage/config.json";

const router = Router();
const manager = new Manager();

router.get(
  "/server/:id/control",
  isAuthenticated,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user as IUser;

    const getServer = await manager.getServer(user.email);

    if (!getServer || getServer.length === 0) {
      res.status(404).redirect("/");
      return;
    }

    const server = getServer.find((server: any) => server.attributes.id === id);
    if (!server) {
      res.status(404).send("Server not found");
      return;
    }

    if (server.attributes.user !== user.pterodactylId)
      return res.redirect("../servers");

    const getResourcesServer: any = await manager.getResourcesServer(
      server.attributes.identifier
    );

    if (!getResourcesServer) {
      res.status(500).send("Failed to retrieve server resources");
      return;
    }

    res.render("server/server", {
      user,
      name: settings.website.name,
      url: manager.provider.url,
      resources: getResourcesServer.attributes,
      serverId: server.attributes.identifier,
    });
  }
);

router.post(
  "/api/server/:identifier/:action",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { identifier, action } = req.params;
      const user = req.user as IUser;

      if (!user?.email) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const getServer = await manager.getServer(user.email);

      if (!getServer || getServer.length === 0) {
        res.status(404).redirect("/");
        return;
      }

      const server = getServer.find(
        (server: any) => server.attributes.identifier === identifier
      );

      if (!server) {
        res.status(404).send("Server not found");
        return;
      }

      if (server.attributes.user !== user.pterodactylId?.toString())
        return res.redirect("../servers");

      await manager.controlServer(identifier, action, user.email);
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Error controlling server:", error);
      res.status(500).json({
        error: error.message || "Failed to control server",
      });
    }
  }
);

router.get(
  "/api/server/:identifier/status",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { identifier } = req.params;
      const user = req.user as IUser;

      if (!user?.email) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const getServer = await manager.getServer(user.email);

      if (!getServer || getServer.length === 0) {
        res.status(404).redirect("/");
        return;
      }

      const server = getServer.find(
        (server: any) => server.attributes.identifier === identifier
      );

      if (!server) {
        res.status(404).send("Server not found");
        return;
      }

      if (server.attributes.user !== user.pterodactylId)
        return res.redirect("../servers");

      const status: any = await manager.getResourcesServer(
        server.attributes.identifier
      );
      if (!status) {
        res.status(500).json({ error: "Failed to retrieve server resources" });
        return;
      }

      if (!status.attributes || !status.attributes.current_state) {
        status.attributes.current_state = "Installing";
      }

      res
        .status(200)
        .json({ success: true, status: status.attributes.current_state });
    } catch (error: any) {
      console.error("Error controlling server:", error);
      res.status(500).json({
        error: error.message || "Failed to control server",
      });
    }
  }
);

export default router;
