var Service, Characteristic, MoxLightAccessory, uuid;
var moxUtils = require('../mox-utils.js');

module.exports = function (_service, _characteristic, _accessory, _uuid) {
  Service = _service;
  Characteristic = _characteristic;
  MoxLightAccessory = _accessory;
  uuid = _uuid;

  return MoxDimmerAccessory;
};

function MoxDimmerAccessory(platform, accessoryData)
{
    //--------------------------------------------------
    //  Initialize the parent
    //--------------------------------------------------
    MoxLightAccessory.call(this, platform, accessoryData);

    //--------------------------------------------------
    //  Register the on-off service
    //--------------------------------------------------
    
    this.lightService.getCharacteristic(Characteristic.Brightness)
        .on('get', this.getBrightness.bind(this))
        .on('set', this.setBrightness.bind(this));
    this._value = 0;

    //--------------------------------------------------
    //  Listen to global event status change events
    //--------------------------------------------------
    
    this.client.addListener('status-' + this.id, function(response, value) {
        this._log("MoxDimmerAccessory", "Received value from global event = " + value);
    
        this._value = value;
    }.bind(this));

    //--------------------------------------------------
    //  Receive the control current status to cache it
    //--------------------------------------------------
    
    this.client.receiveLightBrightnessValue(this.moduleId, this.channelId, function(response, value) {
        this._value = value;
        this._log("MoxDimmerAccessory", "Receieved initial value: " + value);
    }.bind(this));
};

MoxDimmerAccessory.prototype.getBrightness = function(callback, context) {
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
        this._log("MoxDimmerAccessory", "getValue(cache) = " + this._value);
        callback(false, /*state: */ this._value);
    }.bind(this), this.statusTimeout);

    /* Attempt to fetch the status */
    this.client.receiveLightBrightnessValue(this.moduleId, this.channelId, function(response, value) {
        /* We've been handled already? */
        if (hasBeenHandledByDefaultCallback) {
            // Meh, we were too late, so just save it for further use.
            this._value = value;
            return;
        }

        /* We got a value, so remove he default callback ASAP */
        clearTimeout(returnDefaultCallback);
        returnDefaultCallback = undefined;

        /* Save the value */
        this._value = value;

        /* Return the value */
        this._log("MoxDimmerAccessory", "getValue = " + value);
        callback(false, /*state: */ value);
    }.bind(this));
};

MoxDimmerAccessory.prototype.setBrightness = function(level, callback) {
    level = moxUtils.clamp(level, 0, 100);
    this._value = level;

    this._log("MoxDimmerAccessory", "setBrightness = " + value);
    this.client.setLightBrightnessValue(this.moduleId, this.channelId, level, function() {
        callback(false);
    });
};