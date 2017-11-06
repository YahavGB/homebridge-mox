'use strict';

const helpers = require('./mox-utils');

module.exports = class MoxLtServerResponse {
    constructor(buffer)
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
        this.identifier     = helpers.uuidForAccessory(this.moduleId, this.channelId);
    };

    /**
     * Tests if the response buffer matches a status update, according to the MOX LT specification.
     */
    isLightStatusResponse()
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
    isLightBrightnessResponse()
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
    isCurtainStatusResponse()
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
    tryGetLightBrightness()
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
    tryGetCurtainStatus()
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
    tryGetLightStatus()
    {
        if (!this.isLightStatusResponse())
        {
            return undefined;
        }

        return this.buffer[10] == 0x01;
    };
};