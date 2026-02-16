/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.MumbleUDP = (function() {

    /**
     * Namespace MumbleUDP.
     * @exports MumbleUDP
     * @namespace
     */
    var MumbleUDP = {};

    MumbleUDP.Audio = (function() {

        /**
         * Properties of an Audio.
         * @memberof MumbleUDP
         * @interface IAudio
         * @property {number|null} [target] Audio target
         * @property {number|null} [context] Audio context
         * @property {number|null} [senderSession] Audio senderSession
         * @property {number|Long|null} [frameNumber] Audio frameNumber
         * @property {Uint8Array|null} [opusData] Audio opusData
         * @property {Array.<number>|null} [positionalData] Audio positionalData
         * @property {number|null} [volumeAdjustment] Audio volumeAdjustment
         * @property {boolean|null} [isTerminator] Audio isTerminator
         */

        /**
         * Constructs a new Audio.
         * @memberof MumbleUDP
         * @classdesc Represents an Audio.
         * @implements IAudio
         * @constructor
         * @param {MumbleUDP.IAudio=} [properties] Properties to set
         */
        function Audio(properties) {
            this.positionalData = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Audio target.
         * @member {number|null|undefined} target
         * @memberof MumbleUDP.Audio
         * @instance
         */
        Audio.prototype.target = null;

        /**
         * Audio context.
         * @member {number|null|undefined} context
         * @memberof MumbleUDP.Audio
         * @instance
         */
        Audio.prototype.context = null;

        /**
         * Audio senderSession.
         * @member {number} senderSession
         * @memberof MumbleUDP.Audio
         * @instance
         */
        Audio.prototype.senderSession = 0;

        /**
         * Audio frameNumber.
         * @member {number|Long} frameNumber
         * @memberof MumbleUDP.Audio
         * @instance
         */
        Audio.prototype.frameNumber = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Audio opusData.
         * @member {Uint8Array} opusData
         * @memberof MumbleUDP.Audio
         * @instance
         */
        Audio.prototype.opusData = $util.newBuffer([]);

        /**
         * Audio positionalData.
         * @member {Array.<number>} positionalData
         * @memberof MumbleUDP.Audio
         * @instance
         */
        Audio.prototype.positionalData = $util.emptyArray;

        /**
         * Audio volumeAdjustment.
         * @member {number} volumeAdjustment
         * @memberof MumbleUDP.Audio
         * @instance
         */
        Audio.prototype.volumeAdjustment = 0;

        /**
         * Audio isTerminator.
         * @member {boolean} isTerminator
         * @memberof MumbleUDP.Audio
         * @instance
         */
        Audio.prototype.isTerminator = false;

        // OneOf field names bound to virtual getters and setters
        var $oneOfFields;

        /**
         * Audio Header.
         * @member {"target"|"context"|undefined} Header
         * @memberof MumbleUDP.Audio
         * @instance
         */
        Object.defineProperty(Audio.prototype, "Header", {
            get: $util.oneOfGetter($oneOfFields = ["target", "context"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new Audio instance using the specified properties.
         * @function create
         * @memberof MumbleUDP.Audio
         * @static
         * @param {MumbleUDP.IAudio=} [properties] Properties to set
         * @returns {MumbleUDP.Audio} Audio instance
         */
        Audio.create = function create(properties) {
            return new Audio(properties);
        };

        /**
         * Encodes the specified Audio message. Does not implicitly {@link MumbleUDP.Audio.verify|verify} messages.
         * @function encode
         * @memberof MumbleUDP.Audio
         * @static
         * @param {MumbleUDP.IAudio} message Audio message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Audio.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.target != null && Object.hasOwnProperty.call(message, "target"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.target);
            if (message.context != null && Object.hasOwnProperty.call(message, "context"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.context);
            if (message.senderSession != null && Object.hasOwnProperty.call(message, "senderSession"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.senderSession);
            if (message.frameNumber != null && Object.hasOwnProperty.call(message, "frameNumber"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint64(message.frameNumber);
            if (message.opusData != null && Object.hasOwnProperty.call(message, "opusData"))
                writer.uint32(/* id 5, wireType 2 =*/42).bytes(message.opusData);
            if (message.positionalData != null && message.positionalData.length) {
                writer.uint32(/* id 6, wireType 2 =*/50).fork();
                for (var i = 0; i < message.positionalData.length; ++i)
                    writer.float(message.positionalData[i]);
                writer.ldelim();
            }
            if (message.volumeAdjustment != null && Object.hasOwnProperty.call(message, "volumeAdjustment"))
                writer.uint32(/* id 7, wireType 5 =*/61).float(message.volumeAdjustment);
            if (message.isTerminator != null && Object.hasOwnProperty.call(message, "isTerminator"))
                writer.uint32(/* id 16, wireType 0 =*/128).bool(message.isTerminator);
            return writer;
        };

        /**
         * Encodes the specified Audio message, length delimited. Does not implicitly {@link MumbleUDP.Audio.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleUDP.Audio
         * @static
         * @param {MumbleUDP.IAudio} message Audio message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Audio.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an Audio message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleUDP.Audio
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleUDP.Audio} Audio
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Audio.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleUDP.Audio();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.target = reader.uint32();
                        break;
                    }
                case 2: {
                        message.context = reader.uint32();
                        break;
                    }
                case 3: {
                        message.senderSession = reader.uint32();
                        break;
                    }
                case 4: {
                        message.frameNumber = reader.uint64();
                        break;
                    }
                case 5: {
                        message.opusData = reader.bytes();
                        break;
                    }
                case 6: {
                        if (!(message.positionalData && message.positionalData.length))
                            message.positionalData = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.positionalData.push(reader.float());
                        } else
                            message.positionalData.push(reader.float());
                        break;
                    }
                case 7: {
                        message.volumeAdjustment = reader.float();
                        break;
                    }
                case 16: {
                        message.isTerminator = reader.bool();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an Audio message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleUDP.Audio
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleUDP.Audio} Audio
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Audio.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an Audio message.
         * @function verify
         * @memberof MumbleUDP.Audio
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Audio.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            var properties = {};
            if (message.target != null && message.hasOwnProperty("target")) {
                properties.Header = 1;
                if (!$util.isInteger(message.target))
                    return "target: integer expected";
            }
            if (message.context != null && message.hasOwnProperty("context")) {
                if (properties.Header === 1)
                    return "Header: multiple values";
                properties.Header = 1;
                if (!$util.isInteger(message.context))
                    return "context: integer expected";
            }
            if (message.senderSession != null && message.hasOwnProperty("senderSession"))
                if (!$util.isInteger(message.senderSession))
                    return "senderSession: integer expected";
            if (message.frameNumber != null && message.hasOwnProperty("frameNumber"))
                if (!$util.isInteger(message.frameNumber) && !(message.frameNumber && $util.isInteger(message.frameNumber.low) && $util.isInteger(message.frameNumber.high)))
                    return "frameNumber: integer|Long expected";
            if (message.opusData != null && message.hasOwnProperty("opusData"))
                if (!(message.opusData && typeof message.opusData.length === "number" || $util.isString(message.opusData)))
                    return "opusData: buffer expected";
            if (message.positionalData != null && message.hasOwnProperty("positionalData")) {
                if (!Array.isArray(message.positionalData))
                    return "positionalData: array expected";
                for (var i = 0; i < message.positionalData.length; ++i)
                    if (typeof message.positionalData[i] !== "number")
                        return "positionalData: number[] expected";
            }
            if (message.volumeAdjustment != null && message.hasOwnProperty("volumeAdjustment"))
                if (typeof message.volumeAdjustment !== "number")
                    return "volumeAdjustment: number expected";
            if (message.isTerminator != null && message.hasOwnProperty("isTerminator"))
                if (typeof message.isTerminator !== "boolean")
                    return "isTerminator: boolean expected";
            return null;
        };

        /**
         * Creates an Audio message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleUDP.Audio
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleUDP.Audio} Audio
         */
        Audio.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleUDP.Audio)
                return object;
            var message = new $root.MumbleUDP.Audio();
            if (object.target != null)
                message.target = object.target >>> 0;
            if (object.context != null)
                message.context = object.context >>> 0;
            if (object.senderSession != null)
                message.senderSession = object.senderSession >>> 0;
            if (object.frameNumber != null)
                if ($util.Long)
                    (message.frameNumber = $util.Long.fromValue(object.frameNumber)).unsigned = true;
                else if (typeof object.frameNumber === "string")
                    message.frameNumber = parseInt(object.frameNumber, 10);
                else if (typeof object.frameNumber === "number")
                    message.frameNumber = object.frameNumber;
                else if (typeof object.frameNumber === "object")
                    message.frameNumber = new $util.LongBits(object.frameNumber.low >>> 0, object.frameNumber.high >>> 0).toNumber(true);
            if (object.opusData != null)
                if (typeof object.opusData === "string")
                    $util.base64.decode(object.opusData, message.opusData = $util.newBuffer($util.base64.length(object.opusData)), 0);
                else if (object.opusData.length >= 0)
                    message.opusData = object.opusData;
            if (object.positionalData) {
                if (!Array.isArray(object.positionalData))
                    throw TypeError(".MumbleUDP.Audio.positionalData: array expected");
                message.positionalData = [];
                for (var i = 0; i < object.positionalData.length; ++i)
                    message.positionalData[i] = Number(object.positionalData[i]);
            }
            if (object.volumeAdjustment != null)
                message.volumeAdjustment = Number(object.volumeAdjustment);
            if (object.isTerminator != null)
                message.isTerminator = Boolean(object.isTerminator);
            return message;
        };

        /**
         * Creates a plain object from an Audio message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleUDP.Audio
         * @static
         * @param {MumbleUDP.Audio} message Audio
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Audio.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.positionalData = [];
            if (options.defaults) {
                object.senderSession = 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.frameNumber = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.frameNumber = options.longs === String ? "0" : 0;
                if (options.bytes === String)
                    object.opusData = "";
                else {
                    object.opusData = [];
                    if (options.bytes !== Array)
                        object.opusData = $util.newBuffer(object.opusData);
                }
                object.volumeAdjustment = 0;
                object.isTerminator = false;
            }
            if (message.target != null && message.hasOwnProperty("target")) {
                object.target = message.target;
                if (options.oneofs)
                    object.Header = "target";
            }
            if (message.context != null && message.hasOwnProperty("context")) {
                object.context = message.context;
                if (options.oneofs)
                    object.Header = "context";
            }
            if (message.senderSession != null && message.hasOwnProperty("senderSession"))
                object.senderSession = message.senderSession;
            if (message.frameNumber != null && message.hasOwnProperty("frameNumber"))
                if (typeof message.frameNumber === "number")
                    object.frameNumber = options.longs === String ? String(message.frameNumber) : message.frameNumber;
                else
                    object.frameNumber = options.longs === String ? $util.Long.prototype.toString.call(message.frameNumber) : options.longs === Number ? new $util.LongBits(message.frameNumber.low >>> 0, message.frameNumber.high >>> 0).toNumber(true) : message.frameNumber;
            if (message.opusData != null && message.hasOwnProperty("opusData"))
                object.opusData = options.bytes === String ? $util.base64.encode(message.opusData, 0, message.opusData.length) : options.bytes === Array ? Array.prototype.slice.call(message.opusData) : message.opusData;
            if (message.positionalData && message.positionalData.length) {
                object.positionalData = [];
                for (var j = 0; j < message.positionalData.length; ++j)
                    object.positionalData[j] = options.json && !isFinite(message.positionalData[j]) ? String(message.positionalData[j]) : message.positionalData[j];
            }
            if (message.volumeAdjustment != null && message.hasOwnProperty("volumeAdjustment"))
                object.volumeAdjustment = options.json && !isFinite(message.volumeAdjustment) ? String(message.volumeAdjustment) : message.volumeAdjustment;
            if (message.isTerminator != null && message.hasOwnProperty("isTerminator"))
                object.isTerminator = message.isTerminator;
            return object;
        };

        /**
         * Converts this Audio to JSON.
         * @function toJSON
         * @memberof MumbleUDP.Audio
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Audio.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Audio
         * @function getTypeUrl
         * @memberof MumbleUDP.Audio
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Audio.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleUDP.Audio";
        };

        return Audio;
    })();

    MumbleUDP.Ping = (function() {

        /**
         * Properties of a Ping.
         * @memberof MumbleUDP
         * @interface IPing
         * @property {number|Long|null} [timestamp] Ping timestamp
         * @property {boolean|null} [requestExtendedInformation] Ping requestExtendedInformation
         * @property {number|Long|null} [serverVersionV2] Ping serverVersionV2
         * @property {number|null} [userCount] Ping userCount
         * @property {number|null} [maxUserCount] Ping maxUserCount
         * @property {number|null} [maxBandwidthPerUser] Ping maxBandwidthPerUser
         */

        /**
         * Constructs a new Ping.
         * @memberof MumbleUDP
         * @classdesc Represents a Ping.
         * @implements IPing
         * @constructor
         * @param {MumbleUDP.IPing=} [properties] Properties to set
         */
        function Ping(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Ping timestamp.
         * @member {number|Long} timestamp
         * @memberof MumbleUDP.Ping
         * @instance
         */
        Ping.prototype.timestamp = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Ping requestExtendedInformation.
         * @member {boolean} requestExtendedInformation
         * @memberof MumbleUDP.Ping
         * @instance
         */
        Ping.prototype.requestExtendedInformation = false;

        /**
         * Ping serverVersionV2.
         * @member {number|Long} serverVersionV2
         * @memberof MumbleUDP.Ping
         * @instance
         */
        Ping.prototype.serverVersionV2 = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Ping userCount.
         * @member {number} userCount
         * @memberof MumbleUDP.Ping
         * @instance
         */
        Ping.prototype.userCount = 0;

        /**
         * Ping maxUserCount.
         * @member {number} maxUserCount
         * @memberof MumbleUDP.Ping
         * @instance
         */
        Ping.prototype.maxUserCount = 0;

        /**
         * Ping maxBandwidthPerUser.
         * @member {number} maxBandwidthPerUser
         * @memberof MumbleUDP.Ping
         * @instance
         */
        Ping.prototype.maxBandwidthPerUser = 0;

        /**
         * Creates a new Ping instance using the specified properties.
         * @function create
         * @memberof MumbleUDP.Ping
         * @static
         * @param {MumbleUDP.IPing=} [properties] Properties to set
         * @returns {MumbleUDP.Ping} Ping instance
         */
        Ping.create = function create(properties) {
            return new Ping(properties);
        };

        /**
         * Encodes the specified Ping message. Does not implicitly {@link MumbleUDP.Ping.verify|verify} messages.
         * @function encode
         * @memberof MumbleUDP.Ping
         * @static
         * @param {MumbleUDP.IPing} message Ping message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Ping.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.timestamp != null && Object.hasOwnProperty.call(message, "timestamp"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint64(message.timestamp);
            if (message.requestExtendedInformation != null && Object.hasOwnProperty.call(message, "requestExtendedInformation"))
                writer.uint32(/* id 2, wireType 0 =*/16).bool(message.requestExtendedInformation);
            if (message.serverVersionV2 != null && Object.hasOwnProperty.call(message, "serverVersionV2"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.serverVersionV2);
            if (message.userCount != null && Object.hasOwnProperty.call(message, "userCount"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.userCount);
            if (message.maxUserCount != null && Object.hasOwnProperty.call(message, "maxUserCount"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.maxUserCount);
            if (message.maxBandwidthPerUser != null && Object.hasOwnProperty.call(message, "maxBandwidthPerUser"))
                writer.uint32(/* id 6, wireType 0 =*/48).uint32(message.maxBandwidthPerUser);
            return writer;
        };

        /**
         * Encodes the specified Ping message, length delimited. Does not implicitly {@link MumbleUDP.Ping.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleUDP.Ping
         * @static
         * @param {MumbleUDP.IPing} message Ping message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Ping.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Ping message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleUDP.Ping
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleUDP.Ping} Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Ping.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleUDP.Ping();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.timestamp = reader.uint64();
                        break;
                    }
                case 2: {
                        message.requestExtendedInformation = reader.bool();
                        break;
                    }
                case 3: {
                        message.serverVersionV2 = reader.uint64();
                        break;
                    }
                case 4: {
                        message.userCount = reader.uint32();
                        break;
                    }
                case 5: {
                        message.maxUserCount = reader.uint32();
                        break;
                    }
                case 6: {
                        message.maxBandwidthPerUser = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Ping message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleUDP.Ping
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleUDP.Ping} Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Ping.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Ping message.
         * @function verify
         * @memberof MumbleUDP.Ping
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Ping.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.timestamp != null && message.hasOwnProperty("timestamp"))
                if (!$util.isInteger(message.timestamp) && !(message.timestamp && $util.isInteger(message.timestamp.low) && $util.isInteger(message.timestamp.high)))
                    return "timestamp: integer|Long expected";
            if (message.requestExtendedInformation != null && message.hasOwnProperty("requestExtendedInformation"))
                if (typeof message.requestExtendedInformation !== "boolean")
                    return "requestExtendedInformation: boolean expected";
            if (message.serverVersionV2 != null && message.hasOwnProperty("serverVersionV2"))
                if (!$util.isInteger(message.serverVersionV2) && !(message.serverVersionV2 && $util.isInteger(message.serverVersionV2.low) && $util.isInteger(message.serverVersionV2.high)))
                    return "serverVersionV2: integer|Long expected";
            if (message.userCount != null && message.hasOwnProperty("userCount"))
                if (!$util.isInteger(message.userCount))
                    return "userCount: integer expected";
            if (message.maxUserCount != null && message.hasOwnProperty("maxUserCount"))
                if (!$util.isInteger(message.maxUserCount))
                    return "maxUserCount: integer expected";
            if (message.maxBandwidthPerUser != null && message.hasOwnProperty("maxBandwidthPerUser"))
                if (!$util.isInteger(message.maxBandwidthPerUser))
                    return "maxBandwidthPerUser: integer expected";
            return null;
        };

        /**
         * Creates a Ping message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleUDP.Ping
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleUDP.Ping} Ping
         */
        Ping.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleUDP.Ping)
                return object;
            var message = new $root.MumbleUDP.Ping();
            if (object.timestamp != null)
                if ($util.Long)
                    (message.timestamp = $util.Long.fromValue(object.timestamp)).unsigned = true;
                else if (typeof object.timestamp === "string")
                    message.timestamp = parseInt(object.timestamp, 10);
                else if (typeof object.timestamp === "number")
                    message.timestamp = object.timestamp;
                else if (typeof object.timestamp === "object")
                    message.timestamp = new $util.LongBits(object.timestamp.low >>> 0, object.timestamp.high >>> 0).toNumber(true);
            if (object.requestExtendedInformation != null)
                message.requestExtendedInformation = Boolean(object.requestExtendedInformation);
            if (object.serverVersionV2 != null)
                if ($util.Long)
                    (message.serverVersionV2 = $util.Long.fromValue(object.serverVersionV2)).unsigned = true;
                else if (typeof object.serverVersionV2 === "string")
                    message.serverVersionV2 = parseInt(object.serverVersionV2, 10);
                else if (typeof object.serverVersionV2 === "number")
                    message.serverVersionV2 = object.serverVersionV2;
                else if (typeof object.serverVersionV2 === "object")
                    message.serverVersionV2 = new $util.LongBits(object.serverVersionV2.low >>> 0, object.serverVersionV2.high >>> 0).toNumber(true);
            if (object.userCount != null)
                message.userCount = object.userCount >>> 0;
            if (object.maxUserCount != null)
                message.maxUserCount = object.maxUserCount >>> 0;
            if (object.maxBandwidthPerUser != null)
                message.maxBandwidthPerUser = object.maxBandwidthPerUser >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a Ping message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleUDP.Ping
         * @static
         * @param {MumbleUDP.Ping} message Ping
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Ping.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.timestamp = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.timestamp = options.longs === String ? "0" : 0;
                object.requestExtendedInformation = false;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.serverVersionV2 = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.serverVersionV2 = options.longs === String ? "0" : 0;
                object.userCount = 0;
                object.maxUserCount = 0;
                object.maxBandwidthPerUser = 0;
            }
            if (message.timestamp != null && message.hasOwnProperty("timestamp"))
                if (typeof message.timestamp === "number")
                    object.timestamp = options.longs === String ? String(message.timestamp) : message.timestamp;
                else
                    object.timestamp = options.longs === String ? $util.Long.prototype.toString.call(message.timestamp) : options.longs === Number ? new $util.LongBits(message.timestamp.low >>> 0, message.timestamp.high >>> 0).toNumber(true) : message.timestamp;
            if (message.requestExtendedInformation != null && message.hasOwnProperty("requestExtendedInformation"))
                object.requestExtendedInformation = message.requestExtendedInformation;
            if (message.serverVersionV2 != null && message.hasOwnProperty("serverVersionV2"))
                if (typeof message.serverVersionV2 === "number")
                    object.serverVersionV2 = options.longs === String ? String(message.serverVersionV2) : message.serverVersionV2;
                else
                    object.serverVersionV2 = options.longs === String ? $util.Long.prototype.toString.call(message.serverVersionV2) : options.longs === Number ? new $util.LongBits(message.serverVersionV2.low >>> 0, message.serverVersionV2.high >>> 0).toNumber(true) : message.serverVersionV2;
            if (message.userCount != null && message.hasOwnProperty("userCount"))
                object.userCount = message.userCount;
            if (message.maxUserCount != null && message.hasOwnProperty("maxUserCount"))
                object.maxUserCount = message.maxUserCount;
            if (message.maxBandwidthPerUser != null && message.hasOwnProperty("maxBandwidthPerUser"))
                object.maxBandwidthPerUser = message.maxBandwidthPerUser;
            return object;
        };

        /**
         * Converts this Ping to JSON.
         * @function toJSON
         * @memberof MumbleUDP.Ping
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Ping.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Ping
         * @function getTypeUrl
         * @memberof MumbleUDP.Ping
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Ping.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleUDP.Ping";
        };

        return Ping;
    })();

    return MumbleUDP;
})();

module.exports = $root;
