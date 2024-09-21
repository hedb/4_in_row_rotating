// Stone.js

export class Stone {
    static idCounter = 0;
    constructor(playerId, id = null) {
        this.playerId = playerId;
        if (id !== null) {
            this.id = id;
        } else {
            this.id = Stone.idCounter++;
        }
    }
    setElement(stoneElement) {
        this.stoneElement = stoneElement;
    }
}
