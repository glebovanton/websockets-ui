export const ResponseType = {
  AddShips: 'add_ships',
  AddUserToRoom: 'add_user_to_room',
  Attack: 'attack',
  Reg: 'reg',
  CreateGame: 'create_game',
  StartGame: 'start_game',
  Turn: 'turn',
  Finish: 'finish',
  CreateRoom: 'create_room',
  RandomAttack: 'randomAttack',
  UpdateRoom: 'update_room',
  UpdateWinners: 'update_winners',
  SinglePlay: 'single_play',
};

export interface User {
  gameId?: string;
  name?: string;
  password?: string;
  index: string;
  indexRoom?: string;
  indexPlayer?: string;
  error?: boolean;
  errorText?: string;
  ws?: WebSocket;
  x?: number;
  y?: number;
  board?: boolean[][];
  hitBoard?: boolean[][];
  ships?: Ship[];
  shipsWrecked?: number;
}

export interface Ship {
  length: number;
  position: Cell;
  direction: boolean;
  isWrecked: boolean;
}

export interface Room {
  roomId: string;
  roomUsers: User[];
}

export interface Game {
  idOfPlayersTurn: string;
  roomId: string;
  players: User[];
}

export interface Cell {
  x: number;
  y: number;
}

export interface ShipTakenShots {
  x1: number;
  y1: number;
}

export interface Winner {
  name: string;
  wins: number;
}

export enum AttackStatus {
  Miss = 'miss',
  Shot = 'shot',
  Killed = 'killed',
}
