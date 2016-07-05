'use strict';

//==========================================================================================
//  Definitions
//==========================================================================================

var DEFAULT_SERVER_IP_ADDRESS   = "172.16.254.254";
var DEFAULT_SERVER_PORT         = 6670;
var DEFAULT_CLIENT_PORT         = 6666;

var log     = require('util').log;
var dgram   = require('dgram');
var Buffer  = require('buffer').Buffer;

//==========================================================================================
//  MoxLtClient initialization
//==========================================================================================

function MoxLtClient(clientIpAddress, clientPort, serverIpAddress, serverPort)
{
    //--------------------------------------------------
    //  iVars setup
    //--------------------------------------------------

    this.clientIpAddress    = clientIpAddress;
    this.clientPort         = clientPort || DEFAULT_CLIENT_PORT;
    this.serverIpAddress    = serverIpAddress || DEFAULT_SERVER_IP_ADDRESS;
    this.serverPort         = serverPort || DEFAULT_SERVER_PORT;
    this.socket             = undefined;
    this.isV6IpAddress      = false;
    this.pendingStatusQueue = [];
}

//==========================================================================================
//  Public API
//==========================================================================================

/**
 * Opens a connection with the home MOX LT server by binding the client ip address and port.
 */
MoxLtClient.prototype.connect = function(callback)
{
    //--------------------------------------------------
    //  Create a new socket
    //--------------------------------------------------
    this.socket = dgram.createSocket((this.isV6IpAddress ? 'udp6' : 'udp4'));

    //--------------------------------------------------
    //  Bind the socket events to ourselfs
    //--------------------------------------------------

    this.socket.on('listening', function() {
        callback();
    }.bind(this));

    this.socket.on('error', function(e) {
        log('Could not connect to the MOX LT Server using the given information. ABORTING.');
        log('Error: ' + e);

        this.socket.close();
        process.exit(0);
    }.bind(this));

    //--------------------------------------------------
    //  Track income messages
    //--------------------------------------------------

    this.socket.on('message', this._socketReceivedMessageEvent.bind(this));
    this.socket.bind(this.clientPort, this.clientIpAddress);
};

/**
 * Disconnects from the MOX LT server.
 */
MoxLtClient.prototype.disconnect = function()
{
    if (typeof(this.socket) == "undefined") {
        throw new Error("The socket has not been initialized yet.");
    }

    this.socket.close();
};

MoxLtClient.prototype.turnOnLight = function(moduleId, channelId, callback)
{
    var buffer = new Buffer([
        /* priority: */     0x03,
        /* oid_H: */        moduleId[0],
        /* oid_M: */        moduleId[1],
        /* oid_L: */        moduleId[2],
        /* channel_id: */   channelId,
        0x01, 0x00, 0x00, 0x02, 0x03,
        /* isOn: */ 0x01]);

    this._sendMessage(buffer, callback);
};

MoxLtClient.prototype.turnOffLight = function(moduleId, channelId, callback)
{
    var buffer = new Buffer([
        /* priority: */     0x03,
        /* oid_H: */        moduleId[0],
        /* oid_M: */        moduleId[1],
        /* oid_L: */        moduleId[2],
        /* channel_id: */   channelId,
        0x01, 0x00, 0x00, 0x02, 0x03,
        /* isOn: */ 0x00]);

    this._sendMessage(buffer, callback);
};

MoxLtClient.prototype.receiveLightStatus = function(moduleId, channelId, callback)
{
    var buffer = new Buffer([
        /* priority: */     0x02,
        /* oid_H: */        moduleId[0],
        /* oid_M: */        moduleId[1],
        /* oid_L: */        moduleId[2],
        /* channel_id: */   channelId,
        0x01, 0x00, 0x00, 0x01, 0x02]);

    this.pendingStatusQueue.push({
       moduleId: moduleId, channelId: channelId, callback: callback
    });

    this._sendMessage(buffer);
};

MoxLtClient.prototype.setLightBrightness = function(moduleId, channelId, value, callback)
{
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

    this._sendMessage(buffer, callback);
};

