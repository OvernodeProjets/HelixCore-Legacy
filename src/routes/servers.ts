import axios from "axios";
import { Request, Response, Router } from "express";
import { isAuthenticated } from "../handlers/isAuthenticated";
import Manager from "../handlers/manager";
import { validateServerCreation } from "../handlers/server/serverValidation";
import { IUser } from "../handlers/user";
import settings from "../storage/config.json";
import eggs from "../storage/eggs.json";
import locations from "../storage/locations.json";
import serverTypes from "../storage/serverTypes.json";

const router = Router();
const manager = new Manager();

router.get("/servers", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;

    if (!user?.email) return res.status(401).redirect("/");

    const [servers, max, existing] = await Promise.all([
      manager.getServer(user.email),
      manager.getMaxResources(user.email),
      manager.getUsedResources(user.email),
    ]);

    if (!servers || servers.length === 0) {
      return res.render("servers", {
        name: settings.website.name,
        user,
        servers: [],
        url: manager.provider.url,
        max,
        existing,
      });
    }

    const serversWithDetails = await Promise.all(
      servers.map(async (server: any) => {
        try {
          const serverDetails = await axios.get<{ attributes: any }>(
            `${manager.provider.url}/api/client/servers/${server.attributes.identifier}`,
            {
              headers: {
                Authorization: `Bearer ${manager.provider.client_key}`,
                Accept: "application/json",
              },
            }
          );

          if (
            !serverDetails.data ||
            !serverDetails.data.attributes ||
            !serverDetails.data.attributes.name
          ) {
            console.error(
              `Invalid server data for ${server.attributes.identifier}:`,
              serverDetails.data
            );
            return null;
          }

          const status: any = await manager.getResourcesServer(
            server.attributes.identifier
          );
          if (!status) {
            return null;
          }

          if (!status.attributes || !status.attributes.current_state) {
            status.attributes.current_state = "Installing";
            serverDetails.data.attributes.relationships.allocations.data[0].attributes.ip =
              "IP not available";
            serverDetails.data.attributes.relationships.allocations.data[0].attributes.port =
              "Port not available";
          }
          console.log(serverDetails);
          return {
            identifier: server.attributes.identifier,
            locations:
              server.attributes.container.environment.P_SERVER_LOCATION,
            name: serverDetails.data.attributes.name,
            status: status.attributes.current_state || "unknown",
            resources: serverDetails.data.attributes.limits || {},
            allocationDetails: serverDetails.data.attributes.relationships,
            id: server.attributes.id,
          };
        } catch (error) {
          console.error(
            `Error fetching details for server ${server.attributes.identifier}:`,
            error
          );
          return null;
        }
      })
    );

    const validServers = serversWithDetails.filter((server) => server !== null);

    res.render("servers", {
      name: settings.website.name,
      user,
      servers: validServers,
      url: manager.provider.url,
      max,
      existing,
    });
  } catch (error) {
    console.error("Error retrieving servers:", error);
    res.status(500).render("error", {
      name: settings.website.name,
      error: "Error retrieving servers",
    });
  }
});

router.get(
  "/create-server",
  isAuthenticated,
  async (req: Request, res: Response) => {
    const user = req.user as IUser;

    const [max, existing] = await Promise.all([
      manager.getMaxResources(user.email),
      manager.getUsedResources(user.email),
    ]);

    const canCreateServer =
      existing.ram < max.ram &&
      existing.cpu < max.cpu &&
      existing.disk < max.disk &&
      existing.servers < max.servers;

    res.render("create-server", {
      user,
      userResources: { max, existing },
      name: settings.website.name,
      locations,
      serverTypes,
      eggs,
      canCreateServer,
    });
  }
);

router.post(
  "/api/servers/create",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { estimatedCost, location, name, type, egg } = req.body;

      if (!location || !name || !type || !egg) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const user = req.user as IUser;

      if (!user?.email) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const maxServers = await manager.getMaxResources(user.email);
      const usedServers = await manager.getUsedResources(user.email);

      if (usedServers.servers >= maxServers.servers) {
        res
          .status(403)
          .json({ error: "You have reached the maximum number of servers" });
        return;
      }

      const locationData = locations.find((l) => l.id === location);
      const typeData = serverTypes.find((t) => t.id === type);
      const eggData = eggs.find((e) => e.id === parseInt(egg));

      if (!locationData || !typeData || !eggData) {
        res.status(400).json({ error: "Invalid location, type or egg" });
        return;
      }

      const ram = typeData.ram;
      const disk = typeData.disk;
      const cpu = typeData.cpu;
      const backup = typeData.backup;
      const database = typeData.database;
      const allocation = typeData.allocation;

      const validationResult = await validateServerCreation({
        user,
        serverData: { name, ram, disk, cpu, backup, database, allocation },
        manager,
      });

      if (!validationResult.success) {
        res.status(403).json({ error: validationResult.message });
        return;
      }

      const server = {
        name,
        user: user.pterodactylId?.toString(),
        egg_id: eggData.id,
        docker_image: eggData.docker_image,
        startup: eggData.startup,
        environment: eggData.environment,
        memory: (ram * 1024).toString(),
        swap: 0,
        disk: (disk * 1024).toString(),
        io: 500,
        cpu: cpu.toString(),
        backups: backup.toString(),
        databases: database.toString(),
        location_id: locationData.idPterodactyl,
      };

      await manager.removeCoins(user.email, estimatedCost);

      const createdServer: any = await manager.createServer(server);

      if (createdServer?.data?.attributes?.id) {
        res.status(200).json({
          success: true,
          serverId: createdServer.data.attributes.id,
        });
        return;
      }

      throw new Error("Server creation failed");
    } catch (error) {
      console.error("Error creating server:", error);
      res.status(500).json({ error: "Failed to create server" });
    }
  }
);

router.get(
  "/delete-server/:id",
  isAuthenticated,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) return res.redirect("/servers");

    const user = req.user as IUser;
    manager.deleteServer(id, user.email);
    res.redirect("/servers");
  }
);

export default router;
