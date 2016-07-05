# MOX for Homebridge

Make your home [MOX](http://mox.com.au) accessories controllable using Apple's HomeKit with your [Homebridge](https://github.com/nfarina/homebridge) server.

This projects provides a bridge between your MOX local server and HomeKit. Thus, once you setup your homebridge server, poof - all of your supported accessories will be instantly controllable via HomeKit.

What does that means? You'll be able to:
* Control your home using each app in the App Store which supports the HomeKit protocol.
* Control your home using voice commands via Siri.
* Use the built-in Home app (iOS 10+) to control your home.

## Device Support

MOX Group already provides a fully supported home automation platform. Hence, this project that provides a bridge which "expose' your devices in a way that you can control then using HomeKit.

Since MOX only released thier LT (Lighting control) protocol, you'll only be able to control:
* Lightblubs.
* Dimmers.
* Switches.
* Curtain.

## Installation

After installing and setting up [Homebridge](https://github.com/nfarina/homebridge), you can install the Home Assistant plugin with:

    npm install -g homebridge-mox

Once installed, update your Homebridge's `config.json`.

## Configuration

As with other Homebridge plugins, you configure the Home Assistant plugin by
adding it to your `config.json`.

```json
  "platforms": [
    {
      "platform": "homebridge-mox.Mox",
      "name": "Mox",
      "server_ip_address": "172.16.254.254",
      "server_port_number": 6670,
      "client_ip_address": "172.16.1.XX",
      "client_port_number": 6666,
      "accessories": [ ... ]
     }
]
```

### Configuration Platform fields:
* `platform` and `name`: The platform name, you may leave these values.
* `server_ip_address`: Your MOX local server IP address.
* `server_port_number`: Your MOX local server port number.
* `client_ip_address`: The homebridge client IP address (the IP address of the device in which your homebridge server will be executed from).
* `client_port_number`: The homebridge client port number.
* `accessories`: List of accessories which you'd like to expose to the homebridge server.

#### Registering accessories
Since MOX doesn't provide an endpoint for feching the available accessories, we have to register them by hand. The platform definition in the `config.json` file contains an `accessories` array, which constitudes from objects with the following keys:
* `type`: The type of the accessory. The valid values are "light", "switch", "dimmer" and "window" (which controls a curtain).
* `name`: The name of the accessory (e.g. "Living room light", "Beedroom light", "Living Room curtain" etc.).
* `module_id`: The module id of the accessory. Each accessory in MOX environment constitudes from 3 numbers: oid_h, oid_m and oid_l. The module id is a string which contains these values, combined. For instance, a valid of "0x0000cc" will be valid for oid_h: 0x00, oid_m: 0x00 and oid_l: 0xcc.
* `channel_id`: The channel id of the accessory. Each accessory in MOX environment is mapped to a specific channel, which value is from 0x11 to 0x18.

** For more information on the module id and channel id, see [MOX LT protocol specification](https://jayvee.com.au/downloads/commands/mox/mox-lt-protocol-1_00_01.pdf) **

#### Fully functional example config.json:
````json
{
  "bridge": {
    "name": "My Home",
    "username": "CC:22:3D:E3:CE:30",
    "port": 51826,
    "pin": "031-45-154"
  },

  "description": "This is the My home HomeKit API configuration file.",

  "platforms": [
    {
      "platform": "homebridge-mox.Mox",
      "name": "Mox",
      "server_ip_address": "172.16.254.254",
      "server_port_number": 6670,
      "client_ip_address": "172.16.1.87",
      "client_port_number": 6666,
      "accessories":
      [
        { "type": "light", "module_id": "0x0000cb", "channel_id": "0x14", "name": "Living room hidden light" },
        { "type": "light", "module_id": "0x0000cb", "channel_id": "0x13", "name": "Kitchen line-style light" },
        { "type": "light", "module_id": "0x0000cb", "channel_id": "0x12", "name": "Living room line-style light" },
        { "type": "light", "module_id": "0x0000cf", "channel_id": "0x11", "name": "Kitchen main light" },
        { "type": "dimmer", "module_id": "0x0000cc", "channel_id": "0x11", "name": "Bedroom Dimmer" },
        { "type": "switch", "module_id": "0x0000cb", "channel_id": "0x15", "name": "Water Heater" }
      ]
    }
  ],
  "accessories": [ ]
}
````

## Contributions
* fork
* create a feature branch
* open a Pull Request


Contributions are surely welcome!!
Especially, if you can discover the IRIS (Access Control) protocol, it'll be awesome!
