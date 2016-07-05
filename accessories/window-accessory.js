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

    this.windowService.getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getCurrentPosition.bind(this));

    this.windowService.getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));

    this.windowService.getCharacteristic(Characteristic.PositionState)
        .on('get', this.getPositionState.bind(this));
};

MoxWindowAccessory.prototype.getCurrentPosition = function(callback) {
        console.log(callback.toString());

    this.client.receiveCurtainPosition(this.moduleId, this.channelId, function(value) {
        value = this.moxCurtainValueToHomeKit(value);
        this._log('MoxWindowAccessory', 'getCurrentPosition = ' + value);

        callback(false, /* value: */ value == 99 ? 100 : value);
    }.bind(this));
}

MoxWindowAccessory.prototype.getTargetPosition = function(callback) {
        console.log(callback.toString());

    this.client.receiveCurtainPosition(this.moduleId, this.channelId, function(value) {
        value = this.moxCurtainValueToHomeKit(value);
        this._log('MoxWindowAccessory', 'getTargetPosition = ' + value);

        callback(false, /* value: */ value == 99 ? 100 : value);
    }.bind(this));
}

MoxWindowAccessory.prototype.setTargetPosition = function(level, callback) {
    this.log("MoxWindowAccessory: setTargetPosition = " + level + ".");
    this.demoPosition = moxUtils.clamp(level, 0, 100);
    console.log(callback.toString());
    callback(false);
}

MoxWindowAccessory.prototype.getPositionState = function() {
    this.log("MoxWindowAccessory: getPositionState.");
    callback(false, Characteristic.PositionState.STOPPED);
}

MoxWindowAccessory.prototype.moxCurtainValueToHomeKit = function(value) {
    value = Math.abs(100 - value);
    value = value == 1 ? 0 : value;
    value = value == 99 ? 100 : value;
    return value;
}