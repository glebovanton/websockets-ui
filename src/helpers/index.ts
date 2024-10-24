import { users } from "../db";
import { ResponseType } from "../types";
import { rooms, winners } from "../db";

export const generateUid = function () : string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

export const findUserByName = (name) => users.find((player) => player.name === name);

export const updateRooms = (wss) => {
    wss.clients.forEach((client) => {
        const formResponse = {
            type: ResponseType.UpdateRoom,
            data: JSON.stringify(rooms),
            id: 0,
        };
        client.send(JSON.stringify(formResponse));
    });
};

export const updateWinners = (wss) => {
    const formResponse = JSON.stringify({
        type: ResponseType.UpdateWinners,
        data: JSON.stringify(winners),
        id: 0,
    });

    wss.clients.forEach((client) => {
        client.send(formResponse);
    });
};