MoxLtClient.prototype.receiveLightBrightness = function(moduleId, channelId, callback) {
    var buffer = new Buffer([
        /* priority: */     0x02,
        /* oid_H: */        moduleId[0],
        /* oid_M: */        moduleId[1],
        /* oid_L: */        moduleId[2],
        /* channel_id: */   channelId,
        0x03, 0x00, 0x00, 0x01, 0x02]);

    this.pendingStatusQueue.push({
       moduleId: moduleId, channelId: channelId, callback: callback
    });

    this._sendMessage(buffer);
};

MoxLtClient.prototype.setCurtainPosition = function(moduleId, channelId, value, callback) {
    var buffer = new Buffer([
        /* priority: */     0x03,
        /* oid_H: */        moduleId[0],
        /* oid_M: */        moduleId[1],
        /* oid_L: */        moduleId[2],
        /* channel_id: */   channelId,
        0x01, 0x00, 0x00, 0x02, 0x04,
        value,
        0x00]);
    this._sendMessage(buffer, callback);
};

MoxLtClient.prototype.receiveCurtainPosition = function(moduleId, channelId, callback) {
    var buffer = new Buffer([
        /* priority: */     0x02,
        /* oid_H: */        moduleId[0],
        /* oid_M: */        moduleId[1],
        /* oid_L: */        moduleId[2],
        /* channel_id: */   channelId,
        0x01, 0x00, 0x00, 0x01, 0x02]);

    this.pendingStatusQueue.push({
       moduleId: moduleId, channelId: channelId, callback: callback
    });

    this._sendMessage(buffer);
};

//==========================================================================================
//  Events handling
//==========================================================================================

MoxLtClient.prototype._socketReceivedMessageEvent = function(message, remote)
{
    //--------------------------------------------------
    //  Attempt to resolve the income message
    //--------------------------------------------------

    this._resolveReceivedMessage(message);
    //console.log(remote.address + ':' + remote.port +' - ' + message.toString('hex'));
};

//==========================================================================================
//  Private API
//==========================================================================================

MoxLtClient.prototype._sendMessage = function(buffer, callback) {
    //--------------------------------------------------
    //  We've received a valid buffer?
    //--------------------------------------------------
    if (!(buffer instanceof Buffer)) {
        throw new Error('The given buffer arguments must be of type Buffer.');
    }

    //--------------------------------------------------
    //  Send
    //--------------------------------------------------
    this.socket.send(buffer, 0, buffer.length, this.serverPort, this.serverIpAddress, function(err, bytes) {
        if (err) throw err;

        /* Fire the callback */
        if (typeof(callback) != "undefined") {
            callback(buffer);
        }
    });
};

MoxLtClient.prototype._resolveReceivedMessage = function(buffer) {
    //--------------------------------------------------
    //  We're waiting for something?
    //--------------------------------------------------

    if (this.pendingStatusQueue.length < 1)
    {
        return; /* Nope. */
    }

    //--------------------------------------------------
    //  Create a new response object
    //--------------------------------------------------

    var responseObj = new MoxLtServerResponse(buffer);

    //--------------------------------------------------
    //  Prepare our match 'n' call callback
    //--------------------------------------------------

    var callPendingItemCallbackWithValue = function(value)
    {
        /* Iterate over the pending items */
        for (var i = 0; i < this.pendingStatusQueue.length; i++) {
            var item = this.pendingStatusQueue[i];
            if (item.moduleId[0] == responseObj.moduleId[0]
                && item.moduleId[1] == responseObj.moduleId[1]
                && item.moduleId[2] == responseObj.moduleId[2]
                && item.channelId == responseObj.channelId)
            {
                /* Fire the callback */
                item.callback(value);

                /* Remove it from the queue */
                this.pendingStatusQueue.splice(i, 1);
            }
        }
    };

    //--------------------------------------------------
    //  What we've got here?
    //--------------------------------------------------

    if (responseObj.isLightStatusResponse())
    {
        callPendingItemCallbackWithValue.call(this, responseObj.tryGetLightStatus());
    }
    else if (responseObj.isLightBrightnessResponse())
    {
        callPendingItemCallbackWithValue.call(this, responseObj.tryGetLightBrightness());
    }
    else if (responseObj.isCurtainStatusResponse())
    {
        callPendingItemCallbackWithValue.call(this, responseObj.tryGetCurtainStatus());
    }
};



