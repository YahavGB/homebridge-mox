'use strict';

const DEFAULT_IP_ADDRESS = "172.16.254.254";
const DEFAULT_PORT_NUMBER = 6670;

const request     = require("request");
const async       = require("async");
const moxUtils    = require('./mox-utils.js');
const MoxLtClient = require('./mox-client.js');
var Service, Characteristic, Accessory, uuid;

var MoxAccessory;
var MoxLightAccessory;
var MoxDimmerAccessory;
var MoxWindowAccessory;
var MoxSwitchAccessory;

//==========================================================================================
//  Exports block
//==========================================================================================
module.exports = function(homebridge) {
    //--------------------------------------------------
    //  Setup the global vars
    //--------------------------------------------------
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.hap.Accessory;
    uuid = homebridge.hap.uuid;

    //--------------------------------------------------
    //  Setup the MOX accessories
    //--------------------------------------------------
    
    /* Load */
    MoxAccessory        = require('./accessories/accessory.js')(Service, Characteristic, Accessory, uuid);
    MoxLightAccessory   = require('./accessories/light-accessory.js')(Service, Characteristic, MoxAccessory, uuid);
    MoxDimmerAccessory  = require('./accessories/dimmer-accessory.js')(Service, Characteristic, MoxLightAccessory, uuid);
    MoxWindowAccessory  = require('./accessories/window-accessory.js')(Service, Characteristic, MoxAccessory, uuid);
    MoxSwitchAccessory  = require('./accessories/switch-accessory.js')(Service, Characteristic, MoxAccessory, uuid);

    /* Fix inheritance, since we've loaded our classes before the Accessory class has been loaded */
    moxUtils.fixInheritance(MoxAccessory, Accessory);
    moxUtils.fixInheritance(MoxLightAccessory, MoxAccessory);
    moxUtils.fixInheritance(MoxDimmerAccessory, MoxLightAccessory);
    moxUtils.fixInheritance(MoxWindowAccessory, MoxAccessory);
    moxUtils.fixInheritance(MoxSwitchAccessory, MoxAccessory);

    //--------------------------------------------------
    //  Register ourselfs with homebridge
    //--------------------------------------------------
    
    homebridge.registerPlatform("homebridge-mox", "Mox", MoxPlatform);
};

//==========================================================================================
//  Helpers
//==========================================================================================


//==========================================================================================
//  Mox Platform
//==========================================================================================

function MoxPlatform(log, config) {
    //--------------------------------------------------
    //  iVars definition
    //--------------------------------------------------
    this.clientIpAddress     = undefined;
    this.clientPortNumber    = undefined;
    this.serverIpAddress     = undefined;
    this.serverPortNumber    = undefined;
    this.config	             = config;
    this.log                 = log;
    this.foundAccessories    = [];
    this.client              = undefined;

    //--------------------------------------------------
    //  iVars setup
    //--------------------------------------------------
    
    /* Client IP */
    if (typeof(config.client_ip_address) == "undefined") {
        throw new Error('You must specify the client IP address in your config file.');
    }

    this.clientIpAddress = config.client_ip_address;

    /* Server Port */
    if (typeof(config.client_port_number) != "undefined") {
      this.clientPortNumber = config.client_port_number;
    }

    /* Server IP */
    if (typeof(config.server_ip_address) != "undefined") {
      this.serverIpAddress = config.server_ip_address;
    }

    /* Server Port */
    if (typeof(config.server_port_number) != "undefined") {
      this.serverPortNumber = config.server_port_number;
    }
};

// Invokes callback(accessories[])
MoxPlatform.prototype.accessories = function(callback) {
    //--------------------------------------------------
    //  Initiate the MOX client
    //--------------------------------------------------

    this.log.info("Connecting to the local MOX server...");
    this.client = new MoxLtClient(this.clientIpAddress, this.clientPortNumber,
                this.serverIpAddress, this.serverPortNumber);

    this.client.on('connect', function() {
        this.log.info('Mox LT Client is listening via UDP on ' + this.client._socket.address().address + ":" + this.client._socket.address().port + '...');

        this.log.info("Registering the accessories list...");
        this.foundAccessories = []; /* reset */

        for (var entry of this.config.entries) {
            /* Each entry is a room with set of accessories.
            In HomeKit we can't seed the rooms, unfortunatly, so we'll just get the accessories */
            
            for (var accessoryData of entry.accessories) {
                var accessory = this.accessoryFactory(accessoryData);
                if (accessory) {
                    this.foundAccessories.push(accessory);
                } else {
                    this.log.error("Ignoring unknown accessory (type: %s).", accessoryData.type);
                }
            }
        }

        callback(this.foundAccessories.sort(function (a, b) {
            return (a.name > b.name) - (a.name < b.name);
        }));
    }.bind(this));
    
    this.client.connect();
};

MoxPlatform.prototype.accessoryFactory = function(entry) {
    if (!entry.type) {
        return undefined;
    }

    switch (entry.type.toLowerCase())
    {
        case "light":
            return new MoxLightAccessory(this, entry);
        case "dimmer":
            return new MoxDimmerAccessory(this, entry);
        case "switch":
            return new MoxSwitchAccessory(this, entry);
        case "window":
            return new MoxWindowAccessory(this, entry);
        default:
            return undefined;
    }
};