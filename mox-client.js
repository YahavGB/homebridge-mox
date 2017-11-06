'use strict';

//==========================================================================================
//  Definitions
//==========================================================================================

const DEFAULT_SERVER_IP_ADDRESS   = "172.16.254.254";
const DEFAULT_SERVER_PORT         = 6670;
const DEFAULT_CLIENT_PORT         = 6666;

const log                   = require('util').log;
const dgram                 = require('dgram');
const Buffer                = require('buffer').Buffer;
const events                = require('events');
const helpers               = require('./mox-utils');
const debug                 = require('debug')('mox-client');
const MoxLtServerResponse   = require('./mox-server-response');

/* Available events:
    connect,
    disconnect,
    received(Buffer message, MoxLtServerResponse response)
    send(Buffer message) */

class MoxLtClient extends events.EventEmitter {
    constructor(clientIpAddress, clientPort, serverIpAddress, serverPort) {
        super();
        
        //--------------------------------------------------
        //  iVars setup
        //--------------------------------------------------

        this._clientIpAddress    = clientIpAddress;
        this._clientPort         = clientPort || DEFAULT_CLIENT_PORT;
        this._serverIpAddress    = serverIpAddress || DEFAULT_SERVER_IP_ADDRESS;
        this._serverPort         = serverPort || DEFAULT_SERVER_PORT;
        this._socket             = undefined;
        this._isV6IpAddress      = false;
        this._eventEmitter       = new events.EventEmitter();
        this._statusPendingQueue = { };
    }

    //==========================================================================================
    //  Public API
    //==========================================================================================

    /**
     * Opens a connection with the home MOX LT server by binding the client ip address and port.
     */
    connect()
    {
        //--------------------------------------------------
        //  Create a new socket
        //--------------------------------------------------
        this._socket = dgram.createSocket((this._isV6IpAddress ? 'udp6' : 'udp4'));
    
        //--------------------------------------------------
        //  Bind the socket events to ourselfs
        //--------------------------------------------------
        
        this._socket.on('listening', function() {
            this.emit('connect');
        }.bind(this));
    
        this._socket.on('error', function(e) {
            debug('Could not connect to the MOX LT Server using the given information. ABORTING.');
            debug('Error: ' + e);
            
            this._socket.close();
            process.exit(0);
        }.bind(this));
    
        //--------------------------------------------------
        //  Track income messages
        //--------------------------------------------------
    
        this._socket.on('message', this._socketReceivedMessageEvent.bind(this));
        this._socket.bind(this._clientPort, this._clientIpAddress);
    };
    

    /**
     * Disconnects from the MOX LT server.
     */
    disconnect()
    {
        if (typeof(this._socket) == "undefined") {
            throw new Error("The socket has not been initialized yet.");
        }

        this._socket.close();
        this.emit('disconnect');
    };

    turnOnLight(moduleId, channelId, callback)
    {
        /* Create the module id */
        moduleId = helpers.parseModuleId(moduleId);
        debug('Turning off a light with the module id: 0x'
            + (moduleId[0] + moduleId[1] + moduleId[2]).toString(16)
            + ' and channel id 0x' + channelId.toString(16));

        /* Construct the buffer */
        var buffer = new Buffer([
            /* priority: */     0x03,
            /* oid_H: */        moduleId[0],
            /* oid_M: */        moduleId[1], 
            /* oid_L: */        moduleId[2],
            /* channel_id: */   channelId,
            0x01, 0x00, 0x00, 0x02, 0x03,
            /* isOn: */ 0x01]);
    
        /* Send */
        this._sendMessage(buffer, callback);
    };

    turnOffLight(moduleId, channelId, callback)
    {
        /* Create the module id */
        moduleId = helpers.parseModuleId(moduleId);
        debug('Turning off a light with the module id: 0x'
            + (moduleId[0] + moduleId[1] + moduleId[2]).toString(16)
            + ' and channel id 0x' + channelId.toString(16));

        /* Construct the buffer */
        var buffer = new Buffer([
            /* priority: */     0x03,
            /* oid_H: */        moduleId[0],
            /* oid_M: */        moduleId[1], 
            /* oid_L: */        moduleId[2],
            /* channel_id: */   channelId,
            0x01, 0x00, 0x00, 0x02, 0x03,
            /* isOn: */ 0x00]);
    
        /* Send */
        this._sendMessage(buffer, callback);
    };
    
