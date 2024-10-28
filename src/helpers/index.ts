import { WebSocketServer } from 'ws';
import { users } from "../db";
import {Game, ResponseType, Room, ShipTakenShots, User, Winner} from "../types";
import { currentGames, rooms, winners } from "../db";

export const attackAllNearbyCells = (x: number, y: number, ws: WebSocketServer, indexPlayer: string, board: boolean[][]): void => {
    const nearbyCells = [
        { x: x - 1, y: y - 1 },
        { x, y: y - 1 },
        { x: x + 1, y: y - 1 },

        { x: x - 1, y },
        { x: x + 1, y },

        { x: x - 1, y: y + 1 },
        { x: x, y: y + 1 },
        { x: x + 1, y: y + 1 },
    ];

    nearbyCells.forEach((cell) => {
        const x = cell?.x;
        const y = cell?.y;

        if (!board[y][x]) {
            ws.send(attackFeedbackResponse(x, y, indexPlayer, 'miss'));
        }
    });
};

export const attackFeedback = (currentGame: Game, indexPlayer: string, board: boolean[][], hitBoard: boolean[][], x: number, y: number, wss: WebSocketServer): void => {
    const currentGameWebsockets = getCurrentGameWebsockets(currentGame);
    const enemyPlayer = findEnemy(currentGame, indexPlayer);
    const { ships } = enemyPlayer;

    let status = 'miss';
    let isLanded = false;
    if (board[y][x]) {
        status = 'shot';
        isLanded = true;

        currentGameWebsockets.forEach((ws) => {
            ws.send(attackFeedbackResponse(x, y, indexPlayer, status));
            updateTurn(currentGame, indexPlayer, ws, isLanded);
        });

        ships?.forEach((ship) => {
            const {
                length,
                direction,
                position: { x: x1, y: y1 },
            } = ship;
            if (ship.isWrecked) return;

            const thisShipTakenShots: ShipTakenShots[] = [];
            const shotsToKill = length;

            let i;
            direction ? (i = y1) : (i = x1);
            const shipEndCoordinate = i + length;

            while (i < shipEndCoordinate) {
                if (hitBoard[direction ? i : y1][direction ? x1 : i]) {
                    thisShipTakenShots.push({
                        x1: direction ? x1 : i,
                        y1: direction ? i : y1,
                    });
                }
                i++;
            }

            if (thisShipTakenShots.length === shotsToKill) {
                ship.isWrecked = true;

                if (enemyPlayer) {
                    enemyPlayer.shipsWrecked = enemyPlayer.shipsWrecked ?? 0;
                    if (Number.isInteger(enemyPlayer.shipsWrecked)) {
                        enemyPlayer.shipsWrecked++;
                    }
                }

                if (enemyPlayer.shipsWrecked === 10) {
                    finishGame(wss, currentGameWebsockets, currentGame, indexPlayer);
                }

                currentGameWebsockets.forEach((ws) => {
                    thisShipTakenShots.forEach((cell) => {
                        const { x1, y1 } = cell;
                        ws.send(attackFeedbackResponse(x1, y1, indexPlayer, 'killed'));
                        attackAllNearbyCells(x1, y1, ws, indexPlayer, board);
                    });
                    updateTurn(currentGame, indexPlayer, ws, isLanded);
                });
            }
        });
    } else {
        currentGameWebsockets.forEach((ws) => {
            ws.send(attackFeedbackResponse(x, y, indexPlayer, status));
            updateTurn(currentGame, indexPlayer, ws, isLanded);
        });
    }
};

export const attackFeedbackResponse = (x: number, y: number, indexPlayer: string, status: string): string => {
    return JSON.stringify({
        type: 'attack',
        data: JSON.stringify({
            position: {
                x,
                y,
            },
            currentPlayer: indexPlayer,
            status,
        }),
        id: 0,
    });
};

export const createGame = (roomId: string): void => {
    const currentRoom: Room | undefined = findRoom(roomId);
    const currentRoomPlayers: User[] = currentRoom?.roomUsers ?? [];

    let currentGame: { players: User[]; roomId: string } = {
        roomId,
        players: [],
    };

    currentGame && currentGames.push(<Game>currentGame);

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

export const findEnemy = (currentGame: Game, currentPlayerId: string):  User => {
    const { players } = currentGame;
    return players.filter((player: User) => player.indexPlayer !== currentPlayerId)[0];
};

export const findRoomIndex = (roomId: string): number => rooms.findIndex((room) => room.roomId === roomId);

export const finishGame = (wss, currentGameWebsockets, currentGame, indexPlayer) => {
    const winner = findUser(indexPlayer);
    const id = currentGame.roomId;
    currentGames.splice(
        currentGames.findIndex((game) => game.roomId === id),
        1,
    );
    rooms.splice(
        rooms.findIndex((room) => room.roomId === id),
        1,
    );

    const foundWinner: Winner | undefined = winners.find((user: Winner) => user.name === winner?.name);

    if (foundWinner) {
        foundWinner.wins++;
    } else if (winner?.name) {
        winners.push({ name: winner.name, wins: 1 });
    }

    currentGameWebsockets.forEach((ws) => {
        ws.send(
            JSON.stringify({
                type: ResponseType.Finish,
                data: JSON.stringify({
                    winPlayer: indexPlayer,
                }),
                id: 0,
            }),
        );
    });
    updateWinners(wss);
    updateRooms(wss);
};


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

export const getCurrentGameWebsockets = (currentGame) => {
    const currentGameWebsockets: WebSocketServer[] = [];
    currentGame.players.forEach((player) => {
        const playerWebSocket: WebSocket | undefined = findUser(player.indexPlayer)?.ws;

        playerWebSocket && currentGameWebsockets.push(playerWebSocket);
    });

    return currentGameWebsockets;
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
