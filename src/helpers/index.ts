import { WebSocket, WebSocketServer } from 'ws';
import { AttackStatus, Cell, Game, ResponseType, Room, ShipTakenShots, User, Winner } from '../types';
import { currentGames, rooms, users, winners } from '../db';

export const attackAllNearbyCells = (
  x: number,
  y: number,
  ws: WebSocket,
  indexPlayer: string,
  board: boolean[][],
): void => {
  const offsets: number[][] = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];

  offsets.forEach(([dx, dy]: number[]): void => {
    const newX: number = x + dx;
    const newY: number = y + dy;

    if (board[newY]?.[newX] === false) {
      ws.send(attackFeedbackResponse(newX, newY, indexPlayer, AttackStatus.Miss));
    }
  });
};

export const attackFeedback = (
  currentGame: Game,
  indexPlayer: string,
  board: boolean[][],
  hitBoard: boolean[][],
  x: number,
  y: number,
  wss: WebSocketServer,
): void => {
  const currentGameWebsockets: WebSocket[] = getCurrentGameWebsockets(currentGame);
  const enemyPlayer: User = findEnemy(currentGame, indexPlayer);
  const { ships } = enemyPlayer;

  let status: string = AttackStatus.Miss;
  let isLanded: boolean = false;
  if (board[y][x]) {
    status = AttackStatus.Shot;
    isLanded = true;

    currentGameWebsockets.forEach((ws: WebSocket): void => {
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
            ws.send(attackFeedbackResponse(x1, y1, indexPlayer, AttackStatus.Killed));
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
    type: ResponseType.Attack,
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

  const currentGame: { players: User[]; roomId: string } = {
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

export const crnd = (min: number, max: number): number => {
  return +(Math.random() * (max - min) + min).toFixed();
};

export const findEnemy = (currentGame: Game, currentPlayerId: string): User => {
  const { players } = currentGame;
  return players.filter((player: User) => player.indexPlayer !== currentPlayerId)[0];
};

export const findCellToAttack = (hitBoard: boolean[][]): Cell | undefined => {
  let x, y;
  x = crnd(0, 9);
  y = crnd(0, 9);
  if (!hitBoard[y][x]) {
    return { x, y };
  } else {
    findCellToAttack(hitBoard);
  }
};

export const findRoomIndex = (roomId: string): number => rooms.findIndex((room) => room.roomId === roomId);

export const finishGame = (
  wss: WebSocketServer,
  currentGameWebsockets: WebSocket[],
  currentGame: Game,
  indexPlayer: string,
) => {
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

export const generatePlayerBoard = (player: User): void => {
  player?.ships?.forEach((ship) => {
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
      if (board) {
        board[direction ? i : y][direction ? x : i] = true;
      }
      i++;
    }
  });
};

export const generateUid = function (): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

export const getCurrentGameWebsockets = (currentGame) => {
  const currentGameWebsockets: WebSocket[] = [];
  currentGame.players.forEach((player) => {
    const playerWebSocket: WebSocket | undefined = findUser(player.indexPlayer)?.ws;

    playerWebSocket && currentGameWebsockets.push(playerWebSocket);
  });

  return currentGameWebsockets;
};

export const updateRooms = (wss: WebSocketServer): void => {
  wss.clients.forEach((client: WebSocket): void => {
    const formResponse = {
      type: ResponseType.UpdateRoom,
      data: JSON.stringify(rooms),
      id: 0,
    };
    client.send(JSON.stringify(formResponse));
  });
};

export const findRoom = (roomId: string): Room | undefined => rooms.find((room) => room.roomId === roomId);

export const findUser = (id: string): User | undefined => users.find((player) => player.index === id);

export const findUserByName = (name: string | undefined): User | undefined =>
  users.find((player) => player.name === name);

export const updateTurn = (currentGame: Game, indexPlayer: string, ws: WebSocket, isLanded: boolean = false): void => {
  if (!isLanded) {
    const nextPlayer: User = findEnemy(currentGame, indexPlayer);
    nextPlayer?.indexPlayer && ({ indexPlayer } = nextPlayer);
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
  const formResponse: string = JSON.stringify({
    type: ResponseType.UpdateWinners,
    data: JSON.stringify(winners),
    id: 0,
  });

  wss.clients.forEach((client: WebSocket): void => {
    client.send(formResponse);
  });
};

export const startGame = (currentGame: Game): void => {
  currentGame.players.forEach(({ indexPlayer, ships }) => {
    if (indexPlayer && ships) {
      const currentPlayer: User | undefined = findUser(indexPlayer);
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
    }
  });

  currentGame.players.forEach((player) => {
    player.board = JSON.parse(JSON.stringify(Array(10).fill(Array(10).fill(false))));
    player.hitBoard = JSON.parse(JSON.stringify(Array(10).fill(Array(10).fill(false))));
    player.shipsWrecked = 0;

    generatePlayerBoard(player);

    if (player.indexPlayer && currentGame.players[1].indexPlayer) {
      const currentPlayer: User | undefined = findUser(player.indexPlayer);
      const currentPlayerWebsocket: WebSocket | undefined = currentPlayer?.ws;

      updateTurn(currentGame, currentGame.players[1].indexPlayer, currentPlayerWebsocket);
    }
  });
};
