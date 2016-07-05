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
};

MoxDimmerAccessory.prototype.getBrightness = function(callback, context) {
    setTimeout(function() {
        this.client.receiveLightStatus(this.moduleId, this.channelId, function(value) {
            this._log("MoxDimmerAccessory", "getBrightness = " + value);
                callback(false, /* value: */ value);
            }.bind(this));
    }.bind(this), 50);
};

MoxDimmerAccessory.prototype.setBrightness = function(level, callback) {
    level = moxUtils.clamp(level, 0, 100);
    this._log("MoxDimmerAccessory", "setBrightness = " + value + ".");
    this.client.setLightBrightness(this.moduleId, this.channelId, level, function() {
        callback();
    });
};