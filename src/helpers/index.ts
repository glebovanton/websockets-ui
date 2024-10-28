import { WebSocketServer } from 'ws';
import { users } from "../db";
import {ResponseType, Room, User} from "../types";
import { rooms, winners } from "../db";

export const generateUid = function () : string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

export const updateRooms = (wss: WebSocketServer): void => {
    wss.clients.forEach((client) => {
        const formResponse = {
            type: ResponseType.UpdateRoom,
            data: JSON.stringify(rooms),
            id: 0,
        };
        client.send(JSON.stringify(formResponse));
    });
};

export const findRoom = (roomId: string): Room | undefined => rooms.find((room) => room.roomId === roomId)

export const findUser = (id: string): User | undefined =>
    users.find((player) => player.index === id);

export const findUserByName = (name: string | undefined): User | undefined => users.find((player) => player.name === name);

export const updateWinners = (wss: WebSocketServer): void => {
    const formResponse = JSON.stringify({
        type: ResponseType.UpdateWinners,
        data: JSON.stringify(winners),
        id: 0,
    });

    wss.clients.forEach((client) => {
        client.send(formResponse);
    });
};