    receiveLightStatus(moduleId, channelId, callback)
    {
        /* Create the module id */
        moduleId = helpers.parseModuleId(moduleId);
        debug('Sending a status request for a light with the module id: 0x'
            + (moduleId[0] + moduleId[1] + moduleId[2]).toString(16)
            + ' and channel id 0x' + channelId.toString(16));

        /* Construct the buffer */
        var buffer = new Buffer([
            /* priority: */     0x02,
            /* oid_H: */        moduleId[0],
            /* oid_M: */        moduleId[1], 
            /* oid_L: */        moduleId[2],
            /* channel_id: */   channelId,
            0x01, 0x00, 0x00, 0x01, 0x02]);
            
        // console.log("\x1b[33m");
        // console.log(buffer);
        // console.log("\x1b[0m");
        
        /* Do we need to fire a completion callback afterwards? */
        if (typeof(callback) != 'undefined') {
            /* We can't immediately receive the returned status, cause its been passed
            few miliseconds later in the UDP income queue. Therefore we're creatin' a
            pending queue that allow us to call the callback when the time comes and we get the status.

            How we'll identify who belongs to whom? We use a unique UUID that identifies
            this particular accessory (moduleId, channelId). Note that in order to allow
            calls from multiple locations at once, it must be an array of allbacks.

            pendingQueue = { uuid: [Closure, Closure...] }
            */
            var uuid = helpers.uuidForAccessory(moduleId, channelId);
            // console.log("Request light status for " + uuid);

            if (typeof(this._statusPendingQueue[uuid]) == 'undefined') {
                this._statusPendingQueue[uuid] = [];
            }

            this._statusPendingQueue[uuid].push(callback);
        }

        /* Send the request */
        this._sendMessage(buffer);
    };

    setLightBrightnessValue(moduleId, channelId, value, callback)
    {
        /* Create the module id */
        moduleId = helpers.parseModuleId(moduleId);
        debug('Setting a light brightness value for the light with the module id: 0x'
            + (moduleId[0] + moduleId[1] + moduleId[2]).toString(16)
            + ' and channel id 0x' + channelId.toString(16) + ". Value: " + value);

        /* Construct the buffer */
        var buffer = new Buffer([
            /* priority: */     0x03,
            /* oid_H: */        moduleId[0],
            /* oid_M: */        moduleId[1], 
            /* oid_L: */        moduleId[2],
            /* channel_id: */   channelId,
            0x02, 0x00, 0x00, 0x02, 0x06,
            /* value: */ value,
            0x00, 0x64, 0x00
            ]);
        
        /* Send the request */
        this._sendMessage(buffer, callback);
    };
    
    receiveLightBrightnessValue(moduleId, channelId, callback)
    {
        /* Create the module id */
        moduleId = helpers.parseModuleId(moduleId);
        debug('Sending a status request to receive a light brightness value, with the module id: 0x'
            + (moduleId[0] + moduleId[1] + moduleId[2]).toString(16)
            + ' and channel id 0x' + channelId.toString(16));

        /* Construct the buffer */
        var buffer = new Buffer([
            /* priority: */     0x02,
            /* oid_H: */        moduleId[0],
            /* oid_M: */        moduleId[1], 
            /* oid_L: */        moduleId[2],
            /* channel_id: */   channelId,
            0x03, 0x00, 0x00, 0x01, 0x02]);
            
        // console.log("\x1b[33m");
        // console.log(buffer);
        // console.log("\x1b[0m");
        
        /* Do we need to fire a completion callback afterwards? */
        if (typeof(callback) != 'undefined') {
            /* Generates a unique identifier for this module id and channel id */
            var uuid = helpers.uuidForAccessory(moduleId, channelId);
            
            if (typeof(this._statusPendingQueue[uuid]) == 'undefined') {
                this._statusPendingQueue[uuid] = [];
            }

            this._statusPendingQueue[uuid].push(callback);
        }

        /* Send the request */
        this._sendMessage(buffer);
    };

