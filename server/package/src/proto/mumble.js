/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.MumbleProto = (function() {

    /**
     * Namespace MumbleProto.
     * @exports MumbleProto
     * @namespace
     */
    var MumbleProto = {};

    MumbleProto.Version = (function() {

        /**
         * Properties of a Version.
         * @memberof MumbleProto
         * @interface IVersion
         * @property {number|null} [versionV1] Version versionV1
         * @property {number|Long|null} [versionV2] Version versionV2
         * @property {string|null} [release] Version release
         * @property {string|null} [os] Version os
         * @property {string|null} [osVersion] Version osVersion
         */

        /**
         * Constructs a new Version.
         * @memberof MumbleProto
         * @classdesc Represents a Version.
         * @implements IVersion
         * @constructor
         * @param {MumbleProto.IVersion=} [properties] Properties to set
         */
        function Version(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Version versionV1.
         * @member {number} versionV1
         * @memberof MumbleProto.Version
         * @instance
         */
        Version.prototype.versionV1 = 0;

        /**
         * Version versionV2.
         * @member {number|Long} versionV2
         * @memberof MumbleProto.Version
         * @instance
         */
        Version.prototype.versionV2 = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Version release.
         * @member {string} release
         * @memberof MumbleProto.Version
         * @instance
         */
        Version.prototype.release = "";

        /**
         * Version os.
         * @member {string} os
         * @memberof MumbleProto.Version
         * @instance
         */
        Version.prototype.os = "";

        /**
         * Version osVersion.
         * @member {string} osVersion
         * @memberof MumbleProto.Version
         * @instance
         */
        Version.prototype.osVersion = "";

        /**
         * Creates a new Version instance using the specified properties.
         * @function create
         * @memberof MumbleProto.Version
         * @static
         * @param {MumbleProto.IVersion=} [properties] Properties to set
         * @returns {MumbleProto.Version} Version instance
         */
        Version.create = function create(properties) {
            return new Version(properties);
        };

        /**
         * Encodes the specified Version message. Does not implicitly {@link MumbleProto.Version.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.Version
         * @static
         * @param {MumbleProto.IVersion} message Version message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Version.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.versionV1 != null && Object.hasOwnProperty.call(message, "versionV1"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.versionV1);
            if (message.release != null && Object.hasOwnProperty.call(message, "release"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.release);
            if (message.os != null && Object.hasOwnProperty.call(message, "os"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.os);
            if (message.osVersion != null && Object.hasOwnProperty.call(message, "osVersion"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.osVersion);
            if (message.versionV2 != null && Object.hasOwnProperty.call(message, "versionV2"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint64(message.versionV2);
            return writer;
        };

        /**
         * Encodes the specified Version message, length delimited. Does not implicitly {@link MumbleProto.Version.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.Version
         * @static
         * @param {MumbleProto.IVersion} message Version message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Version.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Version message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.Version
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.Version} Version
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Version.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.Version();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.versionV1 = reader.uint32();
                        break;
                    }
                case 5: {
                        message.versionV2 = reader.uint64();
                        break;
                    }
                case 2: {
                        message.release = reader.string();
                        break;
                    }
                case 3: {
                        message.os = reader.string();
                        break;
                    }
                case 4: {
                        message.osVersion = reader.string();
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
         * Decodes a Version message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.Version
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.Version} Version
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Version.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Version message.
         * @function verify
         * @memberof MumbleProto.Version
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Version.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.versionV1 != null && message.hasOwnProperty("versionV1"))
                if (!$util.isInteger(message.versionV1))
                    return "versionV1: integer expected";
            if (message.versionV2 != null && message.hasOwnProperty("versionV2"))
                if (!$util.isInteger(message.versionV2) && !(message.versionV2 && $util.isInteger(message.versionV2.low) && $util.isInteger(message.versionV2.high)))
                    return "versionV2: integer|Long expected";
            if (message.release != null && message.hasOwnProperty("release"))
                if (!$util.isString(message.release))
                    return "release: string expected";
            if (message.os != null && message.hasOwnProperty("os"))
                if (!$util.isString(message.os))
                    return "os: string expected";
            if (message.osVersion != null && message.hasOwnProperty("osVersion"))
                if (!$util.isString(message.osVersion))
                    return "osVersion: string expected";
            return null;
        };

        /**
         * Creates a Version message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.Version
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.Version} Version
         */
        Version.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.Version)
                return object;
            var message = new $root.MumbleProto.Version();
            if (object.versionV1 != null)
                message.versionV1 = object.versionV1 >>> 0;
            if (object.versionV2 != null)
                if ($util.Long)
                    (message.versionV2 = $util.Long.fromValue(object.versionV2)).unsigned = true;
                else if (typeof object.versionV2 === "string")
                    message.versionV2 = parseInt(object.versionV2, 10);
                else if (typeof object.versionV2 === "number")
                    message.versionV2 = object.versionV2;
                else if (typeof object.versionV2 === "object")
                    message.versionV2 = new $util.LongBits(object.versionV2.low >>> 0, object.versionV2.high >>> 0).toNumber(true);
            if (object.release != null)
                message.release = String(object.release);
            if (object.os != null)
                message.os = String(object.os);
            if (object.osVersion != null)
                message.osVersion = String(object.osVersion);
            return message;
        };

        /**
         * Creates a plain object from a Version message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.Version
         * @static
         * @param {MumbleProto.Version} message Version
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Version.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.versionV1 = 0;
                object.release = "";
                object.os = "";
                object.osVersion = "";
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.versionV2 = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.versionV2 = options.longs === String ? "0" : 0;
            }
            if (message.versionV1 != null && message.hasOwnProperty("versionV1"))
                object.versionV1 = message.versionV1;
            if (message.release != null && message.hasOwnProperty("release"))
                object.release = message.release;
            if (message.os != null && message.hasOwnProperty("os"))
                object.os = message.os;
            if (message.osVersion != null && message.hasOwnProperty("osVersion"))
                object.osVersion = message.osVersion;
            if (message.versionV2 != null && message.hasOwnProperty("versionV2"))
                if (typeof message.versionV2 === "number")
                    object.versionV2 = options.longs === String ? String(message.versionV2) : message.versionV2;
                else
                    object.versionV2 = options.longs === String ? $util.Long.prototype.toString.call(message.versionV2) : options.longs === Number ? new $util.LongBits(message.versionV2.low >>> 0, message.versionV2.high >>> 0).toNumber(true) : message.versionV2;
            return object;
        };

        /**
         * Converts this Version to JSON.
         * @function toJSON
         * @memberof MumbleProto.Version
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Version.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Version
         * @function getTypeUrl
         * @memberof MumbleProto.Version
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Version.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.Version";
        };

        return Version;
    })();

    MumbleProto.UDPTunnel = (function() {

        /**
         * Properties of a UDPTunnel.
         * @memberof MumbleProto
         * @interface IUDPTunnel
         * @property {Uint8Array} packet UDPTunnel packet
         */

        /**
         * Constructs a new UDPTunnel.
         * @memberof MumbleProto
         * @classdesc Represents a UDPTunnel.
         * @implements IUDPTunnel
         * @constructor
         * @param {MumbleProto.IUDPTunnel=} [properties] Properties to set
         */
        function UDPTunnel(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * UDPTunnel packet.
         * @member {Uint8Array} packet
         * @memberof MumbleProto.UDPTunnel
         * @instance
         */
        UDPTunnel.prototype.packet = $util.newBuffer([]);

        /**
         * Creates a new UDPTunnel instance using the specified properties.
         * @function create
         * @memberof MumbleProto.UDPTunnel
         * @static
         * @param {MumbleProto.IUDPTunnel=} [properties] Properties to set
         * @returns {MumbleProto.UDPTunnel} UDPTunnel instance
         */
        UDPTunnel.create = function create(properties) {
            return new UDPTunnel(properties);
        };

        /**
         * Encodes the specified UDPTunnel message. Does not implicitly {@link MumbleProto.UDPTunnel.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.UDPTunnel
         * @static
         * @param {MumbleProto.IUDPTunnel} message UDPTunnel message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UDPTunnel.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.packet);
            return writer;
        };

        /**
         * Encodes the specified UDPTunnel message, length delimited. Does not implicitly {@link MumbleProto.UDPTunnel.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.UDPTunnel
         * @static
         * @param {MumbleProto.IUDPTunnel} message UDPTunnel message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UDPTunnel.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a UDPTunnel message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.UDPTunnel
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.UDPTunnel} UDPTunnel
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UDPTunnel.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.UDPTunnel();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.packet = reader.bytes();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("packet"))
                throw $util.ProtocolError("missing required 'packet'", { instance: message });
            return message;
        };

        /**
         * Decodes a UDPTunnel message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.UDPTunnel
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.UDPTunnel} UDPTunnel
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UDPTunnel.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a UDPTunnel message.
         * @function verify
         * @memberof MumbleProto.UDPTunnel
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        UDPTunnel.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!(message.packet && typeof message.packet.length === "number" || $util.isString(message.packet)))
                return "packet: buffer expected";
            return null;
        };

        /**
         * Creates a UDPTunnel message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.UDPTunnel
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.UDPTunnel} UDPTunnel
         */
        UDPTunnel.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.UDPTunnel)
                return object;
            var message = new $root.MumbleProto.UDPTunnel();
            if (object.packet != null)
                if (typeof object.packet === "string")
                    $util.base64.decode(object.packet, message.packet = $util.newBuffer($util.base64.length(object.packet)), 0);
                else if (object.packet.length >= 0)
                    message.packet = object.packet;
            return message;
        };

        /**
         * Creates a plain object from a UDPTunnel message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.UDPTunnel
         * @static
         * @param {MumbleProto.UDPTunnel} message UDPTunnel
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        UDPTunnel.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                if (options.bytes === String)
                    object.packet = "";
                else {
                    object.packet = [];
                    if (options.bytes !== Array)
                        object.packet = $util.newBuffer(object.packet);
                }
            if (message.packet != null && message.hasOwnProperty("packet"))
                object.packet = options.bytes === String ? $util.base64.encode(message.packet, 0, message.packet.length) : options.bytes === Array ? Array.prototype.slice.call(message.packet) : message.packet;
            return object;
        };

        /**
         * Converts this UDPTunnel to JSON.
         * @function toJSON
         * @memberof MumbleProto.UDPTunnel
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        UDPTunnel.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for UDPTunnel
         * @function getTypeUrl
         * @memberof MumbleProto.UDPTunnel
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        UDPTunnel.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.UDPTunnel";
        };

        return UDPTunnel;
    })();

    MumbleProto.Authenticate = (function() {

        /**
         * Properties of an Authenticate.
         * @memberof MumbleProto
         * @interface IAuthenticate
         * @property {string|null} [username] Authenticate username
         * @property {string|null} [password] Authenticate password
         * @property {Array.<string>|null} [tokens] Authenticate tokens
         * @property {Array.<number>|null} [celtVersions] Authenticate celtVersions
         * @property {boolean|null} [opus] Authenticate opus
         * @property {number|null} [clientType] Authenticate clientType
         */

        /**
         * Constructs a new Authenticate.
         * @memberof MumbleProto
         * @classdesc Represents an Authenticate.
         * @implements IAuthenticate
         * @constructor
         * @param {MumbleProto.IAuthenticate=} [properties] Properties to set
         */
        function Authenticate(properties) {
            this.tokens = [];
            this.celtVersions = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Authenticate username.
         * @member {string} username
         * @memberof MumbleProto.Authenticate
         * @instance
         */
        Authenticate.prototype.username = "";

        /**
         * Authenticate password.
         * @member {string} password
         * @memberof MumbleProto.Authenticate
         * @instance
         */
        Authenticate.prototype.password = "";

        /**
         * Authenticate tokens.
         * @member {Array.<string>} tokens
         * @memberof MumbleProto.Authenticate
         * @instance
         */
        Authenticate.prototype.tokens = $util.emptyArray;

        /**
         * Authenticate celtVersions.
         * @member {Array.<number>} celtVersions
         * @memberof MumbleProto.Authenticate
         * @instance
         */
        Authenticate.prototype.celtVersions = $util.emptyArray;

        /**
         * Authenticate opus.
         * @member {boolean} opus
         * @memberof MumbleProto.Authenticate
         * @instance
         */
        Authenticate.prototype.opus = false;

        /**
         * Authenticate clientType.
         * @member {number} clientType
         * @memberof MumbleProto.Authenticate
         * @instance
         */
        Authenticate.prototype.clientType = 0;

        /**
         * Creates a new Authenticate instance using the specified properties.
         * @function create
         * @memberof MumbleProto.Authenticate
         * @static
         * @param {MumbleProto.IAuthenticate=} [properties] Properties to set
         * @returns {MumbleProto.Authenticate} Authenticate instance
         */
        Authenticate.create = function create(properties) {
            return new Authenticate(properties);
        };

        /**
         * Encodes the specified Authenticate message. Does not implicitly {@link MumbleProto.Authenticate.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.Authenticate
         * @static
         * @param {MumbleProto.IAuthenticate} message Authenticate message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Authenticate.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.username != null && Object.hasOwnProperty.call(message, "username"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.username);
            if (message.password != null && Object.hasOwnProperty.call(message, "password"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.password);
            if (message.tokens != null && message.tokens.length)
                for (var i = 0; i < message.tokens.length; ++i)
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.tokens[i]);
            if (message.celtVersions != null && message.celtVersions.length)
                for (var i = 0; i < message.celtVersions.length; ++i)
                    writer.uint32(/* id 4, wireType 0 =*/32).int32(message.celtVersions[i]);
            if (message.opus != null && Object.hasOwnProperty.call(message, "opus"))
                writer.uint32(/* id 5, wireType 0 =*/40).bool(message.opus);
            if (message.clientType != null && Object.hasOwnProperty.call(message, "clientType"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.clientType);
            return writer;
        };

        /**
         * Encodes the specified Authenticate message, length delimited. Does not implicitly {@link MumbleProto.Authenticate.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.Authenticate
         * @static
         * @param {MumbleProto.IAuthenticate} message Authenticate message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Authenticate.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an Authenticate message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.Authenticate
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.Authenticate} Authenticate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Authenticate.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.Authenticate();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.username = reader.string();
                        break;
                    }
                case 2: {
                        message.password = reader.string();
                        break;
                    }
                case 3: {
                        if (!(message.tokens && message.tokens.length))
                            message.tokens = [];
                        message.tokens.push(reader.string());
                        break;
                    }
                case 4: {
                        if (!(message.celtVersions && message.celtVersions.length))
                            message.celtVersions = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.celtVersions.push(reader.int32());
                        } else
                            message.celtVersions.push(reader.int32());
                        break;
                    }
                case 5: {
                        message.opus = reader.bool();
                        break;
                    }
                case 6: {
                        message.clientType = reader.int32();
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
         * Decodes an Authenticate message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.Authenticate
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.Authenticate} Authenticate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Authenticate.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an Authenticate message.
         * @function verify
         * @memberof MumbleProto.Authenticate
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Authenticate.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.username != null && message.hasOwnProperty("username"))
                if (!$util.isString(message.username))
                    return "username: string expected";
            if (message.password != null && message.hasOwnProperty("password"))
                if (!$util.isString(message.password))
                    return "password: string expected";
            if (message.tokens != null && message.hasOwnProperty("tokens")) {
                if (!Array.isArray(message.tokens))
                    return "tokens: array expected";
                for (var i = 0; i < message.tokens.length; ++i)
                    if (!$util.isString(message.tokens[i]))
                        return "tokens: string[] expected";
            }
            if (message.celtVersions != null && message.hasOwnProperty("celtVersions")) {
                if (!Array.isArray(message.celtVersions))
                    return "celtVersions: array expected";
                for (var i = 0; i < message.celtVersions.length; ++i)
                    if (!$util.isInteger(message.celtVersions[i]))
                        return "celtVersions: integer[] expected";
            }
            if (message.opus != null && message.hasOwnProperty("opus"))
                if (typeof message.opus !== "boolean")
                    return "opus: boolean expected";
            if (message.clientType != null && message.hasOwnProperty("clientType"))
                if (!$util.isInteger(message.clientType))
                    return "clientType: integer expected";
            return null;
        };

        /**
         * Creates an Authenticate message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.Authenticate
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.Authenticate} Authenticate
         */
        Authenticate.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.Authenticate)
                return object;
            var message = new $root.MumbleProto.Authenticate();
            if (object.username != null)
                message.username = String(object.username);
            if (object.password != null)
                message.password = String(object.password);
            if (object.tokens) {
                if (!Array.isArray(object.tokens))
                    throw TypeError(".MumbleProto.Authenticate.tokens: array expected");
                message.tokens = [];
                for (var i = 0; i < object.tokens.length; ++i)
                    message.tokens[i] = String(object.tokens[i]);
            }
            if (object.celtVersions) {
                if (!Array.isArray(object.celtVersions))
                    throw TypeError(".MumbleProto.Authenticate.celtVersions: array expected");
                message.celtVersions = [];
                for (var i = 0; i < object.celtVersions.length; ++i)
                    message.celtVersions[i] = object.celtVersions[i] | 0;
            }
            if (object.opus != null)
                message.opus = Boolean(object.opus);
            if (object.clientType != null)
                message.clientType = object.clientType | 0;
            return message;
        };

        /**
         * Creates a plain object from an Authenticate message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.Authenticate
         * @static
         * @param {MumbleProto.Authenticate} message Authenticate
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Authenticate.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object.tokens = [];
                object.celtVersions = [];
            }
            if (options.defaults) {
                object.username = "";
                object.password = "";
                object.opus = false;
                object.clientType = 0;
            }
            if (message.username != null && message.hasOwnProperty("username"))
                object.username = message.username;
            if (message.password != null && message.hasOwnProperty("password"))
                object.password = message.password;
            if (message.tokens && message.tokens.length) {
                object.tokens = [];
                for (var j = 0; j < message.tokens.length; ++j)
                    object.tokens[j] = message.tokens[j];
            }
            if (message.celtVersions && message.celtVersions.length) {
                object.celtVersions = [];
                for (var j = 0; j < message.celtVersions.length; ++j)
                    object.celtVersions[j] = message.celtVersions[j];
            }
            if (message.opus != null && message.hasOwnProperty("opus"))
                object.opus = message.opus;
            if (message.clientType != null && message.hasOwnProperty("clientType"))
                object.clientType = message.clientType;
            return object;
        };

        /**
         * Converts this Authenticate to JSON.
         * @function toJSON
         * @memberof MumbleProto.Authenticate
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Authenticate.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Authenticate
         * @function getTypeUrl
         * @memberof MumbleProto.Authenticate
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Authenticate.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.Authenticate";
        };

        return Authenticate;
    })();

    MumbleProto.Ping = (function() {

        /**
         * Properties of a Ping.
         * @memberof MumbleProto
         * @interface IPing
         * @property {number|Long|null} [timestamp] Ping timestamp
         * @property {number|null} [good] Ping good
         * @property {number|null} [late] Ping late
         * @property {number|null} [lost] Ping lost
         * @property {number|null} [resync] Ping resync
         * @property {number|null} [udpPackets] Ping udpPackets
         * @property {number|null} [tcpPackets] Ping tcpPackets
         * @property {number|null} [udpPingAvg] Ping udpPingAvg
         * @property {number|null} [udpPingVar] Ping udpPingVar
         * @property {number|null} [tcpPingAvg] Ping tcpPingAvg
         * @property {number|null} [tcpPingVar] Ping tcpPingVar
         */

        /**
         * Constructs a new Ping.
         * @memberof MumbleProto
         * @classdesc Represents a Ping.
         * @implements IPing
         * @constructor
         * @param {MumbleProto.IPing=} [properties] Properties to set
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
         * @memberof MumbleProto.Ping
         * @instance
         */
        Ping.prototype.timestamp = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Ping good.
         * @member {number} good
         * @memberof MumbleProto.Ping
         * @instance
         */
        Ping.prototype.good = 0;

        /**
         * Ping late.
         * @member {number} late
         * @memberof MumbleProto.Ping
         * @instance
         */
        Ping.prototype.late = 0;

        /**
         * Ping lost.
         * @member {number} lost
         * @memberof MumbleProto.Ping
         * @instance
         */
        Ping.prototype.lost = 0;

        /**
         * Ping resync.
         * @member {number} resync
         * @memberof MumbleProto.Ping
         * @instance
         */
        Ping.prototype.resync = 0;

        /**
         * Ping udpPackets.
         * @member {number} udpPackets
         * @memberof MumbleProto.Ping
         * @instance
         */
        Ping.prototype.udpPackets = 0;

        /**
         * Ping tcpPackets.
         * @member {number} tcpPackets
         * @memberof MumbleProto.Ping
         * @instance
         */
        Ping.prototype.tcpPackets = 0;

        /**
         * Ping udpPingAvg.
         * @member {number} udpPingAvg
         * @memberof MumbleProto.Ping
         * @instance
         */
        Ping.prototype.udpPingAvg = 0;

        /**
         * Ping udpPingVar.
         * @member {number} udpPingVar
         * @memberof MumbleProto.Ping
         * @instance
         */
        Ping.prototype.udpPingVar = 0;

        /**
         * Ping tcpPingAvg.
         * @member {number} tcpPingAvg
         * @memberof MumbleProto.Ping
         * @instance
         */
        Ping.prototype.tcpPingAvg = 0;

        /**
         * Ping tcpPingVar.
         * @member {number} tcpPingVar
         * @memberof MumbleProto.Ping
         * @instance
         */
        Ping.prototype.tcpPingVar = 0;

        /**
         * Creates a new Ping instance using the specified properties.
         * @function create
         * @memberof MumbleProto.Ping
         * @static
         * @param {MumbleProto.IPing=} [properties] Properties to set
         * @returns {MumbleProto.Ping} Ping instance
         */
        Ping.create = function create(properties) {
            return new Ping(properties);
        };

        /**
         * Encodes the specified Ping message. Does not implicitly {@link MumbleProto.Ping.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.Ping
         * @static
         * @param {MumbleProto.IPing} message Ping message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Ping.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.timestamp != null && Object.hasOwnProperty.call(message, "timestamp"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint64(message.timestamp);
            if (message.good != null && Object.hasOwnProperty.call(message, "good"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.good);
            if (message.late != null && Object.hasOwnProperty.call(message, "late"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.late);
            if (message.lost != null && Object.hasOwnProperty.call(message, "lost"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.lost);
            if (message.resync != null && Object.hasOwnProperty.call(message, "resync"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.resync);
            if (message.udpPackets != null && Object.hasOwnProperty.call(message, "udpPackets"))
                writer.uint32(/* id 6, wireType 0 =*/48).uint32(message.udpPackets);
            if (message.tcpPackets != null && Object.hasOwnProperty.call(message, "tcpPackets"))
                writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.tcpPackets);
            if (message.udpPingAvg != null && Object.hasOwnProperty.call(message, "udpPingAvg"))
                writer.uint32(/* id 8, wireType 5 =*/69).float(message.udpPingAvg);
            if (message.udpPingVar != null && Object.hasOwnProperty.call(message, "udpPingVar"))
                writer.uint32(/* id 9, wireType 5 =*/77).float(message.udpPingVar);
            if (message.tcpPingAvg != null && Object.hasOwnProperty.call(message, "tcpPingAvg"))
                writer.uint32(/* id 10, wireType 5 =*/85).float(message.tcpPingAvg);
            if (message.tcpPingVar != null && Object.hasOwnProperty.call(message, "tcpPingVar"))
                writer.uint32(/* id 11, wireType 5 =*/93).float(message.tcpPingVar);
            return writer;
        };

        /**
         * Encodes the specified Ping message, length delimited. Does not implicitly {@link MumbleProto.Ping.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.Ping
         * @static
         * @param {MumbleProto.IPing} message Ping message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Ping.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Ping message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.Ping
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.Ping} Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Ping.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.Ping();
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
                        message.good = reader.uint32();
                        break;
                    }
                case 3: {
                        message.late = reader.uint32();
                        break;
                    }
                case 4: {
                        message.lost = reader.uint32();
                        break;
                    }
                case 5: {
                        message.resync = reader.uint32();
                        break;
                    }
                case 6: {
                        message.udpPackets = reader.uint32();
                        break;
                    }
                case 7: {
                        message.tcpPackets = reader.uint32();
                        break;
                    }
                case 8: {
                        message.udpPingAvg = reader.float();
                        break;
                    }
                case 9: {
                        message.udpPingVar = reader.float();
                        break;
                    }
                case 10: {
                        message.tcpPingAvg = reader.float();
                        break;
                    }
                case 11: {
                        message.tcpPingVar = reader.float();
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
         * @memberof MumbleProto.Ping
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.Ping} Ping
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
         * @memberof MumbleProto.Ping
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
            if (message.good != null && message.hasOwnProperty("good"))
                if (!$util.isInteger(message.good))
                    return "good: integer expected";
            if (message.late != null && message.hasOwnProperty("late"))
                if (!$util.isInteger(message.late))
                    return "late: integer expected";
            if (message.lost != null && message.hasOwnProperty("lost"))
                if (!$util.isInteger(message.lost))
                    return "lost: integer expected";
            if (message.resync != null && message.hasOwnProperty("resync"))
                if (!$util.isInteger(message.resync))
                    return "resync: integer expected";
            if (message.udpPackets != null && message.hasOwnProperty("udpPackets"))
                if (!$util.isInteger(message.udpPackets))
                    return "udpPackets: integer expected";
            if (message.tcpPackets != null && message.hasOwnProperty("tcpPackets"))
                if (!$util.isInteger(message.tcpPackets))
                    return "tcpPackets: integer expected";
            if (message.udpPingAvg != null && message.hasOwnProperty("udpPingAvg"))
                if (typeof message.udpPingAvg !== "number")
                    return "udpPingAvg: number expected";
            if (message.udpPingVar != null && message.hasOwnProperty("udpPingVar"))
                if (typeof message.udpPingVar !== "number")
                    return "udpPingVar: number expected";
            if (message.tcpPingAvg != null && message.hasOwnProperty("tcpPingAvg"))
                if (typeof message.tcpPingAvg !== "number")
                    return "tcpPingAvg: number expected";
            if (message.tcpPingVar != null && message.hasOwnProperty("tcpPingVar"))
                if (typeof message.tcpPingVar !== "number")
                    return "tcpPingVar: number expected";
            return null;
        };

        /**
         * Creates a Ping message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.Ping
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.Ping} Ping
         */
        Ping.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.Ping)
                return object;
            var message = new $root.MumbleProto.Ping();
            if (object.timestamp != null)
                if ($util.Long)
                    (message.timestamp = $util.Long.fromValue(object.timestamp)).unsigned = true;
                else if (typeof object.timestamp === "string")
                    message.timestamp = parseInt(object.timestamp, 10);
                else if (typeof object.timestamp === "number")
                    message.timestamp = object.timestamp;
                else if (typeof object.timestamp === "object")
                    message.timestamp = new $util.LongBits(object.timestamp.low >>> 0, object.timestamp.high >>> 0).toNumber(true);
            if (object.good != null)
                message.good = object.good >>> 0;
            if (object.late != null)
                message.late = object.late >>> 0;
            if (object.lost != null)
                message.lost = object.lost >>> 0;
            if (object.resync != null)
                message.resync = object.resync >>> 0;
            if (object.udpPackets != null)
                message.udpPackets = object.udpPackets >>> 0;
            if (object.tcpPackets != null)
                message.tcpPackets = object.tcpPackets >>> 0;
            if (object.udpPingAvg != null)
                message.udpPingAvg = Number(object.udpPingAvg);
            if (object.udpPingVar != null)
                message.udpPingVar = Number(object.udpPingVar);
            if (object.tcpPingAvg != null)
                message.tcpPingAvg = Number(object.tcpPingAvg);
            if (object.tcpPingVar != null)
                message.tcpPingVar = Number(object.tcpPingVar);
            return message;
        };

        /**
         * Creates a plain object from a Ping message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.Ping
         * @static
         * @param {MumbleProto.Ping} message Ping
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
                object.good = 0;
                object.late = 0;
                object.lost = 0;
                object.resync = 0;
                object.udpPackets = 0;
                object.tcpPackets = 0;
                object.udpPingAvg = 0;
                object.udpPingVar = 0;
                object.tcpPingAvg = 0;
                object.tcpPingVar = 0;
            }
            if (message.timestamp != null && message.hasOwnProperty("timestamp"))
                if (typeof message.timestamp === "number")
                    object.timestamp = options.longs === String ? String(message.timestamp) : message.timestamp;
                else
                    object.timestamp = options.longs === String ? $util.Long.prototype.toString.call(message.timestamp) : options.longs === Number ? new $util.LongBits(message.timestamp.low >>> 0, message.timestamp.high >>> 0).toNumber(true) : message.timestamp;
            if (message.good != null && message.hasOwnProperty("good"))
                object.good = message.good;
            if (message.late != null && message.hasOwnProperty("late"))
                object.late = message.late;
            if (message.lost != null && message.hasOwnProperty("lost"))
                object.lost = message.lost;
            if (message.resync != null && message.hasOwnProperty("resync"))
                object.resync = message.resync;
            if (message.udpPackets != null && message.hasOwnProperty("udpPackets"))
                object.udpPackets = message.udpPackets;
            if (message.tcpPackets != null && message.hasOwnProperty("tcpPackets"))
                object.tcpPackets = message.tcpPackets;
            if (message.udpPingAvg != null && message.hasOwnProperty("udpPingAvg"))
                object.udpPingAvg = options.json && !isFinite(message.udpPingAvg) ? String(message.udpPingAvg) : message.udpPingAvg;
            if (message.udpPingVar != null && message.hasOwnProperty("udpPingVar"))
                object.udpPingVar = options.json && !isFinite(message.udpPingVar) ? String(message.udpPingVar) : message.udpPingVar;
            if (message.tcpPingAvg != null && message.hasOwnProperty("tcpPingAvg"))
                object.tcpPingAvg = options.json && !isFinite(message.tcpPingAvg) ? String(message.tcpPingAvg) : message.tcpPingAvg;
            if (message.tcpPingVar != null && message.hasOwnProperty("tcpPingVar"))
                object.tcpPingVar = options.json && !isFinite(message.tcpPingVar) ? String(message.tcpPingVar) : message.tcpPingVar;
            return object;
        };

        /**
         * Converts this Ping to JSON.
         * @function toJSON
         * @memberof MumbleProto.Ping
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Ping.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Ping
         * @function getTypeUrl
         * @memberof MumbleProto.Ping
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Ping.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.Ping";
        };

        return Ping;
    })();

    MumbleProto.Reject = (function() {

        /**
         * Properties of a Reject.
         * @memberof MumbleProto
         * @interface IReject
         * @property {MumbleProto.Reject.RejectType|null} [type] Reject type
         * @property {string|null} [reason] Reject reason
         */

        /**
         * Constructs a new Reject.
         * @memberof MumbleProto
         * @classdesc Represents a Reject.
         * @implements IReject
         * @constructor
         * @param {MumbleProto.IReject=} [properties] Properties to set
         */
        function Reject(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Reject type.
         * @member {MumbleProto.Reject.RejectType} type
         * @memberof MumbleProto.Reject
         * @instance
         */
        Reject.prototype.type = 0;

        /**
         * Reject reason.
         * @member {string} reason
         * @memberof MumbleProto.Reject
         * @instance
         */
        Reject.prototype.reason = "";

        /**
         * Creates a new Reject instance using the specified properties.
         * @function create
         * @memberof MumbleProto.Reject
         * @static
         * @param {MumbleProto.IReject=} [properties] Properties to set
         * @returns {MumbleProto.Reject} Reject instance
         */
        Reject.create = function create(properties) {
            return new Reject(properties);
        };

        /**
         * Encodes the specified Reject message. Does not implicitly {@link MumbleProto.Reject.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.Reject
         * @static
         * @param {MumbleProto.IReject} message Reject message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Reject.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.type);
            if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.reason);
            return writer;
        };

        /**
         * Encodes the specified Reject message, length delimited. Does not implicitly {@link MumbleProto.Reject.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.Reject
         * @static
         * @param {MumbleProto.IReject} message Reject message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Reject.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Reject message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.Reject
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.Reject} Reject
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Reject.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.Reject();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.type = reader.int32();
                        break;
                    }
                case 2: {
                        message.reason = reader.string();
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
         * Decodes a Reject message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.Reject
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.Reject} Reject
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Reject.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Reject message.
         * @function verify
         * @memberof MumbleProto.Reject
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Reject.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.type != null && message.hasOwnProperty("type"))
                switch (message.type) {
                default:
                    return "type: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                case 8:
                case 9:
                    break;
                }
            if (message.reason != null && message.hasOwnProperty("reason"))
                if (!$util.isString(message.reason))
                    return "reason: string expected";
            return null;
        };

        /**
         * Creates a Reject message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.Reject
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.Reject} Reject
         */
        Reject.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.Reject)
                return object;
            var message = new $root.MumbleProto.Reject();
            switch (object.type) {
            default:
                if (typeof object.type === "number") {
                    message.type = object.type;
                    break;
                }
                break;
            case "None":
            case 0:
                message.type = 0;
                break;
            case "WrongVersion":
            case 1:
                message.type = 1;
                break;
            case "InvalidUsername":
            case 2:
                message.type = 2;
                break;
            case "WrongUserPW":
            case 3:
                message.type = 3;
                break;
            case "WrongServerPW":
            case 4:
                message.type = 4;
                break;
            case "UsernameInUse":
            case 5:
                message.type = 5;
                break;
            case "ServerFull":
            case 6:
                message.type = 6;
                break;
            case "NoCertificate":
            case 7:
                message.type = 7;
                break;
            case "AuthenticatorFail":
            case 8:
                message.type = 8;
                break;
            case "NoNewConnections":
            case 9:
                message.type = 9;
                break;
            }
            if (object.reason != null)
                message.reason = String(object.reason);
            return message;
        };

        /**
         * Creates a plain object from a Reject message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.Reject
         * @static
         * @param {MumbleProto.Reject} message Reject
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Reject.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.type = options.enums === String ? "None" : 0;
                object.reason = "";
            }
            if (message.type != null && message.hasOwnProperty("type"))
                object.type = options.enums === String ? $root.MumbleProto.Reject.RejectType[message.type] === undefined ? message.type : $root.MumbleProto.Reject.RejectType[message.type] : message.type;
            if (message.reason != null && message.hasOwnProperty("reason"))
                object.reason = message.reason;
            return object;
        };

        /**
         * Converts this Reject to JSON.
         * @function toJSON
         * @memberof MumbleProto.Reject
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Reject.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Reject
         * @function getTypeUrl
         * @memberof MumbleProto.Reject
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Reject.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.Reject";
        };

        /**
         * RejectType enum.
         * @name MumbleProto.Reject.RejectType
         * @enum {number}
         * @property {number} None=0 None value
         * @property {number} WrongVersion=1 WrongVersion value
         * @property {number} InvalidUsername=2 InvalidUsername value
         * @property {number} WrongUserPW=3 WrongUserPW value
         * @property {number} WrongServerPW=4 WrongServerPW value
         * @property {number} UsernameInUse=5 UsernameInUse value
         * @property {number} ServerFull=6 ServerFull value
         * @property {number} NoCertificate=7 NoCertificate value
         * @property {number} AuthenticatorFail=8 AuthenticatorFail value
         * @property {number} NoNewConnections=9 NoNewConnections value
         */
        Reject.RejectType = (function() {
            var valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "None"] = 0;
            values[valuesById[1] = "WrongVersion"] = 1;
            values[valuesById[2] = "InvalidUsername"] = 2;
            values[valuesById[3] = "WrongUserPW"] = 3;
            values[valuesById[4] = "WrongServerPW"] = 4;
            values[valuesById[5] = "UsernameInUse"] = 5;
            values[valuesById[6] = "ServerFull"] = 6;
            values[valuesById[7] = "NoCertificate"] = 7;
            values[valuesById[8] = "AuthenticatorFail"] = 8;
            values[valuesById[9] = "NoNewConnections"] = 9;
            return values;
        })();

        return Reject;
    })();

    MumbleProto.ServerSync = (function() {

        /**
         * Properties of a ServerSync.
         * @memberof MumbleProto
         * @interface IServerSync
         * @property {number|null} [session] ServerSync session
         * @property {number|null} [maxBandwidth] ServerSync maxBandwidth
         * @property {string|null} [welcomeText] ServerSync welcomeText
         * @property {number|Long|null} [permissions] ServerSync permissions
         */

        /**
         * Constructs a new ServerSync.
         * @memberof MumbleProto
         * @classdesc Represents a ServerSync.
         * @implements IServerSync
         * @constructor
         * @param {MumbleProto.IServerSync=} [properties] Properties to set
         */
        function ServerSync(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ServerSync session.
         * @member {number} session
         * @memberof MumbleProto.ServerSync
         * @instance
         */
        ServerSync.prototype.session = 0;

        /**
         * ServerSync maxBandwidth.
         * @member {number} maxBandwidth
         * @memberof MumbleProto.ServerSync
         * @instance
         */
        ServerSync.prototype.maxBandwidth = 0;

        /**
         * ServerSync welcomeText.
         * @member {string} welcomeText
         * @memberof MumbleProto.ServerSync
         * @instance
         */
        ServerSync.prototype.welcomeText = "";

        /**
         * ServerSync permissions.
         * @member {number|Long} permissions
         * @memberof MumbleProto.ServerSync
         * @instance
         */
        ServerSync.prototype.permissions = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Creates a new ServerSync instance using the specified properties.
         * @function create
         * @memberof MumbleProto.ServerSync
         * @static
         * @param {MumbleProto.IServerSync=} [properties] Properties to set
         * @returns {MumbleProto.ServerSync} ServerSync instance
         */
        ServerSync.create = function create(properties) {
            return new ServerSync(properties);
        };

        /**
         * Encodes the specified ServerSync message. Does not implicitly {@link MumbleProto.ServerSync.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.ServerSync
         * @static
         * @param {MumbleProto.IServerSync} message ServerSync message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerSync.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.session != null && Object.hasOwnProperty.call(message, "session"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.session);
            if (message.maxBandwidth != null && Object.hasOwnProperty.call(message, "maxBandwidth"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.maxBandwidth);
            if (message.welcomeText != null && Object.hasOwnProperty.call(message, "welcomeText"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.welcomeText);
            if (message.permissions != null && Object.hasOwnProperty.call(message, "permissions"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint64(message.permissions);
            return writer;
        };

        /**
         * Encodes the specified ServerSync message, length delimited. Does not implicitly {@link MumbleProto.ServerSync.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.ServerSync
         * @static
         * @param {MumbleProto.IServerSync} message ServerSync message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerSync.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ServerSync message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.ServerSync
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.ServerSync} ServerSync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerSync.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.ServerSync();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.session = reader.uint32();
                        break;
                    }
                case 2: {
                        message.maxBandwidth = reader.uint32();
                        break;
                    }
                case 3: {
                        message.welcomeText = reader.string();
                        break;
                    }
                case 4: {
                        message.permissions = reader.uint64();
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
         * Decodes a ServerSync message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.ServerSync
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.ServerSync} ServerSync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerSync.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ServerSync message.
         * @function verify
         * @memberof MumbleProto.ServerSync
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ServerSync.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.session != null && message.hasOwnProperty("session"))
                if (!$util.isInteger(message.session))
                    return "session: integer expected";
            if (message.maxBandwidth != null && message.hasOwnProperty("maxBandwidth"))
                if (!$util.isInteger(message.maxBandwidth))
                    return "maxBandwidth: integer expected";
            if (message.welcomeText != null && message.hasOwnProperty("welcomeText"))
                if (!$util.isString(message.welcomeText))
                    return "welcomeText: string expected";
            if (message.permissions != null && message.hasOwnProperty("permissions"))
                if (!$util.isInteger(message.permissions) && !(message.permissions && $util.isInteger(message.permissions.low) && $util.isInteger(message.permissions.high)))
                    return "permissions: integer|Long expected";
            return null;
        };

        /**
         * Creates a ServerSync message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.ServerSync
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.ServerSync} ServerSync
         */
        ServerSync.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.ServerSync)
                return object;
            var message = new $root.MumbleProto.ServerSync();
            if (object.session != null)
                message.session = object.session >>> 0;
            if (object.maxBandwidth != null)
                message.maxBandwidth = object.maxBandwidth >>> 0;
            if (object.welcomeText != null)
                message.welcomeText = String(object.welcomeText);
            if (object.permissions != null)
                if ($util.Long)
                    (message.permissions = $util.Long.fromValue(object.permissions)).unsigned = true;
                else if (typeof object.permissions === "string")
                    message.permissions = parseInt(object.permissions, 10);
                else if (typeof object.permissions === "number")
                    message.permissions = object.permissions;
                else if (typeof object.permissions === "object")
                    message.permissions = new $util.LongBits(object.permissions.low >>> 0, object.permissions.high >>> 0).toNumber(true);
            return message;
        };

        /**
         * Creates a plain object from a ServerSync message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.ServerSync
         * @static
         * @param {MumbleProto.ServerSync} message ServerSync
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ServerSync.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.session = 0;
                object.maxBandwidth = 0;
                object.welcomeText = "";
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.permissions = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.permissions = options.longs === String ? "0" : 0;
            }
            if (message.session != null && message.hasOwnProperty("session"))
                object.session = message.session;
            if (message.maxBandwidth != null && message.hasOwnProperty("maxBandwidth"))
                object.maxBandwidth = message.maxBandwidth;
            if (message.welcomeText != null && message.hasOwnProperty("welcomeText"))
                object.welcomeText = message.welcomeText;
            if (message.permissions != null && message.hasOwnProperty("permissions"))
                if (typeof message.permissions === "number")
                    object.permissions = options.longs === String ? String(message.permissions) : message.permissions;
                else
                    object.permissions = options.longs === String ? $util.Long.prototype.toString.call(message.permissions) : options.longs === Number ? new $util.LongBits(message.permissions.low >>> 0, message.permissions.high >>> 0).toNumber(true) : message.permissions;
            return object;
        };

        /**
         * Converts this ServerSync to JSON.
         * @function toJSON
         * @memberof MumbleProto.ServerSync
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ServerSync.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ServerSync
         * @function getTypeUrl
         * @memberof MumbleProto.ServerSync
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ServerSync.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.ServerSync";
        };

        return ServerSync;
    })();

    MumbleProto.ChannelRemove = (function() {

        /**
         * Properties of a ChannelRemove.
         * @memberof MumbleProto
         * @interface IChannelRemove
         * @property {number} channelId ChannelRemove channelId
         */

        /**
         * Constructs a new ChannelRemove.
         * @memberof MumbleProto
         * @classdesc Represents a ChannelRemove.
         * @implements IChannelRemove
         * @constructor
         * @param {MumbleProto.IChannelRemove=} [properties] Properties to set
         */
        function ChannelRemove(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ChannelRemove channelId.
         * @member {number} channelId
         * @memberof MumbleProto.ChannelRemove
         * @instance
         */
        ChannelRemove.prototype.channelId = 0;

        /**
         * Creates a new ChannelRemove instance using the specified properties.
         * @function create
         * @memberof MumbleProto.ChannelRemove
         * @static
         * @param {MumbleProto.IChannelRemove=} [properties] Properties to set
         * @returns {MumbleProto.ChannelRemove} ChannelRemove instance
         */
        ChannelRemove.create = function create(properties) {
            return new ChannelRemove(properties);
        };

        /**
         * Encodes the specified ChannelRemove message. Does not implicitly {@link MumbleProto.ChannelRemove.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.ChannelRemove
         * @static
         * @param {MumbleProto.IChannelRemove} message ChannelRemove message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ChannelRemove.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.channelId);
            return writer;
        };

        /**
         * Encodes the specified ChannelRemove message, length delimited. Does not implicitly {@link MumbleProto.ChannelRemove.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.ChannelRemove
         * @static
         * @param {MumbleProto.IChannelRemove} message ChannelRemove message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ChannelRemove.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ChannelRemove message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.ChannelRemove
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.ChannelRemove} ChannelRemove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ChannelRemove.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.ChannelRemove();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.channelId = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("channelId"))
                throw $util.ProtocolError("missing required 'channelId'", { instance: message });
            return message;
        };

        /**
         * Decodes a ChannelRemove message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.ChannelRemove
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.ChannelRemove} ChannelRemove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ChannelRemove.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ChannelRemove message.
         * @function verify
         * @memberof MumbleProto.ChannelRemove
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ChannelRemove.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isInteger(message.channelId))
                return "channelId: integer expected";
            return null;
        };

        /**
         * Creates a ChannelRemove message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.ChannelRemove
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.ChannelRemove} ChannelRemove
         */
        ChannelRemove.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.ChannelRemove)
                return object;
            var message = new $root.MumbleProto.ChannelRemove();
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a ChannelRemove message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.ChannelRemove
         * @static
         * @param {MumbleProto.ChannelRemove} message ChannelRemove
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ChannelRemove.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.channelId = 0;
            if (message.channelId != null && message.hasOwnProperty("channelId"))
                object.channelId = message.channelId;
            return object;
        };

        /**
         * Converts this ChannelRemove to JSON.
         * @function toJSON
         * @memberof MumbleProto.ChannelRemove
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ChannelRemove.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ChannelRemove
         * @function getTypeUrl
         * @memberof MumbleProto.ChannelRemove
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ChannelRemove.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.ChannelRemove";
        };

        return ChannelRemove;
    })();

    MumbleProto.ChannelState = (function() {

        /**
         * Properties of a ChannelState.
         * @memberof MumbleProto
         * @interface IChannelState
         * @property {number|null} [channelId] ChannelState channelId
         * @property {number|null} [parent] ChannelState parent
         * @property {string|null} [name] ChannelState name
         * @property {Array.<number>|null} [links] ChannelState links
         * @property {string|null} [description] ChannelState description
         * @property {Array.<number>|null} [linksAdd] ChannelState linksAdd
         * @property {Array.<number>|null} [linksRemove] ChannelState linksRemove
         * @property {boolean|null} [temporary] ChannelState temporary
         * @property {number|null} [position] ChannelState position
         * @property {Uint8Array|null} [descriptionHash] ChannelState descriptionHash
         * @property {number|null} [maxUsers] ChannelState maxUsers
         * @property {boolean|null} [isEnterRestricted] ChannelState isEnterRestricted
         * @property {boolean|null} [canEnter] ChannelState canEnter
         */

        /**
         * Constructs a new ChannelState.
         * @memberof MumbleProto
         * @classdesc Represents a ChannelState.
         * @implements IChannelState
         * @constructor
         * @param {MumbleProto.IChannelState=} [properties] Properties to set
         */
        function ChannelState(properties) {
            this.links = [];
            this.linksAdd = [];
            this.linksRemove = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ChannelState channelId.
         * @member {number} channelId
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.channelId = 0;

        /**
         * ChannelState parent.
         * @member {number} parent
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.parent = 0;

        /**
         * ChannelState name.
         * @member {string} name
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.name = "";

        /**
         * ChannelState links.
         * @member {Array.<number>} links
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.links = $util.emptyArray;

        /**
         * ChannelState description.
         * @member {string} description
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.description = "";

        /**
         * ChannelState linksAdd.
         * @member {Array.<number>} linksAdd
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.linksAdd = $util.emptyArray;

        /**
         * ChannelState linksRemove.
         * @member {Array.<number>} linksRemove
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.linksRemove = $util.emptyArray;

        /**
         * ChannelState temporary.
         * @member {boolean} temporary
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.temporary = false;

        /**
         * ChannelState position.
         * @member {number} position
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.position = 0;

        /**
         * ChannelState descriptionHash.
         * @member {Uint8Array} descriptionHash
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.descriptionHash = $util.newBuffer([]);

        /**
         * ChannelState maxUsers.
         * @member {number} maxUsers
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.maxUsers = 0;

        /**
         * ChannelState isEnterRestricted.
         * @member {boolean} isEnterRestricted
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.isEnterRestricted = false;

        /**
         * ChannelState canEnter.
         * @member {boolean} canEnter
         * @memberof MumbleProto.ChannelState
         * @instance
         */
        ChannelState.prototype.canEnter = false;

        /**
         * Creates a new ChannelState instance using the specified properties.
         * @function create
         * @memberof MumbleProto.ChannelState
         * @static
         * @param {MumbleProto.IChannelState=} [properties] Properties to set
         * @returns {MumbleProto.ChannelState} ChannelState instance
         */
        ChannelState.create = function create(properties) {
            return new ChannelState(properties);
        };

        /**
         * Encodes the specified ChannelState message. Does not implicitly {@link MumbleProto.ChannelState.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.ChannelState
         * @static
         * @param {MumbleProto.IChannelState} message ChannelState message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ChannelState.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.channelId != null && Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.channelId);
            if (message.parent != null && Object.hasOwnProperty.call(message, "parent"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.parent);
            if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.name);
            if (message.links != null && message.links.length)
                for (var i = 0; i < message.links.length; ++i)
                    writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.links[i]);
            if (message.description != null && Object.hasOwnProperty.call(message, "description"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.description);
            if (message.linksAdd != null && message.linksAdd.length)
                for (var i = 0; i < message.linksAdd.length; ++i)
                    writer.uint32(/* id 6, wireType 0 =*/48).uint32(message.linksAdd[i]);
            if (message.linksRemove != null && message.linksRemove.length)
                for (var i = 0; i < message.linksRemove.length; ++i)
                    writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.linksRemove[i]);
            if (message.temporary != null && Object.hasOwnProperty.call(message, "temporary"))
                writer.uint32(/* id 8, wireType 0 =*/64).bool(message.temporary);
            if (message.position != null && Object.hasOwnProperty.call(message, "position"))
                writer.uint32(/* id 9, wireType 0 =*/72).int32(message.position);
            if (message.descriptionHash != null && Object.hasOwnProperty.call(message, "descriptionHash"))
                writer.uint32(/* id 10, wireType 2 =*/82).bytes(message.descriptionHash);
            if (message.maxUsers != null && Object.hasOwnProperty.call(message, "maxUsers"))
                writer.uint32(/* id 11, wireType 0 =*/88).uint32(message.maxUsers);
            if (message.isEnterRestricted != null && Object.hasOwnProperty.call(message, "isEnterRestricted"))
                writer.uint32(/* id 12, wireType 0 =*/96).bool(message.isEnterRestricted);
            if (message.canEnter != null && Object.hasOwnProperty.call(message, "canEnter"))
                writer.uint32(/* id 13, wireType 0 =*/104).bool(message.canEnter);
            return writer;
        };

        /**
         * Encodes the specified ChannelState message, length delimited. Does not implicitly {@link MumbleProto.ChannelState.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.ChannelState
         * @static
         * @param {MumbleProto.IChannelState} message ChannelState message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ChannelState.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ChannelState message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.ChannelState
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.ChannelState} ChannelState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ChannelState.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.ChannelState();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.channelId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.parent = reader.uint32();
                        break;
                    }
                case 3: {
                        message.name = reader.string();
                        break;
                    }
                case 4: {
                        if (!(message.links && message.links.length))
                            message.links = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.links.push(reader.uint32());
                        } else
                            message.links.push(reader.uint32());
                        break;
                    }
                case 5: {
                        message.description = reader.string();
                        break;
                    }
                case 6: {
                        if (!(message.linksAdd && message.linksAdd.length))
                            message.linksAdd = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.linksAdd.push(reader.uint32());
                        } else
                            message.linksAdd.push(reader.uint32());
                        break;
                    }
                case 7: {
                        if (!(message.linksRemove && message.linksRemove.length))
                            message.linksRemove = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.linksRemove.push(reader.uint32());
                        } else
                            message.linksRemove.push(reader.uint32());
                        break;
                    }
                case 8: {
                        message.temporary = reader.bool();
                        break;
                    }
                case 9: {
                        message.position = reader.int32();
                        break;
                    }
                case 10: {
                        message.descriptionHash = reader.bytes();
                        break;
                    }
                case 11: {
                        message.maxUsers = reader.uint32();
                        break;
                    }
                case 12: {
                        message.isEnterRestricted = reader.bool();
                        break;
                    }
                case 13: {
                        message.canEnter = reader.bool();
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
         * Decodes a ChannelState message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.ChannelState
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.ChannelState} ChannelState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ChannelState.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ChannelState message.
         * @function verify
         * @memberof MumbleProto.ChannelState
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ChannelState.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.channelId != null && message.hasOwnProperty("channelId"))
                if (!$util.isInteger(message.channelId))
                    return "channelId: integer expected";
            if (message.parent != null && message.hasOwnProperty("parent"))
                if (!$util.isInteger(message.parent))
                    return "parent: integer expected";
            if (message.name != null && message.hasOwnProperty("name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            if (message.links != null && message.hasOwnProperty("links")) {
                if (!Array.isArray(message.links))
                    return "links: array expected";
                for (var i = 0; i < message.links.length; ++i)
                    if (!$util.isInteger(message.links[i]))
                        return "links: integer[] expected";
            }
            if (message.description != null && message.hasOwnProperty("description"))
                if (!$util.isString(message.description))
                    return "description: string expected";
            if (message.linksAdd != null && message.hasOwnProperty("linksAdd")) {
                if (!Array.isArray(message.linksAdd))
                    return "linksAdd: array expected";
                for (var i = 0; i < message.linksAdd.length; ++i)
                    if (!$util.isInteger(message.linksAdd[i]))
                        return "linksAdd: integer[] expected";
            }
            if (message.linksRemove != null && message.hasOwnProperty("linksRemove")) {
                if (!Array.isArray(message.linksRemove))
                    return "linksRemove: array expected";
                for (var i = 0; i < message.linksRemove.length; ++i)
                    if (!$util.isInteger(message.linksRemove[i]))
                        return "linksRemove: integer[] expected";
            }
            if (message.temporary != null && message.hasOwnProperty("temporary"))
                if (typeof message.temporary !== "boolean")
                    return "temporary: boolean expected";
            if (message.position != null && message.hasOwnProperty("position"))
                if (!$util.isInteger(message.position))
                    return "position: integer expected";
            if (message.descriptionHash != null && message.hasOwnProperty("descriptionHash"))
                if (!(message.descriptionHash && typeof message.descriptionHash.length === "number" || $util.isString(message.descriptionHash)))
                    return "descriptionHash: buffer expected";
            if (message.maxUsers != null && message.hasOwnProperty("maxUsers"))
                if (!$util.isInteger(message.maxUsers))
                    return "maxUsers: integer expected";
            if (message.isEnterRestricted != null && message.hasOwnProperty("isEnterRestricted"))
                if (typeof message.isEnterRestricted !== "boolean")
                    return "isEnterRestricted: boolean expected";
            if (message.canEnter != null && message.hasOwnProperty("canEnter"))
                if (typeof message.canEnter !== "boolean")
                    return "canEnter: boolean expected";
            return null;
        };

        /**
         * Creates a ChannelState message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.ChannelState
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.ChannelState} ChannelState
         */
        ChannelState.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.ChannelState)
                return object;
            var message = new $root.MumbleProto.ChannelState();
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            if (object.parent != null)
                message.parent = object.parent >>> 0;
            if (object.name != null)
                message.name = String(object.name);
            if (object.links) {
                if (!Array.isArray(object.links))
                    throw TypeError(".MumbleProto.ChannelState.links: array expected");
                message.links = [];
                for (var i = 0; i < object.links.length; ++i)
                    message.links[i] = object.links[i] >>> 0;
            }
            if (object.description != null)
                message.description = String(object.description);
            if (object.linksAdd) {
                if (!Array.isArray(object.linksAdd))
                    throw TypeError(".MumbleProto.ChannelState.linksAdd: array expected");
                message.linksAdd = [];
                for (var i = 0; i < object.linksAdd.length; ++i)
                    message.linksAdd[i] = object.linksAdd[i] >>> 0;
            }
            if (object.linksRemove) {
                if (!Array.isArray(object.linksRemove))
                    throw TypeError(".MumbleProto.ChannelState.linksRemove: array expected");
                message.linksRemove = [];
                for (var i = 0; i < object.linksRemove.length; ++i)
                    message.linksRemove[i] = object.linksRemove[i] >>> 0;
            }
            if (object.temporary != null)
                message.temporary = Boolean(object.temporary);
            if (object.position != null)
                message.position = object.position | 0;
            if (object.descriptionHash != null)
                if (typeof object.descriptionHash === "string")
                    $util.base64.decode(object.descriptionHash, message.descriptionHash = $util.newBuffer($util.base64.length(object.descriptionHash)), 0);
                else if (object.descriptionHash.length >= 0)
                    message.descriptionHash = object.descriptionHash;
            if (object.maxUsers != null)
                message.maxUsers = object.maxUsers >>> 0;
            if (object.isEnterRestricted != null)
                message.isEnterRestricted = Boolean(object.isEnterRestricted);
            if (object.canEnter != null)
                message.canEnter = Boolean(object.canEnter);
            return message;
        };

        /**
         * Creates a plain object from a ChannelState message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.ChannelState
         * @static
         * @param {MumbleProto.ChannelState} message ChannelState
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ChannelState.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object.links = [];
                object.linksAdd = [];
                object.linksRemove = [];
            }
            if (options.defaults) {
                object.channelId = 0;
                object.parent = 0;
                object.name = "";
                object.description = "";
                object.temporary = false;
                object.position = 0;
                if (options.bytes === String)
                    object.descriptionHash = "";
                else {
                    object.descriptionHash = [];
                    if (options.bytes !== Array)
                        object.descriptionHash = $util.newBuffer(object.descriptionHash);
                }
                object.maxUsers = 0;
                object.isEnterRestricted = false;
                object.canEnter = false;
            }
            if (message.channelId != null && message.hasOwnProperty("channelId"))
                object.channelId = message.channelId;
            if (message.parent != null && message.hasOwnProperty("parent"))
                object.parent = message.parent;
            if (message.name != null && message.hasOwnProperty("name"))
                object.name = message.name;
            if (message.links && message.links.length) {
                object.links = [];
                for (var j = 0; j < message.links.length; ++j)
                    object.links[j] = message.links[j];
            }
            if (message.description != null && message.hasOwnProperty("description"))
                object.description = message.description;
            if (message.linksAdd && message.linksAdd.length) {
                object.linksAdd = [];
                for (var j = 0; j < message.linksAdd.length; ++j)
                    object.linksAdd[j] = message.linksAdd[j];
            }
            if (message.linksRemove && message.linksRemove.length) {
                object.linksRemove = [];
                for (var j = 0; j < message.linksRemove.length; ++j)
                    object.linksRemove[j] = message.linksRemove[j];
            }
            if (message.temporary != null && message.hasOwnProperty("temporary"))
                object.temporary = message.temporary;
            if (message.position != null && message.hasOwnProperty("position"))
                object.position = message.position;
            if (message.descriptionHash != null && message.hasOwnProperty("descriptionHash"))
                object.descriptionHash = options.bytes === String ? $util.base64.encode(message.descriptionHash, 0, message.descriptionHash.length) : options.bytes === Array ? Array.prototype.slice.call(message.descriptionHash) : message.descriptionHash;
            if (message.maxUsers != null && message.hasOwnProperty("maxUsers"))
                object.maxUsers = message.maxUsers;
            if (message.isEnterRestricted != null && message.hasOwnProperty("isEnterRestricted"))
                object.isEnterRestricted = message.isEnterRestricted;
            if (message.canEnter != null && message.hasOwnProperty("canEnter"))
                object.canEnter = message.canEnter;
            return object;
        };

        /**
         * Converts this ChannelState to JSON.
         * @function toJSON
         * @memberof MumbleProto.ChannelState
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ChannelState.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ChannelState
         * @function getTypeUrl
         * @memberof MumbleProto.ChannelState
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ChannelState.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.ChannelState";
        };

        return ChannelState;
    })();

    MumbleProto.UserRemove = (function() {

        /**
         * Properties of a UserRemove.
         * @memberof MumbleProto
         * @interface IUserRemove
         * @property {number} session UserRemove session
         * @property {number|null} [actor] UserRemove actor
         * @property {string|null} [reason] UserRemove reason
         * @property {boolean|null} [ban] UserRemove ban
         */

        /**
         * Constructs a new UserRemove.
         * @memberof MumbleProto
         * @classdesc Represents a UserRemove.
         * @implements IUserRemove
         * @constructor
         * @param {MumbleProto.IUserRemove=} [properties] Properties to set
         */
        function UserRemove(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * UserRemove session.
         * @member {number} session
         * @memberof MumbleProto.UserRemove
         * @instance
         */
        UserRemove.prototype.session = 0;

        /**
         * UserRemove actor.
         * @member {number} actor
         * @memberof MumbleProto.UserRemove
         * @instance
         */
        UserRemove.prototype.actor = 0;

        /**
         * UserRemove reason.
         * @member {string} reason
         * @memberof MumbleProto.UserRemove
         * @instance
         */
        UserRemove.prototype.reason = "";

        /**
         * UserRemove ban.
         * @member {boolean} ban
         * @memberof MumbleProto.UserRemove
         * @instance
         */
        UserRemove.prototype.ban = false;

        /**
         * Creates a new UserRemove instance using the specified properties.
         * @function create
         * @memberof MumbleProto.UserRemove
         * @static
         * @param {MumbleProto.IUserRemove=} [properties] Properties to set
         * @returns {MumbleProto.UserRemove} UserRemove instance
         */
        UserRemove.create = function create(properties) {
            return new UserRemove(properties);
        };

        /**
         * Encodes the specified UserRemove message. Does not implicitly {@link MumbleProto.UserRemove.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.UserRemove
         * @static
         * @param {MumbleProto.IUserRemove} message UserRemove message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UserRemove.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.session);
            if (message.actor != null && Object.hasOwnProperty.call(message, "actor"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.actor);
            if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.reason);
            if (message.ban != null && Object.hasOwnProperty.call(message, "ban"))
                writer.uint32(/* id 4, wireType 0 =*/32).bool(message.ban);
            return writer;
        };

        /**
         * Encodes the specified UserRemove message, length delimited. Does not implicitly {@link MumbleProto.UserRemove.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.UserRemove
         * @static
         * @param {MumbleProto.IUserRemove} message UserRemove message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UserRemove.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a UserRemove message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.UserRemove
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.UserRemove} UserRemove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UserRemove.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.UserRemove();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.session = reader.uint32();
                        break;
                    }
                case 2: {
                        message.actor = reader.uint32();
                        break;
                    }
                case 3: {
                        message.reason = reader.string();
                        break;
                    }
                case 4: {
                        message.ban = reader.bool();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("session"))
                throw $util.ProtocolError("missing required 'session'", { instance: message });
            return message;
        };

        /**
         * Decodes a UserRemove message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.UserRemove
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.UserRemove} UserRemove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UserRemove.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a UserRemove message.
         * @function verify
         * @memberof MumbleProto.UserRemove
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        UserRemove.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isInteger(message.session))
                return "session: integer expected";
            if (message.actor != null && message.hasOwnProperty("actor"))
                if (!$util.isInteger(message.actor))
                    return "actor: integer expected";
            if (message.reason != null && message.hasOwnProperty("reason"))
                if (!$util.isString(message.reason))
                    return "reason: string expected";
            if (message.ban != null && message.hasOwnProperty("ban"))
                if (typeof message.ban !== "boolean")
                    return "ban: boolean expected";
            return null;
        };

        /**
         * Creates a UserRemove message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.UserRemove
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.UserRemove} UserRemove
         */
        UserRemove.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.UserRemove)
                return object;
            var message = new $root.MumbleProto.UserRemove();
            if (object.session != null)
                message.session = object.session >>> 0;
            if (object.actor != null)
                message.actor = object.actor >>> 0;
            if (object.reason != null)
                message.reason = String(object.reason);
            if (object.ban != null)
                message.ban = Boolean(object.ban);
            return message;
        };

        /**
         * Creates a plain object from a UserRemove message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.UserRemove
         * @static
         * @param {MumbleProto.UserRemove} message UserRemove
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        UserRemove.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.session = 0;
                object.actor = 0;
                object.reason = "";
                object.ban = false;
            }
            if (message.session != null && message.hasOwnProperty("session"))
                object.session = message.session;
            if (message.actor != null && message.hasOwnProperty("actor"))
                object.actor = message.actor;
            if (message.reason != null && message.hasOwnProperty("reason"))
                object.reason = message.reason;
            if (message.ban != null && message.hasOwnProperty("ban"))
                object.ban = message.ban;
            return object;
        };

        /**
         * Converts this UserRemove to JSON.
         * @function toJSON
         * @memberof MumbleProto.UserRemove
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        UserRemove.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for UserRemove
         * @function getTypeUrl
         * @memberof MumbleProto.UserRemove
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        UserRemove.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.UserRemove";
        };

        return UserRemove;
    })();

    MumbleProto.UserState = (function() {

        /**
         * Properties of a UserState.
         * @memberof MumbleProto
         * @interface IUserState
         * @property {number|null} [session] UserState session
         * @property {number|null} [actor] UserState actor
         * @property {string|null} [name] UserState name
         * @property {number|null} [userId] UserState userId
         * @property {number|null} [channelId] UserState channelId
         * @property {boolean|null} [mute] UserState mute
         * @property {boolean|null} [deaf] UserState deaf
         * @property {boolean|null} [suppress] UserState suppress
         * @property {boolean|null} [selfMute] UserState selfMute
         * @property {boolean|null} [selfDeaf] UserState selfDeaf
         * @property {Uint8Array|null} [texture] UserState texture
         * @property {Uint8Array|null} [pluginContext] UserState pluginContext
         * @property {string|null} [pluginIdentity] UserState pluginIdentity
         * @property {string|null} [comment] UserState comment
         * @property {string|null} [hash] UserState hash
         * @property {Uint8Array|null} [commentHash] UserState commentHash
         * @property {Uint8Array|null} [textureHash] UserState textureHash
         * @property {boolean|null} [prioritySpeaker] UserState prioritySpeaker
         * @property {boolean|null} [recording] UserState recording
         * @property {Array.<string>|null} [temporaryAccessTokens] UserState temporaryAccessTokens
         * @property {Array.<number>|null} [listeningChannelAdd] UserState listeningChannelAdd
         * @property {Array.<number>|null} [listeningChannelRemove] UserState listeningChannelRemove
         * @property {Array.<MumbleProto.UserState.IVolumeAdjustment>|null} [listeningVolumeAdjustment] UserState listeningVolumeAdjustment
         */

        /**
         * Constructs a new UserState.
         * @memberof MumbleProto
         * @classdesc Represents a UserState.
         * @implements IUserState
         * @constructor
         * @param {MumbleProto.IUserState=} [properties] Properties to set
         */
        function UserState(properties) {
            this.temporaryAccessTokens = [];
            this.listeningChannelAdd = [];
            this.listeningChannelRemove = [];
            this.listeningVolumeAdjustment = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * UserState session.
         * @member {number} session
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.session = 0;

        /**
         * UserState actor.
         * @member {number} actor
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.actor = 0;

        /**
         * UserState name.
         * @member {string} name
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.name = "";

        /**
         * UserState userId.
         * @member {number} userId
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.userId = 0;

        /**
         * UserState channelId.
         * @member {number} channelId
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.channelId = 0;

        /**
         * UserState mute.
         * @member {boolean} mute
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.mute = false;

        /**
         * UserState deaf.
         * @member {boolean} deaf
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.deaf = false;

        /**
         * UserState suppress.
         * @member {boolean} suppress
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.suppress = false;

        /**
         * UserState selfMute.
         * @member {boolean} selfMute
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.selfMute = false;

        /**
         * UserState selfDeaf.
         * @member {boolean} selfDeaf
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.selfDeaf = false;

        /**
         * UserState texture.
         * @member {Uint8Array} texture
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.texture = $util.newBuffer([]);

        /**
         * UserState pluginContext.
         * @member {Uint8Array} pluginContext
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.pluginContext = $util.newBuffer([]);

        /**
         * UserState pluginIdentity.
         * @member {string} pluginIdentity
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.pluginIdentity = "";

        /**
         * UserState comment.
         * @member {string} comment
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.comment = "";

        /**
         * UserState hash.
         * @member {string} hash
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.hash = "";

        /**
         * UserState commentHash.
         * @member {Uint8Array} commentHash
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.commentHash = $util.newBuffer([]);

        /**
         * UserState textureHash.
         * @member {Uint8Array} textureHash
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.textureHash = $util.newBuffer([]);

        /**
         * UserState prioritySpeaker.
         * @member {boolean} prioritySpeaker
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.prioritySpeaker = false;

        /**
         * UserState recording.
         * @member {boolean} recording
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.recording = false;

        /**
         * UserState temporaryAccessTokens.
         * @member {Array.<string>} temporaryAccessTokens
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.temporaryAccessTokens = $util.emptyArray;

        /**
         * UserState listeningChannelAdd.
         * @member {Array.<number>} listeningChannelAdd
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.listeningChannelAdd = $util.emptyArray;

        /**
         * UserState listeningChannelRemove.
         * @member {Array.<number>} listeningChannelRemove
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.listeningChannelRemove = $util.emptyArray;

        /**
         * UserState listeningVolumeAdjustment.
         * @member {Array.<MumbleProto.UserState.IVolumeAdjustment>} listeningVolumeAdjustment
         * @memberof MumbleProto.UserState
         * @instance
         */
        UserState.prototype.listeningVolumeAdjustment = $util.emptyArray;

        /**
         * Creates a new UserState instance using the specified properties.
         * @function create
         * @memberof MumbleProto.UserState
         * @static
         * @param {MumbleProto.IUserState=} [properties] Properties to set
         * @returns {MumbleProto.UserState} UserState instance
         */
        UserState.create = function create(properties) {
            return new UserState(properties);
        };

        /**
         * Encodes the specified UserState message. Does not implicitly {@link MumbleProto.UserState.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.UserState
         * @static
         * @param {MumbleProto.IUserState} message UserState message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UserState.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.session != null && Object.hasOwnProperty.call(message, "session"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.session);
            if (message.actor != null && Object.hasOwnProperty.call(message, "actor"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.actor);
            if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.name);
            if (message.userId != null && Object.hasOwnProperty.call(message, "userId"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.userId);
            if (message.channelId != null && Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.channelId);
            if (message.mute != null && Object.hasOwnProperty.call(message, "mute"))
                writer.uint32(/* id 6, wireType 0 =*/48).bool(message.mute);
            if (message.deaf != null && Object.hasOwnProperty.call(message, "deaf"))
                writer.uint32(/* id 7, wireType 0 =*/56).bool(message.deaf);
            if (message.suppress != null && Object.hasOwnProperty.call(message, "suppress"))
                writer.uint32(/* id 8, wireType 0 =*/64).bool(message.suppress);
            if (message.selfMute != null && Object.hasOwnProperty.call(message, "selfMute"))
                writer.uint32(/* id 9, wireType 0 =*/72).bool(message.selfMute);
            if (message.selfDeaf != null && Object.hasOwnProperty.call(message, "selfDeaf"))
                writer.uint32(/* id 10, wireType 0 =*/80).bool(message.selfDeaf);
            if (message.texture != null && Object.hasOwnProperty.call(message, "texture"))
                writer.uint32(/* id 11, wireType 2 =*/90).bytes(message.texture);
            if (message.pluginContext != null && Object.hasOwnProperty.call(message, "pluginContext"))
                writer.uint32(/* id 12, wireType 2 =*/98).bytes(message.pluginContext);
            if (message.pluginIdentity != null && Object.hasOwnProperty.call(message, "pluginIdentity"))
                writer.uint32(/* id 13, wireType 2 =*/106).string(message.pluginIdentity);
            if (message.comment != null && Object.hasOwnProperty.call(message, "comment"))
                writer.uint32(/* id 14, wireType 2 =*/114).string(message.comment);
            if (message.hash != null && Object.hasOwnProperty.call(message, "hash"))
                writer.uint32(/* id 15, wireType 2 =*/122).string(message.hash);
            if (message.commentHash != null && Object.hasOwnProperty.call(message, "commentHash"))
                writer.uint32(/* id 16, wireType 2 =*/130).bytes(message.commentHash);
            if (message.textureHash != null && Object.hasOwnProperty.call(message, "textureHash"))
                writer.uint32(/* id 17, wireType 2 =*/138).bytes(message.textureHash);
            if (message.prioritySpeaker != null && Object.hasOwnProperty.call(message, "prioritySpeaker"))
                writer.uint32(/* id 18, wireType 0 =*/144).bool(message.prioritySpeaker);
            if (message.recording != null && Object.hasOwnProperty.call(message, "recording"))
                writer.uint32(/* id 19, wireType 0 =*/152).bool(message.recording);
            if (message.temporaryAccessTokens != null && message.temporaryAccessTokens.length)
                for (var i = 0; i < message.temporaryAccessTokens.length; ++i)
                    writer.uint32(/* id 20, wireType 2 =*/162).string(message.temporaryAccessTokens[i]);
            if (message.listeningChannelAdd != null && message.listeningChannelAdd.length)
                for (var i = 0; i < message.listeningChannelAdd.length; ++i)
                    writer.uint32(/* id 21, wireType 0 =*/168).uint32(message.listeningChannelAdd[i]);
            if (message.listeningChannelRemove != null && message.listeningChannelRemove.length)
                for (var i = 0; i < message.listeningChannelRemove.length; ++i)
                    writer.uint32(/* id 22, wireType 0 =*/176).uint32(message.listeningChannelRemove[i]);
            if (message.listeningVolumeAdjustment != null && message.listeningVolumeAdjustment.length)
                for (var i = 0; i < message.listeningVolumeAdjustment.length; ++i)
                    $root.MumbleProto.UserState.VolumeAdjustment.encode(message.listeningVolumeAdjustment[i], writer.uint32(/* id 23, wireType 2 =*/186).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified UserState message, length delimited. Does not implicitly {@link MumbleProto.UserState.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.UserState
         * @static
         * @param {MumbleProto.IUserState} message UserState message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UserState.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a UserState message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.UserState
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.UserState} UserState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UserState.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.UserState();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.session = reader.uint32();
                        break;
                    }
                case 2: {
                        message.actor = reader.uint32();
                        break;
                    }
                case 3: {
                        message.name = reader.string();
                        break;
                    }
                case 4: {
                        message.userId = reader.uint32();
                        break;
                    }
                case 5: {
                        message.channelId = reader.uint32();
                        break;
                    }
                case 6: {
                        message.mute = reader.bool();
                        break;
                    }
                case 7: {
                        message.deaf = reader.bool();
                        break;
                    }
                case 8: {
                        message.suppress = reader.bool();
                        break;
                    }
                case 9: {
                        message.selfMute = reader.bool();
                        break;
                    }
                case 10: {
                        message.selfDeaf = reader.bool();
                        break;
                    }
                case 11: {
                        message.texture = reader.bytes();
                        break;
                    }
                case 12: {
                        message.pluginContext = reader.bytes();
                        break;
                    }
                case 13: {
                        message.pluginIdentity = reader.string();
                        break;
                    }
                case 14: {
                        message.comment = reader.string();
                        break;
                    }
                case 15: {
                        message.hash = reader.string();
                        break;
                    }
                case 16: {
                        message.commentHash = reader.bytes();
                        break;
                    }
                case 17: {
                        message.textureHash = reader.bytes();
                        break;
                    }
                case 18: {
                        message.prioritySpeaker = reader.bool();
                        break;
                    }
                case 19: {
                        message.recording = reader.bool();
                        break;
                    }
                case 20: {
                        if (!(message.temporaryAccessTokens && message.temporaryAccessTokens.length))
                            message.temporaryAccessTokens = [];
                        message.temporaryAccessTokens.push(reader.string());
                        break;
                    }
                case 21: {
                        if (!(message.listeningChannelAdd && message.listeningChannelAdd.length))
                            message.listeningChannelAdd = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.listeningChannelAdd.push(reader.uint32());
                        } else
                            message.listeningChannelAdd.push(reader.uint32());
                        break;
                    }
                case 22: {
                        if (!(message.listeningChannelRemove && message.listeningChannelRemove.length))
                            message.listeningChannelRemove = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.listeningChannelRemove.push(reader.uint32());
                        } else
                            message.listeningChannelRemove.push(reader.uint32());
                        break;
                    }
                case 23: {
                        if (!(message.listeningVolumeAdjustment && message.listeningVolumeAdjustment.length))
                            message.listeningVolumeAdjustment = [];
                        message.listeningVolumeAdjustment.push($root.MumbleProto.UserState.VolumeAdjustment.decode(reader, reader.uint32()));
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
         * Decodes a UserState message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.UserState
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.UserState} UserState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UserState.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a UserState message.
         * @function verify
         * @memberof MumbleProto.UserState
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        UserState.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.session != null && message.hasOwnProperty("session"))
                if (!$util.isInteger(message.session))
                    return "session: integer expected";
            if (message.actor != null && message.hasOwnProperty("actor"))
                if (!$util.isInteger(message.actor))
                    return "actor: integer expected";
            if (message.name != null && message.hasOwnProperty("name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            if (message.userId != null && message.hasOwnProperty("userId"))
                if (!$util.isInteger(message.userId))
                    return "userId: integer expected";
            if (message.channelId != null && message.hasOwnProperty("channelId"))
                if (!$util.isInteger(message.channelId))
                    return "channelId: integer expected";
            if (message.mute != null && message.hasOwnProperty("mute"))
                if (typeof message.mute !== "boolean")
                    return "mute: boolean expected";
            if (message.deaf != null && message.hasOwnProperty("deaf"))
                if (typeof message.deaf !== "boolean")
                    return "deaf: boolean expected";
            if (message.suppress != null && message.hasOwnProperty("suppress"))
                if (typeof message.suppress !== "boolean")
                    return "suppress: boolean expected";
            if (message.selfMute != null && message.hasOwnProperty("selfMute"))
                if (typeof message.selfMute !== "boolean")
                    return "selfMute: boolean expected";
            if (message.selfDeaf != null && message.hasOwnProperty("selfDeaf"))
                if (typeof message.selfDeaf !== "boolean")
                    return "selfDeaf: boolean expected";
            if (message.texture != null && message.hasOwnProperty("texture"))
                if (!(message.texture && typeof message.texture.length === "number" || $util.isString(message.texture)))
                    return "texture: buffer expected";
            if (message.pluginContext != null && message.hasOwnProperty("pluginContext"))
                if (!(message.pluginContext && typeof message.pluginContext.length === "number" || $util.isString(message.pluginContext)))
                    return "pluginContext: buffer expected";
            if (message.pluginIdentity != null && message.hasOwnProperty("pluginIdentity"))
                if (!$util.isString(message.pluginIdentity))
                    return "pluginIdentity: string expected";
            if (message.comment != null && message.hasOwnProperty("comment"))
                if (!$util.isString(message.comment))
                    return "comment: string expected";
            if (message.hash != null && message.hasOwnProperty("hash"))
                if (!$util.isString(message.hash))
                    return "hash: string expected";
            if (message.commentHash != null && message.hasOwnProperty("commentHash"))
                if (!(message.commentHash && typeof message.commentHash.length === "number" || $util.isString(message.commentHash)))
                    return "commentHash: buffer expected";
            if (message.textureHash != null && message.hasOwnProperty("textureHash"))
                if (!(message.textureHash && typeof message.textureHash.length === "number" || $util.isString(message.textureHash)))
                    return "textureHash: buffer expected";
            if (message.prioritySpeaker != null && message.hasOwnProperty("prioritySpeaker"))
                if (typeof message.prioritySpeaker !== "boolean")
                    return "prioritySpeaker: boolean expected";
            if (message.recording != null && message.hasOwnProperty("recording"))
                if (typeof message.recording !== "boolean")
                    return "recording: boolean expected";
            if (message.temporaryAccessTokens != null && message.hasOwnProperty("temporaryAccessTokens")) {
                if (!Array.isArray(message.temporaryAccessTokens))
                    return "temporaryAccessTokens: array expected";
                for (var i = 0; i < message.temporaryAccessTokens.length; ++i)
                    if (!$util.isString(message.temporaryAccessTokens[i]))
                        return "temporaryAccessTokens: string[] expected";
            }
            if (message.listeningChannelAdd != null && message.hasOwnProperty("listeningChannelAdd")) {
                if (!Array.isArray(message.listeningChannelAdd))
                    return "listeningChannelAdd: array expected";
                for (var i = 0; i < message.listeningChannelAdd.length; ++i)
                    if (!$util.isInteger(message.listeningChannelAdd[i]))
                        return "listeningChannelAdd: integer[] expected";
            }
            if (message.listeningChannelRemove != null && message.hasOwnProperty("listeningChannelRemove")) {
                if (!Array.isArray(message.listeningChannelRemove))
                    return "listeningChannelRemove: array expected";
                for (var i = 0; i < message.listeningChannelRemove.length; ++i)
                    if (!$util.isInteger(message.listeningChannelRemove[i]))
                        return "listeningChannelRemove: integer[] expected";
            }
            if (message.listeningVolumeAdjustment != null && message.hasOwnProperty("listeningVolumeAdjustment")) {
                if (!Array.isArray(message.listeningVolumeAdjustment))
                    return "listeningVolumeAdjustment: array expected";
                for (var i = 0; i < message.listeningVolumeAdjustment.length; ++i) {
                    var error = $root.MumbleProto.UserState.VolumeAdjustment.verify(message.listeningVolumeAdjustment[i]);
                    if (error)
                        return "listeningVolumeAdjustment." + error;
                }
            }
            return null;
        };

        /**
         * Creates a UserState message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.UserState
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.UserState} UserState
         */
        UserState.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.UserState)
                return object;
            var message = new $root.MumbleProto.UserState();
            if (object.session != null)
                message.session = object.session >>> 0;
            if (object.actor != null)
                message.actor = object.actor >>> 0;
            if (object.name != null)
                message.name = String(object.name);
            if (object.userId != null)
                message.userId = object.userId >>> 0;
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            if (object.mute != null)
                message.mute = Boolean(object.mute);
            if (object.deaf != null)
                message.deaf = Boolean(object.deaf);
            if (object.suppress != null)
                message.suppress = Boolean(object.suppress);
            if (object.selfMute != null)
                message.selfMute = Boolean(object.selfMute);
            if (object.selfDeaf != null)
                message.selfDeaf = Boolean(object.selfDeaf);
            if (object.texture != null)
                if (typeof object.texture === "string")
                    $util.base64.decode(object.texture, message.texture = $util.newBuffer($util.base64.length(object.texture)), 0);
                else if (object.texture.length >= 0)
                    message.texture = object.texture;
            if (object.pluginContext != null)
                if (typeof object.pluginContext === "string")
                    $util.base64.decode(object.pluginContext, message.pluginContext = $util.newBuffer($util.base64.length(object.pluginContext)), 0);
                else if (object.pluginContext.length >= 0)
                    message.pluginContext = object.pluginContext;
            if (object.pluginIdentity != null)
                message.pluginIdentity = String(object.pluginIdentity);
            if (object.comment != null)
                message.comment = String(object.comment);
            if (object.hash != null)
                message.hash = String(object.hash);
            if (object.commentHash != null)
                if (typeof object.commentHash === "string")
                    $util.base64.decode(object.commentHash, message.commentHash = $util.newBuffer($util.base64.length(object.commentHash)), 0);
                else if (object.commentHash.length >= 0)
                    message.commentHash = object.commentHash;
            if (object.textureHash != null)
                if (typeof object.textureHash === "string")
                    $util.base64.decode(object.textureHash, message.textureHash = $util.newBuffer($util.base64.length(object.textureHash)), 0);
                else if (object.textureHash.length >= 0)
                    message.textureHash = object.textureHash;
            if (object.prioritySpeaker != null)
                message.prioritySpeaker = Boolean(object.prioritySpeaker);
            if (object.recording != null)
                message.recording = Boolean(object.recording);
            if (object.temporaryAccessTokens) {
                if (!Array.isArray(object.temporaryAccessTokens))
                    throw TypeError(".MumbleProto.UserState.temporaryAccessTokens: array expected");
                message.temporaryAccessTokens = [];
                for (var i = 0; i < object.temporaryAccessTokens.length; ++i)
                    message.temporaryAccessTokens[i] = String(object.temporaryAccessTokens[i]);
            }
            if (object.listeningChannelAdd) {
                if (!Array.isArray(object.listeningChannelAdd))
                    throw TypeError(".MumbleProto.UserState.listeningChannelAdd: array expected");
                message.listeningChannelAdd = [];
                for (var i = 0; i < object.listeningChannelAdd.length; ++i)
                    message.listeningChannelAdd[i] = object.listeningChannelAdd[i] >>> 0;
            }
            if (object.listeningChannelRemove) {
                if (!Array.isArray(object.listeningChannelRemove))
                    throw TypeError(".MumbleProto.UserState.listeningChannelRemove: array expected");
                message.listeningChannelRemove = [];
                for (var i = 0; i < object.listeningChannelRemove.length; ++i)
                    message.listeningChannelRemove[i] = object.listeningChannelRemove[i] >>> 0;
            }
            if (object.listeningVolumeAdjustment) {
                if (!Array.isArray(object.listeningVolumeAdjustment))
                    throw TypeError(".MumbleProto.UserState.listeningVolumeAdjustment: array expected");
                message.listeningVolumeAdjustment = [];
                for (var i = 0; i < object.listeningVolumeAdjustment.length; ++i) {
                    if (typeof object.listeningVolumeAdjustment[i] !== "object")
                        throw TypeError(".MumbleProto.UserState.listeningVolumeAdjustment: object expected");
                    message.listeningVolumeAdjustment[i] = $root.MumbleProto.UserState.VolumeAdjustment.fromObject(object.listeningVolumeAdjustment[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a UserState message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.UserState
         * @static
         * @param {MumbleProto.UserState} message UserState
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        UserState.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object.temporaryAccessTokens = [];
                object.listeningChannelAdd = [];
                object.listeningChannelRemove = [];
                object.listeningVolumeAdjustment = [];
            }
            if (options.defaults) {
                object.session = 0;
                object.actor = 0;
                object.name = "";
                object.userId = 0;
                object.channelId = 0;
                object.mute = false;
                object.deaf = false;
                object.suppress = false;
                object.selfMute = false;
                object.selfDeaf = false;
                if (options.bytes === String)
                    object.texture = "";
                else {
                    object.texture = [];
                    if (options.bytes !== Array)
                        object.texture = $util.newBuffer(object.texture);
                }
                if (options.bytes === String)
                    object.pluginContext = "";
                else {
                    object.pluginContext = [];
                    if (options.bytes !== Array)
                        object.pluginContext = $util.newBuffer(object.pluginContext);
                }
                object.pluginIdentity = "";
                object.comment = "";
                object.hash = "";
                if (options.bytes === String)
                    object.commentHash = "";
                else {
                    object.commentHash = [];
                    if (options.bytes !== Array)
                        object.commentHash = $util.newBuffer(object.commentHash);
                }
                if (options.bytes === String)
                    object.textureHash = "";
                else {
                    object.textureHash = [];
                    if (options.bytes !== Array)
                        object.textureHash = $util.newBuffer(object.textureHash);
                }
                object.prioritySpeaker = false;
                object.recording = false;
            }
            if (message.session != null && message.hasOwnProperty("session"))
                object.session = message.session;
            if (message.actor != null && message.hasOwnProperty("actor"))
                object.actor = message.actor;
            if (message.name != null && message.hasOwnProperty("name"))
                object.name = message.name;
            if (message.userId != null && message.hasOwnProperty("userId"))
                object.userId = message.userId;
            if (message.channelId != null && message.hasOwnProperty("channelId"))
                object.channelId = message.channelId;
            if (message.mute != null && message.hasOwnProperty("mute"))
                object.mute = message.mute;
            if (message.deaf != null && message.hasOwnProperty("deaf"))
                object.deaf = message.deaf;
            if (message.suppress != null && message.hasOwnProperty("suppress"))
                object.suppress = message.suppress;
            if (message.selfMute != null && message.hasOwnProperty("selfMute"))
                object.selfMute = message.selfMute;
            if (message.selfDeaf != null && message.hasOwnProperty("selfDeaf"))
                object.selfDeaf = message.selfDeaf;
            if (message.texture != null && message.hasOwnProperty("texture"))
                object.texture = options.bytes === String ? $util.base64.encode(message.texture, 0, message.texture.length) : options.bytes === Array ? Array.prototype.slice.call(message.texture) : message.texture;
            if (message.pluginContext != null && message.hasOwnProperty("pluginContext"))
                object.pluginContext = options.bytes === String ? $util.base64.encode(message.pluginContext, 0, message.pluginContext.length) : options.bytes === Array ? Array.prototype.slice.call(message.pluginContext) : message.pluginContext;
            if (message.pluginIdentity != null && message.hasOwnProperty("pluginIdentity"))
                object.pluginIdentity = message.pluginIdentity;
            if (message.comment != null && message.hasOwnProperty("comment"))
                object.comment = message.comment;
            if (message.hash != null && message.hasOwnProperty("hash"))
                object.hash = message.hash;
            if (message.commentHash != null && message.hasOwnProperty("commentHash"))
                object.commentHash = options.bytes === String ? $util.base64.encode(message.commentHash, 0, message.commentHash.length) : options.bytes === Array ? Array.prototype.slice.call(message.commentHash) : message.commentHash;
            if (message.textureHash != null && message.hasOwnProperty("textureHash"))
                object.textureHash = options.bytes === String ? $util.base64.encode(message.textureHash, 0, message.textureHash.length) : options.bytes === Array ? Array.prototype.slice.call(message.textureHash) : message.textureHash;
            if (message.prioritySpeaker != null && message.hasOwnProperty("prioritySpeaker"))
                object.prioritySpeaker = message.prioritySpeaker;
            if (message.recording != null && message.hasOwnProperty("recording"))
                object.recording = message.recording;
            if (message.temporaryAccessTokens && message.temporaryAccessTokens.length) {
                object.temporaryAccessTokens = [];
                for (var j = 0; j < message.temporaryAccessTokens.length; ++j)
                    object.temporaryAccessTokens[j] = message.temporaryAccessTokens[j];
            }
            if (message.listeningChannelAdd && message.listeningChannelAdd.length) {
                object.listeningChannelAdd = [];
                for (var j = 0; j < message.listeningChannelAdd.length; ++j)
                    object.listeningChannelAdd[j] = message.listeningChannelAdd[j];
            }
            if (message.listeningChannelRemove && message.listeningChannelRemove.length) {
                object.listeningChannelRemove = [];
                for (var j = 0; j < message.listeningChannelRemove.length; ++j)
                    object.listeningChannelRemove[j] = message.listeningChannelRemove[j];
            }
            if (message.listeningVolumeAdjustment && message.listeningVolumeAdjustment.length) {
                object.listeningVolumeAdjustment = [];
                for (var j = 0; j < message.listeningVolumeAdjustment.length; ++j)
                    object.listeningVolumeAdjustment[j] = $root.MumbleProto.UserState.VolumeAdjustment.toObject(message.listeningVolumeAdjustment[j], options);
            }
            return object;
        };

        /**
         * Converts this UserState to JSON.
         * @function toJSON
         * @memberof MumbleProto.UserState
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        UserState.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for UserState
         * @function getTypeUrl
         * @memberof MumbleProto.UserState
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        UserState.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.UserState";
        };

        UserState.VolumeAdjustment = (function() {

            /**
             * Properties of a VolumeAdjustment.
             * @memberof MumbleProto.UserState
             * @interface IVolumeAdjustment
             * @property {number|null} [listeningChannel] VolumeAdjustment listeningChannel
             * @property {number|null} [volumeAdjustment] VolumeAdjustment volumeAdjustment
             */

            /**
             * Constructs a new VolumeAdjustment.
             * @memberof MumbleProto.UserState
             * @classdesc Represents a VolumeAdjustment.
             * @implements IVolumeAdjustment
             * @constructor
             * @param {MumbleProto.UserState.IVolumeAdjustment=} [properties] Properties to set
             */
            function VolumeAdjustment(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * VolumeAdjustment listeningChannel.
             * @member {number} listeningChannel
             * @memberof MumbleProto.UserState.VolumeAdjustment
             * @instance
             */
            VolumeAdjustment.prototype.listeningChannel = 0;

            /**
             * VolumeAdjustment volumeAdjustment.
             * @member {number} volumeAdjustment
             * @memberof MumbleProto.UserState.VolumeAdjustment
             * @instance
             */
            VolumeAdjustment.prototype.volumeAdjustment = 0;

            /**
             * Creates a new VolumeAdjustment instance using the specified properties.
             * @function create
             * @memberof MumbleProto.UserState.VolumeAdjustment
             * @static
             * @param {MumbleProto.UserState.IVolumeAdjustment=} [properties] Properties to set
             * @returns {MumbleProto.UserState.VolumeAdjustment} VolumeAdjustment instance
             */
            VolumeAdjustment.create = function create(properties) {
                return new VolumeAdjustment(properties);
            };

            /**
             * Encodes the specified VolumeAdjustment message. Does not implicitly {@link MumbleProto.UserState.VolumeAdjustment.verify|verify} messages.
             * @function encode
             * @memberof MumbleProto.UserState.VolumeAdjustment
             * @static
             * @param {MumbleProto.UserState.IVolumeAdjustment} message VolumeAdjustment message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            VolumeAdjustment.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.listeningChannel != null && Object.hasOwnProperty.call(message, "listeningChannel"))
                    writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.listeningChannel);
                if (message.volumeAdjustment != null && Object.hasOwnProperty.call(message, "volumeAdjustment"))
                    writer.uint32(/* id 2, wireType 5 =*/21).float(message.volumeAdjustment);
                return writer;
            };

            /**
             * Encodes the specified VolumeAdjustment message, length delimited. Does not implicitly {@link MumbleProto.UserState.VolumeAdjustment.verify|verify} messages.
             * @function encodeDelimited
             * @memberof MumbleProto.UserState.VolumeAdjustment
             * @static
             * @param {MumbleProto.UserState.IVolumeAdjustment} message VolumeAdjustment message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            VolumeAdjustment.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a VolumeAdjustment message from the specified reader or buffer.
             * @function decode
             * @memberof MumbleProto.UserState.VolumeAdjustment
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {MumbleProto.UserState.VolumeAdjustment} VolumeAdjustment
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            VolumeAdjustment.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.UserState.VolumeAdjustment();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.listeningChannel = reader.uint32();
                            break;
                        }
                    case 2: {
                            message.volumeAdjustment = reader.float();
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
             * Decodes a VolumeAdjustment message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof MumbleProto.UserState.VolumeAdjustment
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {MumbleProto.UserState.VolumeAdjustment} VolumeAdjustment
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            VolumeAdjustment.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a VolumeAdjustment message.
             * @function verify
             * @memberof MumbleProto.UserState.VolumeAdjustment
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            VolumeAdjustment.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.listeningChannel != null && message.hasOwnProperty("listeningChannel"))
                    if (!$util.isInteger(message.listeningChannel))
                        return "listeningChannel: integer expected";
                if (message.volumeAdjustment != null && message.hasOwnProperty("volumeAdjustment"))
                    if (typeof message.volumeAdjustment !== "number")
                        return "volumeAdjustment: number expected";
                return null;
            };

            /**
             * Creates a VolumeAdjustment message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof MumbleProto.UserState.VolumeAdjustment
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {MumbleProto.UserState.VolumeAdjustment} VolumeAdjustment
             */
            VolumeAdjustment.fromObject = function fromObject(object) {
                if (object instanceof $root.MumbleProto.UserState.VolumeAdjustment)
                    return object;
                var message = new $root.MumbleProto.UserState.VolumeAdjustment();
                if (object.listeningChannel != null)
                    message.listeningChannel = object.listeningChannel >>> 0;
                if (object.volumeAdjustment != null)
                    message.volumeAdjustment = Number(object.volumeAdjustment);
                return message;
            };

            /**
             * Creates a plain object from a VolumeAdjustment message. Also converts values to other types if specified.
             * @function toObject
             * @memberof MumbleProto.UserState.VolumeAdjustment
             * @static
             * @param {MumbleProto.UserState.VolumeAdjustment} message VolumeAdjustment
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            VolumeAdjustment.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.listeningChannel = 0;
                    object.volumeAdjustment = 0;
                }
                if (message.listeningChannel != null && message.hasOwnProperty("listeningChannel"))
                    object.listeningChannel = message.listeningChannel;
                if (message.volumeAdjustment != null && message.hasOwnProperty("volumeAdjustment"))
                    object.volumeAdjustment = options.json && !isFinite(message.volumeAdjustment) ? String(message.volumeAdjustment) : message.volumeAdjustment;
                return object;
            };

            /**
             * Converts this VolumeAdjustment to JSON.
             * @function toJSON
             * @memberof MumbleProto.UserState.VolumeAdjustment
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            VolumeAdjustment.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for VolumeAdjustment
             * @function getTypeUrl
             * @memberof MumbleProto.UserState.VolumeAdjustment
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            VolumeAdjustment.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/MumbleProto.UserState.VolumeAdjustment";
            };

            return VolumeAdjustment;
        })();

        return UserState;
    })();

    MumbleProto.BanList = (function() {

        /**
         * Properties of a BanList.
         * @memberof MumbleProto
         * @interface IBanList
         * @property {Array.<MumbleProto.BanList.IBanEntry>|null} [bans] BanList bans
         * @property {boolean|null} [query] BanList query
         */

        /**
         * Constructs a new BanList.
         * @memberof MumbleProto
         * @classdesc Represents a BanList.
         * @implements IBanList
         * @constructor
         * @param {MumbleProto.IBanList=} [properties] Properties to set
         */
        function BanList(properties) {
            this.bans = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * BanList bans.
         * @member {Array.<MumbleProto.BanList.IBanEntry>} bans
         * @memberof MumbleProto.BanList
         * @instance
         */
        BanList.prototype.bans = $util.emptyArray;

        /**
         * BanList query.
         * @member {boolean} query
         * @memberof MumbleProto.BanList
         * @instance
         */
        BanList.prototype.query = false;

        /**
         * Creates a new BanList instance using the specified properties.
         * @function create
         * @memberof MumbleProto.BanList
         * @static
         * @param {MumbleProto.IBanList=} [properties] Properties to set
         * @returns {MumbleProto.BanList} BanList instance
         */
        BanList.create = function create(properties) {
            return new BanList(properties);
        };

        /**
         * Encodes the specified BanList message. Does not implicitly {@link MumbleProto.BanList.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.BanList
         * @static
         * @param {MumbleProto.IBanList} message BanList message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        BanList.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.bans != null && message.bans.length)
                for (var i = 0; i < message.bans.length; ++i)
                    $root.MumbleProto.BanList.BanEntry.encode(message.bans[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.query != null && Object.hasOwnProperty.call(message, "query"))
                writer.uint32(/* id 2, wireType 0 =*/16).bool(message.query);
            return writer;
        };

        /**
         * Encodes the specified BanList message, length delimited. Does not implicitly {@link MumbleProto.BanList.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.BanList
         * @static
         * @param {MumbleProto.IBanList} message BanList message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        BanList.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a BanList message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.BanList
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.BanList} BanList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        BanList.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.BanList();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.bans && message.bans.length))
                            message.bans = [];
                        message.bans.push($root.MumbleProto.BanList.BanEntry.decode(reader, reader.uint32()));
                        break;
                    }
                case 2: {
                        message.query = reader.bool();
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
         * Decodes a BanList message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.BanList
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.BanList} BanList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        BanList.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a BanList message.
         * @function verify
         * @memberof MumbleProto.BanList
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        BanList.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.bans != null && message.hasOwnProperty("bans")) {
                if (!Array.isArray(message.bans))
                    return "bans: array expected";
                for (var i = 0; i < message.bans.length; ++i) {
                    var error = $root.MumbleProto.BanList.BanEntry.verify(message.bans[i]);
                    if (error)
                        return "bans." + error;
                }
            }
            if (message.query != null && message.hasOwnProperty("query"))
                if (typeof message.query !== "boolean")
                    return "query: boolean expected";
            return null;
        };

        /**
         * Creates a BanList message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.BanList
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.BanList} BanList
         */
        BanList.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.BanList)
                return object;
            var message = new $root.MumbleProto.BanList();
            if (object.bans) {
                if (!Array.isArray(object.bans))
                    throw TypeError(".MumbleProto.BanList.bans: array expected");
                message.bans = [];
                for (var i = 0; i < object.bans.length; ++i) {
                    if (typeof object.bans[i] !== "object")
                        throw TypeError(".MumbleProto.BanList.bans: object expected");
                    message.bans[i] = $root.MumbleProto.BanList.BanEntry.fromObject(object.bans[i]);
                }
            }
            if (object.query != null)
                message.query = Boolean(object.query);
            return message;
        };

        /**
         * Creates a plain object from a BanList message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.BanList
         * @static
         * @param {MumbleProto.BanList} message BanList
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        BanList.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.bans = [];
            if (options.defaults)
                object.query = false;
            if (message.bans && message.bans.length) {
                object.bans = [];
                for (var j = 0; j < message.bans.length; ++j)
                    object.bans[j] = $root.MumbleProto.BanList.BanEntry.toObject(message.bans[j], options);
            }
            if (message.query != null && message.hasOwnProperty("query"))
                object.query = message.query;
            return object;
        };

        /**
         * Converts this BanList to JSON.
         * @function toJSON
         * @memberof MumbleProto.BanList
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        BanList.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for BanList
         * @function getTypeUrl
         * @memberof MumbleProto.BanList
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        BanList.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.BanList";
        };

        BanList.BanEntry = (function() {

            /**
             * Properties of a BanEntry.
             * @memberof MumbleProto.BanList
             * @interface IBanEntry
             * @property {Uint8Array} address BanEntry address
             * @property {number} mask BanEntry mask
             * @property {string|null} [name] BanEntry name
             * @property {string|null} [hash] BanEntry hash
             * @property {string|null} [reason] BanEntry reason
             * @property {string|null} [start] BanEntry start
             * @property {number|null} [duration] BanEntry duration
             */

            /**
             * Constructs a new BanEntry.
             * @memberof MumbleProto.BanList
             * @classdesc Represents a BanEntry.
             * @implements IBanEntry
             * @constructor
             * @param {MumbleProto.BanList.IBanEntry=} [properties] Properties to set
             */
            function BanEntry(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * BanEntry address.
             * @member {Uint8Array} address
             * @memberof MumbleProto.BanList.BanEntry
             * @instance
             */
            BanEntry.prototype.address = $util.newBuffer([]);

            /**
             * BanEntry mask.
             * @member {number} mask
             * @memberof MumbleProto.BanList.BanEntry
             * @instance
             */
            BanEntry.prototype.mask = 0;

            /**
             * BanEntry name.
             * @member {string} name
             * @memberof MumbleProto.BanList.BanEntry
             * @instance
             */
            BanEntry.prototype.name = "";

            /**
             * BanEntry hash.
             * @member {string} hash
             * @memberof MumbleProto.BanList.BanEntry
             * @instance
             */
            BanEntry.prototype.hash = "";

            /**
             * BanEntry reason.
             * @member {string} reason
             * @memberof MumbleProto.BanList.BanEntry
             * @instance
             */
            BanEntry.prototype.reason = "";

            /**
             * BanEntry start.
             * @member {string} start
             * @memberof MumbleProto.BanList.BanEntry
             * @instance
             */
            BanEntry.prototype.start = "";

            /**
             * BanEntry duration.
             * @member {number} duration
             * @memberof MumbleProto.BanList.BanEntry
             * @instance
             */
            BanEntry.prototype.duration = 0;

            /**
             * Creates a new BanEntry instance using the specified properties.
             * @function create
             * @memberof MumbleProto.BanList.BanEntry
             * @static
             * @param {MumbleProto.BanList.IBanEntry=} [properties] Properties to set
             * @returns {MumbleProto.BanList.BanEntry} BanEntry instance
             */
            BanEntry.create = function create(properties) {
                return new BanEntry(properties);
            };

            /**
             * Encodes the specified BanEntry message. Does not implicitly {@link MumbleProto.BanList.BanEntry.verify|verify} messages.
             * @function encode
             * @memberof MumbleProto.BanList.BanEntry
             * @static
             * @param {MumbleProto.BanList.IBanEntry} message BanEntry message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            BanEntry.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.address);
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.mask);
                if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.name);
                if (message.hash != null && Object.hasOwnProperty.call(message, "hash"))
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.hash);
                if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
                    writer.uint32(/* id 5, wireType 2 =*/42).string(message.reason);
                if (message.start != null && Object.hasOwnProperty.call(message, "start"))
                    writer.uint32(/* id 6, wireType 2 =*/50).string(message.start);
                if (message.duration != null && Object.hasOwnProperty.call(message, "duration"))
                    writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.duration);
                return writer;
            };

            /**
             * Encodes the specified BanEntry message, length delimited. Does not implicitly {@link MumbleProto.BanList.BanEntry.verify|verify} messages.
             * @function encodeDelimited
             * @memberof MumbleProto.BanList.BanEntry
             * @static
             * @param {MumbleProto.BanList.IBanEntry} message BanEntry message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            BanEntry.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a BanEntry message from the specified reader or buffer.
             * @function decode
             * @memberof MumbleProto.BanList.BanEntry
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {MumbleProto.BanList.BanEntry} BanEntry
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            BanEntry.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.BanList.BanEntry();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.address = reader.bytes();
                            break;
                        }
                    case 2: {
                            message.mask = reader.uint32();
                            break;
                        }
                    case 3: {
                            message.name = reader.string();
                            break;
                        }
                    case 4: {
                            message.hash = reader.string();
                            break;
                        }
                    case 5: {
                            message.reason = reader.string();
                            break;
                        }
                    case 6: {
                            message.start = reader.string();
                            break;
                        }
                    case 7: {
                            message.duration = reader.uint32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                if (!message.hasOwnProperty("address"))
                    throw $util.ProtocolError("missing required 'address'", { instance: message });
                if (!message.hasOwnProperty("mask"))
                    throw $util.ProtocolError("missing required 'mask'", { instance: message });
                return message;
            };

            /**
             * Decodes a BanEntry message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof MumbleProto.BanList.BanEntry
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {MumbleProto.BanList.BanEntry} BanEntry
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            BanEntry.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a BanEntry message.
             * @function verify
             * @memberof MumbleProto.BanList.BanEntry
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            BanEntry.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (!(message.address && typeof message.address.length === "number" || $util.isString(message.address)))
                    return "address: buffer expected";
                if (!$util.isInteger(message.mask))
                    return "mask: integer expected";
                if (message.name != null && message.hasOwnProperty("name"))
                    if (!$util.isString(message.name))
                        return "name: string expected";
                if (message.hash != null && message.hasOwnProperty("hash"))
                    if (!$util.isString(message.hash))
                        return "hash: string expected";
                if (message.reason != null && message.hasOwnProperty("reason"))
                    if (!$util.isString(message.reason))
                        return "reason: string expected";
                if (message.start != null && message.hasOwnProperty("start"))
                    if (!$util.isString(message.start))
                        return "start: string expected";
                if (message.duration != null && message.hasOwnProperty("duration"))
                    if (!$util.isInteger(message.duration))
                        return "duration: integer expected";
                return null;
            };

            /**
             * Creates a BanEntry message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof MumbleProto.BanList.BanEntry
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {MumbleProto.BanList.BanEntry} BanEntry
             */
            BanEntry.fromObject = function fromObject(object) {
                if (object instanceof $root.MumbleProto.BanList.BanEntry)
                    return object;
                var message = new $root.MumbleProto.BanList.BanEntry();
                if (object.address != null)
                    if (typeof object.address === "string")
                        $util.base64.decode(object.address, message.address = $util.newBuffer($util.base64.length(object.address)), 0);
                    else if (object.address.length >= 0)
                        message.address = object.address;
                if (object.mask != null)
                    message.mask = object.mask >>> 0;
                if (object.name != null)
                    message.name = String(object.name);
                if (object.hash != null)
                    message.hash = String(object.hash);
                if (object.reason != null)
                    message.reason = String(object.reason);
                if (object.start != null)
                    message.start = String(object.start);
                if (object.duration != null)
                    message.duration = object.duration >>> 0;
                return message;
            };

            /**
             * Creates a plain object from a BanEntry message. Also converts values to other types if specified.
             * @function toObject
             * @memberof MumbleProto.BanList.BanEntry
             * @static
             * @param {MumbleProto.BanList.BanEntry} message BanEntry
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            BanEntry.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    if (options.bytes === String)
                        object.address = "";
                    else {
                        object.address = [];
                        if (options.bytes !== Array)
                            object.address = $util.newBuffer(object.address);
                    }
                    object.mask = 0;
                    object.name = "";
                    object.hash = "";
                    object.reason = "";
                    object.start = "";
                    object.duration = 0;
                }
                if (message.address != null && message.hasOwnProperty("address"))
                    object.address = options.bytes === String ? $util.base64.encode(message.address, 0, message.address.length) : options.bytes === Array ? Array.prototype.slice.call(message.address) : message.address;
                if (message.mask != null && message.hasOwnProperty("mask"))
                    object.mask = message.mask;
                if (message.name != null && message.hasOwnProperty("name"))
                    object.name = message.name;
                if (message.hash != null && message.hasOwnProperty("hash"))
                    object.hash = message.hash;
                if (message.reason != null && message.hasOwnProperty("reason"))
                    object.reason = message.reason;
                if (message.start != null && message.hasOwnProperty("start"))
                    object.start = message.start;
                if (message.duration != null && message.hasOwnProperty("duration"))
                    object.duration = message.duration;
                return object;
            };

            /**
             * Converts this BanEntry to JSON.
             * @function toJSON
             * @memberof MumbleProto.BanList.BanEntry
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            BanEntry.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for BanEntry
             * @function getTypeUrl
             * @memberof MumbleProto.BanList.BanEntry
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            BanEntry.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/MumbleProto.BanList.BanEntry";
            };

            return BanEntry;
        })();

        return BanList;
    })();

    MumbleProto.TextMessage = (function() {

        /**
         * Properties of a TextMessage.
         * @memberof MumbleProto
         * @interface ITextMessage
         * @property {number|null} [actor] TextMessage actor
         * @property {Array.<number>|null} [session] TextMessage session
         * @property {Array.<number>|null} [channelId] TextMessage channelId
         * @property {Array.<number>|null} [treeId] TextMessage treeId
         * @property {string} message TextMessage message
         */

        /**
         * Constructs a new TextMessage.
         * @memberof MumbleProto
         * @classdesc Represents a TextMessage.
         * @implements ITextMessage
         * @constructor
         * @param {MumbleProto.ITextMessage=} [properties] Properties to set
         */
        function TextMessage(properties) {
            this.session = [];
            this.channelId = [];
            this.treeId = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * TextMessage actor.
         * @member {number} actor
         * @memberof MumbleProto.TextMessage
         * @instance
         */
        TextMessage.prototype.actor = 0;

        /**
         * TextMessage session.
         * @member {Array.<number>} session
         * @memberof MumbleProto.TextMessage
         * @instance
         */
        TextMessage.prototype.session = $util.emptyArray;

        /**
         * TextMessage channelId.
         * @member {Array.<number>} channelId
         * @memberof MumbleProto.TextMessage
         * @instance
         */
        TextMessage.prototype.channelId = $util.emptyArray;

        /**
         * TextMessage treeId.
         * @member {Array.<number>} treeId
         * @memberof MumbleProto.TextMessage
         * @instance
         */
        TextMessage.prototype.treeId = $util.emptyArray;

        /**
         * TextMessage message.
         * @member {string} message
         * @memberof MumbleProto.TextMessage
         * @instance
         */
        TextMessage.prototype.message = "";

        /**
         * Creates a new TextMessage instance using the specified properties.
         * @function create
         * @memberof MumbleProto.TextMessage
         * @static
         * @param {MumbleProto.ITextMessage=} [properties] Properties to set
         * @returns {MumbleProto.TextMessage} TextMessage instance
         */
        TextMessage.create = function create(properties) {
            return new TextMessage(properties);
        };

        /**
         * Encodes the specified TextMessage message. Does not implicitly {@link MumbleProto.TextMessage.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.TextMessage
         * @static
         * @param {MumbleProto.ITextMessage} message TextMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        TextMessage.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.actor != null && Object.hasOwnProperty.call(message, "actor"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.actor);
            if (message.session != null && message.session.length)
                for (var i = 0; i < message.session.length; ++i)
                    writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.session[i]);
            if (message.channelId != null && message.channelId.length)
                for (var i = 0; i < message.channelId.length; ++i)
                    writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.channelId[i]);
            if (message.treeId != null && message.treeId.length)
                for (var i = 0; i < message.treeId.length; ++i)
                    writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.treeId[i]);
            writer.uint32(/* id 5, wireType 2 =*/42).string(message.message);
            return writer;
        };

        /**
         * Encodes the specified TextMessage message, length delimited. Does not implicitly {@link MumbleProto.TextMessage.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.TextMessage
         * @static
         * @param {MumbleProto.ITextMessage} message TextMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        TextMessage.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a TextMessage message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.TextMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.TextMessage} TextMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        TextMessage.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.TextMessage();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.actor = reader.uint32();
                        break;
                    }
                case 2: {
                        if (!(message.session && message.session.length))
                            message.session = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.session.push(reader.uint32());
                        } else
                            message.session.push(reader.uint32());
                        break;
                    }
                case 3: {
                        if (!(message.channelId && message.channelId.length))
                            message.channelId = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.channelId.push(reader.uint32());
                        } else
                            message.channelId.push(reader.uint32());
                        break;
                    }
                case 4: {
                        if (!(message.treeId && message.treeId.length))
                            message.treeId = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.treeId.push(reader.uint32());
                        } else
                            message.treeId.push(reader.uint32());
                        break;
                    }
                case 5: {
                        message.message = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("message"))
                throw $util.ProtocolError("missing required 'message'", { instance: message });
            return message;
        };

        /**
         * Decodes a TextMessage message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.TextMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.TextMessage} TextMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        TextMessage.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a TextMessage message.
         * @function verify
         * @memberof MumbleProto.TextMessage
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        TextMessage.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.actor != null && message.hasOwnProperty("actor"))
                if (!$util.isInteger(message.actor))
                    return "actor: integer expected";
            if (message.session != null && message.hasOwnProperty("session")) {
                if (!Array.isArray(message.session))
                    return "session: array expected";
                for (var i = 0; i < message.session.length; ++i)
                    if (!$util.isInteger(message.session[i]))
                        return "session: integer[] expected";
            }
            if (message.channelId != null && message.hasOwnProperty("channelId")) {
                if (!Array.isArray(message.channelId))
                    return "channelId: array expected";
                for (var i = 0; i < message.channelId.length; ++i)
                    if (!$util.isInteger(message.channelId[i]))
                        return "channelId: integer[] expected";
            }
            if (message.treeId != null && message.hasOwnProperty("treeId")) {
                if (!Array.isArray(message.treeId))
                    return "treeId: array expected";
                for (var i = 0; i < message.treeId.length; ++i)
                    if (!$util.isInteger(message.treeId[i]))
                        return "treeId: integer[] expected";
            }
            if (!$util.isString(message.message))
                return "message: string expected";
            return null;
        };

        /**
         * Creates a TextMessage message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.TextMessage
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.TextMessage} TextMessage
         */
        TextMessage.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.TextMessage)
                return object;
            var message = new $root.MumbleProto.TextMessage();
            if (object.actor != null)
                message.actor = object.actor >>> 0;
            if (object.session) {
                if (!Array.isArray(object.session))
                    throw TypeError(".MumbleProto.TextMessage.session: array expected");
                message.session = [];
                for (var i = 0; i < object.session.length; ++i)
                    message.session[i] = object.session[i] >>> 0;
            }
            if (object.channelId) {
                if (!Array.isArray(object.channelId))
                    throw TypeError(".MumbleProto.TextMessage.channelId: array expected");
                message.channelId = [];
                for (var i = 0; i < object.channelId.length; ++i)
                    message.channelId[i] = object.channelId[i] >>> 0;
            }
            if (object.treeId) {
                if (!Array.isArray(object.treeId))
                    throw TypeError(".MumbleProto.TextMessage.treeId: array expected");
                message.treeId = [];
                for (var i = 0; i < object.treeId.length; ++i)
                    message.treeId[i] = object.treeId[i] >>> 0;
            }
            if (object.message != null)
                message.message = String(object.message);
            return message;
        };

        /**
         * Creates a plain object from a TextMessage message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.TextMessage
         * @static
         * @param {MumbleProto.TextMessage} message TextMessage
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        TextMessage.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object.session = [];
                object.channelId = [];
                object.treeId = [];
            }
            if (options.defaults) {
                object.actor = 0;
                object.message = "";
            }
            if (message.actor != null && message.hasOwnProperty("actor"))
                object.actor = message.actor;
            if (message.session && message.session.length) {
                object.session = [];
                for (var j = 0; j < message.session.length; ++j)
                    object.session[j] = message.session[j];
            }
            if (message.channelId && message.channelId.length) {
                object.channelId = [];
                for (var j = 0; j < message.channelId.length; ++j)
                    object.channelId[j] = message.channelId[j];
            }
            if (message.treeId && message.treeId.length) {
                object.treeId = [];
                for (var j = 0; j < message.treeId.length; ++j)
                    object.treeId[j] = message.treeId[j];
            }
            if (message.message != null && message.hasOwnProperty("message"))
                object.message = message.message;
            return object;
        };

        /**
         * Converts this TextMessage to JSON.
         * @function toJSON
         * @memberof MumbleProto.TextMessage
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        TextMessage.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for TextMessage
         * @function getTypeUrl
         * @memberof MumbleProto.TextMessage
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        TextMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.TextMessage";
        };

        return TextMessage;
    })();

    MumbleProto.PermissionDenied = (function() {

        /**
         * Properties of a PermissionDenied.
         * @memberof MumbleProto
         * @interface IPermissionDenied
         * @property {number|null} [permission] PermissionDenied permission
         * @property {number|null} [channelId] PermissionDenied channelId
         * @property {number|null} [session] PermissionDenied session
         * @property {string|null} [reason] PermissionDenied reason
         * @property {MumbleProto.PermissionDenied.DenyType|null} [type] PermissionDenied type
         * @property {string|null} [name] PermissionDenied name
         */

        /**
         * Constructs a new PermissionDenied.
         * @memberof MumbleProto
         * @classdesc Represents a PermissionDenied.
         * @implements IPermissionDenied
         * @constructor
         * @param {MumbleProto.IPermissionDenied=} [properties] Properties to set
         */
        function PermissionDenied(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PermissionDenied permission.
         * @member {number} permission
         * @memberof MumbleProto.PermissionDenied
         * @instance
         */
        PermissionDenied.prototype.permission = 0;

        /**
         * PermissionDenied channelId.
         * @member {number} channelId
         * @memberof MumbleProto.PermissionDenied
         * @instance
         */
        PermissionDenied.prototype.channelId = 0;

        /**
         * PermissionDenied session.
         * @member {number} session
         * @memberof MumbleProto.PermissionDenied
         * @instance
         */
        PermissionDenied.prototype.session = 0;

        /**
         * PermissionDenied reason.
         * @member {string} reason
         * @memberof MumbleProto.PermissionDenied
         * @instance
         */
        PermissionDenied.prototype.reason = "";

        /**
         * PermissionDenied type.
         * @member {MumbleProto.PermissionDenied.DenyType} type
         * @memberof MumbleProto.PermissionDenied
         * @instance
         */
        PermissionDenied.prototype.type = 0;

        /**
         * PermissionDenied name.
         * @member {string} name
         * @memberof MumbleProto.PermissionDenied
         * @instance
         */
        PermissionDenied.prototype.name = "";

        /**
         * Creates a new PermissionDenied instance using the specified properties.
         * @function create
         * @memberof MumbleProto.PermissionDenied
         * @static
         * @param {MumbleProto.IPermissionDenied=} [properties] Properties to set
         * @returns {MumbleProto.PermissionDenied} PermissionDenied instance
         */
        PermissionDenied.create = function create(properties) {
            return new PermissionDenied(properties);
        };

        /**
         * Encodes the specified PermissionDenied message. Does not implicitly {@link MumbleProto.PermissionDenied.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.PermissionDenied
         * @static
         * @param {MumbleProto.IPermissionDenied} message PermissionDenied message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PermissionDenied.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.permission != null && Object.hasOwnProperty.call(message, "permission"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.permission);
            if (message.channelId != null && Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.channelId);
            if (message.session != null && Object.hasOwnProperty.call(message, "session"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.session);
            if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.reason);
            if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                writer.uint32(/* id 5, wireType 0 =*/40).int32(message.type);
            if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                writer.uint32(/* id 6, wireType 2 =*/50).string(message.name);
            return writer;
        };

        /**
         * Encodes the specified PermissionDenied message, length delimited. Does not implicitly {@link MumbleProto.PermissionDenied.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.PermissionDenied
         * @static
         * @param {MumbleProto.IPermissionDenied} message PermissionDenied message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PermissionDenied.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PermissionDenied message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.PermissionDenied
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.PermissionDenied} PermissionDenied
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PermissionDenied.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.PermissionDenied();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.permission = reader.uint32();
                        break;
                    }
                case 2: {
                        message.channelId = reader.uint32();
                        break;
                    }
                case 3: {
                        message.session = reader.uint32();
                        break;
                    }
                case 4: {
                        message.reason = reader.string();
                        break;
                    }
                case 5: {
                        message.type = reader.int32();
                        break;
                    }
                case 6: {
                        message.name = reader.string();
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
         * Decodes a PermissionDenied message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.PermissionDenied
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.PermissionDenied} PermissionDenied
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PermissionDenied.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PermissionDenied message.
         * @function verify
         * @memberof MumbleProto.PermissionDenied
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PermissionDenied.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.permission != null && message.hasOwnProperty("permission"))
                if (!$util.isInteger(message.permission))
                    return "permission: integer expected";
            if (message.channelId != null && message.hasOwnProperty("channelId"))
                if (!$util.isInteger(message.channelId))
                    return "channelId: integer expected";
            if (message.session != null && message.hasOwnProperty("session"))
                if (!$util.isInteger(message.session))
                    return "session: integer expected";
            if (message.reason != null && message.hasOwnProperty("reason"))
                if (!$util.isString(message.reason))
                    return "reason: string expected";
            if (message.type != null && message.hasOwnProperty("type"))
                switch (message.type) {
                default:
                    return "type: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                case 8:
                case 9:
                case 10:
                case 11:
                case 12:
                case 13:
                    break;
                }
            if (message.name != null && message.hasOwnProperty("name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            return null;
        };

        /**
         * Creates a PermissionDenied message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.PermissionDenied
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.PermissionDenied} PermissionDenied
         */
        PermissionDenied.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.PermissionDenied)
                return object;
            var message = new $root.MumbleProto.PermissionDenied();
            if (object.permission != null)
                message.permission = object.permission >>> 0;
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            if (object.session != null)
                message.session = object.session >>> 0;
            if (object.reason != null)
                message.reason = String(object.reason);
            switch (object.type) {
            default:
                if (typeof object.type === "number") {
                    message.type = object.type;
                    break;
                }
                break;
            case "Text":
            case 0:
                message.type = 0;
                break;
            case "Permission":
            case 1:
                message.type = 1;
                break;
            case "SuperUser":
            case 2:
                message.type = 2;
                break;
            case "ChannelName":
            case 3:
                message.type = 3;
                break;
            case "TextTooLong":
            case 4:
                message.type = 4;
                break;
            case "H9K":
            case 5:
                message.type = 5;
                break;
            case "TemporaryChannel":
            case 6:
                message.type = 6;
                break;
            case "MissingCertificate":
            case 7:
                message.type = 7;
                break;
            case "UserName":
            case 8:
                message.type = 8;
                break;
            case "ChannelFull":
            case 9:
                message.type = 9;
                break;
            case "NestingLimit":
            case 10:
                message.type = 10;
                break;
            case "ChannelCountLimit":
            case 11:
                message.type = 11;
                break;
            case "ChannelListenerLimit":
            case 12:
                message.type = 12;
                break;
            case "UserListenerLimit":
            case 13:
                message.type = 13;
                break;
            }
            if (object.name != null)
                message.name = String(object.name);
            return message;
        };

        /**
         * Creates a plain object from a PermissionDenied message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.PermissionDenied
         * @static
         * @param {MumbleProto.PermissionDenied} message PermissionDenied
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PermissionDenied.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.permission = 0;
                object.channelId = 0;
                object.session = 0;
                object.reason = "";
                object.type = options.enums === String ? "Text" : 0;
                object.name = "";
            }
            if (message.permission != null && message.hasOwnProperty("permission"))
                object.permission = message.permission;
            if (message.channelId != null && message.hasOwnProperty("channelId"))
                object.channelId = message.channelId;
            if (message.session != null && message.hasOwnProperty("session"))
                object.session = message.session;
            if (message.reason != null && message.hasOwnProperty("reason"))
                object.reason = message.reason;
            if (message.type != null && message.hasOwnProperty("type"))
                object.type = options.enums === String ? $root.MumbleProto.PermissionDenied.DenyType[message.type] === undefined ? message.type : $root.MumbleProto.PermissionDenied.DenyType[message.type] : message.type;
            if (message.name != null && message.hasOwnProperty("name"))
                object.name = message.name;
            return object;
        };

        /**
         * Converts this PermissionDenied to JSON.
         * @function toJSON
         * @memberof MumbleProto.PermissionDenied
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PermissionDenied.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PermissionDenied
         * @function getTypeUrl
         * @memberof MumbleProto.PermissionDenied
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PermissionDenied.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.PermissionDenied";
        };

        /**
         * DenyType enum.
         * @name MumbleProto.PermissionDenied.DenyType
         * @enum {number}
         * @property {number} Text=0 Text value
         * @property {number} Permission=1 Permission value
         * @property {number} SuperUser=2 SuperUser value
         * @property {number} ChannelName=3 ChannelName value
         * @property {number} TextTooLong=4 TextTooLong value
         * @property {number} H9K=5 H9K value
         * @property {number} TemporaryChannel=6 TemporaryChannel value
         * @property {number} MissingCertificate=7 MissingCertificate value
         * @property {number} UserName=8 UserName value
         * @property {number} ChannelFull=9 ChannelFull value
         * @property {number} NestingLimit=10 NestingLimit value
         * @property {number} ChannelCountLimit=11 ChannelCountLimit value
         * @property {number} ChannelListenerLimit=12 ChannelListenerLimit value
         * @property {number} UserListenerLimit=13 UserListenerLimit value
         */
        PermissionDenied.DenyType = (function() {
            var valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "Text"] = 0;
            values[valuesById[1] = "Permission"] = 1;
            values[valuesById[2] = "SuperUser"] = 2;
            values[valuesById[3] = "ChannelName"] = 3;
            values[valuesById[4] = "TextTooLong"] = 4;
            values[valuesById[5] = "H9K"] = 5;
            values[valuesById[6] = "TemporaryChannel"] = 6;
            values[valuesById[7] = "MissingCertificate"] = 7;
            values[valuesById[8] = "UserName"] = 8;
            values[valuesById[9] = "ChannelFull"] = 9;
            values[valuesById[10] = "NestingLimit"] = 10;
            values[valuesById[11] = "ChannelCountLimit"] = 11;
            values[valuesById[12] = "ChannelListenerLimit"] = 12;
            values[valuesById[13] = "UserListenerLimit"] = 13;
            return values;
        })();

        return PermissionDenied;
    })();

    MumbleProto.ACL = (function() {

        /**
         * Properties of a ACL.
         * @memberof MumbleProto
         * @interface IACL
         * @property {number} channelId ACL channelId
         * @property {boolean|null} [inheritAcls] ACL inheritAcls
         * @property {Array.<MumbleProto.ACL.IChanGroup>|null} [groups] ACL groups
         * @property {Array.<MumbleProto.ACL.IChanACL>|null} [acls] ACL acls
         * @property {boolean|null} [query] ACL query
         */

        /**
         * Constructs a new ACL.
         * @memberof MumbleProto
         * @classdesc Represents a ACL.
         * @implements IACL
         * @constructor
         * @param {MumbleProto.IACL=} [properties] Properties to set
         */
        function ACL(properties) {
            this.groups = [];
            this.acls = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ACL channelId.
         * @member {number} channelId
         * @memberof MumbleProto.ACL
         * @instance
         */
        ACL.prototype.channelId = 0;

        /**
         * ACL inheritAcls.
         * @member {boolean} inheritAcls
         * @memberof MumbleProto.ACL
         * @instance
         */
        ACL.prototype.inheritAcls = true;

        /**
         * ACL groups.
         * @member {Array.<MumbleProto.ACL.IChanGroup>} groups
         * @memberof MumbleProto.ACL
         * @instance
         */
        ACL.prototype.groups = $util.emptyArray;

        /**
         * ACL acls.
         * @member {Array.<MumbleProto.ACL.IChanACL>} acls
         * @memberof MumbleProto.ACL
         * @instance
         */
        ACL.prototype.acls = $util.emptyArray;

        /**
         * ACL query.
         * @member {boolean} query
         * @memberof MumbleProto.ACL
         * @instance
         */
        ACL.prototype.query = false;

        /**
         * Creates a new ACL instance using the specified properties.
         * @function create
         * @memberof MumbleProto.ACL
         * @static
         * @param {MumbleProto.IACL=} [properties] Properties to set
         * @returns {MumbleProto.ACL} ACL instance
         */
        ACL.create = function create(properties) {
            return new ACL(properties);
        };

        /**
         * Encodes the specified ACL message. Does not implicitly {@link MumbleProto.ACL.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.ACL
         * @static
         * @param {MumbleProto.IACL} message ACL message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ACL.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.channelId);
            if (message.inheritAcls != null && Object.hasOwnProperty.call(message, "inheritAcls"))
                writer.uint32(/* id 2, wireType 0 =*/16).bool(message.inheritAcls);
            if (message.groups != null && message.groups.length)
                for (var i = 0; i < message.groups.length; ++i)
                    $root.MumbleProto.ACL.ChanGroup.encode(message.groups[i], writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            if (message.acls != null && message.acls.length)
                for (var i = 0; i < message.acls.length; ++i)
                    $root.MumbleProto.ACL.ChanACL.encode(message.acls[i], writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            if (message.query != null && Object.hasOwnProperty.call(message, "query"))
                writer.uint32(/* id 5, wireType 0 =*/40).bool(message.query);
            return writer;
        };

        /**
         * Encodes the specified ACL message, length delimited. Does not implicitly {@link MumbleProto.ACL.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.ACL
         * @static
         * @param {MumbleProto.IACL} message ACL message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ACL.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ACL message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.ACL
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.ACL} ACL
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ACL.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.ACL();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.channelId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.inheritAcls = reader.bool();
                        break;
                    }
                case 3: {
                        if (!(message.groups && message.groups.length))
                            message.groups = [];
                        message.groups.push($root.MumbleProto.ACL.ChanGroup.decode(reader, reader.uint32()));
                        break;
                    }
                case 4: {
                        if (!(message.acls && message.acls.length))
                            message.acls = [];
                        message.acls.push($root.MumbleProto.ACL.ChanACL.decode(reader, reader.uint32()));
                        break;
                    }
                case 5: {
                        message.query = reader.bool();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("channelId"))
                throw $util.ProtocolError("missing required 'channelId'", { instance: message });
            return message;
        };

        /**
         * Decodes a ACL message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.ACL
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.ACL} ACL
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ACL.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ACL message.
         * @function verify
         * @memberof MumbleProto.ACL
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ACL.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isInteger(message.channelId))
                return "channelId: integer expected";
            if (message.inheritAcls != null && message.hasOwnProperty("inheritAcls"))
                if (typeof message.inheritAcls !== "boolean")
                    return "inheritAcls: boolean expected";
            if (message.groups != null && message.hasOwnProperty("groups")) {
                if (!Array.isArray(message.groups))
                    return "groups: array expected";
                for (var i = 0; i < message.groups.length; ++i) {
                    var error = $root.MumbleProto.ACL.ChanGroup.verify(message.groups[i]);
                    if (error)
                        return "groups." + error;
                }
            }
            if (message.acls != null && message.hasOwnProperty("acls")) {
                if (!Array.isArray(message.acls))
                    return "acls: array expected";
                for (var i = 0; i < message.acls.length; ++i) {
                    var error = $root.MumbleProto.ACL.ChanACL.verify(message.acls[i]);
                    if (error)
                        return "acls." + error;
                }
            }
            if (message.query != null && message.hasOwnProperty("query"))
                if (typeof message.query !== "boolean")
                    return "query: boolean expected";
            return null;
        };

        /**
         * Creates a ACL message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.ACL
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.ACL} ACL
         */
        ACL.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.ACL)
                return object;
            var message = new $root.MumbleProto.ACL();
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            if (object.inheritAcls != null)
                message.inheritAcls = Boolean(object.inheritAcls);
            if (object.groups) {
                if (!Array.isArray(object.groups))
                    throw TypeError(".MumbleProto.ACL.groups: array expected");
                message.groups = [];
                for (var i = 0; i < object.groups.length; ++i) {
                    if (typeof object.groups[i] !== "object")
                        throw TypeError(".MumbleProto.ACL.groups: object expected");
                    message.groups[i] = $root.MumbleProto.ACL.ChanGroup.fromObject(object.groups[i]);
                }
            }
            if (object.acls) {
                if (!Array.isArray(object.acls))
                    throw TypeError(".MumbleProto.ACL.acls: array expected");
                message.acls = [];
                for (var i = 0; i < object.acls.length; ++i) {
                    if (typeof object.acls[i] !== "object")
                        throw TypeError(".MumbleProto.ACL.acls: object expected");
                    message.acls[i] = $root.MumbleProto.ACL.ChanACL.fromObject(object.acls[i]);
                }
            }
            if (object.query != null)
                message.query = Boolean(object.query);
            return message;
        };

        /**
         * Creates a plain object from a ACL message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.ACL
         * @static
         * @param {MumbleProto.ACL} message ACL
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ACL.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object.groups = [];
                object.acls = [];
            }
            if (options.defaults) {
                object.channelId = 0;
                object.inheritAcls = true;
                object.query = false;
            }
            if (message.channelId != null && message.hasOwnProperty("channelId"))
                object.channelId = message.channelId;
            if (message.inheritAcls != null && message.hasOwnProperty("inheritAcls"))
                object.inheritAcls = message.inheritAcls;
            if (message.groups && message.groups.length) {
                object.groups = [];
                for (var j = 0; j < message.groups.length; ++j)
                    object.groups[j] = $root.MumbleProto.ACL.ChanGroup.toObject(message.groups[j], options);
            }
            if (message.acls && message.acls.length) {
                object.acls = [];
                for (var j = 0; j < message.acls.length; ++j)
                    object.acls[j] = $root.MumbleProto.ACL.ChanACL.toObject(message.acls[j], options);
            }
            if (message.query != null && message.hasOwnProperty("query"))
                object.query = message.query;
            return object;
        };

        /**
         * Converts this ACL to JSON.
         * @function toJSON
         * @memberof MumbleProto.ACL
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ACL.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ACL
         * @function getTypeUrl
         * @memberof MumbleProto.ACL
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ACL.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.ACL";
        };

        ACL.ChanGroup = (function() {

            /**
             * Properties of a ChanGroup.
             * @memberof MumbleProto.ACL
             * @interface IChanGroup
             * @property {string} name ChanGroup name
             * @property {boolean|null} [inherited] ChanGroup inherited
             * @property {boolean|null} [inherit] ChanGroup inherit
             * @property {boolean|null} [inheritable] ChanGroup inheritable
             * @property {Array.<number>|null} [add] ChanGroup add
             * @property {Array.<number>|null} [remove] ChanGroup remove
             * @property {Array.<number>|null} [inheritedMembers] ChanGroup inheritedMembers
             */

            /**
             * Constructs a new ChanGroup.
             * @memberof MumbleProto.ACL
             * @classdesc Represents a ChanGroup.
             * @implements IChanGroup
             * @constructor
             * @param {MumbleProto.ACL.IChanGroup=} [properties] Properties to set
             */
            function ChanGroup(properties) {
                this.add = [];
                this.remove = [];
                this.inheritedMembers = [];
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * ChanGroup name.
             * @member {string} name
             * @memberof MumbleProto.ACL.ChanGroup
             * @instance
             */
            ChanGroup.prototype.name = "";

            /**
             * ChanGroup inherited.
             * @member {boolean} inherited
             * @memberof MumbleProto.ACL.ChanGroup
             * @instance
             */
            ChanGroup.prototype.inherited = true;

            /**
             * ChanGroup inherit.
             * @member {boolean} inherit
             * @memberof MumbleProto.ACL.ChanGroup
             * @instance
             */
            ChanGroup.prototype.inherit = true;

            /**
             * ChanGroup inheritable.
             * @member {boolean} inheritable
             * @memberof MumbleProto.ACL.ChanGroup
             * @instance
             */
            ChanGroup.prototype.inheritable = true;

            /**
             * ChanGroup add.
             * @member {Array.<number>} add
             * @memberof MumbleProto.ACL.ChanGroup
             * @instance
             */
            ChanGroup.prototype.add = $util.emptyArray;

            /**
             * ChanGroup remove.
             * @member {Array.<number>} remove
             * @memberof MumbleProto.ACL.ChanGroup
             * @instance
             */
            ChanGroup.prototype.remove = $util.emptyArray;

            /**
             * ChanGroup inheritedMembers.
             * @member {Array.<number>} inheritedMembers
             * @memberof MumbleProto.ACL.ChanGroup
             * @instance
             */
            ChanGroup.prototype.inheritedMembers = $util.emptyArray;

            /**
             * Creates a new ChanGroup instance using the specified properties.
             * @function create
             * @memberof MumbleProto.ACL.ChanGroup
             * @static
             * @param {MumbleProto.ACL.IChanGroup=} [properties] Properties to set
             * @returns {MumbleProto.ACL.ChanGroup} ChanGroup instance
             */
            ChanGroup.create = function create(properties) {
                return new ChanGroup(properties);
            };

            /**
             * Encodes the specified ChanGroup message. Does not implicitly {@link MumbleProto.ACL.ChanGroup.verify|verify} messages.
             * @function encode
             * @memberof MumbleProto.ACL.ChanGroup
             * @static
             * @param {MumbleProto.ACL.IChanGroup} message ChanGroup message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            ChanGroup.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
                if (message.inherited != null && Object.hasOwnProperty.call(message, "inherited"))
                    writer.uint32(/* id 2, wireType 0 =*/16).bool(message.inherited);
                if (message.inherit != null && Object.hasOwnProperty.call(message, "inherit"))
                    writer.uint32(/* id 3, wireType 0 =*/24).bool(message.inherit);
                if (message.inheritable != null && Object.hasOwnProperty.call(message, "inheritable"))
                    writer.uint32(/* id 4, wireType 0 =*/32).bool(message.inheritable);
                if (message.add != null && message.add.length)
                    for (var i = 0; i < message.add.length; ++i)
                        writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.add[i]);
                if (message.remove != null && message.remove.length)
                    for (var i = 0; i < message.remove.length; ++i)
                        writer.uint32(/* id 6, wireType 0 =*/48).uint32(message.remove[i]);
                if (message.inheritedMembers != null && message.inheritedMembers.length)
                    for (var i = 0; i < message.inheritedMembers.length; ++i)
                        writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.inheritedMembers[i]);
                return writer;
            };

            /**
             * Encodes the specified ChanGroup message, length delimited. Does not implicitly {@link MumbleProto.ACL.ChanGroup.verify|verify} messages.
             * @function encodeDelimited
             * @memberof MumbleProto.ACL.ChanGroup
             * @static
             * @param {MumbleProto.ACL.IChanGroup} message ChanGroup message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            ChanGroup.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a ChanGroup message from the specified reader or buffer.
             * @function decode
             * @memberof MumbleProto.ACL.ChanGroup
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {MumbleProto.ACL.ChanGroup} ChanGroup
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            ChanGroup.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.ACL.ChanGroup();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.name = reader.string();
                            break;
                        }
                    case 2: {
                            message.inherited = reader.bool();
                            break;
                        }
                    case 3: {
                            message.inherit = reader.bool();
                            break;
                        }
                    case 4: {
                            message.inheritable = reader.bool();
                            break;
                        }
                    case 5: {
                            if (!(message.add && message.add.length))
                                message.add = [];
                            if ((tag & 7) === 2) {
                                var end2 = reader.uint32() + reader.pos;
                                while (reader.pos < end2)
                                    message.add.push(reader.uint32());
                            } else
                                message.add.push(reader.uint32());
                            break;
                        }
                    case 6: {
                            if (!(message.remove && message.remove.length))
                                message.remove = [];
                            if ((tag & 7) === 2) {
                                var end2 = reader.uint32() + reader.pos;
                                while (reader.pos < end2)
                                    message.remove.push(reader.uint32());
                            } else
                                message.remove.push(reader.uint32());
                            break;
                        }
                    case 7: {
                            if (!(message.inheritedMembers && message.inheritedMembers.length))
                                message.inheritedMembers = [];
                            if ((tag & 7) === 2) {
                                var end2 = reader.uint32() + reader.pos;
                                while (reader.pos < end2)
                                    message.inheritedMembers.push(reader.uint32());
                            } else
                                message.inheritedMembers.push(reader.uint32());
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                if (!message.hasOwnProperty("name"))
                    throw $util.ProtocolError("missing required 'name'", { instance: message });
                return message;
            };

            /**
             * Decodes a ChanGroup message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof MumbleProto.ACL.ChanGroup
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {MumbleProto.ACL.ChanGroup} ChanGroup
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            ChanGroup.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a ChanGroup message.
             * @function verify
             * @memberof MumbleProto.ACL.ChanGroup
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            ChanGroup.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (!$util.isString(message.name))
                    return "name: string expected";
                if (message.inherited != null && message.hasOwnProperty("inherited"))
                    if (typeof message.inherited !== "boolean")
                        return "inherited: boolean expected";
                if (message.inherit != null && message.hasOwnProperty("inherit"))
                    if (typeof message.inherit !== "boolean")
                        return "inherit: boolean expected";
                if (message.inheritable != null && message.hasOwnProperty("inheritable"))
                    if (typeof message.inheritable !== "boolean")
                        return "inheritable: boolean expected";
                if (message.add != null && message.hasOwnProperty("add")) {
                    if (!Array.isArray(message.add))
                        return "add: array expected";
                    for (var i = 0; i < message.add.length; ++i)
                        if (!$util.isInteger(message.add[i]))
                            return "add: integer[] expected";
                }
                if (message.remove != null && message.hasOwnProperty("remove")) {
                    if (!Array.isArray(message.remove))
                        return "remove: array expected";
                    for (var i = 0; i < message.remove.length; ++i)
                        if (!$util.isInteger(message.remove[i]))
                            return "remove: integer[] expected";
                }
                if (message.inheritedMembers != null && message.hasOwnProperty("inheritedMembers")) {
                    if (!Array.isArray(message.inheritedMembers))
                        return "inheritedMembers: array expected";
                    for (var i = 0; i < message.inheritedMembers.length; ++i)
                        if (!$util.isInteger(message.inheritedMembers[i]))
                            return "inheritedMembers: integer[] expected";
                }
                return null;
            };

            /**
             * Creates a ChanGroup message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof MumbleProto.ACL.ChanGroup
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {MumbleProto.ACL.ChanGroup} ChanGroup
             */
            ChanGroup.fromObject = function fromObject(object) {
                if (object instanceof $root.MumbleProto.ACL.ChanGroup)
                    return object;
                var message = new $root.MumbleProto.ACL.ChanGroup();
                if (object.name != null)
                    message.name = String(object.name);
                if (object.inherited != null)
                    message.inherited = Boolean(object.inherited);
                if (object.inherit != null)
                    message.inherit = Boolean(object.inherit);
                if (object.inheritable != null)
                    message.inheritable = Boolean(object.inheritable);
                if (object.add) {
                    if (!Array.isArray(object.add))
                        throw TypeError(".MumbleProto.ACL.ChanGroup.add: array expected");
                    message.add = [];
                    for (var i = 0; i < object.add.length; ++i)
                        message.add[i] = object.add[i] >>> 0;
                }
                if (object.remove) {
                    if (!Array.isArray(object.remove))
                        throw TypeError(".MumbleProto.ACL.ChanGroup.remove: array expected");
                    message.remove = [];
                    for (var i = 0; i < object.remove.length; ++i)
                        message.remove[i] = object.remove[i] >>> 0;
                }
                if (object.inheritedMembers) {
                    if (!Array.isArray(object.inheritedMembers))
                        throw TypeError(".MumbleProto.ACL.ChanGroup.inheritedMembers: array expected");
                    message.inheritedMembers = [];
                    for (var i = 0; i < object.inheritedMembers.length; ++i)
                        message.inheritedMembers[i] = object.inheritedMembers[i] >>> 0;
                }
                return message;
            };

            /**
             * Creates a plain object from a ChanGroup message. Also converts values to other types if specified.
             * @function toObject
             * @memberof MumbleProto.ACL.ChanGroup
             * @static
             * @param {MumbleProto.ACL.ChanGroup} message ChanGroup
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            ChanGroup.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.arrays || options.defaults) {
                    object.add = [];
                    object.remove = [];
                    object.inheritedMembers = [];
                }
                if (options.defaults) {
                    object.name = "";
                    object.inherited = true;
                    object.inherit = true;
                    object.inheritable = true;
                }
                if (message.name != null && message.hasOwnProperty("name"))
                    object.name = message.name;
                if (message.inherited != null && message.hasOwnProperty("inherited"))
                    object.inherited = message.inherited;
                if (message.inherit != null && message.hasOwnProperty("inherit"))
                    object.inherit = message.inherit;
                if (message.inheritable != null && message.hasOwnProperty("inheritable"))
                    object.inheritable = message.inheritable;
                if (message.add && message.add.length) {
                    object.add = [];
                    for (var j = 0; j < message.add.length; ++j)
                        object.add[j] = message.add[j];
                }
                if (message.remove && message.remove.length) {
                    object.remove = [];
                    for (var j = 0; j < message.remove.length; ++j)
                        object.remove[j] = message.remove[j];
                }
                if (message.inheritedMembers && message.inheritedMembers.length) {
                    object.inheritedMembers = [];
                    for (var j = 0; j < message.inheritedMembers.length; ++j)
                        object.inheritedMembers[j] = message.inheritedMembers[j];
                }
                return object;
            };

            /**
             * Converts this ChanGroup to JSON.
             * @function toJSON
             * @memberof MumbleProto.ACL.ChanGroup
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            ChanGroup.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for ChanGroup
             * @function getTypeUrl
             * @memberof MumbleProto.ACL.ChanGroup
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            ChanGroup.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/MumbleProto.ACL.ChanGroup";
            };

            return ChanGroup;
        })();

        ACL.ChanACL = (function() {

            /**
             * Properties of a ChanACL.
             * @memberof MumbleProto.ACL
             * @interface IChanACL
             * @property {boolean|null} [applyHere] ChanACL applyHere
             * @property {boolean|null} [applySubs] ChanACL applySubs
             * @property {boolean|null} [inherited] ChanACL inherited
             * @property {number|null} [userId] ChanACL userId
             * @property {string|null} [group] ChanACL group
             * @property {number|null} [grant] ChanACL grant
             * @property {number|null} [deny] ChanACL deny
             */

            /**
             * Constructs a new ChanACL.
             * @memberof MumbleProto.ACL
             * @classdesc Represents a ChanACL.
             * @implements IChanACL
             * @constructor
             * @param {MumbleProto.ACL.IChanACL=} [properties] Properties to set
             */
            function ChanACL(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * ChanACL applyHere.
             * @member {boolean} applyHere
             * @memberof MumbleProto.ACL.ChanACL
             * @instance
             */
            ChanACL.prototype.applyHere = true;

            /**
             * ChanACL applySubs.
             * @member {boolean} applySubs
             * @memberof MumbleProto.ACL.ChanACL
             * @instance
             */
            ChanACL.prototype.applySubs = true;

            /**
             * ChanACL inherited.
             * @member {boolean} inherited
             * @memberof MumbleProto.ACL.ChanACL
             * @instance
             */
            ChanACL.prototype.inherited = true;

            /**
             * ChanACL userId.
             * @member {number} userId
             * @memberof MumbleProto.ACL.ChanACL
             * @instance
             */
            ChanACL.prototype.userId = 0;

            /**
             * ChanACL group.
             * @member {string} group
             * @memberof MumbleProto.ACL.ChanACL
             * @instance
             */
            ChanACL.prototype.group = "";

            /**
             * ChanACL grant.
             * @member {number} grant
             * @memberof MumbleProto.ACL.ChanACL
             * @instance
             */
            ChanACL.prototype.grant = 0;

            /**
             * ChanACL deny.
             * @member {number} deny
             * @memberof MumbleProto.ACL.ChanACL
             * @instance
             */
            ChanACL.prototype.deny = 0;

            /**
             * Creates a new ChanACL instance using the specified properties.
             * @function create
             * @memberof MumbleProto.ACL.ChanACL
             * @static
             * @param {MumbleProto.ACL.IChanACL=} [properties] Properties to set
             * @returns {MumbleProto.ACL.ChanACL} ChanACL instance
             */
            ChanACL.create = function create(properties) {
                return new ChanACL(properties);
            };

            /**
             * Encodes the specified ChanACL message. Does not implicitly {@link MumbleProto.ACL.ChanACL.verify|verify} messages.
             * @function encode
             * @memberof MumbleProto.ACL.ChanACL
             * @static
             * @param {MumbleProto.ACL.IChanACL} message ChanACL message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            ChanACL.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.applyHere != null && Object.hasOwnProperty.call(message, "applyHere"))
                    writer.uint32(/* id 1, wireType 0 =*/8).bool(message.applyHere);
                if (message.applySubs != null && Object.hasOwnProperty.call(message, "applySubs"))
                    writer.uint32(/* id 2, wireType 0 =*/16).bool(message.applySubs);
                if (message.inherited != null && Object.hasOwnProperty.call(message, "inherited"))
                    writer.uint32(/* id 3, wireType 0 =*/24).bool(message.inherited);
                if (message.userId != null && Object.hasOwnProperty.call(message, "userId"))
                    writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.userId);
                if (message.group != null && Object.hasOwnProperty.call(message, "group"))
                    writer.uint32(/* id 5, wireType 2 =*/42).string(message.group);
                if (message.grant != null && Object.hasOwnProperty.call(message, "grant"))
                    writer.uint32(/* id 6, wireType 0 =*/48).uint32(message.grant);
                if (message.deny != null && Object.hasOwnProperty.call(message, "deny"))
                    writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.deny);
                return writer;
            };

            /**
             * Encodes the specified ChanACL message, length delimited. Does not implicitly {@link MumbleProto.ACL.ChanACL.verify|verify} messages.
             * @function encodeDelimited
             * @memberof MumbleProto.ACL.ChanACL
             * @static
             * @param {MumbleProto.ACL.IChanACL} message ChanACL message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            ChanACL.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a ChanACL message from the specified reader or buffer.
             * @function decode
             * @memberof MumbleProto.ACL.ChanACL
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {MumbleProto.ACL.ChanACL} ChanACL
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            ChanACL.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.ACL.ChanACL();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.applyHere = reader.bool();
                            break;
                        }
                    case 2: {
                            message.applySubs = reader.bool();
                            break;
                        }
                    case 3: {
                            message.inherited = reader.bool();
                            break;
                        }
                    case 4: {
                            message.userId = reader.uint32();
                            break;
                        }
                    case 5: {
                            message.group = reader.string();
                            break;
                        }
                    case 6: {
                            message.grant = reader.uint32();
                            break;
                        }
                    case 7: {
                            message.deny = reader.uint32();
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
             * Decodes a ChanACL message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof MumbleProto.ACL.ChanACL
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {MumbleProto.ACL.ChanACL} ChanACL
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            ChanACL.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a ChanACL message.
             * @function verify
             * @memberof MumbleProto.ACL.ChanACL
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            ChanACL.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.applyHere != null && message.hasOwnProperty("applyHere"))
                    if (typeof message.applyHere !== "boolean")
                        return "applyHere: boolean expected";
                if (message.applySubs != null && message.hasOwnProperty("applySubs"))
                    if (typeof message.applySubs !== "boolean")
                        return "applySubs: boolean expected";
                if (message.inherited != null && message.hasOwnProperty("inherited"))
                    if (typeof message.inherited !== "boolean")
                        return "inherited: boolean expected";
                if (message.userId != null && message.hasOwnProperty("userId"))
                    if (!$util.isInteger(message.userId))
                        return "userId: integer expected";
                if (message.group != null && message.hasOwnProperty("group"))
                    if (!$util.isString(message.group))
                        return "group: string expected";
                if (message.grant != null && message.hasOwnProperty("grant"))
                    if (!$util.isInteger(message.grant))
                        return "grant: integer expected";
                if (message.deny != null && message.hasOwnProperty("deny"))
                    if (!$util.isInteger(message.deny))
                        return "deny: integer expected";
                return null;
            };

            /**
             * Creates a ChanACL message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof MumbleProto.ACL.ChanACL
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {MumbleProto.ACL.ChanACL} ChanACL
             */
            ChanACL.fromObject = function fromObject(object) {
                if (object instanceof $root.MumbleProto.ACL.ChanACL)
                    return object;
                var message = new $root.MumbleProto.ACL.ChanACL();
                if (object.applyHere != null)
                    message.applyHere = Boolean(object.applyHere);
                if (object.applySubs != null)
                    message.applySubs = Boolean(object.applySubs);
                if (object.inherited != null)
                    message.inherited = Boolean(object.inherited);
                if (object.userId != null)
                    message.userId = object.userId >>> 0;
                if (object.group != null)
                    message.group = String(object.group);
                if (object.grant != null)
                    message.grant = object.grant >>> 0;
                if (object.deny != null)
                    message.deny = object.deny >>> 0;
                return message;
            };

            /**
             * Creates a plain object from a ChanACL message. Also converts values to other types if specified.
             * @function toObject
             * @memberof MumbleProto.ACL.ChanACL
             * @static
             * @param {MumbleProto.ACL.ChanACL} message ChanACL
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            ChanACL.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.applyHere = true;
                    object.applySubs = true;
                    object.inherited = true;
                    object.userId = 0;
                    object.group = "";
                    object.grant = 0;
                    object.deny = 0;
                }
                if (message.applyHere != null && message.hasOwnProperty("applyHere"))
                    object.applyHere = message.applyHere;
                if (message.applySubs != null && message.hasOwnProperty("applySubs"))
                    object.applySubs = message.applySubs;
                if (message.inherited != null && message.hasOwnProperty("inherited"))
                    object.inherited = message.inherited;
                if (message.userId != null && message.hasOwnProperty("userId"))
                    object.userId = message.userId;
                if (message.group != null && message.hasOwnProperty("group"))
                    object.group = message.group;
                if (message.grant != null && message.hasOwnProperty("grant"))
                    object.grant = message.grant;
                if (message.deny != null && message.hasOwnProperty("deny"))
                    object.deny = message.deny;
                return object;
            };

            /**
             * Converts this ChanACL to JSON.
             * @function toJSON
             * @memberof MumbleProto.ACL.ChanACL
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            ChanACL.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for ChanACL
             * @function getTypeUrl
             * @memberof MumbleProto.ACL.ChanACL
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            ChanACL.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/MumbleProto.ACL.ChanACL";
            };

            return ChanACL;
        })();

        return ACL;
    })();

    MumbleProto.QueryUsers = (function() {

        /**
         * Properties of a QueryUsers.
         * @memberof MumbleProto
         * @interface IQueryUsers
         * @property {Array.<number>|null} [ids] QueryUsers ids
         * @property {Array.<string>|null} [names] QueryUsers names
         */

        /**
         * Constructs a new QueryUsers.
         * @memberof MumbleProto
         * @classdesc Represents a QueryUsers.
         * @implements IQueryUsers
         * @constructor
         * @param {MumbleProto.IQueryUsers=} [properties] Properties to set
         */
        function QueryUsers(properties) {
            this.ids = [];
            this.names = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * QueryUsers ids.
         * @member {Array.<number>} ids
         * @memberof MumbleProto.QueryUsers
         * @instance
         */
        QueryUsers.prototype.ids = $util.emptyArray;

        /**
         * QueryUsers names.
         * @member {Array.<string>} names
         * @memberof MumbleProto.QueryUsers
         * @instance
         */
        QueryUsers.prototype.names = $util.emptyArray;

        /**
         * Creates a new QueryUsers instance using the specified properties.
         * @function create
         * @memberof MumbleProto.QueryUsers
         * @static
         * @param {MumbleProto.IQueryUsers=} [properties] Properties to set
         * @returns {MumbleProto.QueryUsers} QueryUsers instance
         */
        QueryUsers.create = function create(properties) {
            return new QueryUsers(properties);
        };

        /**
         * Encodes the specified QueryUsers message. Does not implicitly {@link MumbleProto.QueryUsers.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.QueryUsers
         * @static
         * @param {MumbleProto.IQueryUsers} message QueryUsers message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        QueryUsers.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.ids != null && message.ids.length)
                for (var i = 0; i < message.ids.length; ++i)
                    writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.ids[i]);
            if (message.names != null && message.names.length)
                for (var i = 0; i < message.names.length; ++i)
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.names[i]);
            return writer;
        };

        /**
         * Encodes the specified QueryUsers message, length delimited. Does not implicitly {@link MumbleProto.QueryUsers.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.QueryUsers
         * @static
         * @param {MumbleProto.IQueryUsers} message QueryUsers message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        QueryUsers.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a QueryUsers message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.QueryUsers
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.QueryUsers} QueryUsers
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        QueryUsers.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.QueryUsers();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.ids && message.ids.length))
                            message.ids = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.ids.push(reader.uint32());
                        } else
                            message.ids.push(reader.uint32());
                        break;
                    }
                case 2: {
                        if (!(message.names && message.names.length))
                            message.names = [];
                        message.names.push(reader.string());
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
         * Decodes a QueryUsers message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.QueryUsers
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.QueryUsers} QueryUsers
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        QueryUsers.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a QueryUsers message.
         * @function verify
         * @memberof MumbleProto.QueryUsers
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        QueryUsers.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.ids != null && message.hasOwnProperty("ids")) {
                if (!Array.isArray(message.ids))
                    return "ids: array expected";
                for (var i = 0; i < message.ids.length; ++i)
                    if (!$util.isInteger(message.ids[i]))
                        return "ids: integer[] expected";
            }
            if (message.names != null && message.hasOwnProperty("names")) {
                if (!Array.isArray(message.names))
                    return "names: array expected";
                for (var i = 0; i < message.names.length; ++i)
                    if (!$util.isString(message.names[i]))
                        return "names: string[] expected";
            }
            return null;
        };

        /**
         * Creates a QueryUsers message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.QueryUsers
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.QueryUsers} QueryUsers
         */
        QueryUsers.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.QueryUsers)
                return object;
            var message = new $root.MumbleProto.QueryUsers();
            if (object.ids) {
                if (!Array.isArray(object.ids))
                    throw TypeError(".MumbleProto.QueryUsers.ids: array expected");
                message.ids = [];
                for (var i = 0; i < object.ids.length; ++i)
                    message.ids[i] = object.ids[i] >>> 0;
            }
            if (object.names) {
                if (!Array.isArray(object.names))
                    throw TypeError(".MumbleProto.QueryUsers.names: array expected");
                message.names = [];
                for (var i = 0; i < object.names.length; ++i)
                    message.names[i] = String(object.names[i]);
            }
            return message;
        };

        /**
         * Creates a plain object from a QueryUsers message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.QueryUsers
         * @static
         * @param {MumbleProto.QueryUsers} message QueryUsers
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        QueryUsers.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object.ids = [];
                object.names = [];
            }
            if (message.ids && message.ids.length) {
                object.ids = [];
                for (var j = 0; j < message.ids.length; ++j)
                    object.ids[j] = message.ids[j];
            }
            if (message.names && message.names.length) {
                object.names = [];
                for (var j = 0; j < message.names.length; ++j)
                    object.names[j] = message.names[j];
            }
            return object;
        };

        /**
         * Converts this QueryUsers to JSON.
         * @function toJSON
         * @memberof MumbleProto.QueryUsers
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        QueryUsers.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for QueryUsers
         * @function getTypeUrl
         * @memberof MumbleProto.QueryUsers
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        QueryUsers.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.QueryUsers";
        };

        return QueryUsers;
    })();

    MumbleProto.CryptSetup = (function() {

        /**
         * Properties of a CryptSetup.
         * @memberof MumbleProto
         * @interface ICryptSetup
         * @property {Uint8Array|null} [key] CryptSetup key
         * @property {Uint8Array|null} [clientNonce] CryptSetup clientNonce
         * @property {Uint8Array|null} [serverNonce] CryptSetup serverNonce
         */

        /**
         * Constructs a new CryptSetup.
         * @memberof MumbleProto
         * @classdesc Represents a CryptSetup.
         * @implements ICryptSetup
         * @constructor
         * @param {MumbleProto.ICryptSetup=} [properties] Properties to set
         */
        function CryptSetup(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * CryptSetup key.
         * @member {Uint8Array} key
         * @memberof MumbleProto.CryptSetup
         * @instance
         */
        CryptSetup.prototype.key = $util.newBuffer([]);

        /**
         * CryptSetup clientNonce.
         * @member {Uint8Array} clientNonce
         * @memberof MumbleProto.CryptSetup
         * @instance
         */
        CryptSetup.prototype.clientNonce = $util.newBuffer([]);

        /**
         * CryptSetup serverNonce.
         * @member {Uint8Array} serverNonce
         * @memberof MumbleProto.CryptSetup
         * @instance
         */
        CryptSetup.prototype.serverNonce = $util.newBuffer([]);

        /**
         * Creates a new CryptSetup instance using the specified properties.
         * @function create
         * @memberof MumbleProto.CryptSetup
         * @static
         * @param {MumbleProto.ICryptSetup=} [properties] Properties to set
         * @returns {MumbleProto.CryptSetup} CryptSetup instance
         */
        CryptSetup.create = function create(properties) {
            return new CryptSetup(properties);
        };

        /**
         * Encodes the specified CryptSetup message. Does not implicitly {@link MumbleProto.CryptSetup.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.CryptSetup
         * @static
         * @param {MumbleProto.ICryptSetup} message CryptSetup message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        CryptSetup.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.key != null && Object.hasOwnProperty.call(message, "key"))
                writer.uint32(/* id 1, wireType 2 =*/10).bytes(message.key);
            if (message.clientNonce != null && Object.hasOwnProperty.call(message, "clientNonce"))
                writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.clientNonce);
            if (message.serverNonce != null && Object.hasOwnProperty.call(message, "serverNonce"))
                writer.uint32(/* id 3, wireType 2 =*/26).bytes(message.serverNonce);
            return writer;
        };

        /**
         * Encodes the specified CryptSetup message, length delimited. Does not implicitly {@link MumbleProto.CryptSetup.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.CryptSetup
         * @static
         * @param {MumbleProto.ICryptSetup} message CryptSetup message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        CryptSetup.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a CryptSetup message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.CryptSetup
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.CryptSetup} CryptSetup
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        CryptSetup.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.CryptSetup();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.key = reader.bytes();
                        break;
                    }
                case 2: {
                        message.clientNonce = reader.bytes();
                        break;
                    }
                case 3: {
                        message.serverNonce = reader.bytes();
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
         * Decodes a CryptSetup message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.CryptSetup
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.CryptSetup} CryptSetup
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        CryptSetup.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a CryptSetup message.
         * @function verify
         * @memberof MumbleProto.CryptSetup
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        CryptSetup.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.key != null && message.hasOwnProperty("key"))
                if (!(message.key && typeof message.key.length === "number" || $util.isString(message.key)))
                    return "key: buffer expected";
            if (message.clientNonce != null && message.hasOwnProperty("clientNonce"))
                if (!(message.clientNonce && typeof message.clientNonce.length === "number" || $util.isString(message.clientNonce)))
                    return "clientNonce: buffer expected";
            if (message.serverNonce != null && message.hasOwnProperty("serverNonce"))
                if (!(message.serverNonce && typeof message.serverNonce.length === "number" || $util.isString(message.serverNonce)))
                    return "serverNonce: buffer expected";
            return null;
        };

        /**
         * Creates a CryptSetup message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.CryptSetup
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.CryptSetup} CryptSetup
         */
        CryptSetup.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.CryptSetup)
                return object;
            var message = new $root.MumbleProto.CryptSetup();
            if (object.key != null)
                if (typeof object.key === "string")
                    $util.base64.decode(object.key, message.key = $util.newBuffer($util.base64.length(object.key)), 0);
                else if (object.key.length >= 0)
                    message.key = object.key;
            if (object.clientNonce != null)
                if (typeof object.clientNonce === "string")
                    $util.base64.decode(object.clientNonce, message.clientNonce = $util.newBuffer($util.base64.length(object.clientNonce)), 0);
                else if (object.clientNonce.length >= 0)
                    message.clientNonce = object.clientNonce;
            if (object.serverNonce != null)
                if (typeof object.serverNonce === "string")
                    $util.base64.decode(object.serverNonce, message.serverNonce = $util.newBuffer($util.base64.length(object.serverNonce)), 0);
                else if (object.serverNonce.length >= 0)
                    message.serverNonce = object.serverNonce;
            return message;
        };

        /**
         * Creates a plain object from a CryptSetup message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.CryptSetup
         * @static
         * @param {MumbleProto.CryptSetup} message CryptSetup
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        CryptSetup.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                if (options.bytes === String)
                    object.key = "";
                else {
                    object.key = [];
                    if (options.bytes !== Array)
                        object.key = $util.newBuffer(object.key);
                }
                if (options.bytes === String)
                    object.clientNonce = "";
                else {
                    object.clientNonce = [];
                    if (options.bytes !== Array)
                        object.clientNonce = $util.newBuffer(object.clientNonce);
                }
                if (options.bytes === String)
                    object.serverNonce = "";
                else {
                    object.serverNonce = [];
                    if (options.bytes !== Array)
                        object.serverNonce = $util.newBuffer(object.serverNonce);
                }
            }
            if (message.key != null && message.hasOwnProperty("key"))
                object.key = options.bytes === String ? $util.base64.encode(message.key, 0, message.key.length) : options.bytes === Array ? Array.prototype.slice.call(message.key) : message.key;
            if (message.clientNonce != null && message.hasOwnProperty("clientNonce"))
                object.clientNonce = options.bytes === String ? $util.base64.encode(message.clientNonce, 0, message.clientNonce.length) : options.bytes === Array ? Array.prototype.slice.call(message.clientNonce) : message.clientNonce;
            if (message.serverNonce != null && message.hasOwnProperty("serverNonce"))
                object.serverNonce = options.bytes === String ? $util.base64.encode(message.serverNonce, 0, message.serverNonce.length) : options.bytes === Array ? Array.prototype.slice.call(message.serverNonce) : message.serverNonce;
            return object;
        };

        /**
         * Converts this CryptSetup to JSON.
         * @function toJSON
         * @memberof MumbleProto.CryptSetup
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        CryptSetup.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for CryptSetup
         * @function getTypeUrl
         * @memberof MumbleProto.CryptSetup
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        CryptSetup.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.CryptSetup";
        };

        return CryptSetup;
    })();

    MumbleProto.ContextActionModify = (function() {

        /**
         * Properties of a ContextActionModify.
         * @memberof MumbleProto
         * @interface IContextActionModify
         * @property {string} action ContextActionModify action
         * @property {string|null} [text] ContextActionModify text
         * @property {number|null} [context] ContextActionModify context
         * @property {MumbleProto.ContextActionModify.Operation|null} [operation] ContextActionModify operation
         */

        /**
         * Constructs a new ContextActionModify.
         * @memberof MumbleProto
         * @classdesc Represents a ContextActionModify.
         * @implements IContextActionModify
         * @constructor
         * @param {MumbleProto.IContextActionModify=} [properties] Properties to set
         */
        function ContextActionModify(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ContextActionModify action.
         * @member {string} action
         * @memberof MumbleProto.ContextActionModify
         * @instance
         */
        ContextActionModify.prototype.action = "";

        /**
         * ContextActionModify text.
         * @member {string} text
         * @memberof MumbleProto.ContextActionModify
         * @instance
         */
        ContextActionModify.prototype.text = "";

        /**
         * ContextActionModify context.
         * @member {number} context
         * @memberof MumbleProto.ContextActionModify
         * @instance
         */
        ContextActionModify.prototype.context = 0;

        /**
         * ContextActionModify operation.
         * @member {MumbleProto.ContextActionModify.Operation} operation
         * @memberof MumbleProto.ContextActionModify
         * @instance
         */
        ContextActionModify.prototype.operation = 0;

        /**
         * Creates a new ContextActionModify instance using the specified properties.
         * @function create
         * @memberof MumbleProto.ContextActionModify
         * @static
         * @param {MumbleProto.IContextActionModify=} [properties] Properties to set
         * @returns {MumbleProto.ContextActionModify} ContextActionModify instance
         */
        ContextActionModify.create = function create(properties) {
            return new ContextActionModify(properties);
        };

        /**
         * Encodes the specified ContextActionModify message. Does not implicitly {@link MumbleProto.ContextActionModify.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.ContextActionModify
         * @static
         * @param {MumbleProto.IContextActionModify} message ContextActionModify message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ContextActionModify.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.action);
            if (message.text != null && Object.hasOwnProperty.call(message, "text"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.text);
            if (message.context != null && Object.hasOwnProperty.call(message, "context"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.context);
            if (message.operation != null && Object.hasOwnProperty.call(message, "operation"))
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.operation);
            return writer;
        };

        /**
         * Encodes the specified ContextActionModify message, length delimited. Does not implicitly {@link MumbleProto.ContextActionModify.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.ContextActionModify
         * @static
         * @param {MumbleProto.IContextActionModify} message ContextActionModify message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ContextActionModify.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ContextActionModify message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.ContextActionModify
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.ContextActionModify} ContextActionModify
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ContextActionModify.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.ContextActionModify();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.action = reader.string();
                        break;
                    }
                case 2: {
                        message.text = reader.string();
                        break;
                    }
                case 3: {
                        message.context = reader.uint32();
                        break;
                    }
                case 4: {
                        message.operation = reader.int32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("action"))
                throw $util.ProtocolError("missing required 'action'", { instance: message });
            return message;
        };

        /**
         * Decodes a ContextActionModify message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.ContextActionModify
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.ContextActionModify} ContextActionModify
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ContextActionModify.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ContextActionModify message.
         * @function verify
         * @memberof MumbleProto.ContextActionModify
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ContextActionModify.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isString(message.action))
                return "action: string expected";
            if (message.text != null && message.hasOwnProperty("text"))
                if (!$util.isString(message.text))
                    return "text: string expected";
            if (message.context != null && message.hasOwnProperty("context"))
                if (!$util.isInteger(message.context))
                    return "context: integer expected";
            if (message.operation != null && message.hasOwnProperty("operation"))
                switch (message.operation) {
                default:
                    return "operation: enum value expected";
                case 0:
                case 1:
                    break;
                }
            return null;
        };

        /**
         * Creates a ContextActionModify message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.ContextActionModify
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.ContextActionModify} ContextActionModify
         */
        ContextActionModify.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.ContextActionModify)
                return object;
            var message = new $root.MumbleProto.ContextActionModify();
            if (object.action != null)
                message.action = String(object.action);
            if (object.text != null)
                message.text = String(object.text);
            if (object.context != null)
                message.context = object.context >>> 0;
            switch (object.operation) {
            default:
                if (typeof object.operation === "number") {
                    message.operation = object.operation;
                    break;
                }
                break;
            case "Add":
            case 0:
                message.operation = 0;
                break;
            case "Remove":
            case 1:
                message.operation = 1;
                break;
            }
            return message;
        };

        /**
         * Creates a plain object from a ContextActionModify message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.ContextActionModify
         * @static
         * @param {MumbleProto.ContextActionModify} message ContextActionModify
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ContextActionModify.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.action = "";
                object.text = "";
                object.context = 0;
                object.operation = options.enums === String ? "Add" : 0;
            }
            if (message.action != null && message.hasOwnProperty("action"))
                object.action = message.action;
            if (message.text != null && message.hasOwnProperty("text"))
                object.text = message.text;
            if (message.context != null && message.hasOwnProperty("context"))
                object.context = message.context;
            if (message.operation != null && message.hasOwnProperty("operation"))
                object.operation = options.enums === String ? $root.MumbleProto.ContextActionModify.Operation[message.operation] === undefined ? message.operation : $root.MumbleProto.ContextActionModify.Operation[message.operation] : message.operation;
            return object;
        };

        /**
         * Converts this ContextActionModify to JSON.
         * @function toJSON
         * @memberof MumbleProto.ContextActionModify
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ContextActionModify.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ContextActionModify
         * @function getTypeUrl
         * @memberof MumbleProto.ContextActionModify
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ContextActionModify.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.ContextActionModify";
        };

        /**
         * Context enum.
         * @name MumbleProto.ContextActionModify.Context
         * @enum {number}
         * @property {number} Server=1 Server value
         * @property {number} Channel=2 Channel value
         * @property {number} User=4 User value
         */
        ContextActionModify.Context = (function() {
            var valuesById = {}, values = Object.create(valuesById);
            values[valuesById[1] = "Server"] = 1;
            values[valuesById[2] = "Channel"] = 2;
            values[valuesById[4] = "User"] = 4;
            return values;
        })();

        /**
         * Operation enum.
         * @name MumbleProto.ContextActionModify.Operation
         * @enum {number}
         * @property {number} Add=0 Add value
         * @property {number} Remove=1 Remove value
         */
        ContextActionModify.Operation = (function() {
            var valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "Add"] = 0;
            values[valuesById[1] = "Remove"] = 1;
            return values;
        })();

        return ContextActionModify;
    })();

    MumbleProto.ContextAction = (function() {

        /**
         * Properties of a ContextAction.
         * @memberof MumbleProto
         * @interface IContextAction
         * @property {number|null} [session] ContextAction session
         * @property {number|null} [channelId] ContextAction channelId
         * @property {string} action ContextAction action
         */

        /**
         * Constructs a new ContextAction.
         * @memberof MumbleProto
         * @classdesc Represents a ContextAction.
         * @implements IContextAction
         * @constructor
         * @param {MumbleProto.IContextAction=} [properties] Properties to set
         */
        function ContextAction(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ContextAction session.
         * @member {number} session
         * @memberof MumbleProto.ContextAction
         * @instance
         */
        ContextAction.prototype.session = 0;

        /**
         * ContextAction channelId.
         * @member {number} channelId
         * @memberof MumbleProto.ContextAction
         * @instance
         */
        ContextAction.prototype.channelId = 0;

        /**
         * ContextAction action.
         * @member {string} action
         * @memberof MumbleProto.ContextAction
         * @instance
         */
        ContextAction.prototype.action = "";

        /**
         * Creates a new ContextAction instance using the specified properties.
         * @function create
         * @memberof MumbleProto.ContextAction
         * @static
         * @param {MumbleProto.IContextAction=} [properties] Properties to set
         * @returns {MumbleProto.ContextAction} ContextAction instance
         */
        ContextAction.create = function create(properties) {
            return new ContextAction(properties);
        };

        /**
         * Encodes the specified ContextAction message. Does not implicitly {@link MumbleProto.ContextAction.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.ContextAction
         * @static
         * @param {MumbleProto.IContextAction} message ContextAction message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ContextAction.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.session != null && Object.hasOwnProperty.call(message, "session"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.session);
            if (message.channelId != null && Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.channelId);
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.action);
            return writer;
        };

        /**
         * Encodes the specified ContextAction message, length delimited. Does not implicitly {@link MumbleProto.ContextAction.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.ContextAction
         * @static
         * @param {MumbleProto.IContextAction} message ContextAction message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ContextAction.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ContextAction message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.ContextAction
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.ContextAction} ContextAction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ContextAction.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.ContextAction();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.session = reader.uint32();
                        break;
                    }
                case 2: {
                        message.channelId = reader.uint32();
                        break;
                    }
                case 3: {
                        message.action = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("action"))
                throw $util.ProtocolError("missing required 'action'", { instance: message });
            return message;
        };

        /**
         * Decodes a ContextAction message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.ContextAction
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.ContextAction} ContextAction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ContextAction.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ContextAction message.
         * @function verify
         * @memberof MumbleProto.ContextAction
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ContextAction.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.session != null && message.hasOwnProperty("session"))
                if (!$util.isInteger(message.session))
                    return "session: integer expected";
            if (message.channelId != null && message.hasOwnProperty("channelId"))
                if (!$util.isInteger(message.channelId))
                    return "channelId: integer expected";
            if (!$util.isString(message.action))
                return "action: string expected";
            return null;
        };

        /**
         * Creates a ContextAction message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.ContextAction
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.ContextAction} ContextAction
         */
        ContextAction.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.ContextAction)
                return object;
            var message = new $root.MumbleProto.ContextAction();
            if (object.session != null)
                message.session = object.session >>> 0;
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            if (object.action != null)
                message.action = String(object.action);
            return message;
        };

        /**
         * Creates a plain object from a ContextAction message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.ContextAction
         * @static
         * @param {MumbleProto.ContextAction} message ContextAction
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ContextAction.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.session = 0;
                object.channelId = 0;
                object.action = "";
            }
            if (message.session != null && message.hasOwnProperty("session"))
                object.session = message.session;
            if (message.channelId != null && message.hasOwnProperty("channelId"))
                object.channelId = message.channelId;
            if (message.action != null && message.hasOwnProperty("action"))
                object.action = message.action;
            return object;
        };

        /**
         * Converts this ContextAction to JSON.
         * @function toJSON
         * @memberof MumbleProto.ContextAction
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ContextAction.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ContextAction
         * @function getTypeUrl
         * @memberof MumbleProto.ContextAction
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ContextAction.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.ContextAction";
        };

        return ContextAction;
    })();

    MumbleProto.UserList = (function() {

        /**
         * Properties of a UserList.
         * @memberof MumbleProto
         * @interface IUserList
         * @property {Array.<MumbleProto.UserList.IUser>|null} [users] UserList users
         */

        /**
         * Constructs a new UserList.
         * @memberof MumbleProto
         * @classdesc Represents a UserList.
         * @implements IUserList
         * @constructor
         * @param {MumbleProto.IUserList=} [properties] Properties to set
         */
        function UserList(properties) {
            this.users = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * UserList users.
         * @member {Array.<MumbleProto.UserList.IUser>} users
         * @memberof MumbleProto.UserList
         * @instance
         */
        UserList.prototype.users = $util.emptyArray;

        /**
         * Creates a new UserList instance using the specified properties.
         * @function create
         * @memberof MumbleProto.UserList
         * @static
         * @param {MumbleProto.IUserList=} [properties] Properties to set
         * @returns {MumbleProto.UserList} UserList instance
         */
        UserList.create = function create(properties) {
            return new UserList(properties);
        };

        /**
         * Encodes the specified UserList message. Does not implicitly {@link MumbleProto.UserList.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.UserList
         * @static
         * @param {MumbleProto.IUserList} message UserList message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UserList.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.users != null && message.users.length)
                for (var i = 0; i < message.users.length; ++i)
                    $root.MumbleProto.UserList.User.encode(message.users[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified UserList message, length delimited. Does not implicitly {@link MumbleProto.UserList.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.UserList
         * @static
         * @param {MumbleProto.IUserList} message UserList message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UserList.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a UserList message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.UserList
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.UserList} UserList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UserList.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.UserList();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.users && message.users.length))
                            message.users = [];
                        message.users.push($root.MumbleProto.UserList.User.decode(reader, reader.uint32()));
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
         * Decodes a UserList message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.UserList
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.UserList} UserList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UserList.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a UserList message.
         * @function verify
         * @memberof MumbleProto.UserList
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        UserList.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.users != null && message.hasOwnProperty("users")) {
                if (!Array.isArray(message.users))
                    return "users: array expected";
                for (var i = 0; i < message.users.length; ++i) {
                    var error = $root.MumbleProto.UserList.User.verify(message.users[i]);
                    if (error)
                        return "users." + error;
                }
            }
            return null;
        };

        /**
         * Creates a UserList message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.UserList
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.UserList} UserList
         */
        UserList.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.UserList)
                return object;
            var message = new $root.MumbleProto.UserList();
            if (object.users) {
                if (!Array.isArray(object.users))
                    throw TypeError(".MumbleProto.UserList.users: array expected");
                message.users = [];
                for (var i = 0; i < object.users.length; ++i) {
                    if (typeof object.users[i] !== "object")
                        throw TypeError(".MumbleProto.UserList.users: object expected");
                    message.users[i] = $root.MumbleProto.UserList.User.fromObject(object.users[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a UserList message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.UserList
         * @static
         * @param {MumbleProto.UserList} message UserList
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        UserList.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.users = [];
            if (message.users && message.users.length) {
                object.users = [];
                for (var j = 0; j < message.users.length; ++j)
                    object.users[j] = $root.MumbleProto.UserList.User.toObject(message.users[j], options);
            }
            return object;
        };

        /**
         * Converts this UserList to JSON.
         * @function toJSON
         * @memberof MumbleProto.UserList
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        UserList.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for UserList
         * @function getTypeUrl
         * @memberof MumbleProto.UserList
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        UserList.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.UserList";
        };

        UserList.User = (function() {

            /**
             * Properties of a User.
             * @memberof MumbleProto.UserList
             * @interface IUser
             * @property {number} userId User userId
             * @property {string|null} [name] User name
             * @property {string|null} [lastSeen] User lastSeen
             * @property {number|null} [lastChannel] User lastChannel
             */

            /**
             * Constructs a new User.
             * @memberof MumbleProto.UserList
             * @classdesc Represents a User.
             * @implements IUser
             * @constructor
             * @param {MumbleProto.UserList.IUser=} [properties] Properties to set
             */
            function User(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * User userId.
             * @member {number} userId
             * @memberof MumbleProto.UserList.User
             * @instance
             */
            User.prototype.userId = 0;

            /**
             * User name.
             * @member {string} name
             * @memberof MumbleProto.UserList.User
             * @instance
             */
            User.prototype.name = "";

            /**
             * User lastSeen.
             * @member {string} lastSeen
             * @memberof MumbleProto.UserList.User
             * @instance
             */
            User.prototype.lastSeen = "";

            /**
             * User lastChannel.
             * @member {number} lastChannel
             * @memberof MumbleProto.UserList.User
             * @instance
             */
            User.prototype.lastChannel = 0;

            /**
             * Creates a new User instance using the specified properties.
             * @function create
             * @memberof MumbleProto.UserList.User
             * @static
             * @param {MumbleProto.UserList.IUser=} [properties] Properties to set
             * @returns {MumbleProto.UserList.User} User instance
             */
            User.create = function create(properties) {
                return new User(properties);
            };

            /**
             * Encodes the specified User message. Does not implicitly {@link MumbleProto.UserList.User.verify|verify} messages.
             * @function encode
             * @memberof MumbleProto.UserList.User
             * @static
             * @param {MumbleProto.UserList.IUser} message User message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            User.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.userId);
                if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.name);
                if (message.lastSeen != null && Object.hasOwnProperty.call(message, "lastSeen"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.lastSeen);
                if (message.lastChannel != null && Object.hasOwnProperty.call(message, "lastChannel"))
                    writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.lastChannel);
                return writer;
            };

            /**
             * Encodes the specified User message, length delimited. Does not implicitly {@link MumbleProto.UserList.User.verify|verify} messages.
             * @function encodeDelimited
             * @memberof MumbleProto.UserList.User
             * @static
             * @param {MumbleProto.UserList.IUser} message User message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            User.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a User message from the specified reader or buffer.
             * @function decode
             * @memberof MumbleProto.UserList.User
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {MumbleProto.UserList.User} User
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            User.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.UserList.User();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.userId = reader.uint32();
                            break;
                        }
                    case 2: {
                            message.name = reader.string();
                            break;
                        }
                    case 3: {
                            message.lastSeen = reader.string();
                            break;
                        }
                    case 4: {
                            message.lastChannel = reader.uint32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                if (!message.hasOwnProperty("userId"))
                    throw $util.ProtocolError("missing required 'userId'", { instance: message });
                return message;
            };

            /**
             * Decodes a User message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof MumbleProto.UserList.User
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {MumbleProto.UserList.User} User
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            User.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a User message.
             * @function verify
             * @memberof MumbleProto.UserList.User
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            User.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (!$util.isInteger(message.userId))
                    return "userId: integer expected";
                if (message.name != null && message.hasOwnProperty("name"))
                    if (!$util.isString(message.name))
                        return "name: string expected";
                if (message.lastSeen != null && message.hasOwnProperty("lastSeen"))
                    if (!$util.isString(message.lastSeen))
                        return "lastSeen: string expected";
                if (message.lastChannel != null && message.hasOwnProperty("lastChannel"))
                    if (!$util.isInteger(message.lastChannel))
                        return "lastChannel: integer expected";
                return null;
            };

            /**
             * Creates a User message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof MumbleProto.UserList.User
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {MumbleProto.UserList.User} User
             */
            User.fromObject = function fromObject(object) {
                if (object instanceof $root.MumbleProto.UserList.User)
                    return object;
                var message = new $root.MumbleProto.UserList.User();
                if (object.userId != null)
                    message.userId = object.userId >>> 0;
                if (object.name != null)
                    message.name = String(object.name);
                if (object.lastSeen != null)
                    message.lastSeen = String(object.lastSeen);
                if (object.lastChannel != null)
                    message.lastChannel = object.lastChannel >>> 0;
                return message;
            };

            /**
             * Creates a plain object from a User message. Also converts values to other types if specified.
             * @function toObject
             * @memberof MumbleProto.UserList.User
             * @static
             * @param {MumbleProto.UserList.User} message User
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            User.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.userId = 0;
                    object.name = "";
                    object.lastSeen = "";
                    object.lastChannel = 0;
                }
                if (message.userId != null && message.hasOwnProperty("userId"))
                    object.userId = message.userId;
                if (message.name != null && message.hasOwnProperty("name"))
                    object.name = message.name;
                if (message.lastSeen != null && message.hasOwnProperty("lastSeen"))
                    object.lastSeen = message.lastSeen;
                if (message.lastChannel != null && message.hasOwnProperty("lastChannel"))
                    object.lastChannel = message.lastChannel;
                return object;
            };

            /**
             * Converts this User to JSON.
             * @function toJSON
             * @memberof MumbleProto.UserList.User
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            User.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for User
             * @function getTypeUrl
             * @memberof MumbleProto.UserList.User
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            User.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/MumbleProto.UserList.User";
            };

            return User;
        })();

        return UserList;
    })();

    MumbleProto.VoiceTarget = (function() {

        /**
         * Properties of a VoiceTarget.
         * @memberof MumbleProto
         * @interface IVoiceTarget
         * @property {number|null} [id] VoiceTarget id
         * @property {Array.<MumbleProto.VoiceTarget.ITarget>|null} [targets] VoiceTarget targets
         */

        /**
         * Constructs a new VoiceTarget.
         * @memberof MumbleProto
         * @classdesc Represents a VoiceTarget.
         * @implements IVoiceTarget
         * @constructor
         * @param {MumbleProto.IVoiceTarget=} [properties] Properties to set
         */
        function VoiceTarget(properties) {
            this.targets = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * VoiceTarget id.
         * @member {number} id
         * @memberof MumbleProto.VoiceTarget
         * @instance
         */
        VoiceTarget.prototype.id = 0;

        /**
         * VoiceTarget targets.
         * @member {Array.<MumbleProto.VoiceTarget.ITarget>} targets
         * @memberof MumbleProto.VoiceTarget
         * @instance
         */
        VoiceTarget.prototype.targets = $util.emptyArray;

        /**
         * Creates a new VoiceTarget instance using the specified properties.
         * @function create
         * @memberof MumbleProto.VoiceTarget
         * @static
         * @param {MumbleProto.IVoiceTarget=} [properties] Properties to set
         * @returns {MumbleProto.VoiceTarget} VoiceTarget instance
         */
        VoiceTarget.create = function create(properties) {
            return new VoiceTarget(properties);
        };

        /**
         * Encodes the specified VoiceTarget message. Does not implicitly {@link MumbleProto.VoiceTarget.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.VoiceTarget
         * @static
         * @param {MumbleProto.IVoiceTarget} message VoiceTarget message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        VoiceTarget.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.id);
            if (message.targets != null && message.targets.length)
                for (var i = 0; i < message.targets.length; ++i)
                    $root.MumbleProto.VoiceTarget.Target.encode(message.targets[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified VoiceTarget message, length delimited. Does not implicitly {@link MumbleProto.VoiceTarget.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.VoiceTarget
         * @static
         * @param {MumbleProto.IVoiceTarget} message VoiceTarget message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        VoiceTarget.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a VoiceTarget message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.VoiceTarget
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.VoiceTarget} VoiceTarget
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        VoiceTarget.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.VoiceTarget();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.uint32();
                        break;
                    }
                case 2: {
                        if (!(message.targets && message.targets.length))
                            message.targets = [];
                        message.targets.push($root.MumbleProto.VoiceTarget.Target.decode(reader, reader.uint32()));
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
         * Decodes a VoiceTarget message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.VoiceTarget
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.VoiceTarget} VoiceTarget
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        VoiceTarget.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a VoiceTarget message.
         * @function verify
         * @memberof MumbleProto.VoiceTarget
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        VoiceTarget.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.id != null && message.hasOwnProperty("id"))
                if (!$util.isInteger(message.id))
                    return "id: integer expected";
            if (message.targets != null && message.hasOwnProperty("targets")) {
                if (!Array.isArray(message.targets))
                    return "targets: array expected";
                for (var i = 0; i < message.targets.length; ++i) {
                    var error = $root.MumbleProto.VoiceTarget.Target.verify(message.targets[i]);
                    if (error)
                        return "targets." + error;
                }
            }
            return null;
        };

        /**
         * Creates a VoiceTarget message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.VoiceTarget
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.VoiceTarget} VoiceTarget
         */
        VoiceTarget.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.VoiceTarget)
                return object;
            var message = new $root.MumbleProto.VoiceTarget();
            if (object.id != null)
                message.id = object.id >>> 0;
            if (object.targets) {
                if (!Array.isArray(object.targets))
                    throw TypeError(".MumbleProto.VoiceTarget.targets: array expected");
                message.targets = [];
                for (var i = 0; i < object.targets.length; ++i) {
                    if (typeof object.targets[i] !== "object")
                        throw TypeError(".MumbleProto.VoiceTarget.targets: object expected");
                    message.targets[i] = $root.MumbleProto.VoiceTarget.Target.fromObject(object.targets[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a VoiceTarget message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.VoiceTarget
         * @static
         * @param {MumbleProto.VoiceTarget} message VoiceTarget
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        VoiceTarget.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.targets = [];
            if (options.defaults)
                object.id = 0;
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.targets && message.targets.length) {
                object.targets = [];
                for (var j = 0; j < message.targets.length; ++j)
                    object.targets[j] = $root.MumbleProto.VoiceTarget.Target.toObject(message.targets[j], options);
            }
            return object;
        };

        /**
         * Converts this VoiceTarget to JSON.
         * @function toJSON
         * @memberof MumbleProto.VoiceTarget
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        VoiceTarget.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for VoiceTarget
         * @function getTypeUrl
         * @memberof MumbleProto.VoiceTarget
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        VoiceTarget.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.VoiceTarget";
        };

        VoiceTarget.Target = (function() {

            /**
             * Properties of a Target.
             * @memberof MumbleProto.VoiceTarget
             * @interface ITarget
             * @property {Array.<number>|null} [session] Target session
             * @property {number|null} [channelId] Target channelId
             * @property {string|null} [group] Target group
             * @property {boolean|null} [links] Target links
             * @property {boolean|null} [children] Target children
             */

            /**
             * Constructs a new Target.
             * @memberof MumbleProto.VoiceTarget
             * @classdesc Represents a Target.
             * @implements ITarget
             * @constructor
             * @param {MumbleProto.VoiceTarget.ITarget=} [properties] Properties to set
             */
            function Target(properties) {
                this.session = [];
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * Target session.
             * @member {Array.<number>} session
             * @memberof MumbleProto.VoiceTarget.Target
             * @instance
             */
            Target.prototype.session = $util.emptyArray;

            /**
             * Target channelId.
             * @member {number} channelId
             * @memberof MumbleProto.VoiceTarget.Target
             * @instance
             */
            Target.prototype.channelId = 0;

            /**
             * Target group.
             * @member {string} group
             * @memberof MumbleProto.VoiceTarget.Target
             * @instance
             */
            Target.prototype.group = "";

            /**
             * Target links.
             * @member {boolean} links
             * @memberof MumbleProto.VoiceTarget.Target
             * @instance
             */
            Target.prototype.links = false;

            /**
             * Target children.
             * @member {boolean} children
             * @memberof MumbleProto.VoiceTarget.Target
             * @instance
             */
            Target.prototype.children = false;

            /**
             * Creates a new Target instance using the specified properties.
             * @function create
             * @memberof MumbleProto.VoiceTarget.Target
             * @static
             * @param {MumbleProto.VoiceTarget.ITarget=} [properties] Properties to set
             * @returns {MumbleProto.VoiceTarget.Target} Target instance
             */
            Target.create = function create(properties) {
                return new Target(properties);
            };

            /**
             * Encodes the specified Target message. Does not implicitly {@link MumbleProto.VoiceTarget.Target.verify|verify} messages.
             * @function encode
             * @memberof MumbleProto.VoiceTarget.Target
             * @static
             * @param {MumbleProto.VoiceTarget.ITarget} message Target message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Target.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.session != null && message.session.length)
                    for (var i = 0; i < message.session.length; ++i)
                        writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.session[i]);
                if (message.channelId != null && Object.hasOwnProperty.call(message, "channelId"))
                    writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.channelId);
                if (message.group != null && Object.hasOwnProperty.call(message, "group"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.group);
                if (message.links != null && Object.hasOwnProperty.call(message, "links"))
                    writer.uint32(/* id 4, wireType 0 =*/32).bool(message.links);
                if (message.children != null && Object.hasOwnProperty.call(message, "children"))
                    writer.uint32(/* id 5, wireType 0 =*/40).bool(message.children);
                return writer;
            };

            /**
             * Encodes the specified Target message, length delimited. Does not implicitly {@link MumbleProto.VoiceTarget.Target.verify|verify} messages.
             * @function encodeDelimited
             * @memberof MumbleProto.VoiceTarget.Target
             * @static
             * @param {MumbleProto.VoiceTarget.ITarget} message Target message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Target.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a Target message from the specified reader or buffer.
             * @function decode
             * @memberof MumbleProto.VoiceTarget.Target
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {MumbleProto.VoiceTarget.Target} Target
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Target.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.VoiceTarget.Target();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            if (!(message.session && message.session.length))
                                message.session = [];
                            if ((tag & 7) === 2) {
                                var end2 = reader.uint32() + reader.pos;
                                while (reader.pos < end2)
                                    message.session.push(reader.uint32());
                            } else
                                message.session.push(reader.uint32());
                            break;
                        }
                    case 2: {
                            message.channelId = reader.uint32();
                            break;
                        }
                    case 3: {
                            message.group = reader.string();
                            break;
                        }
                    case 4: {
                            message.links = reader.bool();
                            break;
                        }
                    case 5: {
                            message.children = reader.bool();
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
             * Decodes a Target message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof MumbleProto.VoiceTarget.Target
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {MumbleProto.VoiceTarget.Target} Target
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Target.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a Target message.
             * @function verify
             * @memberof MumbleProto.VoiceTarget.Target
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Target.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.session != null && message.hasOwnProperty("session")) {
                    if (!Array.isArray(message.session))
                        return "session: array expected";
                    for (var i = 0; i < message.session.length; ++i)
                        if (!$util.isInteger(message.session[i]))
                            return "session: integer[] expected";
                }
                if (message.channelId != null && message.hasOwnProperty("channelId"))
                    if (!$util.isInteger(message.channelId))
                        return "channelId: integer expected";
                if (message.group != null && message.hasOwnProperty("group"))
                    if (!$util.isString(message.group))
                        return "group: string expected";
                if (message.links != null && message.hasOwnProperty("links"))
                    if (typeof message.links !== "boolean")
                        return "links: boolean expected";
                if (message.children != null && message.hasOwnProperty("children"))
                    if (typeof message.children !== "boolean")
                        return "children: boolean expected";
                return null;
            };

            /**
             * Creates a Target message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof MumbleProto.VoiceTarget.Target
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {MumbleProto.VoiceTarget.Target} Target
             */
            Target.fromObject = function fromObject(object) {
                if (object instanceof $root.MumbleProto.VoiceTarget.Target)
                    return object;
                var message = new $root.MumbleProto.VoiceTarget.Target();
                if (object.session) {
                    if (!Array.isArray(object.session))
                        throw TypeError(".MumbleProto.VoiceTarget.Target.session: array expected");
                    message.session = [];
                    for (var i = 0; i < object.session.length; ++i)
                        message.session[i] = object.session[i] >>> 0;
                }
                if (object.channelId != null)
                    message.channelId = object.channelId >>> 0;
                if (object.group != null)
                    message.group = String(object.group);
                if (object.links != null)
                    message.links = Boolean(object.links);
                if (object.children != null)
                    message.children = Boolean(object.children);
                return message;
            };

            /**
             * Creates a plain object from a Target message. Also converts values to other types if specified.
             * @function toObject
             * @memberof MumbleProto.VoiceTarget.Target
             * @static
             * @param {MumbleProto.VoiceTarget.Target} message Target
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Target.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.arrays || options.defaults)
                    object.session = [];
                if (options.defaults) {
                    object.channelId = 0;
                    object.group = "";
                    object.links = false;
                    object.children = false;
                }
                if (message.session && message.session.length) {
                    object.session = [];
                    for (var j = 0; j < message.session.length; ++j)
                        object.session[j] = message.session[j];
                }
                if (message.channelId != null && message.hasOwnProperty("channelId"))
                    object.channelId = message.channelId;
                if (message.group != null && message.hasOwnProperty("group"))
                    object.group = message.group;
                if (message.links != null && message.hasOwnProperty("links"))
                    object.links = message.links;
                if (message.children != null && message.hasOwnProperty("children"))
                    object.children = message.children;
                return object;
            };

            /**
             * Converts this Target to JSON.
             * @function toJSON
             * @memberof MumbleProto.VoiceTarget.Target
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Target.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Target
             * @function getTypeUrl
             * @memberof MumbleProto.VoiceTarget.Target
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Target.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/MumbleProto.VoiceTarget.Target";
            };

            return Target;
        })();

        return VoiceTarget;
    })();

    MumbleProto.PermissionQuery = (function() {

        /**
         * Properties of a PermissionQuery.
         * @memberof MumbleProto
         * @interface IPermissionQuery
         * @property {number|null} [channelId] PermissionQuery channelId
         * @property {number|null} [permissions] PermissionQuery permissions
         * @property {boolean|null} [flush] PermissionQuery flush
         */

        /**
         * Constructs a new PermissionQuery.
         * @memberof MumbleProto
         * @classdesc Represents a PermissionQuery.
         * @implements IPermissionQuery
         * @constructor
         * @param {MumbleProto.IPermissionQuery=} [properties] Properties to set
         */
        function PermissionQuery(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PermissionQuery channelId.
         * @member {number} channelId
         * @memberof MumbleProto.PermissionQuery
         * @instance
         */
        PermissionQuery.prototype.channelId = 0;

        /**
         * PermissionQuery permissions.
         * @member {number} permissions
         * @memberof MumbleProto.PermissionQuery
         * @instance
         */
        PermissionQuery.prototype.permissions = 0;

        /**
         * PermissionQuery flush.
         * @member {boolean} flush
         * @memberof MumbleProto.PermissionQuery
         * @instance
         */
        PermissionQuery.prototype.flush = false;

        /**
         * Creates a new PermissionQuery instance using the specified properties.
         * @function create
         * @memberof MumbleProto.PermissionQuery
         * @static
         * @param {MumbleProto.IPermissionQuery=} [properties] Properties to set
         * @returns {MumbleProto.PermissionQuery} PermissionQuery instance
         */
        PermissionQuery.create = function create(properties) {
            return new PermissionQuery(properties);
        };

        /**
         * Encodes the specified PermissionQuery message. Does not implicitly {@link MumbleProto.PermissionQuery.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.PermissionQuery
         * @static
         * @param {MumbleProto.IPermissionQuery} message PermissionQuery message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PermissionQuery.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.channelId != null && Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.channelId);
            if (message.permissions != null && Object.hasOwnProperty.call(message, "permissions"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.permissions);
            if (message.flush != null && Object.hasOwnProperty.call(message, "flush"))
                writer.uint32(/* id 3, wireType 0 =*/24).bool(message.flush);
            return writer;
        };

        /**
         * Encodes the specified PermissionQuery message, length delimited. Does not implicitly {@link MumbleProto.PermissionQuery.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.PermissionQuery
         * @static
         * @param {MumbleProto.IPermissionQuery} message PermissionQuery message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PermissionQuery.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PermissionQuery message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.PermissionQuery
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.PermissionQuery} PermissionQuery
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PermissionQuery.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.PermissionQuery();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.channelId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.permissions = reader.uint32();
                        break;
                    }
                case 3: {
                        message.flush = reader.bool();
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
         * Decodes a PermissionQuery message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.PermissionQuery
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.PermissionQuery} PermissionQuery
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PermissionQuery.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PermissionQuery message.
         * @function verify
         * @memberof MumbleProto.PermissionQuery
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PermissionQuery.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.channelId != null && message.hasOwnProperty("channelId"))
                if (!$util.isInteger(message.channelId))
                    return "channelId: integer expected";
            if (message.permissions != null && message.hasOwnProperty("permissions"))
                if (!$util.isInteger(message.permissions))
                    return "permissions: integer expected";
            if (message.flush != null && message.hasOwnProperty("flush"))
                if (typeof message.flush !== "boolean")
                    return "flush: boolean expected";
            return null;
        };

        /**
         * Creates a PermissionQuery message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.PermissionQuery
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.PermissionQuery} PermissionQuery
         */
        PermissionQuery.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.PermissionQuery)
                return object;
            var message = new $root.MumbleProto.PermissionQuery();
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            if (object.permissions != null)
                message.permissions = object.permissions >>> 0;
            if (object.flush != null)
                message.flush = Boolean(object.flush);
            return message;
        };

        /**
         * Creates a plain object from a PermissionQuery message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.PermissionQuery
         * @static
         * @param {MumbleProto.PermissionQuery} message PermissionQuery
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PermissionQuery.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.channelId = 0;
                object.permissions = 0;
                object.flush = false;
            }
            if (message.channelId != null && message.hasOwnProperty("channelId"))
                object.channelId = message.channelId;
            if (message.permissions != null && message.hasOwnProperty("permissions"))
                object.permissions = message.permissions;
            if (message.flush != null && message.hasOwnProperty("flush"))
                object.flush = message.flush;
            return object;
        };

        /**
         * Converts this PermissionQuery to JSON.
         * @function toJSON
         * @memberof MumbleProto.PermissionQuery
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PermissionQuery.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PermissionQuery
         * @function getTypeUrl
         * @memberof MumbleProto.PermissionQuery
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PermissionQuery.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.PermissionQuery";
        };

        return PermissionQuery;
    })();

    MumbleProto.CodecVersion = (function() {

        /**
         * Properties of a CodecVersion.
         * @memberof MumbleProto
         * @interface ICodecVersion
         * @property {number} alpha CodecVersion alpha
         * @property {number} beta CodecVersion beta
         * @property {boolean} preferAlpha CodecVersion preferAlpha
         * @property {boolean|null} [opus] CodecVersion opus
         */

        /**
         * Constructs a new CodecVersion.
         * @memberof MumbleProto
         * @classdesc Represents a CodecVersion.
         * @implements ICodecVersion
         * @constructor
         * @param {MumbleProto.ICodecVersion=} [properties] Properties to set
         */
        function CodecVersion(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * CodecVersion alpha.
         * @member {number} alpha
         * @memberof MumbleProto.CodecVersion
         * @instance
         */
        CodecVersion.prototype.alpha = 0;

        /**
         * CodecVersion beta.
         * @member {number} beta
         * @memberof MumbleProto.CodecVersion
         * @instance
         */
        CodecVersion.prototype.beta = 0;

        /**
         * CodecVersion preferAlpha.
         * @member {boolean} preferAlpha
         * @memberof MumbleProto.CodecVersion
         * @instance
         */
        CodecVersion.prototype.preferAlpha = true;

        /**
         * CodecVersion opus.
         * @member {boolean} opus
         * @memberof MumbleProto.CodecVersion
         * @instance
         */
        CodecVersion.prototype.opus = false;

        /**
         * Creates a new CodecVersion instance using the specified properties.
         * @function create
         * @memberof MumbleProto.CodecVersion
         * @static
         * @param {MumbleProto.ICodecVersion=} [properties] Properties to set
         * @returns {MumbleProto.CodecVersion} CodecVersion instance
         */
        CodecVersion.create = function create(properties) {
            return new CodecVersion(properties);
        };

        /**
         * Encodes the specified CodecVersion message. Does not implicitly {@link MumbleProto.CodecVersion.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.CodecVersion
         * @static
         * @param {MumbleProto.ICodecVersion} message CodecVersion message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        CodecVersion.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.alpha);
            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.beta);
            writer.uint32(/* id 3, wireType 0 =*/24).bool(message.preferAlpha);
            if (message.opus != null && Object.hasOwnProperty.call(message, "opus"))
                writer.uint32(/* id 4, wireType 0 =*/32).bool(message.opus);
            return writer;
        };

        /**
         * Encodes the specified CodecVersion message, length delimited. Does not implicitly {@link MumbleProto.CodecVersion.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.CodecVersion
         * @static
         * @param {MumbleProto.ICodecVersion} message CodecVersion message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        CodecVersion.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a CodecVersion message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.CodecVersion
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.CodecVersion} CodecVersion
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        CodecVersion.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.CodecVersion();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.alpha = reader.int32();
                        break;
                    }
                case 2: {
                        message.beta = reader.int32();
                        break;
                    }
                case 3: {
                        message.preferAlpha = reader.bool();
                        break;
                    }
                case 4: {
                        message.opus = reader.bool();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("alpha"))
                throw $util.ProtocolError("missing required 'alpha'", { instance: message });
            if (!message.hasOwnProperty("beta"))
                throw $util.ProtocolError("missing required 'beta'", { instance: message });
            if (!message.hasOwnProperty("preferAlpha"))
                throw $util.ProtocolError("missing required 'preferAlpha'", { instance: message });
            return message;
        };

        /**
         * Decodes a CodecVersion message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.CodecVersion
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.CodecVersion} CodecVersion
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        CodecVersion.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a CodecVersion message.
         * @function verify
         * @memberof MumbleProto.CodecVersion
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        CodecVersion.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isInteger(message.alpha))
                return "alpha: integer expected";
            if (!$util.isInteger(message.beta))
                return "beta: integer expected";
            if (typeof message.preferAlpha !== "boolean")
                return "preferAlpha: boolean expected";
            if (message.opus != null && message.hasOwnProperty("opus"))
                if (typeof message.opus !== "boolean")
                    return "opus: boolean expected";
            return null;
        };

        /**
         * Creates a CodecVersion message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.CodecVersion
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.CodecVersion} CodecVersion
         */
        CodecVersion.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.CodecVersion)
                return object;
            var message = new $root.MumbleProto.CodecVersion();
            if (object.alpha != null)
                message.alpha = object.alpha | 0;
            if (object.beta != null)
                message.beta = object.beta | 0;
            if (object.preferAlpha != null)
                message.preferAlpha = Boolean(object.preferAlpha);
            if (object.opus != null)
                message.opus = Boolean(object.opus);
            return message;
        };

        /**
         * Creates a plain object from a CodecVersion message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.CodecVersion
         * @static
         * @param {MumbleProto.CodecVersion} message CodecVersion
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        CodecVersion.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.alpha = 0;
                object.beta = 0;
                object.preferAlpha = true;
                object.opus = false;
            }
            if (message.alpha != null && message.hasOwnProperty("alpha"))
                object.alpha = message.alpha;
            if (message.beta != null && message.hasOwnProperty("beta"))
                object.beta = message.beta;
            if (message.preferAlpha != null && message.hasOwnProperty("preferAlpha"))
                object.preferAlpha = message.preferAlpha;
            if (message.opus != null && message.hasOwnProperty("opus"))
                object.opus = message.opus;
            return object;
        };

        /**
         * Converts this CodecVersion to JSON.
         * @function toJSON
         * @memberof MumbleProto.CodecVersion
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        CodecVersion.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for CodecVersion
         * @function getTypeUrl
         * @memberof MumbleProto.CodecVersion
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        CodecVersion.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.CodecVersion";
        };

        return CodecVersion;
    })();

    MumbleProto.UserStats = (function() {

        /**
         * Properties of a UserStats.
         * @memberof MumbleProto
         * @interface IUserStats
         * @property {number|null} [session] UserStats session
         * @property {boolean|null} [statsOnly] UserStats statsOnly
         * @property {Array.<Uint8Array>|null} [certificates] UserStats certificates
         * @property {MumbleProto.UserStats.IStats|null} [fromClient] UserStats fromClient
         * @property {MumbleProto.UserStats.IStats|null} [fromServer] UserStats fromServer
         * @property {number|null} [udpPackets] UserStats udpPackets
         * @property {number|null} [tcpPackets] UserStats tcpPackets
         * @property {number|null} [udpPingAvg] UserStats udpPingAvg
         * @property {number|null} [udpPingVar] UserStats udpPingVar
         * @property {number|null} [tcpPingAvg] UserStats tcpPingAvg
         * @property {number|null} [tcpPingVar] UserStats tcpPingVar
         * @property {MumbleProto.IVersion|null} [version] UserStats version
         * @property {Array.<number>|null} [celtVersions] UserStats celtVersions
         * @property {Uint8Array|null} [address] UserStats address
         * @property {number|null} [bandwidth] UserStats bandwidth
         * @property {number|null} [onlinesecs] UserStats onlinesecs
         * @property {number|null} [idlesecs] UserStats idlesecs
         * @property {boolean|null} [strongCertificate] UserStats strongCertificate
         * @property {boolean|null} [opus] UserStats opus
         * @property {MumbleProto.UserStats.IRollingStats|null} [rollingStats] UserStats rollingStats
         */

        /**
         * Constructs a new UserStats.
         * @memberof MumbleProto
         * @classdesc Represents a UserStats.
         * @implements IUserStats
         * @constructor
         * @param {MumbleProto.IUserStats=} [properties] Properties to set
         */
        function UserStats(properties) {
            this.certificates = [];
            this.celtVersions = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * UserStats session.
         * @member {number} session
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.session = 0;

        /**
         * UserStats statsOnly.
         * @member {boolean} statsOnly
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.statsOnly = false;

        /**
         * UserStats certificates.
         * @member {Array.<Uint8Array>} certificates
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.certificates = $util.emptyArray;

        /**
         * UserStats fromClient.
         * @member {MumbleProto.UserStats.IStats|null|undefined} fromClient
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.fromClient = null;

        /**
         * UserStats fromServer.
         * @member {MumbleProto.UserStats.IStats|null|undefined} fromServer
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.fromServer = null;

        /**
         * UserStats udpPackets.
         * @member {number} udpPackets
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.udpPackets = 0;

        /**
         * UserStats tcpPackets.
         * @member {number} tcpPackets
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.tcpPackets = 0;

        /**
         * UserStats udpPingAvg.
         * @member {number} udpPingAvg
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.udpPingAvg = 0;

        /**
         * UserStats udpPingVar.
         * @member {number} udpPingVar
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.udpPingVar = 0;

        /**
         * UserStats tcpPingAvg.
         * @member {number} tcpPingAvg
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.tcpPingAvg = 0;

        /**
         * UserStats tcpPingVar.
         * @member {number} tcpPingVar
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.tcpPingVar = 0;

        /**
         * UserStats version.
         * @member {MumbleProto.IVersion|null|undefined} version
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.version = null;

        /**
         * UserStats celtVersions.
         * @member {Array.<number>} celtVersions
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.celtVersions = $util.emptyArray;

        /**
         * UserStats address.
         * @member {Uint8Array} address
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.address = $util.newBuffer([]);

        /**
         * UserStats bandwidth.
         * @member {number} bandwidth
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.bandwidth = 0;

        /**
         * UserStats onlinesecs.
         * @member {number} onlinesecs
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.onlinesecs = 0;

        /**
         * UserStats idlesecs.
         * @member {number} idlesecs
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.idlesecs = 0;

        /**
         * UserStats strongCertificate.
         * @member {boolean} strongCertificate
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.strongCertificate = false;

        /**
         * UserStats opus.
         * @member {boolean} opus
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.opus = false;

        /**
         * UserStats rollingStats.
         * @member {MumbleProto.UserStats.IRollingStats|null|undefined} rollingStats
         * @memberof MumbleProto.UserStats
         * @instance
         */
        UserStats.prototype.rollingStats = null;

        /**
         * Creates a new UserStats instance using the specified properties.
         * @function create
         * @memberof MumbleProto.UserStats
         * @static
         * @param {MumbleProto.IUserStats=} [properties] Properties to set
         * @returns {MumbleProto.UserStats} UserStats instance
         */
        UserStats.create = function create(properties) {
            return new UserStats(properties);
        };

        /**
         * Encodes the specified UserStats message. Does not implicitly {@link MumbleProto.UserStats.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.UserStats
         * @static
         * @param {MumbleProto.IUserStats} message UserStats message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UserStats.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.session != null && Object.hasOwnProperty.call(message, "session"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.session);
            if (message.statsOnly != null && Object.hasOwnProperty.call(message, "statsOnly"))
                writer.uint32(/* id 2, wireType 0 =*/16).bool(message.statsOnly);
            if (message.certificates != null && message.certificates.length)
                for (var i = 0; i < message.certificates.length; ++i)
                    writer.uint32(/* id 3, wireType 2 =*/26).bytes(message.certificates[i]);
            if (message.fromClient != null && Object.hasOwnProperty.call(message, "fromClient"))
                $root.MumbleProto.UserStats.Stats.encode(message.fromClient, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            if (message.fromServer != null && Object.hasOwnProperty.call(message, "fromServer"))
                $root.MumbleProto.UserStats.Stats.encode(message.fromServer, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            if (message.udpPackets != null && Object.hasOwnProperty.call(message, "udpPackets"))
                writer.uint32(/* id 6, wireType 0 =*/48).uint32(message.udpPackets);
            if (message.tcpPackets != null && Object.hasOwnProperty.call(message, "tcpPackets"))
                writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.tcpPackets);
            if (message.udpPingAvg != null && Object.hasOwnProperty.call(message, "udpPingAvg"))
                writer.uint32(/* id 8, wireType 5 =*/69).float(message.udpPingAvg);
            if (message.udpPingVar != null && Object.hasOwnProperty.call(message, "udpPingVar"))
                writer.uint32(/* id 9, wireType 5 =*/77).float(message.udpPingVar);
            if (message.tcpPingAvg != null && Object.hasOwnProperty.call(message, "tcpPingAvg"))
                writer.uint32(/* id 10, wireType 5 =*/85).float(message.tcpPingAvg);
            if (message.tcpPingVar != null && Object.hasOwnProperty.call(message, "tcpPingVar"))
                writer.uint32(/* id 11, wireType 5 =*/93).float(message.tcpPingVar);
            if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                $root.MumbleProto.Version.encode(message.version, writer.uint32(/* id 12, wireType 2 =*/98).fork()).ldelim();
            if (message.celtVersions != null && message.celtVersions.length)
                for (var i = 0; i < message.celtVersions.length; ++i)
                    writer.uint32(/* id 13, wireType 0 =*/104).int32(message.celtVersions[i]);
            if (message.address != null && Object.hasOwnProperty.call(message, "address"))
                writer.uint32(/* id 14, wireType 2 =*/114).bytes(message.address);
            if (message.bandwidth != null && Object.hasOwnProperty.call(message, "bandwidth"))
                writer.uint32(/* id 15, wireType 0 =*/120).uint32(message.bandwidth);
            if (message.onlinesecs != null && Object.hasOwnProperty.call(message, "onlinesecs"))
                writer.uint32(/* id 16, wireType 0 =*/128).uint32(message.onlinesecs);
            if (message.idlesecs != null && Object.hasOwnProperty.call(message, "idlesecs"))
                writer.uint32(/* id 17, wireType 0 =*/136).uint32(message.idlesecs);
            if (message.strongCertificate != null && Object.hasOwnProperty.call(message, "strongCertificate"))
                writer.uint32(/* id 18, wireType 0 =*/144).bool(message.strongCertificate);
            if (message.opus != null && Object.hasOwnProperty.call(message, "opus"))
                writer.uint32(/* id 19, wireType 0 =*/152).bool(message.opus);
            if (message.rollingStats != null && Object.hasOwnProperty.call(message, "rollingStats"))
                $root.MumbleProto.UserStats.RollingStats.encode(message.rollingStats, writer.uint32(/* id 20, wireType 2 =*/162).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified UserStats message, length delimited. Does not implicitly {@link MumbleProto.UserStats.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.UserStats
         * @static
         * @param {MumbleProto.IUserStats} message UserStats message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        UserStats.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a UserStats message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.UserStats
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.UserStats} UserStats
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UserStats.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.UserStats();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.session = reader.uint32();
                        break;
                    }
                case 2: {
                        message.statsOnly = reader.bool();
                        break;
                    }
                case 3: {
                        if (!(message.certificates && message.certificates.length))
                            message.certificates = [];
                        message.certificates.push(reader.bytes());
                        break;
                    }
                case 4: {
                        message.fromClient = $root.MumbleProto.UserStats.Stats.decode(reader, reader.uint32());
                        break;
                    }
                case 5: {
                        message.fromServer = $root.MumbleProto.UserStats.Stats.decode(reader, reader.uint32());
                        break;
                    }
                case 6: {
                        message.udpPackets = reader.uint32();
                        break;
                    }
                case 7: {
                        message.tcpPackets = reader.uint32();
                        break;
                    }
                case 8: {
                        message.udpPingAvg = reader.float();
                        break;
                    }
                case 9: {
                        message.udpPingVar = reader.float();
                        break;
                    }
                case 10: {
                        message.tcpPingAvg = reader.float();
                        break;
                    }
                case 11: {
                        message.tcpPingVar = reader.float();
                        break;
                    }
                case 12: {
                        message.version = $root.MumbleProto.Version.decode(reader, reader.uint32());
                        break;
                    }
                case 13: {
                        if (!(message.celtVersions && message.celtVersions.length))
                            message.celtVersions = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.celtVersions.push(reader.int32());
                        } else
                            message.celtVersions.push(reader.int32());
                        break;
                    }
                case 14: {
                        message.address = reader.bytes();
                        break;
                    }
                case 15: {
                        message.bandwidth = reader.uint32();
                        break;
                    }
                case 16: {
                        message.onlinesecs = reader.uint32();
                        break;
                    }
                case 17: {
                        message.idlesecs = reader.uint32();
                        break;
                    }
                case 18: {
                        message.strongCertificate = reader.bool();
                        break;
                    }
                case 19: {
                        message.opus = reader.bool();
                        break;
                    }
                case 20: {
                        message.rollingStats = $root.MumbleProto.UserStats.RollingStats.decode(reader, reader.uint32());
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
         * Decodes a UserStats message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.UserStats
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.UserStats} UserStats
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        UserStats.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a UserStats message.
         * @function verify
         * @memberof MumbleProto.UserStats
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        UserStats.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.session != null && message.hasOwnProperty("session"))
                if (!$util.isInteger(message.session))
                    return "session: integer expected";
            if (message.statsOnly != null && message.hasOwnProperty("statsOnly"))
                if (typeof message.statsOnly !== "boolean")
                    return "statsOnly: boolean expected";
            if (message.certificates != null && message.hasOwnProperty("certificates")) {
                if (!Array.isArray(message.certificates))
                    return "certificates: array expected";
                for (var i = 0; i < message.certificates.length; ++i)
                    if (!(message.certificates[i] && typeof message.certificates[i].length === "number" || $util.isString(message.certificates[i])))
                        return "certificates: buffer[] expected";
            }
            if (message.fromClient != null && message.hasOwnProperty("fromClient")) {
                var error = $root.MumbleProto.UserStats.Stats.verify(message.fromClient);
                if (error)
                    return "fromClient." + error;
            }
            if (message.fromServer != null && message.hasOwnProperty("fromServer")) {
                var error = $root.MumbleProto.UserStats.Stats.verify(message.fromServer);
                if (error)
                    return "fromServer." + error;
            }
            if (message.udpPackets != null && message.hasOwnProperty("udpPackets"))
                if (!$util.isInteger(message.udpPackets))
                    return "udpPackets: integer expected";
            if (message.tcpPackets != null && message.hasOwnProperty("tcpPackets"))
                if (!$util.isInteger(message.tcpPackets))
                    return "tcpPackets: integer expected";
            if (message.udpPingAvg != null && message.hasOwnProperty("udpPingAvg"))
                if (typeof message.udpPingAvg !== "number")
                    return "udpPingAvg: number expected";
            if (message.udpPingVar != null && message.hasOwnProperty("udpPingVar"))
                if (typeof message.udpPingVar !== "number")
                    return "udpPingVar: number expected";
            if (message.tcpPingAvg != null && message.hasOwnProperty("tcpPingAvg"))
                if (typeof message.tcpPingAvg !== "number")
                    return "tcpPingAvg: number expected";
            if (message.tcpPingVar != null && message.hasOwnProperty("tcpPingVar"))
                if (typeof message.tcpPingVar !== "number")
                    return "tcpPingVar: number expected";
            if (message.version != null && message.hasOwnProperty("version")) {
                var error = $root.MumbleProto.Version.verify(message.version);
                if (error)
                    return "version." + error;
            }
            if (message.celtVersions != null && message.hasOwnProperty("celtVersions")) {
                if (!Array.isArray(message.celtVersions))
                    return "celtVersions: array expected";
                for (var i = 0; i < message.celtVersions.length; ++i)
                    if (!$util.isInteger(message.celtVersions[i]))
                        return "celtVersions: integer[] expected";
            }
            if (message.address != null && message.hasOwnProperty("address"))
                if (!(message.address && typeof message.address.length === "number" || $util.isString(message.address)))
                    return "address: buffer expected";
            if (message.bandwidth != null && message.hasOwnProperty("bandwidth"))
                if (!$util.isInteger(message.bandwidth))
                    return "bandwidth: integer expected";
            if (message.onlinesecs != null && message.hasOwnProperty("onlinesecs"))
                if (!$util.isInteger(message.onlinesecs))
                    return "onlinesecs: integer expected";
            if (message.idlesecs != null && message.hasOwnProperty("idlesecs"))
                if (!$util.isInteger(message.idlesecs))
                    return "idlesecs: integer expected";
            if (message.strongCertificate != null && message.hasOwnProperty("strongCertificate"))
                if (typeof message.strongCertificate !== "boolean")
                    return "strongCertificate: boolean expected";
            if (message.opus != null && message.hasOwnProperty("opus"))
                if (typeof message.opus !== "boolean")
                    return "opus: boolean expected";
            if (message.rollingStats != null && message.hasOwnProperty("rollingStats")) {
                var error = $root.MumbleProto.UserStats.RollingStats.verify(message.rollingStats);
                if (error)
                    return "rollingStats." + error;
            }
            return null;
        };

        /**
         * Creates a UserStats message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.UserStats
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.UserStats} UserStats
         */
        UserStats.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.UserStats)
                return object;
            var message = new $root.MumbleProto.UserStats();
            if (object.session != null)
                message.session = object.session >>> 0;
            if (object.statsOnly != null)
                message.statsOnly = Boolean(object.statsOnly);
            if (object.certificates) {
                if (!Array.isArray(object.certificates))
                    throw TypeError(".MumbleProto.UserStats.certificates: array expected");
                message.certificates = [];
                for (var i = 0; i < object.certificates.length; ++i)
                    if (typeof object.certificates[i] === "string")
                        $util.base64.decode(object.certificates[i], message.certificates[i] = $util.newBuffer($util.base64.length(object.certificates[i])), 0);
                    else if (object.certificates[i].length >= 0)
                        message.certificates[i] = object.certificates[i];
            }
            if (object.fromClient != null) {
                if (typeof object.fromClient !== "object")
                    throw TypeError(".MumbleProto.UserStats.fromClient: object expected");
                message.fromClient = $root.MumbleProto.UserStats.Stats.fromObject(object.fromClient);
            }
            if (object.fromServer != null) {
                if (typeof object.fromServer !== "object")
                    throw TypeError(".MumbleProto.UserStats.fromServer: object expected");
                message.fromServer = $root.MumbleProto.UserStats.Stats.fromObject(object.fromServer);
            }
            if (object.udpPackets != null)
                message.udpPackets = object.udpPackets >>> 0;
            if (object.tcpPackets != null)
                message.tcpPackets = object.tcpPackets >>> 0;
            if (object.udpPingAvg != null)
                message.udpPingAvg = Number(object.udpPingAvg);
            if (object.udpPingVar != null)
                message.udpPingVar = Number(object.udpPingVar);
            if (object.tcpPingAvg != null)
                message.tcpPingAvg = Number(object.tcpPingAvg);
            if (object.tcpPingVar != null)
                message.tcpPingVar = Number(object.tcpPingVar);
            if (object.version != null) {
                if (typeof object.version !== "object")
                    throw TypeError(".MumbleProto.UserStats.version: object expected");
                message.version = $root.MumbleProto.Version.fromObject(object.version);
            }
            if (object.celtVersions) {
                if (!Array.isArray(object.celtVersions))
                    throw TypeError(".MumbleProto.UserStats.celtVersions: array expected");
                message.celtVersions = [];
                for (var i = 0; i < object.celtVersions.length; ++i)
                    message.celtVersions[i] = object.celtVersions[i] | 0;
            }
            if (object.address != null)
                if (typeof object.address === "string")
                    $util.base64.decode(object.address, message.address = $util.newBuffer($util.base64.length(object.address)), 0);
                else if (object.address.length >= 0)
                    message.address = object.address;
            if (object.bandwidth != null)
                message.bandwidth = object.bandwidth >>> 0;
            if (object.onlinesecs != null)
                message.onlinesecs = object.onlinesecs >>> 0;
            if (object.idlesecs != null)
                message.idlesecs = object.idlesecs >>> 0;
            if (object.strongCertificate != null)
                message.strongCertificate = Boolean(object.strongCertificate);
            if (object.opus != null)
                message.opus = Boolean(object.opus);
            if (object.rollingStats != null) {
                if (typeof object.rollingStats !== "object")
                    throw TypeError(".MumbleProto.UserStats.rollingStats: object expected");
                message.rollingStats = $root.MumbleProto.UserStats.RollingStats.fromObject(object.rollingStats);
            }
            return message;
        };

        /**
         * Creates a plain object from a UserStats message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.UserStats
         * @static
         * @param {MumbleProto.UserStats} message UserStats
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        UserStats.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object.certificates = [];
                object.celtVersions = [];
            }
            if (options.defaults) {
                object.session = 0;
                object.statsOnly = false;
                object.fromClient = null;
                object.fromServer = null;
                object.udpPackets = 0;
                object.tcpPackets = 0;
                object.udpPingAvg = 0;
                object.udpPingVar = 0;
                object.tcpPingAvg = 0;
                object.tcpPingVar = 0;
                object.version = null;
                if (options.bytes === String)
                    object.address = "";
                else {
                    object.address = [];
                    if (options.bytes !== Array)
                        object.address = $util.newBuffer(object.address);
                }
                object.bandwidth = 0;
                object.onlinesecs = 0;
                object.idlesecs = 0;
                object.strongCertificate = false;
                object.opus = false;
                object.rollingStats = null;
            }
            if (message.session != null && message.hasOwnProperty("session"))
                object.session = message.session;
            if (message.statsOnly != null && message.hasOwnProperty("statsOnly"))
                object.statsOnly = message.statsOnly;
            if (message.certificates && message.certificates.length) {
                object.certificates = [];
                for (var j = 0; j < message.certificates.length; ++j)
                    object.certificates[j] = options.bytes === String ? $util.base64.encode(message.certificates[j], 0, message.certificates[j].length) : options.bytes === Array ? Array.prototype.slice.call(message.certificates[j]) : message.certificates[j];
            }
            if (message.fromClient != null && message.hasOwnProperty("fromClient"))
                object.fromClient = $root.MumbleProto.UserStats.Stats.toObject(message.fromClient, options);
            if (message.fromServer != null && message.hasOwnProperty("fromServer"))
                object.fromServer = $root.MumbleProto.UserStats.Stats.toObject(message.fromServer, options);
            if (message.udpPackets != null && message.hasOwnProperty("udpPackets"))
                object.udpPackets = message.udpPackets;
            if (message.tcpPackets != null && message.hasOwnProperty("tcpPackets"))
                object.tcpPackets = message.tcpPackets;
            if (message.udpPingAvg != null && message.hasOwnProperty("udpPingAvg"))
                object.udpPingAvg = options.json && !isFinite(message.udpPingAvg) ? String(message.udpPingAvg) : message.udpPingAvg;
            if (message.udpPingVar != null && message.hasOwnProperty("udpPingVar"))
                object.udpPingVar = options.json && !isFinite(message.udpPingVar) ? String(message.udpPingVar) : message.udpPingVar;
            if (message.tcpPingAvg != null && message.hasOwnProperty("tcpPingAvg"))
                object.tcpPingAvg = options.json && !isFinite(message.tcpPingAvg) ? String(message.tcpPingAvg) : message.tcpPingAvg;
            if (message.tcpPingVar != null && message.hasOwnProperty("tcpPingVar"))
                object.tcpPingVar = options.json && !isFinite(message.tcpPingVar) ? String(message.tcpPingVar) : message.tcpPingVar;
            if (message.version != null && message.hasOwnProperty("version"))
                object.version = $root.MumbleProto.Version.toObject(message.version, options);
            if (message.celtVersions && message.celtVersions.length) {
                object.celtVersions = [];
                for (var j = 0; j < message.celtVersions.length; ++j)
                    object.celtVersions[j] = message.celtVersions[j];
            }
            if (message.address != null && message.hasOwnProperty("address"))
                object.address = options.bytes === String ? $util.base64.encode(message.address, 0, message.address.length) : options.bytes === Array ? Array.prototype.slice.call(message.address) : message.address;
            if (message.bandwidth != null && message.hasOwnProperty("bandwidth"))
                object.bandwidth = message.bandwidth;
            if (message.onlinesecs != null && message.hasOwnProperty("onlinesecs"))
                object.onlinesecs = message.onlinesecs;
            if (message.idlesecs != null && message.hasOwnProperty("idlesecs"))
                object.idlesecs = message.idlesecs;
            if (message.strongCertificate != null && message.hasOwnProperty("strongCertificate"))
                object.strongCertificate = message.strongCertificate;
            if (message.opus != null && message.hasOwnProperty("opus"))
                object.opus = message.opus;
            if (message.rollingStats != null && message.hasOwnProperty("rollingStats"))
                object.rollingStats = $root.MumbleProto.UserStats.RollingStats.toObject(message.rollingStats, options);
            return object;
        };

        /**
         * Converts this UserStats to JSON.
         * @function toJSON
         * @memberof MumbleProto.UserStats
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        UserStats.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for UserStats
         * @function getTypeUrl
         * @memberof MumbleProto.UserStats
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        UserStats.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.UserStats";
        };

        UserStats.Stats = (function() {

            /**
             * Properties of a Stats.
             * @memberof MumbleProto.UserStats
             * @interface IStats
             * @property {number|null} [good] Stats good
             * @property {number|null} [late] Stats late
             * @property {number|null} [lost] Stats lost
             * @property {number|null} [resync] Stats resync
             */

            /**
             * Constructs a new Stats.
             * @memberof MumbleProto.UserStats
             * @classdesc Represents a Stats.
             * @implements IStats
             * @constructor
             * @param {MumbleProto.UserStats.IStats=} [properties] Properties to set
             */
            function Stats(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * Stats good.
             * @member {number} good
             * @memberof MumbleProto.UserStats.Stats
             * @instance
             */
            Stats.prototype.good = 0;

            /**
             * Stats late.
             * @member {number} late
             * @memberof MumbleProto.UserStats.Stats
             * @instance
             */
            Stats.prototype.late = 0;

            /**
             * Stats lost.
             * @member {number} lost
             * @memberof MumbleProto.UserStats.Stats
             * @instance
             */
            Stats.prototype.lost = 0;

            /**
             * Stats resync.
             * @member {number} resync
             * @memberof MumbleProto.UserStats.Stats
             * @instance
             */
            Stats.prototype.resync = 0;

            /**
             * Creates a new Stats instance using the specified properties.
             * @function create
             * @memberof MumbleProto.UserStats.Stats
             * @static
             * @param {MumbleProto.UserStats.IStats=} [properties] Properties to set
             * @returns {MumbleProto.UserStats.Stats} Stats instance
             */
            Stats.create = function create(properties) {
                return new Stats(properties);
            };

            /**
             * Encodes the specified Stats message. Does not implicitly {@link MumbleProto.UserStats.Stats.verify|verify} messages.
             * @function encode
             * @memberof MumbleProto.UserStats.Stats
             * @static
             * @param {MumbleProto.UserStats.IStats} message Stats message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Stats.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.good != null && Object.hasOwnProperty.call(message, "good"))
                    writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.good);
                if (message.late != null && Object.hasOwnProperty.call(message, "late"))
                    writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.late);
                if (message.lost != null && Object.hasOwnProperty.call(message, "lost"))
                    writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.lost);
                if (message.resync != null && Object.hasOwnProperty.call(message, "resync"))
                    writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.resync);
                return writer;
            };

            /**
             * Encodes the specified Stats message, length delimited. Does not implicitly {@link MumbleProto.UserStats.Stats.verify|verify} messages.
             * @function encodeDelimited
             * @memberof MumbleProto.UserStats.Stats
             * @static
             * @param {MumbleProto.UserStats.IStats} message Stats message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Stats.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a Stats message from the specified reader or buffer.
             * @function decode
             * @memberof MumbleProto.UserStats.Stats
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {MumbleProto.UserStats.Stats} Stats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Stats.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.UserStats.Stats();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.good = reader.uint32();
                            break;
                        }
                    case 2: {
                            message.late = reader.uint32();
                            break;
                        }
                    case 3: {
                            message.lost = reader.uint32();
                            break;
                        }
                    case 4: {
                            message.resync = reader.uint32();
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
             * Decodes a Stats message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof MumbleProto.UserStats.Stats
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {MumbleProto.UserStats.Stats} Stats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Stats.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a Stats message.
             * @function verify
             * @memberof MumbleProto.UserStats.Stats
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Stats.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.good != null && message.hasOwnProperty("good"))
                    if (!$util.isInteger(message.good))
                        return "good: integer expected";
                if (message.late != null && message.hasOwnProperty("late"))
                    if (!$util.isInteger(message.late))
                        return "late: integer expected";
                if (message.lost != null && message.hasOwnProperty("lost"))
                    if (!$util.isInteger(message.lost))
                        return "lost: integer expected";
                if (message.resync != null && message.hasOwnProperty("resync"))
                    if (!$util.isInteger(message.resync))
                        return "resync: integer expected";
                return null;
            };

            /**
             * Creates a Stats message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof MumbleProto.UserStats.Stats
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {MumbleProto.UserStats.Stats} Stats
             */
            Stats.fromObject = function fromObject(object) {
                if (object instanceof $root.MumbleProto.UserStats.Stats)
                    return object;
                var message = new $root.MumbleProto.UserStats.Stats();
                if (object.good != null)
                    message.good = object.good >>> 0;
                if (object.late != null)
                    message.late = object.late >>> 0;
                if (object.lost != null)
                    message.lost = object.lost >>> 0;
                if (object.resync != null)
                    message.resync = object.resync >>> 0;
                return message;
            };

            /**
             * Creates a plain object from a Stats message. Also converts values to other types if specified.
             * @function toObject
             * @memberof MumbleProto.UserStats.Stats
             * @static
             * @param {MumbleProto.UserStats.Stats} message Stats
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Stats.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.good = 0;
                    object.late = 0;
                    object.lost = 0;
                    object.resync = 0;
                }
                if (message.good != null && message.hasOwnProperty("good"))
                    object.good = message.good;
                if (message.late != null && message.hasOwnProperty("late"))
                    object.late = message.late;
                if (message.lost != null && message.hasOwnProperty("lost"))
                    object.lost = message.lost;
                if (message.resync != null && message.hasOwnProperty("resync"))
                    object.resync = message.resync;
                return object;
            };

            /**
             * Converts this Stats to JSON.
             * @function toJSON
             * @memberof MumbleProto.UserStats.Stats
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Stats.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Stats
             * @function getTypeUrl
             * @memberof MumbleProto.UserStats.Stats
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Stats.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/MumbleProto.UserStats.Stats";
            };

            return Stats;
        })();

        UserStats.RollingStats = (function() {

            /**
             * Properties of a RollingStats.
             * @memberof MumbleProto.UserStats
             * @interface IRollingStats
             * @property {number|null} [timeWindow] RollingStats timeWindow
             * @property {MumbleProto.UserStats.IStats|null} [fromClient] RollingStats fromClient
             * @property {MumbleProto.UserStats.IStats|null} [fromServer] RollingStats fromServer
             */

            /**
             * Constructs a new RollingStats.
             * @memberof MumbleProto.UserStats
             * @classdesc Represents a RollingStats.
             * @implements IRollingStats
             * @constructor
             * @param {MumbleProto.UserStats.IRollingStats=} [properties] Properties to set
             */
            function RollingStats(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * RollingStats timeWindow.
             * @member {number} timeWindow
             * @memberof MumbleProto.UserStats.RollingStats
             * @instance
             */
            RollingStats.prototype.timeWindow = 0;

            /**
             * RollingStats fromClient.
             * @member {MumbleProto.UserStats.IStats|null|undefined} fromClient
             * @memberof MumbleProto.UserStats.RollingStats
             * @instance
             */
            RollingStats.prototype.fromClient = null;

            /**
             * RollingStats fromServer.
             * @member {MumbleProto.UserStats.IStats|null|undefined} fromServer
             * @memberof MumbleProto.UserStats.RollingStats
             * @instance
             */
            RollingStats.prototype.fromServer = null;

            /**
             * Creates a new RollingStats instance using the specified properties.
             * @function create
             * @memberof MumbleProto.UserStats.RollingStats
             * @static
             * @param {MumbleProto.UserStats.IRollingStats=} [properties] Properties to set
             * @returns {MumbleProto.UserStats.RollingStats} RollingStats instance
             */
            RollingStats.create = function create(properties) {
                return new RollingStats(properties);
            };

            /**
             * Encodes the specified RollingStats message. Does not implicitly {@link MumbleProto.UserStats.RollingStats.verify|verify} messages.
             * @function encode
             * @memberof MumbleProto.UserStats.RollingStats
             * @static
             * @param {MumbleProto.UserStats.IRollingStats} message RollingStats message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            RollingStats.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.timeWindow != null && Object.hasOwnProperty.call(message, "timeWindow"))
                    writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.timeWindow);
                if (message.fromClient != null && Object.hasOwnProperty.call(message, "fromClient"))
                    $root.MumbleProto.UserStats.Stats.encode(message.fromClient, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                if (message.fromServer != null && Object.hasOwnProperty.call(message, "fromServer"))
                    $root.MumbleProto.UserStats.Stats.encode(message.fromServer, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                return writer;
            };

            /**
             * Encodes the specified RollingStats message, length delimited. Does not implicitly {@link MumbleProto.UserStats.RollingStats.verify|verify} messages.
             * @function encodeDelimited
             * @memberof MumbleProto.UserStats.RollingStats
             * @static
             * @param {MumbleProto.UserStats.IRollingStats} message RollingStats message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            RollingStats.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a RollingStats message from the specified reader or buffer.
             * @function decode
             * @memberof MumbleProto.UserStats.RollingStats
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {MumbleProto.UserStats.RollingStats} RollingStats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            RollingStats.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.UserStats.RollingStats();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.timeWindow = reader.uint32();
                            break;
                        }
                    case 2: {
                            message.fromClient = $root.MumbleProto.UserStats.Stats.decode(reader, reader.uint32());
                            break;
                        }
                    case 3: {
                            message.fromServer = $root.MumbleProto.UserStats.Stats.decode(reader, reader.uint32());
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
             * Decodes a RollingStats message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof MumbleProto.UserStats.RollingStats
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {MumbleProto.UserStats.RollingStats} RollingStats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            RollingStats.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a RollingStats message.
             * @function verify
             * @memberof MumbleProto.UserStats.RollingStats
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            RollingStats.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.timeWindow != null && message.hasOwnProperty("timeWindow"))
                    if (!$util.isInteger(message.timeWindow))
                        return "timeWindow: integer expected";
                if (message.fromClient != null && message.hasOwnProperty("fromClient")) {
                    var error = $root.MumbleProto.UserStats.Stats.verify(message.fromClient);
                    if (error)
                        return "fromClient." + error;
                }
                if (message.fromServer != null && message.hasOwnProperty("fromServer")) {
                    var error = $root.MumbleProto.UserStats.Stats.verify(message.fromServer);
                    if (error)
                        return "fromServer." + error;
                }
                return null;
            };

            /**
             * Creates a RollingStats message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof MumbleProto.UserStats.RollingStats
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {MumbleProto.UserStats.RollingStats} RollingStats
             */
            RollingStats.fromObject = function fromObject(object) {
                if (object instanceof $root.MumbleProto.UserStats.RollingStats)
                    return object;
                var message = new $root.MumbleProto.UserStats.RollingStats();
                if (object.timeWindow != null)
                    message.timeWindow = object.timeWindow >>> 0;
                if (object.fromClient != null) {
                    if (typeof object.fromClient !== "object")
                        throw TypeError(".MumbleProto.UserStats.RollingStats.fromClient: object expected");
                    message.fromClient = $root.MumbleProto.UserStats.Stats.fromObject(object.fromClient);
                }
                if (object.fromServer != null) {
                    if (typeof object.fromServer !== "object")
                        throw TypeError(".MumbleProto.UserStats.RollingStats.fromServer: object expected");
                    message.fromServer = $root.MumbleProto.UserStats.Stats.fromObject(object.fromServer);
                }
                return message;
            };

            /**
             * Creates a plain object from a RollingStats message. Also converts values to other types if specified.
             * @function toObject
             * @memberof MumbleProto.UserStats.RollingStats
             * @static
             * @param {MumbleProto.UserStats.RollingStats} message RollingStats
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            RollingStats.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.timeWindow = 0;
                    object.fromClient = null;
                    object.fromServer = null;
                }
                if (message.timeWindow != null && message.hasOwnProperty("timeWindow"))
                    object.timeWindow = message.timeWindow;
                if (message.fromClient != null && message.hasOwnProperty("fromClient"))
                    object.fromClient = $root.MumbleProto.UserStats.Stats.toObject(message.fromClient, options);
                if (message.fromServer != null && message.hasOwnProperty("fromServer"))
                    object.fromServer = $root.MumbleProto.UserStats.Stats.toObject(message.fromServer, options);
                return object;
            };

            /**
             * Converts this RollingStats to JSON.
             * @function toJSON
             * @memberof MumbleProto.UserStats.RollingStats
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            RollingStats.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for RollingStats
             * @function getTypeUrl
             * @memberof MumbleProto.UserStats.RollingStats
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            RollingStats.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/MumbleProto.UserStats.RollingStats";
            };

            return RollingStats;
        })();

        return UserStats;
    })();

    MumbleProto.RequestBlob = (function() {

        /**
         * Properties of a RequestBlob.
         * @memberof MumbleProto
         * @interface IRequestBlob
         * @property {Array.<number>|null} [sessionTexture] RequestBlob sessionTexture
         * @property {Array.<number>|null} [sessionComment] RequestBlob sessionComment
         * @property {Array.<number>|null} [channelDescription] RequestBlob channelDescription
         */

        /**
         * Constructs a new RequestBlob.
         * @memberof MumbleProto
         * @classdesc Represents a RequestBlob.
         * @implements IRequestBlob
         * @constructor
         * @param {MumbleProto.IRequestBlob=} [properties] Properties to set
         */
        function RequestBlob(properties) {
            this.sessionTexture = [];
            this.sessionComment = [];
            this.channelDescription = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * RequestBlob sessionTexture.
         * @member {Array.<number>} sessionTexture
         * @memberof MumbleProto.RequestBlob
         * @instance
         */
        RequestBlob.prototype.sessionTexture = $util.emptyArray;

        /**
         * RequestBlob sessionComment.
         * @member {Array.<number>} sessionComment
         * @memberof MumbleProto.RequestBlob
         * @instance
         */
        RequestBlob.prototype.sessionComment = $util.emptyArray;

        /**
         * RequestBlob channelDescription.
         * @member {Array.<number>} channelDescription
         * @memberof MumbleProto.RequestBlob
         * @instance
         */
        RequestBlob.prototype.channelDescription = $util.emptyArray;

        /**
         * Creates a new RequestBlob instance using the specified properties.
         * @function create
         * @memberof MumbleProto.RequestBlob
         * @static
         * @param {MumbleProto.IRequestBlob=} [properties] Properties to set
         * @returns {MumbleProto.RequestBlob} RequestBlob instance
         */
        RequestBlob.create = function create(properties) {
            return new RequestBlob(properties);
        };

        /**
         * Encodes the specified RequestBlob message. Does not implicitly {@link MumbleProto.RequestBlob.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.RequestBlob
         * @static
         * @param {MumbleProto.IRequestBlob} message RequestBlob message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        RequestBlob.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.sessionTexture != null && message.sessionTexture.length)
                for (var i = 0; i < message.sessionTexture.length; ++i)
                    writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.sessionTexture[i]);
            if (message.sessionComment != null && message.sessionComment.length)
                for (var i = 0; i < message.sessionComment.length; ++i)
                    writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.sessionComment[i]);
            if (message.channelDescription != null && message.channelDescription.length)
                for (var i = 0; i < message.channelDescription.length; ++i)
                    writer.uint32(/* id 3, wireType 0 =*/24).uint32(message.channelDescription[i]);
            return writer;
        };

        /**
         * Encodes the specified RequestBlob message, length delimited. Does not implicitly {@link MumbleProto.RequestBlob.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.RequestBlob
         * @static
         * @param {MumbleProto.IRequestBlob} message RequestBlob message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        RequestBlob.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a RequestBlob message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.RequestBlob
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.RequestBlob} RequestBlob
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        RequestBlob.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.RequestBlob();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.sessionTexture && message.sessionTexture.length))
                            message.sessionTexture = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.sessionTexture.push(reader.uint32());
                        } else
                            message.sessionTexture.push(reader.uint32());
                        break;
                    }
                case 2: {
                        if (!(message.sessionComment && message.sessionComment.length))
                            message.sessionComment = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.sessionComment.push(reader.uint32());
                        } else
                            message.sessionComment.push(reader.uint32());
                        break;
                    }
                case 3: {
                        if (!(message.channelDescription && message.channelDescription.length))
                            message.channelDescription = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.channelDescription.push(reader.uint32());
                        } else
                            message.channelDescription.push(reader.uint32());
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
         * Decodes a RequestBlob message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.RequestBlob
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.RequestBlob} RequestBlob
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        RequestBlob.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a RequestBlob message.
         * @function verify
         * @memberof MumbleProto.RequestBlob
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        RequestBlob.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.sessionTexture != null && message.hasOwnProperty("sessionTexture")) {
                if (!Array.isArray(message.sessionTexture))
                    return "sessionTexture: array expected";
                for (var i = 0; i < message.sessionTexture.length; ++i)
                    if (!$util.isInteger(message.sessionTexture[i]))
                        return "sessionTexture: integer[] expected";
            }
            if (message.sessionComment != null && message.hasOwnProperty("sessionComment")) {
                if (!Array.isArray(message.sessionComment))
                    return "sessionComment: array expected";
                for (var i = 0; i < message.sessionComment.length; ++i)
                    if (!$util.isInteger(message.sessionComment[i]))
                        return "sessionComment: integer[] expected";
            }
            if (message.channelDescription != null && message.hasOwnProperty("channelDescription")) {
                if (!Array.isArray(message.channelDescription))
                    return "channelDescription: array expected";
                for (var i = 0; i < message.channelDescription.length; ++i)
                    if (!$util.isInteger(message.channelDescription[i]))
                        return "channelDescription: integer[] expected";
            }
            return null;
        };

        /**
         * Creates a RequestBlob message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.RequestBlob
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.RequestBlob} RequestBlob
         */
        RequestBlob.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.RequestBlob)
                return object;
            var message = new $root.MumbleProto.RequestBlob();
            if (object.sessionTexture) {
                if (!Array.isArray(object.sessionTexture))
                    throw TypeError(".MumbleProto.RequestBlob.sessionTexture: array expected");
                message.sessionTexture = [];
                for (var i = 0; i < object.sessionTexture.length; ++i)
                    message.sessionTexture[i] = object.sessionTexture[i] >>> 0;
            }
            if (object.sessionComment) {
                if (!Array.isArray(object.sessionComment))
                    throw TypeError(".MumbleProto.RequestBlob.sessionComment: array expected");
                message.sessionComment = [];
                for (var i = 0; i < object.sessionComment.length; ++i)
                    message.sessionComment[i] = object.sessionComment[i] >>> 0;
            }
            if (object.channelDescription) {
                if (!Array.isArray(object.channelDescription))
                    throw TypeError(".MumbleProto.RequestBlob.channelDescription: array expected");
                message.channelDescription = [];
                for (var i = 0; i < object.channelDescription.length; ++i)
                    message.channelDescription[i] = object.channelDescription[i] >>> 0;
            }
            return message;
        };

        /**
         * Creates a plain object from a RequestBlob message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.RequestBlob
         * @static
         * @param {MumbleProto.RequestBlob} message RequestBlob
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        RequestBlob.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object.sessionTexture = [];
                object.sessionComment = [];
                object.channelDescription = [];
            }
            if (message.sessionTexture && message.sessionTexture.length) {
                object.sessionTexture = [];
                for (var j = 0; j < message.sessionTexture.length; ++j)
                    object.sessionTexture[j] = message.sessionTexture[j];
            }
            if (message.sessionComment && message.sessionComment.length) {
                object.sessionComment = [];
                for (var j = 0; j < message.sessionComment.length; ++j)
                    object.sessionComment[j] = message.sessionComment[j];
            }
            if (message.channelDescription && message.channelDescription.length) {
                object.channelDescription = [];
                for (var j = 0; j < message.channelDescription.length; ++j)
                    object.channelDescription[j] = message.channelDescription[j];
            }
            return object;
        };

        /**
         * Converts this RequestBlob to JSON.
         * @function toJSON
         * @memberof MumbleProto.RequestBlob
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        RequestBlob.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for RequestBlob
         * @function getTypeUrl
         * @memberof MumbleProto.RequestBlob
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        RequestBlob.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.RequestBlob";
        };

        return RequestBlob;
    })();

    MumbleProto.ServerConfig = (function() {

        /**
         * Properties of a ServerConfig.
         * @memberof MumbleProto
         * @interface IServerConfig
         * @property {number|null} [maxBandwidth] ServerConfig maxBandwidth
         * @property {string|null} [welcomeText] ServerConfig welcomeText
         * @property {boolean|null} [allowHtml] ServerConfig allowHtml
         * @property {number|null} [messageLength] ServerConfig messageLength
         * @property {number|null} [imageMessageLength] ServerConfig imageMessageLength
         * @property {number|null} [maxUsers] ServerConfig maxUsers
         * @property {boolean|null} [recordingAllowed] ServerConfig recordingAllowed
         */

        /**
         * Constructs a new ServerConfig.
         * @memberof MumbleProto
         * @classdesc Represents a ServerConfig.
         * @implements IServerConfig
         * @constructor
         * @param {MumbleProto.IServerConfig=} [properties] Properties to set
         */
        function ServerConfig(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ServerConfig maxBandwidth.
         * @member {number} maxBandwidth
         * @memberof MumbleProto.ServerConfig
         * @instance
         */
        ServerConfig.prototype.maxBandwidth = 0;

        /**
         * ServerConfig welcomeText.
         * @member {string} welcomeText
         * @memberof MumbleProto.ServerConfig
         * @instance
         */
        ServerConfig.prototype.welcomeText = "";

        /**
         * ServerConfig allowHtml.
         * @member {boolean} allowHtml
         * @memberof MumbleProto.ServerConfig
         * @instance
         */
        ServerConfig.prototype.allowHtml = false;

        /**
         * ServerConfig messageLength.
         * @member {number} messageLength
         * @memberof MumbleProto.ServerConfig
         * @instance
         */
        ServerConfig.prototype.messageLength = 0;

        /**
         * ServerConfig imageMessageLength.
         * @member {number} imageMessageLength
         * @memberof MumbleProto.ServerConfig
         * @instance
         */
        ServerConfig.prototype.imageMessageLength = 0;

        /**
         * ServerConfig maxUsers.
         * @member {number} maxUsers
         * @memberof MumbleProto.ServerConfig
         * @instance
         */
        ServerConfig.prototype.maxUsers = 0;

        /**
         * ServerConfig recordingAllowed.
         * @member {boolean} recordingAllowed
         * @memberof MumbleProto.ServerConfig
         * @instance
         */
        ServerConfig.prototype.recordingAllowed = false;

        /**
         * Creates a new ServerConfig instance using the specified properties.
         * @function create
         * @memberof MumbleProto.ServerConfig
         * @static
         * @param {MumbleProto.IServerConfig=} [properties] Properties to set
         * @returns {MumbleProto.ServerConfig} ServerConfig instance
         */
        ServerConfig.create = function create(properties) {
            return new ServerConfig(properties);
        };

        /**
         * Encodes the specified ServerConfig message. Does not implicitly {@link MumbleProto.ServerConfig.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.ServerConfig
         * @static
         * @param {MumbleProto.IServerConfig} message ServerConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerConfig.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.maxBandwidth != null && Object.hasOwnProperty.call(message, "maxBandwidth"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.maxBandwidth);
            if (message.welcomeText != null && Object.hasOwnProperty.call(message, "welcomeText"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.welcomeText);
            if (message.allowHtml != null && Object.hasOwnProperty.call(message, "allowHtml"))
                writer.uint32(/* id 3, wireType 0 =*/24).bool(message.allowHtml);
            if (message.messageLength != null && Object.hasOwnProperty.call(message, "messageLength"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.messageLength);
            if (message.imageMessageLength != null && Object.hasOwnProperty.call(message, "imageMessageLength"))
                writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.imageMessageLength);
            if (message.maxUsers != null && Object.hasOwnProperty.call(message, "maxUsers"))
                writer.uint32(/* id 6, wireType 0 =*/48).uint32(message.maxUsers);
            if (message.recordingAllowed != null && Object.hasOwnProperty.call(message, "recordingAllowed"))
                writer.uint32(/* id 7, wireType 0 =*/56).bool(message.recordingAllowed);
            return writer;
        };

        /**
         * Encodes the specified ServerConfig message, length delimited. Does not implicitly {@link MumbleProto.ServerConfig.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.ServerConfig
         * @static
         * @param {MumbleProto.IServerConfig} message ServerConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ServerConfig.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ServerConfig message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.ServerConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.ServerConfig} ServerConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerConfig.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.ServerConfig();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.maxBandwidth = reader.uint32();
                        break;
                    }
                case 2: {
                        message.welcomeText = reader.string();
                        break;
                    }
                case 3: {
                        message.allowHtml = reader.bool();
                        break;
                    }
                case 4: {
                        message.messageLength = reader.uint32();
                        break;
                    }
                case 5: {
                        message.imageMessageLength = reader.uint32();
                        break;
                    }
                case 6: {
                        message.maxUsers = reader.uint32();
                        break;
                    }
                case 7: {
                        message.recordingAllowed = reader.bool();
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
         * Decodes a ServerConfig message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.ServerConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.ServerConfig} ServerConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ServerConfig.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ServerConfig message.
         * @function verify
         * @memberof MumbleProto.ServerConfig
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ServerConfig.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.maxBandwidth != null && message.hasOwnProperty("maxBandwidth"))
                if (!$util.isInteger(message.maxBandwidth))
                    return "maxBandwidth: integer expected";
            if (message.welcomeText != null && message.hasOwnProperty("welcomeText"))
                if (!$util.isString(message.welcomeText))
                    return "welcomeText: string expected";
            if (message.allowHtml != null && message.hasOwnProperty("allowHtml"))
                if (typeof message.allowHtml !== "boolean")
                    return "allowHtml: boolean expected";
            if (message.messageLength != null && message.hasOwnProperty("messageLength"))
                if (!$util.isInteger(message.messageLength))
                    return "messageLength: integer expected";
            if (message.imageMessageLength != null && message.hasOwnProperty("imageMessageLength"))
                if (!$util.isInteger(message.imageMessageLength))
                    return "imageMessageLength: integer expected";
            if (message.maxUsers != null && message.hasOwnProperty("maxUsers"))
                if (!$util.isInteger(message.maxUsers))
                    return "maxUsers: integer expected";
            if (message.recordingAllowed != null && message.hasOwnProperty("recordingAllowed"))
                if (typeof message.recordingAllowed !== "boolean")
                    return "recordingAllowed: boolean expected";
            return null;
        };

        /**
         * Creates a ServerConfig message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.ServerConfig
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.ServerConfig} ServerConfig
         */
        ServerConfig.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.ServerConfig)
                return object;
            var message = new $root.MumbleProto.ServerConfig();
            if (object.maxBandwidth != null)
                message.maxBandwidth = object.maxBandwidth >>> 0;
            if (object.welcomeText != null)
                message.welcomeText = String(object.welcomeText);
            if (object.allowHtml != null)
                message.allowHtml = Boolean(object.allowHtml);
            if (object.messageLength != null)
                message.messageLength = object.messageLength >>> 0;
            if (object.imageMessageLength != null)
                message.imageMessageLength = object.imageMessageLength >>> 0;
            if (object.maxUsers != null)
                message.maxUsers = object.maxUsers >>> 0;
            if (object.recordingAllowed != null)
                message.recordingAllowed = Boolean(object.recordingAllowed);
            return message;
        };

        /**
         * Creates a plain object from a ServerConfig message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.ServerConfig
         * @static
         * @param {MumbleProto.ServerConfig} message ServerConfig
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ServerConfig.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.maxBandwidth = 0;
                object.welcomeText = "";
                object.allowHtml = false;
                object.messageLength = 0;
                object.imageMessageLength = 0;
                object.maxUsers = 0;
                object.recordingAllowed = false;
            }
            if (message.maxBandwidth != null && message.hasOwnProperty("maxBandwidth"))
                object.maxBandwidth = message.maxBandwidth;
            if (message.welcomeText != null && message.hasOwnProperty("welcomeText"))
                object.welcomeText = message.welcomeText;
            if (message.allowHtml != null && message.hasOwnProperty("allowHtml"))
                object.allowHtml = message.allowHtml;
            if (message.messageLength != null && message.hasOwnProperty("messageLength"))
                object.messageLength = message.messageLength;
            if (message.imageMessageLength != null && message.hasOwnProperty("imageMessageLength"))
                object.imageMessageLength = message.imageMessageLength;
            if (message.maxUsers != null && message.hasOwnProperty("maxUsers"))
                object.maxUsers = message.maxUsers;
            if (message.recordingAllowed != null && message.hasOwnProperty("recordingAllowed"))
                object.recordingAllowed = message.recordingAllowed;
            return object;
        };

        /**
         * Converts this ServerConfig to JSON.
         * @function toJSON
         * @memberof MumbleProto.ServerConfig
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ServerConfig.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ServerConfig
         * @function getTypeUrl
         * @memberof MumbleProto.ServerConfig
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ServerConfig.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.ServerConfig";
        };

        return ServerConfig;
    })();

    MumbleProto.SuggestConfig = (function() {

        /**
         * Properties of a SuggestConfig.
         * @memberof MumbleProto
         * @interface ISuggestConfig
         * @property {number|null} [versionV1] SuggestConfig versionV1
         * @property {number|Long|null} [versionV2] SuggestConfig versionV2
         * @property {boolean|null} [positional] SuggestConfig positional
         * @property {boolean|null} [pushToTalk] SuggestConfig pushToTalk
         */

        /**
         * Constructs a new SuggestConfig.
         * @memberof MumbleProto
         * @classdesc Represents a SuggestConfig.
         * @implements ISuggestConfig
         * @constructor
         * @param {MumbleProto.ISuggestConfig=} [properties] Properties to set
         */
        function SuggestConfig(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SuggestConfig versionV1.
         * @member {number} versionV1
         * @memberof MumbleProto.SuggestConfig
         * @instance
         */
        SuggestConfig.prototype.versionV1 = 0;

        /**
         * SuggestConfig versionV2.
         * @member {number|Long} versionV2
         * @memberof MumbleProto.SuggestConfig
         * @instance
         */
        SuggestConfig.prototype.versionV2 = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * SuggestConfig positional.
         * @member {boolean} positional
         * @memberof MumbleProto.SuggestConfig
         * @instance
         */
        SuggestConfig.prototype.positional = false;

        /**
         * SuggestConfig pushToTalk.
         * @member {boolean} pushToTalk
         * @memberof MumbleProto.SuggestConfig
         * @instance
         */
        SuggestConfig.prototype.pushToTalk = false;

        /**
         * Creates a new SuggestConfig instance using the specified properties.
         * @function create
         * @memberof MumbleProto.SuggestConfig
         * @static
         * @param {MumbleProto.ISuggestConfig=} [properties] Properties to set
         * @returns {MumbleProto.SuggestConfig} SuggestConfig instance
         */
        SuggestConfig.create = function create(properties) {
            return new SuggestConfig(properties);
        };

        /**
         * Encodes the specified SuggestConfig message. Does not implicitly {@link MumbleProto.SuggestConfig.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.SuggestConfig
         * @static
         * @param {MumbleProto.ISuggestConfig} message SuggestConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SuggestConfig.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.versionV1 != null && Object.hasOwnProperty.call(message, "versionV1"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.versionV1);
            if (message.positional != null && Object.hasOwnProperty.call(message, "positional"))
                writer.uint32(/* id 2, wireType 0 =*/16).bool(message.positional);
            if (message.pushToTalk != null && Object.hasOwnProperty.call(message, "pushToTalk"))
                writer.uint32(/* id 3, wireType 0 =*/24).bool(message.pushToTalk);
            if (message.versionV2 != null && Object.hasOwnProperty.call(message, "versionV2"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint64(message.versionV2);
            return writer;
        };

        /**
         * Encodes the specified SuggestConfig message, length delimited. Does not implicitly {@link MumbleProto.SuggestConfig.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.SuggestConfig
         * @static
         * @param {MumbleProto.ISuggestConfig} message SuggestConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SuggestConfig.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a SuggestConfig message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.SuggestConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.SuggestConfig} SuggestConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SuggestConfig.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.SuggestConfig();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.versionV1 = reader.uint32();
                        break;
                    }
                case 4: {
                        message.versionV2 = reader.uint64();
                        break;
                    }
                case 2: {
                        message.positional = reader.bool();
                        break;
                    }
                case 3: {
                        message.pushToTalk = reader.bool();
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
         * Decodes a SuggestConfig message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.SuggestConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.SuggestConfig} SuggestConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SuggestConfig.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a SuggestConfig message.
         * @function verify
         * @memberof MumbleProto.SuggestConfig
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SuggestConfig.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.versionV1 != null && message.hasOwnProperty("versionV1"))
                if (!$util.isInteger(message.versionV1))
                    return "versionV1: integer expected";
            if (message.versionV2 != null && message.hasOwnProperty("versionV2"))
                if (!$util.isInteger(message.versionV2) && !(message.versionV2 && $util.isInteger(message.versionV2.low) && $util.isInteger(message.versionV2.high)))
                    return "versionV2: integer|Long expected";
            if (message.positional != null && message.hasOwnProperty("positional"))
                if (typeof message.positional !== "boolean")
                    return "positional: boolean expected";
            if (message.pushToTalk != null && message.hasOwnProperty("pushToTalk"))
                if (typeof message.pushToTalk !== "boolean")
                    return "pushToTalk: boolean expected";
            return null;
        };

        /**
         * Creates a SuggestConfig message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.SuggestConfig
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.SuggestConfig} SuggestConfig
         */
        SuggestConfig.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.SuggestConfig)
                return object;
            var message = new $root.MumbleProto.SuggestConfig();
            if (object.versionV1 != null)
                message.versionV1 = object.versionV1 >>> 0;
            if (object.versionV2 != null)
                if ($util.Long)
                    (message.versionV2 = $util.Long.fromValue(object.versionV2)).unsigned = true;
                else if (typeof object.versionV2 === "string")
                    message.versionV2 = parseInt(object.versionV2, 10);
                else if (typeof object.versionV2 === "number")
                    message.versionV2 = object.versionV2;
                else if (typeof object.versionV2 === "object")
                    message.versionV2 = new $util.LongBits(object.versionV2.low >>> 0, object.versionV2.high >>> 0).toNumber(true);
            if (object.positional != null)
                message.positional = Boolean(object.positional);
            if (object.pushToTalk != null)
                message.pushToTalk = Boolean(object.pushToTalk);
            return message;
        };

        /**
         * Creates a plain object from a SuggestConfig message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.SuggestConfig
         * @static
         * @param {MumbleProto.SuggestConfig} message SuggestConfig
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SuggestConfig.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.versionV1 = 0;
                object.positional = false;
                object.pushToTalk = false;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.versionV2 = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.versionV2 = options.longs === String ? "0" : 0;
            }
            if (message.versionV1 != null && message.hasOwnProperty("versionV1"))
                object.versionV1 = message.versionV1;
            if (message.positional != null && message.hasOwnProperty("positional"))
                object.positional = message.positional;
            if (message.pushToTalk != null && message.hasOwnProperty("pushToTalk"))
                object.pushToTalk = message.pushToTalk;
            if (message.versionV2 != null && message.hasOwnProperty("versionV2"))
                if (typeof message.versionV2 === "number")
                    object.versionV2 = options.longs === String ? String(message.versionV2) : message.versionV2;
                else
                    object.versionV2 = options.longs === String ? $util.Long.prototype.toString.call(message.versionV2) : options.longs === Number ? new $util.LongBits(message.versionV2.low >>> 0, message.versionV2.high >>> 0).toNumber(true) : message.versionV2;
            return object;
        };

        /**
         * Converts this SuggestConfig to JSON.
         * @function toJSON
         * @memberof MumbleProto.SuggestConfig
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SuggestConfig.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SuggestConfig
         * @function getTypeUrl
         * @memberof MumbleProto.SuggestConfig
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SuggestConfig.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.SuggestConfig";
        };

        return SuggestConfig;
    })();

    MumbleProto.PluginDataTransmission = (function() {

        /**
         * Properties of a PluginDataTransmission.
         * @memberof MumbleProto
         * @interface IPluginDataTransmission
         * @property {number|null} [senderSession] PluginDataTransmission senderSession
         * @property {Array.<number>|null} [receiverSessions] PluginDataTransmission receiverSessions
         * @property {Uint8Array|null} [data] PluginDataTransmission data
         * @property {string|null} [dataID] PluginDataTransmission dataID
         */

        /**
         * Constructs a new PluginDataTransmission.
         * @memberof MumbleProto
         * @classdesc Represents a PluginDataTransmission.
         * @implements IPluginDataTransmission
         * @constructor
         * @param {MumbleProto.IPluginDataTransmission=} [properties] Properties to set
         */
        function PluginDataTransmission(properties) {
            this.receiverSessions = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PluginDataTransmission senderSession.
         * @member {number} senderSession
         * @memberof MumbleProto.PluginDataTransmission
         * @instance
         */
        PluginDataTransmission.prototype.senderSession = 0;

        /**
         * PluginDataTransmission receiverSessions.
         * @member {Array.<number>} receiverSessions
         * @memberof MumbleProto.PluginDataTransmission
         * @instance
         */
        PluginDataTransmission.prototype.receiverSessions = $util.emptyArray;

        /**
         * PluginDataTransmission data.
         * @member {Uint8Array} data
         * @memberof MumbleProto.PluginDataTransmission
         * @instance
         */
        PluginDataTransmission.prototype.data = $util.newBuffer([]);

        /**
         * PluginDataTransmission dataID.
         * @member {string} dataID
         * @memberof MumbleProto.PluginDataTransmission
         * @instance
         */
        PluginDataTransmission.prototype.dataID = "";

        /**
         * Creates a new PluginDataTransmission instance using the specified properties.
         * @function create
         * @memberof MumbleProto.PluginDataTransmission
         * @static
         * @param {MumbleProto.IPluginDataTransmission=} [properties] Properties to set
         * @returns {MumbleProto.PluginDataTransmission} PluginDataTransmission instance
         */
        PluginDataTransmission.create = function create(properties) {
            return new PluginDataTransmission(properties);
        };

        /**
         * Encodes the specified PluginDataTransmission message. Does not implicitly {@link MumbleProto.PluginDataTransmission.verify|verify} messages.
         * @function encode
         * @memberof MumbleProto.PluginDataTransmission
         * @static
         * @param {MumbleProto.IPluginDataTransmission} message PluginDataTransmission message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PluginDataTransmission.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.senderSession != null && Object.hasOwnProperty.call(message, "senderSession"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.senderSession);
            if (message.receiverSessions != null && message.receiverSessions.length) {
                writer.uint32(/* id 2, wireType 2 =*/18).fork();
                for (var i = 0; i < message.receiverSessions.length; ++i)
                    writer.uint32(message.receiverSessions[i]);
                writer.ldelim();
            }
            if (message.data != null && Object.hasOwnProperty.call(message, "data"))
                writer.uint32(/* id 3, wireType 2 =*/26).bytes(message.data);
            if (message.dataID != null && Object.hasOwnProperty.call(message, "dataID"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.dataID);
            return writer;
        };

        /**
         * Encodes the specified PluginDataTransmission message, length delimited. Does not implicitly {@link MumbleProto.PluginDataTransmission.verify|verify} messages.
         * @function encodeDelimited
         * @memberof MumbleProto.PluginDataTransmission
         * @static
         * @param {MumbleProto.IPluginDataTransmission} message PluginDataTransmission message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PluginDataTransmission.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PluginDataTransmission message from the specified reader or buffer.
         * @function decode
         * @memberof MumbleProto.PluginDataTransmission
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {MumbleProto.PluginDataTransmission} PluginDataTransmission
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PluginDataTransmission.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.MumbleProto.PluginDataTransmission();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.senderSession = reader.uint32();
                        break;
                    }
                case 2: {
                        if (!(message.receiverSessions && message.receiverSessions.length))
                            message.receiverSessions = [];
                        if ((tag & 7) === 2) {
                            var end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.receiverSessions.push(reader.uint32());
                        } else
                            message.receiverSessions.push(reader.uint32());
                        break;
                    }
                case 3: {
                        message.data = reader.bytes();
                        break;
                    }
                case 4: {
                        message.dataID = reader.string();
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
         * Decodes a PluginDataTransmission message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof MumbleProto.PluginDataTransmission
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {MumbleProto.PluginDataTransmission} PluginDataTransmission
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PluginDataTransmission.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PluginDataTransmission message.
         * @function verify
         * @memberof MumbleProto.PluginDataTransmission
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PluginDataTransmission.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.senderSession != null && message.hasOwnProperty("senderSession"))
                if (!$util.isInteger(message.senderSession))
                    return "senderSession: integer expected";
            if (message.receiverSessions != null && message.hasOwnProperty("receiverSessions")) {
                if (!Array.isArray(message.receiverSessions))
                    return "receiverSessions: array expected";
                for (var i = 0; i < message.receiverSessions.length; ++i)
                    if (!$util.isInteger(message.receiverSessions[i]))
                        return "receiverSessions: integer[] expected";
            }
            if (message.data != null && message.hasOwnProperty("data"))
                if (!(message.data && typeof message.data.length === "number" || $util.isString(message.data)))
                    return "data: buffer expected";
            if (message.dataID != null && message.hasOwnProperty("dataID"))
                if (!$util.isString(message.dataID))
                    return "dataID: string expected";
            return null;
        };

        /**
         * Creates a PluginDataTransmission message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof MumbleProto.PluginDataTransmission
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {MumbleProto.PluginDataTransmission} PluginDataTransmission
         */
        PluginDataTransmission.fromObject = function fromObject(object) {
            if (object instanceof $root.MumbleProto.PluginDataTransmission)
                return object;
            var message = new $root.MumbleProto.PluginDataTransmission();
            if (object.senderSession != null)
                message.senderSession = object.senderSession >>> 0;
            if (object.receiverSessions) {
                if (!Array.isArray(object.receiverSessions))
                    throw TypeError(".MumbleProto.PluginDataTransmission.receiverSessions: array expected");
                message.receiverSessions = [];
                for (var i = 0; i < object.receiverSessions.length; ++i)
                    message.receiverSessions[i] = object.receiverSessions[i] >>> 0;
            }
            if (object.data != null)
                if (typeof object.data === "string")
                    $util.base64.decode(object.data, message.data = $util.newBuffer($util.base64.length(object.data)), 0);
                else if (object.data.length >= 0)
                    message.data = object.data;
            if (object.dataID != null)
                message.dataID = String(object.dataID);
            return message;
        };

        /**
         * Creates a plain object from a PluginDataTransmission message. Also converts values to other types if specified.
         * @function toObject
         * @memberof MumbleProto.PluginDataTransmission
         * @static
         * @param {MumbleProto.PluginDataTransmission} message PluginDataTransmission
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PluginDataTransmission.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.receiverSessions = [];
            if (options.defaults) {
                object.senderSession = 0;
                if (options.bytes === String)
                    object.data = "";
                else {
                    object.data = [];
                    if (options.bytes !== Array)
                        object.data = $util.newBuffer(object.data);
                }
                object.dataID = "";
            }
            if (message.senderSession != null && message.hasOwnProperty("senderSession"))
                object.senderSession = message.senderSession;
            if (message.receiverSessions && message.receiverSessions.length) {
                object.receiverSessions = [];
                for (var j = 0; j < message.receiverSessions.length; ++j)
                    object.receiverSessions[j] = message.receiverSessions[j];
            }
            if (message.data != null && message.hasOwnProperty("data"))
                object.data = options.bytes === String ? $util.base64.encode(message.data, 0, message.data.length) : options.bytes === Array ? Array.prototype.slice.call(message.data) : message.data;
            if (message.dataID != null && message.hasOwnProperty("dataID"))
                object.dataID = message.dataID;
            return object;
        };

        /**
         * Converts this PluginDataTransmission to JSON.
         * @function toJSON
         * @memberof MumbleProto.PluginDataTransmission
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PluginDataTransmission.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PluginDataTransmission
         * @function getTypeUrl
         * @memberof MumbleProto.PluginDataTransmission
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PluginDataTransmission.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/MumbleProto.PluginDataTransmission";
        };

        return PluginDataTransmission;
    })();

    return MumbleProto;
})();

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
         * @classdesc Ping message for checking UDP connectivity (and roundtrip ping) and potentially obtaining further server
         * details (e.g. version).
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
