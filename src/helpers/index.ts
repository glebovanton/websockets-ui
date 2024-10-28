import { WebSocketServer } from 'ws';
import { users } from "../db";
import { Game,ResponseType, Room, User } from "../types";
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

export const findEnemy = (currentGame: Game, currentPlayerId: string) => {
    const { players } = currentGame;
    return players.filter((player: User) => player.indexPlayer !== currentPlayerId)[0];
};

export const findRoomIndex = (roomId: string): number => rooms.findIndex((room) => room.roomId === roomId);

export const generatePlayerBoard = (player) => {
    player.ships.forEach((ship) => {
        const { board } = player;
        const {
            position: { x, y },
            direction,
            length,
        } = ship;

        let i;
        direction ? (i = y) : (i = x);
        const shipEndCoordinate = i + length;

        while (i < shipEndCoordinate) {
            board[direction ? i : y][direction ? x : i] = true;
            i++;
        }
    });
};

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

export const updateTurn = (currentGame, indexPlayer, ws, isLanded = false) => {
    if (!isLanded) {
        const nextPlayer = findEnemy(currentGame, indexPlayer);
        ({ indexPlayer } = nextPlayer);
    }
    currentGame.idOfPlayersTurn = indexPlayer;
    ws.send(
        JSON.stringify({
            type: ResponseType.Turn,
            data: JSON.stringify({
                currentPlayer: indexPlayer,
            }),
            id: 0,
        }),
    );
};

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

export const startGame = (currentGame) => {
    currentGame.players.forEach(({ indexPlayer, ships }) => {
        const currentPlayer : User | undefined = findUser(indexPlayer);
        const currentPlayerWebsocket: WebSocket | undefined = currentPlayer?.ws;

        currentPlayerWebsocket?.send(
            JSON.stringify({
                type: ResponseType.StartGame,
                data: JSON.stringify({
                    ships: [...ships],
                    currentPlayerIndex: indexPlayer,
                }),
                id: 0,
            }),
        );
    });

    currentGame.players.forEach((player) => {
        player.board = JSON.parse(JSON.stringify(Array(10).fill(Array(10).fill(false))));
        player.hitBoard = JSON.parse(JSON.stringify(Array(10).fill(Array(10).fill(false))));
        player.shipsWrecked = 0;

        generatePlayerBoard(player);

        const currentPlayer: User | undefined = findUser(player.indexPlayer);
        const currentPlayerWebsocket: WebSocket | undefined = currentPlayer?.ws;
        updateTurn(currentGame, currentGame.players[1].indexPlayer, currentPlayerWebsocket);
    });
};
