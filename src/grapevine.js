const backend = require('./backend');
const uuid = require('uuid/v4');
const EventEmitter = require('events');

/**
 * Class representing a connection to grapevine.haus
 * 
 * @extends EventEmitter
 */
class Grapevine extends EventEmitter {
    /**
     * @param {String} client_id Your game's client ID from grapevine.haus.
     * @param {String} client_secret Your game's client secret from grapevine.haus.
     * @param {Object} options Connection options.
     * @param {Array} options.supports Supported features of grapevine.
     * @param {Array} options.channels Channels to subscribe to on authentication.
     * @param {String} options.user_agent User agent provided to grapevine for your game.
     * @param {Array} options.players List of players currently online. Useful if you have players on already when creating.
     */
    constructor(client_id, client_secret, options){
        super();
        this.options = options || {};
        if(typeof client_id != 'string' || client_id.length == 0) throw new TypeError('client_id must be a valid string.');
        if(typeof client_secret != 'string' || client_secret.length == 0) throw new TypeError('client_secret must be a valid string.');
        this.client_id = client_id;
        this.client_secret = client_secret;
        this.supports = this.options.supports || [];
        this.players = this.options.players || [];
        this.channels = this.options.channels || [];
        this.user_agent = this.options.user_agent || `NodeGrapevine ${PACKAGE_VERSION}`;
        this.socket = null;
        this.event_listeners = new Map();
        (async () => {
            this.socket = await backend.connect();
            this.emit('connected');
            this.socket.on('json', (dobj) => {
                if(!dobj.event) return;
                let events = this.event_listeners.get(dobj.event);
                for(let event of events){
                    if(dobj.status !== undefined){
                        if(dobj.status == 'success') event.resolve(dobj);
                        else event.reject(dobj.error);
                    } else {
                        event.resolve(dobj);
                    }
                }
                event_listeners.delete(dobj.event);
            });
            this.socket.send({
                event: 'authenticate',
                payload: {
                    client_id: this.client_id,
                    client_secret: this.client_secret,
                    supports: this.supports,
                    channels: this.channels,
                    version: "2.3.0",
                    user_agent: this.user_agent
                }
            });
            await this.wait('authenticate');
            this.socket.on('grapevine/heartbeat', () => {
                this.socket.send({
                    event: "heartbeat",
                    payload: {
                        players: this.players
                    }
                });
                this.emit('heartbeat');
            });
            this.emit('authenticated');
        })();
    }
    /**
     * Send a sign-in player event.
     * @param {String} name Name of the player to send a sign-in event for.
     */
    sign_in(name){
        this.socket.send({
            event: 'players/sign-in',
            payload: {
                name
            }
        });
    }
    /**
     * Send a sign-out player event.
     * @param {String} name Name of the player to send a sign-out event for.
     */
    sign_out(name){
        this.socket.send({
            event: 'players/sign-out',
            payload: {
                name
            }
        });
    }
    /**
     * Wait for a grapevine event.
     * @param {String} event Name of the event to wait on.
     * @return {Promise} A promise that resolves to the object sent from grapevine.
     */
    wait(event){
        return new Promise((resolve, reject) => {
            let events = this.event_listeners.get(event) || [];
            events.push({resolve, reject});
            this.event_listeners.set(event, events);
        });
    }
    /**
     * Send a status event. Causes grapevine to send players/status for each game online, unless a game name is provided.
     * @param {String} game (Optional) Get the status of a specific game.
     */
    get_status(game){
        if(typeof game == "string" && game.length > 0) {
            this.socket.send({
                event: 'games/status',
                ref: uuid(),
                payload: {
                    game
                }
            });
        } else {
            this.socket.send({
                event: 'players/status',
                ref: uuid()
            });
        }
    }
    /**
     * Add a player to the internal player list used for the online players status.
     * @param {String} name Name of the player to add to the list.
     * @param {Boolean} online Whether or not to send a sign in event to grapevine.
     * @return {Boolean} Whether or not the operation was successful.
     */
    add_player(name, online){
        if(!this.players.find(el=>el == name)){
            this.players.push(name);
            if(online){
                this.sign_in(name);
            }
            return true;
        } else {
            return false;
        }
    }
    /**
     * Remove a player from the internal player list used for the online players status.
     * @param {String} name Name of the player to remove from the list.
     * @param {Boolean} online Whether or not to send a sign out event to grapevine.
     * @return {Boolean} Whether or not the operation was successful.
     */
    remove_player(name, online){
        let i = this.players.findIndex(el=>el == name);
        if(i != -1){
            this.players.splice(i, 1);
            if(online){
                this.sign_out(name);
            }
            return true;
        } else {
            return false;
        }
    }
    /**
     * Send a tell to another player via grapevine.
     * @param {String} message Message to be sent.
     * @param {String} from Name of the player sending the tell.
     * @param {String} target Name of the player the tell is being sent to. May be in the format Player@Game instead of explicitly providing the game name.
     * @param {String} game_name Name of the game the player is playing.
     * @return {Promise} A promise the resolves to sent, or rejects with a send error.
     */
    send_tell(message, from, target, game_name){
        return new Promise(async (resolve, reject) => {
            let spl = target.split('@');
            let game = game_name;
            if(spl.length > 1){
                game = spl[1];
            }
            target = spl[0];
            try {
                this.socket.send({
                    event: 'tells/send',
                    ref: uuid(),
                    payload: {
                        from_name: from,
                        to_game: game,
                        to_name: target,
                        sent_at: new Date().toISOString(),
                        message
                    }
                });
                let dobj = await this.wait('tells/send');
                resolve('Sent');
            } catch(e) {
                reject(e);
            }
        });
    }
}

module.exports = Grapevine;