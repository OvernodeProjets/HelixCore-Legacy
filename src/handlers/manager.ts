import axios from "axios";
import settings from "../storage/config.json";
import prisma from "./prisma/prisma";
import { PterodactylClient } from "./pterodactyl/pterodactyl";

interface PterodactylResponse {
  data: {
    attributes: {
      relationships: {
        servers: {
          data: any[];
        };
      };
    };
  }[];
}

class Manager {
  public provider = {
    url: settings.provider.url,
    key: settings.provider.key,
    client_key: settings.provider.client_key,
  };

  private pterodactyl = new PterodactylClient(
    this.provider.key,
    this.provider.client_key,
    this.provider.url
  );

  /**
   * Retrieves the total resources for a given user.
   * @param email The email address of the user.
   * @param resource The name of the resource to retrieve (e.g. cpu, ram, disk, etc.).
   * @param isFeatureLimit If true, will retrieve the feature limits instead of the normal limits.
   * @returns The total resources for the user, or 0 if the user is not found or an error occurs.
   * @throws {Error} If there is an error retrieving the server data.
   */
  async getResources(
    email: string,
    resource: string,
    isFeatureLimit = false
  ): Promise<number> {
    try {
      const servers = await this.getServer(email);
      const totalResources = servers.reduce((prev: number, server: any) => {
        if (resource === "servers") return prev + 1;
        const limits = isFeatureLimit
          ? server.attributes.feature_limits
          : server.attributes.limits;
        return prev + (limits[resource] || 0);
      }, 0);
      return totalResources;
    } catch (error) {
      console.error(`Error retrieving server data for ${email}:`, error);
      throw new Error("Error retrieving server data");
    }
  }

  /**
   * Retrieves a user from the database, given their email address.
   * @param email The email address of the user to retrieve.
   * @returns The user object, or null if the user is not found.
   * @throws {Error} If there is a database error.
   */
  async getUser(email: string): Promise<any> {
    try {
      const user = await prisma.user.findUnique({
        where: {
          email: email,
        },
        include: {
          resources: true,
        },
      });

      return user;
    } catch (error) {
      console.error(`Error retrieving data for ${email}:`, error);
      throw new Error("Error retrieving data");
    }
  }

  async getHistory(id: string): Promise<any> {
    try {
      const history = await prisma.storeHistory.findMany({
        where: {
          userId: id,
        },
      });
      return history;
    } catch (error) {
      console.error(`Error retrieving data for :`, error);
      throw new Error("Error retrieving data");
    }
  }

  async removeCoins(email: string, amount: number) {
    await prisma.user.update({
      where: { email },
      data: { coins: { decrement: amount } },
    });
  }

  /**
   * Retrieves a user from the Pterodactyl Panel API, given their email address.
   * @param email The email address of the user to retrieve.
   * @returns The user object, or throws an error if the user is not found.
   * @throws {Error} If there is a database error.
   */
  async getUsersFromPterodactyl(email: string): Promise<any> {
    try {
      const data = await this.pterodactyl.getUser(email);
      //console.log(data);

      return data;
    } catch (error) {
      console.error(`Error retrieving server data for ${email}:`, error);
      throw new Error("Error retrieving server data");
    }
  }

  /**
   * Retrieves the list of servers associated with a given user's email address.
   * @param email The email address of the user whose servers are to be retrieved.
   * @returns A promise that resolves to an array containing the user's servers, or an empty array if no servers are found.
   * @throws {Error} If there is an error retrieving the server data.
   */
  async getServer(email: string): Promise<any> {
    try {
      //const data = await this.pterodactyl.getUser(email) as PterodactylResponse;

      const data = (await this.getUsersFromPterodactyl(
        email
      )) as PterodactylResponse;
      const servers = data.data[0].attributes.relationships.servers.data || [];
      return servers;
    } catch (error) {
      console.error(`Error retrieving server data for ${email}:`, error);
      throw new Error("Error retrieving server data");
    }
  }

  /**
   * Retrieves the maximum resources for a given user.
   * @param email The email address of the user.
   * @returns An object containing the maximum resources for the user, keyed by resource type.
   */
  async getMaxResources(email: string): Promise<{
    cpu: number;
    ram: number;
    disk: number;
    backup: number;
    database: number;
    allocation: number;
    servers: number;
  }> {
    try {
      const user = await this.getUser(email);
      return {
        cpu: user.resources?.cpu ?? NaN,
        ram: user.resources?.ram ?? NaN,
        disk: user.resources?.disk ?? NaN,
        backup: user.resources?.backup ?? NaN,
        database: user.resources?.database ?? NaN,
        allocation: user.resources?.allocation ?? NaN,
        servers: user.resources?.servers ?? NaN,
      };
    } catch (error) {
      console.error(`Error retrieving data for ${email}:`, error);
      throw new Error("Error retrieving data");
    }
  }

  /**
   * Retrieves the used resources for a given user.
   * @param email The email address of the user.
   * @returns An object containing the used resources for the user, keyed by resource type.
   */
  async getUsedResources(email: string): Promise<any> {
    try {
      const resourceTypes = [
        "cpu",
        "memory",
        "disk",
        "backups",
        "databases",
        "allocations",
        "servers",
      ];
      const resourcePromises = resourceTypes.map((type) =>
        this.getResources(
          email,
          type,
          ["backups", "databases", "allocations"].includes(type)
        )
      );
      const resources = await Promise.all(resourcePromises);

      const usedResources = resourceTypes.reduce((acc, type, index) => {
        acc[type] = resources[index] ?? NaN;
        return acc;
      }, {} as any);

      const usedResourcesFinal = {
        cpu: usedResources.cpu ?? NaN,
        ram: usedResources.memory ?? NaN,
        disk: usedResources.disk ?? NaN,
        backup: usedResources.backups ?? NaN,
        database: usedResources.databases ?? NaN,
        allocation: usedResources.allocations ?? NaN,
        servers: usedResources.servers ?? NaN,
      };

      return usedResourcesFinal;
    } catch (error) {
      console.error(`Error retrieving data for ${email}:`, error);
      throw new Error("Error retrieving data");
    }
  }

