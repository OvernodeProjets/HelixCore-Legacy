import PterodactylWebSocket from '../pterodactyl/PterodactylWebSocket';
import Manager from '../manager';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';

const manager = new Manager();

class ServerWebSocketHandler {
    private static wss: WebSocketServer;

    public initialize(app: any) {
        ServerWebSocketHandler.wss = new WebSocketServer({
            noServer: true,
            path: '/serverws'
        });
        const activeConnections = new Map<string, PterodactylWebSocket>();

        app.ws('/serverws', async (ws: WebSocket, req: express.Request) => {
            console.log('WebSocket connection attempt', req.url);
        
            ws.on('message', async (message: string) => {
                const parsedMessage = JSON.parse(message);
                const { userId, serverId, event, command } = parsedMessage;
        
                if (!userId || !serverId) {
                    console.log("Invalid userId or serverId");
                    return;
                }
        
                let pterodactylWS = activeConnections.get(serverId);
        
                if (!pterodactylWS) {
                    console.log(`Creating new WebSocket connection for server ${serverId}`);
                    pterodactylWS = new PterodactylWebSocket(manager.provider.client_key, serverId, manager.provider.url);
                    activeConnections.set(serverId, pterodactylWS);
        
                    await pterodactylWS.connect(
                        (data: any) => {
                            console.log(`[Server ${serverId} Log]:`, data.args[0]);
                            ws.send(JSON.stringify({ event: 'console output', args: [data.args[0]] }));
                            
                        },
                        () => {
                            console.log(`WebSocket closed for server ${serverId}`);
                            activeConnections.delete(serverId);
                        }
                    );
                } else {
                    console.log(`Reusing existing WebSocket for server ${serverId}`);
                    await pterodactylWS.connect(
                        (data: any) => {
                            if (data.event === 'console output') {
                                console.log(`[Server ${serverId} Log]:`, data.args[0]);
                                ws.send(JSON.stringify({ event: 'console output', args: [data.args[0]] }));
                            }
                        },
                        () => {
                            console.log(`WebSocket closed for server ${serverId}`);
                            activeConnections.delete(serverId);
                        }
                    );
                }
        
                pterodactylWS.on('console output', (consoleMessage: string) => {
                    const event = { event: 'console output', args: [consoleMessage] };
                    ws.send(JSON.stringify(event));
                });
        
                if (event === "send command" && command) {
                    console.log(`Sending command to server ${serverId}: ${command}`);
                    pterodactylWS.sendCommand(command);
                }
            });
        
            ws.on('close', () => {
                console.log('WebSocket connection closed');
            });
        });
            
        
    }
}

export default ServerWebSocketHandler;