    setCurtainPositionValue(moduleId, channelId, value, callback) {
         /* Create the module id */
         moduleId = helpers.parseModuleId(moduleId);
         debug('Setting a curtain position value for the curtain with the module id: 0x'
             + (moduleId[0] + moduleId[1] + moduleId[2]).toString(16)
             + ' and channel id 0x' + channelId.toString(16) + ". Value: " + value);
 
         /* Construct the buffer */
         var buffer = new Buffer([
            /* priority: */     0x03,
            /* oid_H: */        moduleId[0],
            /* oid_M: */        moduleId[1], 
            /* oid_L: */        moduleId[2],
            /* channel_id: */   channelId,
            0x01, 0x00, 0x00, 0x02, 0x04,
            value,
            0x00]);

        /* Send the request */
        this._sendMessage(buffer, callback);
    };

    receiveCurtainPositionValue(moduleId, channelId, callback)
    {
        /* Create the module id */
        moduleId = helpers.parseModuleId(moduleId);
        debug('Sending a status request to receive a curtain value, with the module id: 0x'
            + (moduleId[0] + moduleId[1] + moduleId[2]).toString(16)
            + ' and channel id 0x' + channelId.toString(16));

        /* Construct the buffer */
        var buffer = new Buffer([
        /* priority: */     0x02,
        /* oid_H: */        moduleId[0],
        /* oid_M: */        moduleId[1], 
        /* oid_L: */        moduleId[2],
        /* channel_id: */   channelId,
        0x01, 0x00, 0x00, 0x01, 0x02]);
            
        // console.log("\x1b[33m");
        // console.log(buffer);
        // console.log("\x1b[0m");
        
        /* Do we need to fire a completion callback afterwards? */
        if (typeof(callback) != 'undefined') {
            /* Generates a unique identifier for this module id and channel id */
            var uuid = helpers.uuidForAccessory(moduleId, channelId);
            
            if (typeof(this._statusPendingQueue[uuid]) == 'undefined') {
                this._statusPendingQueue[uuid] = [];
            }

            this._statusPendingQueue[uuid].push(callback);
        }

        /* Send the request */
        this._sendMessage(buffer);
    };

    //==========================================================================================
    //  Private API
    //==========================================================================================

    _socketReceivedMessageEvent(message, remote)
    {
        // console.log("\x1b[32m");
        // console.log(message);
        // console.log("\x1b[0m");

        //--------------------------------------------------
        //  Create a new response object
        //--------------------------------------------------
        
        const response = new MoxLtServerResponse(message);
        
        //--------------------------------------------------
        //  Emit the general event
        //--------------------------------------------------

        this.emit('received', message, response);

        //--------------------------------------------------
        //  We're waiting for something?
        //--------------------------------------------------

        if (typeof(this._statusPendingQueue[response.identifier]) != 'object'
            || this._statusPendingQueue[response.identifier].length < 1)
        {
            // console.log('empty (requested: ' + response.identifier + ')');
            // console.log(this._statusPendingQueue);
            return; /* Nope. */
        }
        
        var pendingQueue = this._statusPendingQueue[response.identifier];

        //--------------------------------------------------
        //  Prepare the executor callback
        //--------------------------------------------------

        var executorCallback = (value) => {
            /* Execute all pending callbacks */
            for (var i in pendingQueue) {
                pendingQueue[i].call(null, response, value);
            }

            /* Truncate the pending queue */
            this._statusPendingQueue[response.identifier] = [];

            /* Emit global events */
            // Global event 
            this.emit('status', response, value);

            // Control specific
            this.emit('status-' + response.identifier, response, value);
        };

        //--------------------------------------------------
        //  What we've got here?
        //--------------------------------------------------

        if (response.isLightStatusResponse())
        {
            executorCallback.call(this, response.tryGetLightStatus());
        }
        else if (response.isLightBrightnessResponse())
        {
            executorCallback.call(this, response.tryGetLightBrightness());
        }
        else if (response.isCurtainStatusResponse())
        {
            executorCallback.call(this, response.tryGetCurtainStatus());
        }
    }

    _sendMessage(buffer, callback) {
        //--------------------------------------------------
        //  We've received a valid buffer?
        //--------------------------------------------------
        if (!(buffer instanceof Buffer)) {
            throw new Error('The given buffer arguments must be of type Buffer.');
        }

        //--------------------------------------------------
        //  Send
        //--------------------------------------------------
        this._socket.send(buffer, 0, buffer.length, this._serverPort, this._serverIpAddress, (err, bytes) => {
            if (err) throw err;

            /* General event */
            this.emit('send', buffer);

            /* Fire the callback */
            if (typeof(callback) != "undefined") {
                callback(buffer);
            }
        });
    };
};

module.exports = MoxLtClient;