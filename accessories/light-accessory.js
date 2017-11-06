var Service, Characteristic, MoxAccessory, uuid;

module.exports = function (_service, _characteristic, _accessory, _uuid) {
  Service = _service;
  Characteristic = _characteristic;
  MoxAccessory = _accessory;
  uuid = _uuid;

  return MoxLightAccessory;
};

function MoxLightAccessory(platform, accessoryData)
{
    //--------------------------------------------------
    //  Initialize the parent
    //--------------------------------------------------
    MoxAccessory.call(this, platform, accessoryData);

    //--------------------------------------------------
    //  Register the on-off service
    //--------------------------------------------------
    this._status = false;
    this.lightService = this.addService(new Service.Lightbulb(this.name));
    this.lightService.getCharacteristic(Characteristic.On)
        .on('get', this.getState.bind(this))
        .on('set', this.setState.bind(this));


    //--------------------------------------------------
    //  Listen to global event status change events
    //--------------------------------------------------
    
    this.client.addListener('status-' + this.id, function(response, value) {
        this._log("MoxLightAccessory", "Received status from global event = " + value);
        
        this._status = value;
    }.bind(this));

    //--------------------------------------------------
    //  Receive the control current status to cache it
    //--------------------------------------------------
    
    this.client.receiveLightStatus(this.moduleId, this.channelId, function(response, value) {
        this._status = value;
        this._log("MoxLightAccessory", "Receieved initial status: " + value);
    }.bind(this));
};

MoxLightAccessory.prototype.getState = function(callback, context) {
    /* We need to return the control state in a short time otherwise
    HomeKit will consider ourselfs as not respondin'. To make sure this will occur for sure,
    we'll request the control status, but at the same time register a timeout function.
    If the given amount of time will paass, we'll return the default value that we already cached.

    It shouldn't be that problematic cause we're listening to global events and therefore
    each time the control status changed (no matther from which device) we'll get notification and change
    our cached value. */

    /* Register the timeout callback */
    var hasBeenHandledByDefaultCallback = false;
    var returnDefaultCallback = setTimeout(function() {
        /* Mark */
        hasBeenHandledByDefaultCallback = true;

        /* Return the value */
        this._log("MoxLightAccessory", "getState(cache) = " + this._status);
        callback(false, /*state: */ this._status ? 1 : 0);
    }.bind(this), this.statusTimeout);

    /* Attempt to fetch the status */
    this.client.receiveLightStatus(this.moduleId, this.channelId, function(response, value) {
        /* We've been handled already? */
        if (hasBeenHandledByDefaultCallback) {
            // Meh, we were too late, so just save it for further use.
            this._status = value;
            return;
        }

        /* We got a value, so remove he default callback ASAP */
        clearTimeout(returnDefaultCallback);
        returnDefaultCallback = undefined;

        /* Save the value */
        this._status = value;

        /* Return the value */
        this._log("MoxLightAccessory", "getState = " + value);
        callback(false, /*state: */ value ? 1 : 0);
    }.bind(this));
};

MoxLightAccessory.prototype.setState = function(value, callback) {
    this._status = value;
    this._log("MoxLightAccessory", "setState = " + value + ".");
    
    if (value) {
        this.client.turnOnLight(this.moduleId, this.channelId, function() {
            callback();
        });
    } else {
        this.client.turnOffLight(this.moduleId, this.channelId, function() {
            callback();
        });
    }
};