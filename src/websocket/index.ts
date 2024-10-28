import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const { WEBSOCKET_PORT = 3000 } = process.env;

export const webSocketServer = new WebSocketServer({ port: WEBSOCKET_PORT });
