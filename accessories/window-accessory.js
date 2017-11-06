var Service, Characteristic, MoxAccessory, uuid;
var moxUtils = require('../mox-utils.js');

module.exports = function (_service, _characteristic, _accessory, _uuid) {
  Service = _service;
  Characteristic = _characteristic;
  MoxAccessory = _accessory;
  uuid = _uuid;

  return MoxWindowAccessory;
};

function MoxWindowAccessory(platform, accessoryData)
{
    //--------------------------------------------------
    //  Initialize the parent
    //--------------------------------------------------
    MoxAccessory.call(this, platform, accessoryData);
    this.targetPosition = -1;

    //--------------------------------------------------
    //  Register the on-off service
    //--------------------------------------------------
    this.windowService = this.addService(new Service.WindowCovering(this.name));
    this.demoPosition = 0;
    this.demoState = Characteristic.PositionState.STOPPED;
    this._currentPosition = 0;
    this._targetPosition = 0;
    this._state = Characteristic.PositionState.STOPPED;

    this.windowService.getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getCurrentPosition.bind(this));

    this.windowService.getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));

    this.windowService.getCharacteristic(Characteristic.PositionState)
        .on('get', this.getPositionState.bind(this));
    

    //--------------------------------------------------
    //  Listen to global event status change events
    //--------------------------------------------------
    
    this.client.addListener('status-' + this.id, function(response, value) {
        this._log("MoxWindowAccessory", "Received current position from global event = " + value);
    
        this._currentPosition = value;
    }.bind(this));

    //--------------------------------------------------
    //  Receive the control current status to cache it
    //--------------------------------------------------
    
    this.client.receiveCurtainPositionValue(this.moduleId, this.channelId, function(response, value) {
        this._currentPosition = value;
        this._targetPosition = value;
        this._log("MoxWindowAccessory", "Receieved initial position: " + value);
    }.bind(this));
};

/* Gets the current position of the curation */
MoxWindowAccessory.prototype.getCurrentPosition = function(callback) {
    /* Register the timeout callback */
    var hasBeenHandledByDefaultCallback = false;
    var returnDefaultCallback = setTimeout(function() {
        /* Mark */
        hasBeenHandledByDefaultCallback = true;

        /* Return the value */
        this._log("MoxWindowAccessory", "getCurrentPosition(cache) = " + this._currentPosition);
        callback(false, /* value: */ this.moxCurtainValueToHomeKit(this._currentPosition));
    }.bind(this), this.statusTimeout);

    /* Attempt to fetch the status */
    this.client.receiveCurtainPositionValue(this.moduleId, this.channelId, function(response, value) {
        /* We've been handled already? */
        if (hasBeenHandledByDefaultCallback) {
            // Meh, we were too late, so just save it for further use.
            this._currentPosition = value;
            return;
        }

        /* We got a value, so remove he default callback ASAP */
        clearTimeout(returnDefaultCallback);
        returnDefaultCallback = undefined;

        /* Save the value */
        this._currentPosition = value;

        /* Return the value */
        this._log("MoxWindowAccessory", "getCurrentPosition = " + value);
        
        value = this._moxCurtainValueToHomeKit(value);
        callback(false, /* value: */ value == 99 ? 100 : value);
    }.bind(this));
}

/* Gets the window target position (the position the user aims for) */
MoxWindowAccessory.prototype.getTargetPosition = function(callback) {
    /* Log */
    this._log("MoxWindowAccessory", "getTargetPosition = " + this._targetPosition);
    
    /* Return the target position */
    callback(false, this._targetPosition);
}

/* Sets the window target position (the position the user aims to get into) */
MoxWindowAccessory.prototype.setTargetPosition = function(level, callback) {
    this.log("MoxWindowAccessory: setTargetPosition = " + level + ".");
    level = moxUtils.clamp(level, 0, 100);
    this._targetPosition = level;

    /* Update the position state */
    this._syncState();
    this.windowService.setCharacteristic(Characteristic.PositionState, this._state);

    /* Update the curation */
    this.client.setCurtainPositionValue(this.moduleId, this.channelId, level, function() {
        callback(false, level);
    });
}

MoxWindowAccessory.prototype.getPositionState = function() {
    this._syncState();
    this.log("MoxWindowAccessory", "getPositionState = " + this._state);
    
    callback(false, this._state);
}

MoxWindowAccessory.prototype._syncState = function() {
    /* What is our value ? */
    if (this._targetPosition > this._currentPosition) {
        this._state = Characteristic.PositionState.INCREASING;
    } else if (this._targetPosition < this._currentPosition) {
        this._state = Characteristic.PositionState.DECREASING;
    } else if (this._targetPosition = this._currentPosition) {
        this._state = Characteristic.PositionState.STOPPED;
    }
}

MoxWindowAccessory.prototype._moxCurtainValueToHomeKit = function(value) {
    value = Math.abs(100 - value);
    value = value == 1 ? 0 : value;
    value = value == 99 ? 100 : value;
    return value;
}