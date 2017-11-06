'use strict';

var Service, Characteristic, Accessory, uuid;
var moxUtils = require('../mox-utils.js');

module.exports = function (_service, _characteristic, _accessory, _uuid) {
  Service = _service;
  Characteristic = _characteristic;
  Accessory = _accessory;
  uuid = _uuid;

  return MoxAccessory;
};

function MoxAccessory(platform, accessoryData)
{
    //--------------------------------------------------
    //  Accessory data validation
    //--------------------------------------------------

    /* We got a name? */
    if (typeof(accessoryData.name) != "string") {
        this.log.error("One of your accessories is missing the \"name\" field, which is required. ABORTING.");
        process.exit(0);
    }

    /* We got a module id? */
    if (typeof(accessoryData.module_id) != "string") {
        this.log.error("One of your accessories is missing the \"module_id\" field, which is required. ABORTING.");
        process.exit(0);
    } else if (!moxUtils.verifyModuleId(accessoryData.module_id)) {
        this.log.error("The specified module id (" + accessoryData.module_id + ") is invalid. ABORTING.");
        process.exit(0);
    }

    //--------------------------------------------------
    //  Define our iVars
    //--------------------------------------------------

    this.platform        =   platform;
    this.client         =   this.platform.client;
    this.accessoryData  =   accessoryData;
    this.log            =   platform.log;

    this.id             =   moxUtils.uuidForAccessory(this.accessoryData.module_id, this.accessoryData.channel_id);
    this.name           =   this.accessoryData.name;
    this.type           =   typeof(this.accessoryData.type) != "undefined" ? this.accessoryData.type : undefined;
    this.moduleId       =   moxUtils.parseModuleId(this.accessoryData.module_id);
    this.channelId      =   parseInt(this.accessoryData.channel_id, 16);
    this.statusTimeout  =   500;

    //--------------------------------------------------
    //  Fire our parent
    //--------------------------------------------------
    Accessory.call(this, this.name, uuid.generate(String(this.id)));

    //--------------------------------------------------
    //  Setup the service
    //--------------------------------------------------
    var s = this.getService(Service.AccessoryInformation);
    
    s.setCharacteristic(Characteristic.Manufacturer, "Mox")
        .setCharacteristic(Characteristic.SerialNumber, String(this.id));
    
    if (this.type) {
        s.setCharacteristic(Characteristic.Model, this.type);
    }
};

MoxAccessory.prototype.getServices = function() {
    return this.services;
};

MoxAccessory.prototype._log = function(tag, message) {
    this.log.info("[" + tag + "] [" + this.accessoryData.module_id + ", " + this.accessoryData.channel_id + "]: " + message);
}
