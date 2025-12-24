import express from "express";
import { WebSocket, WebSocketServer } from "ws";
import prisma from "../handlers/prisma/prisma";
import settings from "../storage/config.json";

class AfkWebSocketHandler {
  private static wss: WebSocketServer;
  private static REWARD_AMOUNT = settings.afk.rewardAmount;

  public initialize(app: any) {
    AfkWebSocketHandler.wss = new WebSocketServer({
      noServer: true,
      path: "/afkws",
    });

    app.ws("/afkws", async (ws: WebSocket, req: express.Request) => {
      const userId = req.query.userId as string;
      if (!userId) {
        ws.close(1008, "User ID not provided");
        return;
      }

      const HEARTBEAT_INTERVAL = 30000;
      let isAlive = true;

      const heartbeat = setInterval(() => {
        if (!isAlive) {
          clearInterval(heartbeat);
          clearInterval(rewardInterval);
          ws.terminate();
          return;
        }
        isAlive = false;
        ws.ping();
      }, HEARTBEAT_INTERVAL);

      ws.on("pong", () => (isAlive = true));

      const rewardInterval = setInterval(() => {
        if (ws.readyState !== ws.OPEN) {
          clearInterval(rewardInterval);
          return;
        }

        prisma.user
          .update({
            where: { id: userId },
            data: { coins: { increment: AfkWebSocketHandler.REWARD_AMOUNT } },
            select: { coins: true },
          })
          .then(
            (updatedUser) => {
              ws.send(
                JSON.stringify({
                  type: "reward",
                  newBalance: updatedUser.coins,
                  earned: AfkWebSocketHandler.REWARD_AMOUNT,
                })
              );
            },
            (error) => {
              console.error("Error updating coins:", error);
              ws.close(1011, "Database error");
            }
          );
      }, settings.afk.rewardTime * 1000);

      ws.on("close", () => {
        clearInterval(heartbeat);
        clearInterval(rewardInterval);
      });
    });
  }
}

export default AfkWebSocketHandler;