//==========================================================================================
//  MoxLtServerResponse
//==========================================================================================

function MoxLtServerResponse(buffer)
{
    //--------------------------------------------------
    //  Did we got a valid response?
    //--------------------------------------------------

    if (!(buffer instanceof Buffer)) {
        throw new Error('The given buffer arguments must be of type Buffer.');
    }

    if (buffer.length < 5) {
        /* 5 = priority + oid_H + oid_M + oid_L + channel */
        throw new Error('The received buffer is invalid.');
    }

    //--------------------------------------------------
    //  Setup our iVars
    //--------------------------------------------------

    this.buffer         = buffer;
    this.priority       = buffer[0];
    this.moduleId       = [buffer[1], buffer[2], buffer[3]];
    this.channelId      = buffer[4];
};

/**
 * Tests if the response buffer matches a status update, according to the MOX LT specification.
 */
MoxLtServerResponse.prototype.isLightStatusResponse = function()
{
    //--------------------------------------------------
    //  We must receive exactly 11 bytes.
    //--------------------------------------------------
    if (this.buffer.length != 11)
    {
        return false;
    }

    //--------------------------------------------------
    //  Compare the fixed bytes
    //--------------------------------------------------

    if (this.buffer[5] != 0x01
        || this.buffer[6] != 0x00
        || this.buffer[7] != 0x00
        || this.buffer[8] != 0x03
        || this.buffer[9] != 0x03)
        {
            return false;
        }

    return true;
};


/**
 * Tests if the response buffer matches a status update, according to the MOX LT specification.
 */
MoxLtServerResponse.prototype.isLightBrightnessResponse = function()
{
    //--------------------------------------------------
    //  We must receive exactly 12 bytes.
    //--------------------------------------------------
    if (this.buffer.length != 12)
    {
        return false;
    }

    //--------------------------------------------------
    //  Compare the fixed bytes
    //--------------------------------------------------

    if (this.buffer[5] != 0x03
        || this.buffer[6] != 0x00
        || this.buffer[7] != 0x00
        || this.buffer[8] != 0x03
        || this.buffer[9] != 0x04
        || this.buffer[11] != 0x00)
        {
            return false;
        }

    return true;
};

/**
 * Tests if the response buffer matches a curtain status update, according to the MOX LT specification.
 */
MoxLtServerResponse.prototype.isCurtainStatusResponse = function()
{
    //--------------------------------------------------
    //  We must receive exactly 11 bytes.
    //--------------------------------------------------
    if (this.buffer.length != 12)
    {
        return false;
    }

    //--------------------------------------------------
    //  Compare the fixed bytes
    //--------------------------------------------------

    if (this.buffer[5] != 0x01
        || this.buffer[6] != 0x00
        || this.buffer[7] != 0x00
        || this.buffer[8] != 0x03
        || this.buffer[9] != 0x04
        || this.buffer[11] != 0x00)
        {
            return false;
        }

    return true;
};

/**
 * Attemps to get a light brightness value.
 * @return undefined|boolean
 */
MoxLtServerResponse.prototype.tryGetLightBrightness = function()
{
    if (!this.isLightBrightnessResponse())
    {
        return undefined;
    }

    return this.buffer[10];
};

/**
 * Attemps to get a curtain status.
 * @return undefined|boolean
 */
MoxLtServerResponse.prototype.tryGetCurtainStatus = function()
{
    if (!this.isCurtainStatusResponse())
    {
        return undefined;
    }

    return this.buffer[10];
};

/**
 * Attemps to get a light status.
 * @return undefined|boolean
 */
MoxLtServerResponse.prototype.tryGetLightStatus = function()
{
    if (!this.isLightStatusResponse())
    {
        return undefined;
    }

    return this.buffer[10] == 0x01;
};

//==========================================================================================
//  Exportation
//==========================================================================================

module.exports = MoxLtClient;
