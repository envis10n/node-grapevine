const backend = require('./backend');
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
     */
    constructor(client_id, client_secret, options){
        super();
        this.options = options || {};
        if(typeof client_id != 'string' || client_id.length == 0) throw new TypeError('client_id must be a valid string.');
        if(typeof client_secret != 'string' || client_secret.length == 0) throw new TypeError('client_secret must be a valid string.');
        this.client_id = client_id;
        this.client_secret = client_secret;
        this.supports = this.options.supports || [];
        this.clients = new Map();
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
                        if(dobj.status == 'success') event.resolve(dobj.payload);
                        else event.reject(dobj.error);
                    }
                }
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
            this.emit('authenticated');
        })();
    }
    wait(event){
        return new Promise((resolve, reject) => {
            let events = this.event_listeners.get(event) || [];
            events.push({resolve, reject});
            this.event_listeners.set(event, events);
        });
    }
}

module.exports = Grapevine;