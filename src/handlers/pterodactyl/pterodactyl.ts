import axios from "axios";

interface PterodactylUser {
  attributes: {
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    language: string;
  };
}

export class PterodactylClient {
  private readonly apiKey: string;
  private readonly clientKey: string;
  private readonly baseURL: string;

  constructor(apiKey: string, clientKey: string, baseURL: string) {
    this.apiKey = apiKey;
    this.clientKey = clientKey;
    this.baseURL = baseURL.endsWith("/") ? baseURL : baseURL + "/";
  }

  private get application() {
    return axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      validateStatus: (status) => status < 500,
    });
  }

  private get client() {
    return axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Bearer ${this.clientKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      validateStatus: (status) => status < 500,
    });
  }

  /**
   * Application
   */
  async getServers() {
    try {
      const response = await this.application.get("/api/application/servers");
      return response.data;
    } catch (error: any) {
      console.error("Error in getServers:", error.message);
      throw new Error(`Failed to get servers: ${error.message}`);
    }
  }

  async getNodes() {
    try {
      const response = await this.application.get("/api/application/nodes");
      return response.data;
    } catch (error: any) {
      console.error("Error in getNodes:", error.message);
      throw new Error(`Failed to get nodes: ${error.message}`);
    }
  }

  async getLocations() {
    try {
      const response = await this.application.get("/api/application/locations");
      return response.data;
    } catch (error: any) {
      console.error("Error in getLocations:", error.message);
      throw new Error(`Failed to get locations: ${error.message}`);
    }
  }

  async getUsers() {
    try {
      const response = await this.application.get("/api/application/users");
      return response.data;
    } catch (error: any) {
      console.error("Error in getUsers:", error.message);
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }

  async updateUserPassword(user: any, password: string) {
    try {
      if (!user.pterodactylId) {
        throw new Error("User does not have a Pterodactyl ID");
      }
      const data = await this.application.get(
        `/api/application/users/${user.pterodactylId}/`
      );
      const userData = data.data as {
        attributes: PterodactylUser["attributes"];
      };
      const dataResponse = {
        email: userData.attributes.email,
        username: userData.attributes.username,
        first_name: userData.attributes.first_name,
        last_name: userData.attributes.last_name,
        language: userData.attributes.language,
        password: password,
      };
      const response = await this.application.patch(
        `/api/application/users/${user.pterodactylId}`,
        dataResponse
      );
      return response.data;
    } catch (error: any) {
      console.error("Error in updateUserPassword:", error.message);
      throw new Error(`Failed to update user password: ${error.message}`);
    }
  }

  async getUser(email: string = "") {
    try {
      const response = await this.application.get("/api/application/users", {
        params: { include: "servers", "filter[email]": email },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`${error.message}`);
    }
  }

  async createUser(user: any) {
    try {
      const response = await this.application.post(
        "/api/application/users",
        user
      );
      return response.data;
    } catch (error: any) {
      console.error("Error in createUser:", error.message);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async deleteUser(user: any) {
    try {
      const response = await this.application.delete(
        `/api/application/users/${user.pterodactylId}`
      );
      return response.data;
    } catch (error: any) {
      console.error("Error in deleteUser:", error.message);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  async createServer(server: any) {
    try {
      const response = await this.application.post(
        "/api/application/servers",
        server
      );
      return response;
    } catch (error: any) {
      console.error("Error in createServer:", error.message);
      throw new Error(`Failed to create server: ${error.message}`);
    }
  }

  async deleteServer(id: string) {
    try {
      const response = await this.application.delete(
        `/api/application/servers/${id}`
      );
      return response;
    } catch (error: any) {
      console.error("Error in deleteServer:", error.message);
      throw new Error(`Failed to delete server: ${error.message}`);
    }
  }

  /**
   * Client
   */
  async setPower(identifier: string, signal: string) {
    try {
      const response = await this.client.post(
        `api/client/servers/${identifier}/power`,
        { signal }
      );

      return response;
    } catch (error: any) {
      console.error("Error in setPower:", error.message);
      throw new Error(`Failed to control server: ${error.message}`);
    }
  }

  async getServerWebsocket(serverId: string) {
    try {
      const response = await this.client.get(
        `api/client/servers/${serverId}/websocket`
      );
      return (response.data as { data: any }).data;
    } catch (error) {
      console.error("Error getting websocket details:", error);
      throw error;
    }
  }

  async getResources(serverId: string) {
    try {
      const response = await this.client.get(
        `api/client/servers/${serverId}/resources`
      );
      return response.data;
    } catch (error: any) {
      console.error("Error in getResources:", error.message);
      throw new Error(`Failed to get resources: ${error.message}`);
    }
  }
}
