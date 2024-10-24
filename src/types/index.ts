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
    randomAttack: 'randomAttack',
    UpdateRoom: 'update_room',
    UpdateWinners: 'update_winners',
    SinglePlay: 'single_play',
};

export interface User {
    name?: string;
    password?: string;
    index: string;
    indexRoom?: number;
    error: boolean;
    errorText: string;
    ws?: WebSocket;
}
