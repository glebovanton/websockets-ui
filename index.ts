import { WebSocketServer } from "ws";
import 'dotenv/config'
import { httpServer } from "./src/http_server";
import { webSocketServer } from "./src/websocket"
import {
    attackFeedback,
    createGame,
    findCellToAttack,
    findEnemy,
    findRoom,
    findRoomIndex,
    findUser,
    findUserByName,
    generateUid,
    isUndefined,
    updateRooms,
    updateWinners,
    startGame
} from "./src/helpers";
import { Game, Room, ResponseType, User } from "./src/types";
import { currentGames,rooms, users } from "./src/db";

const { HOST = 'localhost', HTTP_PORT = 8181, WEBSOCKET_PORT = 3000 } = process.env;

httpServer.listen(HTTP_PORT, ()=> {
    console.log(`Start static http server on the port ${HTTP_PORT} & PID: ${process.pid}. Visit: http://${HOST}:${HTTP_PORT}/`);
    console.log(`Websocket on the ${WEBSOCKET_PORT} port!`);
});

webSocketServer.on('connection', (ws: WebSocketServer): void => {
    const id: string = generateUid();

    ws.on('message', (data) => {
        const message: string = data.toString();
        const messageAsObject = JSON.parse(message);
        let user: User = {
            index: id,
            name: messageAsObject.name,
            indexRoom: undefined,
            ws: undefined,
            error: false,
            errorText: '',
            password: undefined
        };
        let existingUser: User | undefined;
        let roomId: string | undefined;
        let gameId: string | undefined;
        let currentGame: Game | undefined;
        let indexPlayer: string | undefined;
        let x: number | undefined;
        let y: number | undefined;
        let hitBoard: boolean[][] | undefined;
        let board: boolean[][] | undefined;

        if (messageAsObject.data) {
            messageAsObject.data = JSON.parse(messageAsObject.data);
            user = { ...messageAsObject.data };
            existingUser = findUserByName(user.name);
            roomId = user?.indexRoom;
            user.name = existingUser ? existingUser.name : user.name;
            user.index = existingUser ? existingUser.index : user.index;
            user.ws = ws;
        }

        switch (messageAsObject.type) {

            case ResponseType.Reg:
                user.index = id;
                user.error = false;
                user.errorText = '';

                if (existingUser && existingUser.password !== user.password) {
                    user.error = true;
                    user.errorText = 'The credentials are not correct.';
                }

                ws.send(
                    JSON.stringify({
                        type: ResponseType.Reg,
                        data: JSON.stringify({
                            name: user.name,
                            index: user.index,
                            error: user.error,
                            errorText: user.errorText,
                        }),
                        id: 0,
                    }),
                );

                if (!user.error) {
                    updateRooms(webSocketServer);
                    updateWinners(webSocketServer);
                    users.push(user);
                }

                break;

            case ResponseType.CreateRoom:
                const foundPlayer: User | undefined = findUser(id);
                const newRoomId: string = generateUid();

                if (!foundPlayer) {
                    break;
                }

                const newRoom: Room = {
                    roomId: newRoomId,
                    roomUsers: [
                        {
                            name: foundPlayer.name,
                            index: foundPlayer.index,
                        },
                    ],
                };
                rooms.push(newRoom);
                updateRooms(webSocketServer);
                break;

            case ResponseType.AddUserToRoom:
                if (!roomId) {
                    roomId = user.indexRoom;
                }

                const currentRoom: Room | undefined = roomId ? findRoom(roomId) : undefined;;
                const currentRoomUsers: User[] = currentRoom?.roomUsers ?? [];
                const targetUser: User | undefined = findUser(user.index || id);

                if (currentRoom && targetUser && !currentRoomUsers.find((roomUser) => roomUser.index === targetUser.index)) {
                    currentRoom.roomUsers.push(targetUser);
                }

                updateRooms(webSocketServer);

                if (currentRoomUsers.length > 1) {
                    createGame(roomId as string);
                    const currentRoomIndex: number = findRoomIndex(roomId as string);
                    rooms.splice(currentRoomIndex, 1);
                }
                break;

            case ResponseType.AddShips:
                ({ gameId } = user);
                currentGame = currentGames.find((game: Game) => game.roomId === gameId);
                currentGame?.players.push(user);

                if (currentGame?.players && currentGame.players.length > 1) {
                    startGame(currentGame);
                }
                break;

            case ResponseType.Attack:
                ({ indexPlayer, gameId, x, y } = user);
                currentGame = currentGames.find((game) => game.roomId === gameId);
                currentGame && indexPlayer && ({ board, hitBoard } = findEnemy(currentGame, indexPlayer));

                if ((currentGame?.idOfPlayersTurn === indexPlayer) && x && y && !hitBoard?.[y][x]) {
                    hitBoard && ( hitBoard[y][x] = true );

                    if (currentGame && indexPlayer && board && hitBoard) {
                        attackFeedback(currentGame, indexPlayer, board, hitBoard, x, y, webSocketServer);
                    }
                }
                break;

            case ResponseType.randomAttack:
                ({ indexPlayer, gameId } = user);
                currentGame = currentGames?.find((game) => game.roomId === gameId);
                currentGame && indexPlayer && ({ board, hitBoard } = findEnemy(currentGame, indexPlayer));

                if (hitBoard) {
                    const cell = findCellToAttack(hitBoard);

                    if (cell && cell.x !== undefined && cell.y !== undefined) {
                        const { x, y } = cell;

                        if (
                            currentGame &&
                            indexPlayer !== undefined &&
                            board &&
                            currentGame.idOfPlayersTurn === indexPlayer &&
                            !hitBoard[y][x]
                        ) {
                            hitBoard[y][x] = true;
                            attackFeedback(currentGame, indexPlayer, board, hitBoard, x, y, webSocketServer);
                        }
                    }
                }

                break;

        }
    });
});

function shutdown() {
    httpServer.close((err) => {
        if (err) {
            console.error('Error while closing the server:', err);
            process.exit(1);
        }
        console.log('Server closed successfully');

        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTSTP', shutdown);
process.on('SIGTERM', shutdown);
