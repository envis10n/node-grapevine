const WebSocket = require('ws');

/**
 * Create a websocket connection to grapevine.haus
 * @return {WebSocket} The websocket client.
 */
module.exports.connect = () => {
    return new Promise((resolve, reject) => {
        let ws = new WebSocket("wss://grapevine.haus/socket");
        ws._send = ws.send;
        ws.send = (data) => {
            ws._send(JSON.stringify(Object.assign({ts: Date.now()}, data)));
        };
        ws.on('open', () => {
            resolve(ws);
        });
        ws.on('message', (data) => {
            try {
                let dobj = JSON.parse(data);
                ws.emit('json', dobj);
                if(dobj.event)
                    ws.emit(`grapevine/${dobj.event}`, dobj);
            } catch(e) {
                ws.emit('json.error', e);
            }
        });
        ws.on('close', (code, reason) => {
            ws = null;
        });
    });
}