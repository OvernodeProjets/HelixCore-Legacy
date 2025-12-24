import axios from "axios";
import { EventEmitter } from "events";
import WebSocket from "ws";

interface WebSocketCredentials {
  token: string;
  socket: string;
}

class PterodactylWebSocket extends EventEmitter {
  private apiKey: string;
  private serverId: string;
  private baseUrl: string;
  private socket: WebSocket | null = null;
  private tokenRefreshInterval: NodeJS.Timeout | null = null;

  constructor(apiKey: string, serverId: string, baseUrl: string) {
    super();
    this.apiKey = apiKey;
    this.serverId = serverId;
    this.baseUrl = baseUrl;
  }

  async getWebSocketCredentials(): Promise<WebSocketCredentials> {
    try {
      console.log("Fetching WebSocket credentials...");
      const response: any = await axios.get(
        `${this.baseUrl}/api/client/servers/${this.serverId}/websocket`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );
      return response.data.data;
    } catch (error: any) {
      console.error("Error fetching WebSocket credentials:", error);
      throw error;
    }
  }

  async connect(
    onMessage?: (data: any) => void,
    onClose?: (code: number, reason: string) => void
  ) {
    try {
      const credentials = await this.getWebSocketCredentials();

      return new Promise<void>((resolve, reject) => {
        this.socket = new WebSocket(credentials.socket, [], {
          headers: {
            Origin: this.baseUrl,
            Authorization: `Bearer ${credentials.token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        this.socket.on("open", () => {
          console.log("WebSocket connection established");
          this.authenticate(credentials.token);
          this.startTokenRefresh();
          resolve();
        });

        this.socket.on("message", (data: WebSocket.Data) => {
          try {
            const parsedData = JSON.parse(data.toString());
            // if the token is expiring, refresh it
            if (parsedData.event === "token expiring") {
              this.refreshToken();
            }

            if (parsedData.event === "console output") {
              this.emit("console output", parsedData.args[0]);
            }
            onMessage?.(parsedData);
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        });

        this.socket.on("error", (error) => {
          console.error("WebSocket connection error:", error);
          reject(error);
        });

        this.socket.on("close", (code, reason) => {
          console.log("WebSocket closed:", code, reason.toString());
          this.stopTokenRefresh();
          onClose?.(code, reason.toString());
        });
      });
    } catch (error) {
      console.error("WebSocket setup error:", error);
      throw error;
    }
  }

  private authenticate(token: string) {
    this.send("auth", [token]);
  }

  private async refreshToken() {
    try {
      console.log("Refreshing WebSocket token...");
      const newCredentials = await this.getWebSocketCredentials();
      this.authenticate(newCredentials.token);
    } catch (error) {
      console.error("Failed to refresh token", error);
    }
  }

  private startTokenRefresh() {
    this.tokenRefreshInterval = setInterval(() => {
      this.refreshToken();
    }, 10 * 60 * 1000); // 10 minutes
  }

  private stopTokenRefresh() {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
  }

  send(event: string, args: any[] = []) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    this.socket.send(JSON.stringify({ event, args }));
  }

  sendStats() {
    this.send("send stats");
  }

  sendLogs() {
    this.send("send logs");
  }

  sendCommand(command: string) {
    this.send("send command", [command]);
  }

  close() {
    this.stopTokenRefresh();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export default PterodactylWebSocket;