  /**
   * Creates a new server for a given user.
   * @param data The server data to create the server with.
   * @returns The created server object, or throws an error if the server could not be created.
   */
  async createServer(data: any) {
    try {
      if (!data.location_id && !data.node_id) {
        throw new Error("A location_id or node_id is required");
      }

      const serverData = {
        name: data.name,
        user: parseInt(data.user),
        egg: data.egg_id,
        docker_image: data.docker_image,
        startup: data.startup,
        environment: data.environment || {},
        limits: {
          memory: data.memory || 0,
          swap: data.swap || 0,
          disk: data.disk || 0,
          io: data.io || 500,
          cpu: data.cpu || 0,
        },
        feature_limits: {
          databases: data.databases || 0,
          backups: data.backups || 0,
          allocations: data.allocations || 0,
        },
        allocation: {
          default: 1,
        },
        deploy: {
          locations: [data.location_id],
          dedicated_ip: false,
          port_range: [],
          deploy: false,
        },
      };

      const server = await this.pterodactyl.createServer(serverData);
      return server;
    } catch (error: any) {
      console.error(`Error creating server:`, error);
      if (error.response) {
        console.error("Server response:", error.response.data);
      }
      throw new Error("Error creating server");
    }
  }

  async deleteServer(id: string, email: string) {
    try {
      const user = await this.getUser(email);

      if (!user?.resources?.servers) {
        throw new Error("You do not have any servers");
      }

      const servers = await this.getServer(email);
      const serverExists = servers.some(
        (server: any) => server.attributes.id.toString() === id.toString()
      );

      if (!serverExists) {
        throw new Error("You do not have access to this server");
      }

      const response = await this.pterodactyl.deleteServer(id);
      if (response.status === 204 || response.status === 200) {
        return true;
      }

      throw new Error(
        `Server deletion failed with status: ${response?.status}`
      );
    } catch (error: any) {
      console.error("Error deleting server:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      throw new Error(error.message || "Error deleting server");
    }
  }

  /**
   * Creates a new user on the Pterodactyl Panel API.
   * @param data The user data to create the user with.
   * @returns The created user object, or throws an error if the user could not be created.
   * @throws {Error} If the given user data is invalid, or if the user already exists.
   */
  async createUser(data: any) {
    try {
      type User = {
        username: string;
        email: string;
        first_name: string;
        last_name: string;
        password: string;
      };

      if (
        typeof data !== "object" ||
        !data.hasOwnProperty("username") ||
        !data.hasOwnProperty("email") ||
        !data.hasOwnProperty("first_name") ||
        !data.hasOwnProperty("last_name") ||
        !data.hasOwnProperty("password")
      ) {
        throw new Error("Invalid user object");
      }

      //if (await this.getUser(data.email)) {
      //    throw new Error('User already exists');
      //}

      const userData: User = {
        username: data.username,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        password: data.password,
      };

      const response = await this.pterodactyl.createUser(userData);
      if (!response || typeof response !== "object") {
        throw new Error("Invalid response from server");
      }
      return response;
    } catch (error) {
      console.error(`Error creating user:`, error);
      throw new Error("Error creating user");
    }
  }

  async logToDiscord(title: string, message: string) {
    try {
      const { data } = await axios.post<any>(
        "https://discord.com/api/webhooks/1037804536104824421/5fYl9oWd3g8b5ZaTQbqYiHgQVpXy2fYm1vY",
        {
          content: `**${title}**\n${message}`,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.error(`Error logging to Discord:`, error);
      throw new Error("Error logging to Discord");
    }
  }

  async controlServer(identifier: string, action: string, email: string) {
    try {
      const servers = await this.getServer(email);
      const server = servers.find(
        (s: any) => s.attributes.identifier === identifier
      );

      if (!server) {
        throw new Error("Server not found or access denied");
      }

      const validActions = ["start", "stop", "restart", "kill"];
      if (!validActions.includes(action)) {
        throw new Error("Invalid action");
      }

      const response = (await this.pterodactyl.setPower(
        identifier,
        action
      )) as { status: number };

      if (response.status === 204) {
        return true;
      }

      throw new Error("Failed to control server");
    } catch (error: any) {
      console.error(`Error controlling server ${identifier}:`, error.message);
      if (error.response) {
        console.error("Server response:", error.response.data);
      }
      throw new Error(error.message || "Error controlling server");
    }
  }

  async updateUserPassword(user: any, password: string) {
    try {
      await this.pterodactyl.updateUserPassword(user, password);

      if (user.provider === "discord") {
        await prisma.user.update({
          where: { email: user.email },
          data: { password: password },
        });
        return;
      }
    } catch (error: any) {
      console.error(`Error updating user password:`, error);
      console.error(error.response?.data);
      throw new Error("Error updating user password");
    }
  }

  async deleteUser(user: any) {
    try {
      await this.pterodactyl.deleteUser(user);
    } catch (error: any) {
      console.error(`Error deleting user:`, error);
      throw new Error("Error deleting user");
    }
  }

  async getResourcesServer(serverId: string) {
    try {
      const response = await this.pterodactyl.getResources(serverId);
      return response;
    } catch (error: any) {
      console.error(`Error getting resources:`, error);
      throw new Error("Error getting resources");
    }
  }
}

export default Manager;
