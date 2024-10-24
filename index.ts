import dotenv from 'dotenv';
import { httpServer } from "./src/http_server";
import { webSocketServer } from "./src/websocket"
import { findUserByName, generateUid, updateRooms, updateWinners } from "./src/helpers";
import {ResponseType, User } from "./src/types";
import { users } from "./src/db";

dotenv.config();

const { HOST = 'localhost', HTTP_PORT = 8181, WEBSOCKET_PORT = 3000 } = process.env;


httpServer.listen(HTTP_PORT, ()=> {
    console.log(`Start static http server on the port ${HTTP_PORT} & PID: ${process.pid}. Visit: http://${HOST}:${HTTP_PORT}/`);
    console.log(`Websocket on the ${WEBSOCKET_PORT} port!`);
});

webSocketServer.on('connection', (ws) => {
    const id = generateUid();

    ws.on('message', (data) => {
        const message = data.toString();
        const messageAsObject = JSON.parse(message);
        let user: User= {
            index: id,
            name: messageAsObject.name,
            indexRoom: undefined,
            ws: undefined,
            error: false,
            errorText: '',
            password: undefined
        };
        let existingUser;
        let roomId;

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
