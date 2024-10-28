import { WebSocketServer } from 'ws';
import { users } from "../db";
import { ResponseType, Room, User } from "../types";
import { currentGames, rooms, winners } from "../db";

export const createGame = (roomId: string): void => {
    const currentRoom: Room | undefined = findRoom(roomId);
    const currentRoomPlayers: User[] = currentRoom?.roomUsers ?? [];

    const currentGame = {
        roomId,
        players: [],
    };

    currentGames.push(currentGame);

    currentRoomPlayers.forEach((player): void => {
        const thisPlayersWebSocket = findUser(player.index)?.ws;

        thisPlayersWebSocket?.send(
            JSON.stringify({
                type: ResponseType.CreateGame,
                data: JSON.stringify({
                    idGame: roomId,
                    idPlayer: player.index,
                }),
                id: 0,
            }),
        );
    });
};

export const findRoomIndex = (roomId: string): number => rooms.findIndex((room) => room.roomId === roomId);

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
