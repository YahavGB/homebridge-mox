var Service, Characteristic, MoxAccessory, uuid;

module.exports = function (_service, _characteristic, _accessory, _uuid) {
  Service = _service;
  Characteristic = _characteristic;
  MoxAccessory = _accessory;
  uuid = _uuid;

  return MoxSwitchAccessory;
};

function MoxSwitchAccessory(platform, accessoryData)
{
    //--------------------------------------------------
    //  Initialize the parent
    //--------------------------------------------------
    MoxAccessory.call(this, platform, accessoryData);

    //--------------------------------------------------
    //  Register the on-off service
    //--------------------------------------------------
    this.lightService = this.addService(new Service.Switch(this.name));
    this.lightService.getCharacteristic(Characteristic.On)
        .on('get', this.getState.bind(this))
        .on('set', this.setState.bind(this));
};

MoxSwitchAccessory.prototype.getState = function(callback, context) {
    setTimeout(function() {
        this.client.receiveLightStatus(this.moduleId, this.channelId, function(result) {
            this._log("MoxSwitchAccessory", "getState = " + result);
                callback(false, /*state: */ result ? 1 : 0);
            }.bind(this));
    }.bind(this), 50);
};

MoxSwitchAccessory.prototype.setState = function(value, callback) {
    this._log("MoxSwitchAccessory", "setState = " + value + ".");
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