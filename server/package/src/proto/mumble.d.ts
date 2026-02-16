import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace MumbleProto. */
export namespace MumbleProto {

    /** Properties of a Version. */
    interface IVersion {

        /** Version versionV1 */
        versionV1?: (number|null);

        /** Version versionV2 */
        versionV2?: (number|Long|null);

        /** Version release */
        release?: (string|null);

        /** Version os */
        os?: (string|null);

        /** Version osVersion */
        osVersion?: (string|null);
    }

    /** Represents a Version. */
    class Version implements IVersion {

        /**
         * Constructs a new Version.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IVersion);

        /** Version versionV1. */
        public versionV1: number;

        /** Version versionV2. */
        public versionV2: (number|Long);

        /** Version release. */
        public release: string;

        /** Version os. */
        public os: string;

        /** Version osVersion. */
        public osVersion: string;

        /**
         * Creates a new Version instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Version instance
         */
        public static create(properties?: MumbleProto.IVersion): MumbleProto.Version;

        /**
         * Encodes the specified Version message. Does not implicitly {@link MumbleProto.Version.verify|verify} messages.
         * @param message Version message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IVersion, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Version message, length delimited. Does not implicitly {@link MumbleProto.Version.verify|verify} messages.
         * @param message Version message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IVersion, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Version message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Version
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.Version;

        /**
         * Decodes a Version message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Version
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.Version;

        /**
         * Verifies a Version message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Version message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Version
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.Version;

        /**
         * Creates a plain object from a Version message. Also converts values to other types if specified.
         * @param message Version
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.Version, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Version to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Version
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a UDPTunnel. */
    interface IUDPTunnel {

        /** UDPTunnel packet */
        packet: Uint8Array;
    }

    /** Represents a UDPTunnel. */
    class UDPTunnel implements IUDPTunnel {

        /**
         * Constructs a new UDPTunnel.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IUDPTunnel);

        /** UDPTunnel packet. */
        public packet: Uint8Array;

        /**
         * Creates a new UDPTunnel instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UDPTunnel instance
         */
        public static create(properties?: MumbleProto.IUDPTunnel): MumbleProto.UDPTunnel;

        /**
         * Encodes the specified UDPTunnel message. Does not implicitly {@link MumbleProto.UDPTunnel.verify|verify} messages.
         * @param message UDPTunnel message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IUDPTunnel, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified UDPTunnel message, length delimited. Does not implicitly {@link MumbleProto.UDPTunnel.verify|verify} messages.
         * @param message UDPTunnel message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IUDPTunnel, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a UDPTunnel message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UDPTunnel
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.UDPTunnel;

        /**
         * Decodes a UDPTunnel message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UDPTunnel
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.UDPTunnel;

        /**
         * Verifies a UDPTunnel message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a UDPTunnel message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UDPTunnel
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.UDPTunnel;

        /**
         * Creates a plain object from a UDPTunnel message. Also converts values to other types if specified.
         * @param message UDPTunnel
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.UDPTunnel, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this UDPTunnel to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UDPTunnel
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an Authenticate. */
    interface IAuthenticate {

        /** Authenticate username */
        username?: (string|null);

        /** Authenticate password */
        password?: (string|null);

        /** Authenticate tokens */
        tokens?: (string[]|null);

        /** Authenticate celtVersions */
        celtVersions?: (number[]|null);

        /** Authenticate opus */
        opus?: (boolean|null);

        /** Authenticate clientType */
        clientType?: (number|null);
    }

    /** Represents an Authenticate. */
    class Authenticate implements IAuthenticate {

        /**
         * Constructs a new Authenticate.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IAuthenticate);

        /** Authenticate username. */
        public username: string;

        /** Authenticate password. */
        public password: string;

        /** Authenticate tokens. */
        public tokens: string[];

        /** Authenticate celtVersions. */
        public celtVersions: number[];

        /** Authenticate opus. */
        public opus: boolean;

        /** Authenticate clientType. */
        public clientType: number;

        /**
         * Creates a new Authenticate instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Authenticate instance
         */
        public static create(properties?: MumbleProto.IAuthenticate): MumbleProto.Authenticate;

        /**
         * Encodes the specified Authenticate message. Does not implicitly {@link MumbleProto.Authenticate.verify|verify} messages.
         * @param message Authenticate message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IAuthenticate, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Authenticate message, length delimited. Does not implicitly {@link MumbleProto.Authenticate.verify|verify} messages.
         * @param message Authenticate message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IAuthenticate, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an Authenticate message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Authenticate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.Authenticate;

        /**
         * Decodes an Authenticate message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Authenticate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.Authenticate;

        /**
         * Verifies an Authenticate message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an Authenticate message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Authenticate
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.Authenticate;

        /**
         * Creates a plain object from an Authenticate message. Also converts values to other types if specified.
         * @param message Authenticate
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.Authenticate, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Authenticate to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Authenticate
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Ping. */
    interface IPing {

        /** Ping timestamp */
        timestamp?: (number|Long|null);

        /** Ping good */
        good?: (number|null);

        /** Ping late */
        late?: (number|null);

        /** Ping lost */
        lost?: (number|null);

        /** Ping resync */
        resync?: (number|null);

        /** Ping udpPackets */
        udpPackets?: (number|null);

        /** Ping tcpPackets */
        tcpPackets?: (number|null);

        /** Ping udpPingAvg */
        udpPingAvg?: (number|null);

        /** Ping udpPingVar */
        udpPingVar?: (number|null);

        /** Ping tcpPingAvg */
        tcpPingAvg?: (number|null);

        /** Ping tcpPingVar */
        tcpPingVar?: (number|null);
    }

    /** Represents a Ping. */
    class Ping implements IPing {

        /**
         * Constructs a new Ping.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IPing);

        /** Ping timestamp. */
        public timestamp: (number|Long);

        /** Ping good. */
        public good: number;

        /** Ping late. */
        public late: number;

        /** Ping lost. */
        public lost: number;

        /** Ping resync. */
        public resync: number;

        /** Ping udpPackets. */
        public udpPackets: number;

        /** Ping tcpPackets. */
        public tcpPackets: number;

        /** Ping udpPingAvg. */
        public udpPingAvg: number;

        /** Ping udpPingVar. */
        public udpPingVar: number;

        /** Ping tcpPingAvg. */
        public tcpPingAvg: number;

        /** Ping tcpPingVar. */
        public tcpPingVar: number;

        /**
         * Creates a new Ping instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Ping instance
         */
        public static create(properties?: MumbleProto.IPing): MumbleProto.Ping;

        /**
         * Encodes the specified Ping message. Does not implicitly {@link MumbleProto.Ping.verify|verify} messages.
         * @param message Ping message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IPing, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Ping message, length delimited. Does not implicitly {@link MumbleProto.Ping.verify|verify} messages.
         * @param message Ping message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IPing, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Ping message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.Ping;

        /**
         * Decodes a Ping message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.Ping;

        /**
         * Verifies a Ping message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Ping message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Ping
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.Ping;

        /**
         * Creates a plain object from a Ping message. Also converts values to other types if specified.
         * @param message Ping
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.Ping, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Ping to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Ping
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Reject. */
    interface IReject {

        /** Reject type */
        type?: (MumbleProto.Reject.RejectType|null);

        /** Reject reason */
        reason?: (string|null);
    }

    /** Represents a Reject. */
    class Reject implements IReject {

        /**
         * Constructs a new Reject.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IReject);

        /** Reject type. */
        public type: MumbleProto.Reject.RejectType;

        /** Reject reason. */
        public reason: string;

        /**
         * Creates a new Reject instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Reject instance
         */
        public static create(properties?: MumbleProto.IReject): MumbleProto.Reject;

        /**
         * Encodes the specified Reject message. Does not implicitly {@link MumbleProto.Reject.verify|verify} messages.
         * @param message Reject message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IReject, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Reject message, length delimited. Does not implicitly {@link MumbleProto.Reject.verify|verify} messages.
         * @param message Reject message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IReject, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Reject message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Reject
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.Reject;

        /**
         * Decodes a Reject message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Reject
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.Reject;

        /**
         * Verifies a Reject message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Reject message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Reject
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.Reject;

        /**
         * Creates a plain object from a Reject message. Also converts values to other types if specified.
         * @param message Reject
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.Reject, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Reject to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Reject
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace Reject {

        /** RejectType enum. */
        enum RejectType {
            None = 0,
            WrongVersion = 1,
            InvalidUsername = 2,
            WrongUserPW = 3,
            WrongServerPW = 4,
            UsernameInUse = 5,
            ServerFull = 6,
            NoCertificate = 7,
            AuthenticatorFail = 8,
            NoNewConnections = 9
        }
    }

    /** Properties of a ServerSync. */
    interface IServerSync {

        /** ServerSync session */
        session?: (number|null);

        /** ServerSync maxBandwidth */
        maxBandwidth?: (number|null);

        /** ServerSync welcomeText */
        welcomeText?: (string|null);

        /** ServerSync permissions */
        permissions?: (number|Long|null);
    }

    /** Represents a ServerSync. */
    class ServerSync implements IServerSync {

        /**
         * Constructs a new ServerSync.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IServerSync);

        /** ServerSync session. */
        public session: number;

        /** ServerSync maxBandwidth. */
        public maxBandwidth: number;

        /** ServerSync welcomeText. */
        public welcomeText: string;

        /** ServerSync permissions. */
        public permissions: (number|Long);

        /**
         * Creates a new ServerSync instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ServerSync instance
         */
        public static create(properties?: MumbleProto.IServerSync): MumbleProto.ServerSync;

        /**
         * Encodes the specified ServerSync message. Does not implicitly {@link MumbleProto.ServerSync.verify|verify} messages.
         * @param message ServerSync message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IServerSync, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ServerSync message, length delimited. Does not implicitly {@link MumbleProto.ServerSync.verify|verify} messages.
         * @param message ServerSync message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IServerSync, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ServerSync message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ServerSync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.ServerSync;

        /**
         * Decodes a ServerSync message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ServerSync
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.ServerSync;

        /**
         * Verifies a ServerSync message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ServerSync message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ServerSync
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.ServerSync;

        /**
         * Creates a plain object from a ServerSync message. Also converts values to other types if specified.
         * @param message ServerSync
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.ServerSync, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ServerSync to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ServerSync
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ChannelRemove. */
    interface IChannelRemove {

        /** ChannelRemove channelId */
        channelId: number;
    }

    /** Represents a ChannelRemove. */
    class ChannelRemove implements IChannelRemove {

        /**
         * Constructs a new ChannelRemove.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IChannelRemove);

        /** ChannelRemove channelId. */
        public channelId: number;

        /**
         * Creates a new ChannelRemove instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ChannelRemove instance
         */
        public static create(properties?: MumbleProto.IChannelRemove): MumbleProto.ChannelRemove;

        /**
         * Encodes the specified ChannelRemove message. Does not implicitly {@link MumbleProto.ChannelRemove.verify|verify} messages.
         * @param message ChannelRemove message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IChannelRemove, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ChannelRemove message, length delimited. Does not implicitly {@link MumbleProto.ChannelRemove.verify|verify} messages.
         * @param message ChannelRemove message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IChannelRemove, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ChannelRemove message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ChannelRemove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.ChannelRemove;

        /**
         * Decodes a ChannelRemove message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ChannelRemove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.ChannelRemove;

        /**
         * Verifies a ChannelRemove message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ChannelRemove message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ChannelRemove
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.ChannelRemove;

        /**
         * Creates a plain object from a ChannelRemove message. Also converts values to other types if specified.
         * @param message ChannelRemove
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.ChannelRemove, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ChannelRemove to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ChannelRemove
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ChannelState. */
    interface IChannelState {

        /** ChannelState channelId */
        channelId?: (number|null);

        /** ChannelState parent */
        parent?: (number|null);

        /** ChannelState name */
        name?: (string|null);

        /** ChannelState links */
        links?: (number[]|null);

        /** ChannelState description */
        description?: (string|null);

        /** ChannelState linksAdd */
        linksAdd?: (number[]|null);

        /** ChannelState linksRemove */
        linksRemove?: (number[]|null);

        /** ChannelState temporary */
        temporary?: (boolean|null);

        /** ChannelState position */
        position?: (number|null);

        /** ChannelState descriptionHash */
        descriptionHash?: (Uint8Array|null);

        /** ChannelState maxUsers */
        maxUsers?: (number|null);

        /** ChannelState isEnterRestricted */
        isEnterRestricted?: (boolean|null);

        /** ChannelState canEnter */
        canEnter?: (boolean|null);
    }

    /** Represents a ChannelState. */
    class ChannelState implements IChannelState {

        /**
         * Constructs a new ChannelState.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IChannelState);

        /** ChannelState channelId. */
        public channelId: number;

        /** ChannelState parent. */
        public parent: number;

        /** ChannelState name. */
        public name: string;

        /** ChannelState links. */
        public links: number[];

        /** ChannelState description. */
        public description: string;

        /** ChannelState linksAdd. */
        public linksAdd: number[];

        /** ChannelState linksRemove. */
        public linksRemove: number[];

        /** ChannelState temporary. */
        public temporary: boolean;

        /** ChannelState position. */
        public position: number;

        /** ChannelState descriptionHash. */
        public descriptionHash: Uint8Array;

        /** ChannelState maxUsers. */
        public maxUsers: number;

        /** ChannelState isEnterRestricted. */
        public isEnterRestricted: boolean;

        /** ChannelState canEnter. */
        public canEnter: boolean;

        /**
         * Creates a new ChannelState instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ChannelState instance
         */
        public static create(properties?: MumbleProto.IChannelState): MumbleProto.ChannelState;

        /**
         * Encodes the specified ChannelState message. Does not implicitly {@link MumbleProto.ChannelState.verify|verify} messages.
         * @param message ChannelState message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IChannelState, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ChannelState message, length delimited. Does not implicitly {@link MumbleProto.ChannelState.verify|verify} messages.
         * @param message ChannelState message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IChannelState, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ChannelState message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ChannelState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.ChannelState;

        /**
         * Decodes a ChannelState message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ChannelState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.ChannelState;

        /**
         * Verifies a ChannelState message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ChannelState message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ChannelState
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.ChannelState;

        /**
         * Creates a plain object from a ChannelState message. Also converts values to other types if specified.
         * @param message ChannelState
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.ChannelState, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ChannelState to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ChannelState
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a UserRemove. */
    interface IUserRemove {

        /** UserRemove session */
        session: number;

        /** UserRemove actor */
        actor?: (number|null);

        /** UserRemove reason */
        reason?: (string|null);

        /** UserRemove ban */
        ban?: (boolean|null);
    }

    /** Represents a UserRemove. */
    class UserRemove implements IUserRemove {

        /**
         * Constructs a new UserRemove.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IUserRemove);

        /** UserRemove session. */
        public session: number;

        /** UserRemove actor. */
        public actor: number;

        /** UserRemove reason. */
        public reason: string;

        /** UserRemove ban. */
        public ban: boolean;

        /**
         * Creates a new UserRemove instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UserRemove instance
         */
        public static create(properties?: MumbleProto.IUserRemove): MumbleProto.UserRemove;

        /**
         * Encodes the specified UserRemove message. Does not implicitly {@link MumbleProto.UserRemove.verify|verify} messages.
         * @param message UserRemove message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IUserRemove, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified UserRemove message, length delimited. Does not implicitly {@link MumbleProto.UserRemove.verify|verify} messages.
         * @param message UserRemove message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IUserRemove, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a UserRemove message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UserRemove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.UserRemove;

        /**
         * Decodes a UserRemove message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UserRemove
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.UserRemove;

        /**
         * Verifies a UserRemove message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a UserRemove message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UserRemove
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.UserRemove;

        /**
         * Creates a plain object from a UserRemove message. Also converts values to other types if specified.
         * @param message UserRemove
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.UserRemove, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this UserRemove to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UserRemove
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a UserState. */
    interface IUserState {

        /** UserState session */
        session?: (number|null);

        /** UserState actor */
        actor?: (number|null);

        /** UserState name */
        name?: (string|null);

        /** UserState userId */
        userId?: (number|null);

        /** UserState channelId */
        channelId?: (number|null);

        /** UserState mute */
        mute?: (boolean|null);

        /** UserState deaf */
        deaf?: (boolean|null);

        /** UserState suppress */
        suppress?: (boolean|null);

        /** UserState selfMute */
        selfMute?: (boolean|null);

        /** UserState selfDeaf */
        selfDeaf?: (boolean|null);

        /** UserState texture */
        texture?: (Uint8Array|null);

        /** UserState pluginContext */
        pluginContext?: (Uint8Array|null);

        /** UserState pluginIdentity */
        pluginIdentity?: (string|null);

        /** UserState comment */
        comment?: (string|null);

        /** UserState hash */
        hash?: (string|null);

        /** UserState commentHash */
        commentHash?: (Uint8Array|null);

        /** UserState textureHash */
        textureHash?: (Uint8Array|null);

        /** UserState prioritySpeaker */
        prioritySpeaker?: (boolean|null);

        /** UserState recording */
        recording?: (boolean|null);

        /** UserState temporaryAccessTokens */
        temporaryAccessTokens?: (string[]|null);

        /** UserState listeningChannelAdd */
        listeningChannelAdd?: (number[]|null);

        /** UserState listeningChannelRemove */
        listeningChannelRemove?: (number[]|null);

        /** UserState listeningVolumeAdjustment */
        listeningVolumeAdjustment?: (MumbleProto.UserState.IVolumeAdjustment[]|null);
    }

    /** Represents a UserState. */
    class UserState implements IUserState {

        /**
         * Constructs a new UserState.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IUserState);

        /** UserState session. */
        public session: number;

        /** UserState actor. */
        public actor: number;

        /** UserState name. */
        public name: string;

        /** UserState userId. */
        public userId: number;

        /** UserState channelId. */
        public channelId: number;

        /** UserState mute. */
        public mute: boolean;

        /** UserState deaf. */
        public deaf: boolean;

        /** UserState suppress. */
        public suppress: boolean;

        /** UserState selfMute. */
        public selfMute: boolean;

        /** UserState selfDeaf. */
        public selfDeaf: boolean;

        /** UserState texture. */
        public texture: Uint8Array;

        /** UserState pluginContext. */
        public pluginContext: Uint8Array;

        /** UserState pluginIdentity. */
        public pluginIdentity: string;

        /** UserState comment. */
        public comment: string;

        /** UserState hash. */
        public hash: string;

        /** UserState commentHash. */
        public commentHash: Uint8Array;

        /** UserState textureHash. */
        public textureHash: Uint8Array;

        /** UserState prioritySpeaker. */
        public prioritySpeaker: boolean;

        /** UserState recording. */
        public recording: boolean;

        /** UserState temporaryAccessTokens. */
        public temporaryAccessTokens: string[];

        /** UserState listeningChannelAdd. */
        public listeningChannelAdd: number[];

        /** UserState listeningChannelRemove. */
        public listeningChannelRemove: number[];

        /** UserState listeningVolumeAdjustment. */
        public listeningVolumeAdjustment: MumbleProto.UserState.IVolumeAdjustment[];

        /**
         * Creates a new UserState instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UserState instance
         */
        public static create(properties?: MumbleProto.IUserState): MumbleProto.UserState;

        /**
         * Encodes the specified UserState message. Does not implicitly {@link MumbleProto.UserState.verify|verify} messages.
         * @param message UserState message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IUserState, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified UserState message, length delimited. Does not implicitly {@link MumbleProto.UserState.verify|verify} messages.
         * @param message UserState message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IUserState, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a UserState message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UserState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.UserState;

        /**
         * Decodes a UserState message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UserState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.UserState;

        /**
         * Verifies a UserState message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a UserState message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UserState
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.UserState;

        /**
         * Creates a plain object from a UserState message. Also converts values to other types if specified.
         * @param message UserState
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.UserState, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this UserState to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UserState
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace UserState {

        /** Properties of a VolumeAdjustment. */
        interface IVolumeAdjustment {

            /** VolumeAdjustment listeningChannel */
            listeningChannel?: (number|null);

            /** VolumeAdjustment volumeAdjustment */
            volumeAdjustment?: (number|null);
        }

        /** Represents a VolumeAdjustment. */
        class VolumeAdjustment implements IVolumeAdjustment {

            /**
             * Constructs a new VolumeAdjustment.
             * @param [properties] Properties to set
             */
            constructor(properties?: MumbleProto.UserState.IVolumeAdjustment);

            /** VolumeAdjustment listeningChannel. */
            public listeningChannel: number;

            /** VolumeAdjustment volumeAdjustment. */
            public volumeAdjustment: number;

            /**
             * Creates a new VolumeAdjustment instance using the specified properties.
             * @param [properties] Properties to set
             * @returns VolumeAdjustment instance
             */
            public static create(properties?: MumbleProto.UserState.IVolumeAdjustment): MumbleProto.UserState.VolumeAdjustment;

            /**
             * Encodes the specified VolumeAdjustment message. Does not implicitly {@link MumbleProto.UserState.VolumeAdjustment.verify|verify} messages.
             * @param message VolumeAdjustment message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: MumbleProto.UserState.IVolumeAdjustment, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified VolumeAdjustment message, length delimited. Does not implicitly {@link MumbleProto.UserState.VolumeAdjustment.verify|verify} messages.
             * @param message VolumeAdjustment message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: MumbleProto.UserState.IVolumeAdjustment, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a VolumeAdjustment message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns VolumeAdjustment
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.UserState.VolumeAdjustment;

            /**
             * Decodes a VolumeAdjustment message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns VolumeAdjustment
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.UserState.VolumeAdjustment;

            /**
             * Verifies a VolumeAdjustment message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a VolumeAdjustment message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns VolumeAdjustment
             */
            public static fromObject(object: { [k: string]: any }): MumbleProto.UserState.VolumeAdjustment;

            /**
             * Creates a plain object from a VolumeAdjustment message. Also converts values to other types if specified.
             * @param message VolumeAdjustment
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: MumbleProto.UserState.VolumeAdjustment, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this VolumeAdjustment to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for VolumeAdjustment
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Properties of a BanList. */
    interface IBanList {

        /** BanList bans */
        bans?: (MumbleProto.BanList.IBanEntry[]|null);

        /** BanList query */
        query?: (boolean|null);
    }

    /** Represents a BanList. */
    class BanList implements IBanList {

        /**
         * Constructs a new BanList.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IBanList);

        /** BanList bans. */
        public bans: MumbleProto.BanList.IBanEntry[];

        /** BanList query. */
        public query: boolean;

        /**
         * Creates a new BanList instance using the specified properties.
         * @param [properties] Properties to set
         * @returns BanList instance
         */
        public static create(properties?: MumbleProto.IBanList): MumbleProto.BanList;

        /**
         * Encodes the specified BanList message. Does not implicitly {@link MumbleProto.BanList.verify|verify} messages.
         * @param message BanList message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IBanList, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified BanList message, length delimited. Does not implicitly {@link MumbleProto.BanList.verify|verify} messages.
         * @param message BanList message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IBanList, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a BanList message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns BanList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.BanList;

        /**
         * Decodes a BanList message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns BanList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.BanList;

        /**
         * Verifies a BanList message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a BanList message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns BanList
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.BanList;

        /**
         * Creates a plain object from a BanList message. Also converts values to other types if specified.
         * @param message BanList
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.BanList, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this BanList to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for BanList
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace BanList {

        /** Properties of a BanEntry. */
        interface IBanEntry {

            /** BanEntry address */
            address: Uint8Array;

            /** BanEntry mask */
            mask: number;

            /** BanEntry name */
            name?: (string|null);

            /** BanEntry hash */
            hash?: (string|null);

            /** BanEntry reason */
            reason?: (string|null);

            /** BanEntry start */
            start?: (string|null);

            /** BanEntry duration */
            duration?: (number|null);
        }

        /** Represents a BanEntry. */
        class BanEntry implements IBanEntry {

            /**
             * Constructs a new BanEntry.
             * @param [properties] Properties to set
             */
            constructor(properties?: MumbleProto.BanList.IBanEntry);

            /** BanEntry address. */
            public address: Uint8Array;

            /** BanEntry mask. */
            public mask: number;

            /** BanEntry name. */
            public name: string;

            /** BanEntry hash. */
            public hash: string;

            /** BanEntry reason. */
            public reason: string;

            /** BanEntry start. */
            public start: string;

            /** BanEntry duration. */
            public duration: number;

            /**
             * Creates a new BanEntry instance using the specified properties.
             * @param [properties] Properties to set
             * @returns BanEntry instance
             */
            public static create(properties?: MumbleProto.BanList.IBanEntry): MumbleProto.BanList.BanEntry;

            /**
             * Encodes the specified BanEntry message. Does not implicitly {@link MumbleProto.BanList.BanEntry.verify|verify} messages.
             * @param message BanEntry message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: MumbleProto.BanList.IBanEntry, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified BanEntry message, length delimited. Does not implicitly {@link MumbleProto.BanList.BanEntry.verify|verify} messages.
             * @param message BanEntry message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: MumbleProto.BanList.IBanEntry, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a BanEntry message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns BanEntry
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.BanList.BanEntry;

            /**
             * Decodes a BanEntry message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns BanEntry
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.BanList.BanEntry;

            /**
             * Verifies a BanEntry message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a BanEntry message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns BanEntry
             */
            public static fromObject(object: { [k: string]: any }): MumbleProto.BanList.BanEntry;

            /**
             * Creates a plain object from a BanEntry message. Also converts values to other types if specified.
             * @param message BanEntry
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: MumbleProto.BanList.BanEntry, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this BanEntry to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for BanEntry
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Properties of a TextMessage. */
    interface ITextMessage {

        /** TextMessage actor */
        actor?: (number|null);

        /** TextMessage session */
        session?: (number[]|null);

        /** TextMessage channelId */
        channelId?: (number[]|null);

        /** TextMessage treeId */
        treeId?: (number[]|null);

        /** TextMessage message */
        message: string;
    }

    /** Represents a TextMessage. */
    class TextMessage implements ITextMessage {

        /**
         * Constructs a new TextMessage.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.ITextMessage);

        /** TextMessage actor. */
        public actor: number;

        /** TextMessage session. */
        public session: number[];

        /** TextMessage channelId. */
        public channelId: number[];

        /** TextMessage treeId. */
        public treeId: number[];

        /** TextMessage message. */
        public message: string;

        /**
         * Creates a new TextMessage instance using the specified properties.
         * @param [properties] Properties to set
         * @returns TextMessage instance
         */
        public static create(properties?: MumbleProto.ITextMessage): MumbleProto.TextMessage;

        /**
         * Encodes the specified TextMessage message. Does not implicitly {@link MumbleProto.TextMessage.verify|verify} messages.
         * @param message TextMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.ITextMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified TextMessage message, length delimited. Does not implicitly {@link MumbleProto.TextMessage.verify|verify} messages.
         * @param message TextMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.ITextMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a TextMessage message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns TextMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.TextMessage;

        /**
         * Decodes a TextMessage message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns TextMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.TextMessage;

        /**
         * Verifies a TextMessage message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a TextMessage message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns TextMessage
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.TextMessage;

        /**
         * Creates a plain object from a TextMessage message. Also converts values to other types if specified.
         * @param message TextMessage
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.TextMessage, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this TextMessage to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for TextMessage
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PermissionDenied. */
    interface IPermissionDenied {

        /** PermissionDenied permission */
        permission?: (number|null);

        /** PermissionDenied channelId */
        channelId?: (number|null);

        /** PermissionDenied session */
        session?: (number|null);

        /** PermissionDenied reason */
        reason?: (string|null);

        /** PermissionDenied type */
        type?: (MumbleProto.PermissionDenied.DenyType|null);

        /** PermissionDenied name */
        name?: (string|null);
    }

    /** Represents a PermissionDenied. */
    class PermissionDenied implements IPermissionDenied {

        /**
         * Constructs a new PermissionDenied.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IPermissionDenied);

        /** PermissionDenied permission. */
        public permission: number;

        /** PermissionDenied channelId. */
        public channelId: number;

        /** PermissionDenied session. */
        public session: number;

        /** PermissionDenied reason. */
        public reason: string;

        /** PermissionDenied type. */
        public type: MumbleProto.PermissionDenied.DenyType;

        /** PermissionDenied name. */
        public name: string;

        /**
         * Creates a new PermissionDenied instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PermissionDenied instance
         */
        public static create(properties?: MumbleProto.IPermissionDenied): MumbleProto.PermissionDenied;

        /**
         * Encodes the specified PermissionDenied message. Does not implicitly {@link MumbleProto.PermissionDenied.verify|verify} messages.
         * @param message PermissionDenied message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IPermissionDenied, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified PermissionDenied message, length delimited. Does not implicitly {@link MumbleProto.PermissionDenied.verify|verify} messages.
         * @param message PermissionDenied message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IPermissionDenied, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a PermissionDenied message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PermissionDenied
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.PermissionDenied;

        /**
         * Decodes a PermissionDenied message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PermissionDenied
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.PermissionDenied;

        /**
         * Verifies a PermissionDenied message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a PermissionDenied message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PermissionDenied
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.PermissionDenied;

        /**
         * Creates a plain object from a PermissionDenied message. Also converts values to other types if specified.
         * @param message PermissionDenied
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.PermissionDenied, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this PermissionDenied to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PermissionDenied
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace PermissionDenied {

        /** DenyType enum. */
        enum DenyType {
            Text = 0,
            Permission = 1,
            SuperUser = 2,
            ChannelName = 3,
            TextTooLong = 4,
            H9K = 5,
            TemporaryChannel = 6,
            MissingCertificate = 7,
            UserName = 8,
            ChannelFull = 9,
            NestingLimit = 10,
            ChannelCountLimit = 11,
            ChannelListenerLimit = 12,
            UserListenerLimit = 13
        }
    }

    /** Properties of a ACL. */
    interface IACL {

        /** ACL channelId */
        channelId: number;

        /** ACL inheritAcls */
        inheritAcls?: (boolean|null);

        /** ACL groups */
        groups?: (MumbleProto.ACL.IChanGroup[]|null);

        /** ACL acls */
        acls?: (MumbleProto.ACL.IChanACL[]|null);

        /** ACL query */
        query?: (boolean|null);
    }

    /** Represents a ACL. */
    class ACL implements IACL {

        /**
         * Constructs a new ACL.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IACL);

        /** ACL channelId. */
        public channelId: number;

        /** ACL inheritAcls. */
        public inheritAcls: boolean;

        /** ACL groups. */
        public groups: MumbleProto.ACL.IChanGroup[];

        /** ACL acls. */
        public acls: MumbleProto.ACL.IChanACL[];

        /** ACL query. */
        public query: boolean;

        /**
         * Creates a new ACL instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ACL instance
         */
        public static create(properties?: MumbleProto.IACL): MumbleProto.ACL;

        /**
         * Encodes the specified ACL message. Does not implicitly {@link MumbleProto.ACL.verify|verify} messages.
         * @param message ACL message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IACL, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ACL message, length delimited. Does not implicitly {@link MumbleProto.ACL.verify|verify} messages.
         * @param message ACL message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IACL, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ACL message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ACL
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.ACL;

        /**
         * Decodes a ACL message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ACL
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.ACL;

        /**
         * Verifies a ACL message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ACL message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ACL
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.ACL;

        /**
         * Creates a plain object from a ACL message. Also converts values to other types if specified.
         * @param message ACL
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.ACL, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ACL to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ACL
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace ACL {

        /** Properties of a ChanGroup. */
        interface IChanGroup {

            /** ChanGroup name */
            name: string;

            /** ChanGroup inherited */
            inherited?: (boolean|null);

            /** ChanGroup inherit */
            inherit?: (boolean|null);

            /** ChanGroup inheritable */
            inheritable?: (boolean|null);

            /** ChanGroup add */
            add?: (number[]|null);

            /** ChanGroup remove */
            remove?: (number[]|null);

            /** ChanGroup inheritedMembers */
            inheritedMembers?: (number[]|null);
        }

        /** Represents a ChanGroup. */
        class ChanGroup implements IChanGroup {

            /**
             * Constructs a new ChanGroup.
             * @param [properties] Properties to set
             */
            constructor(properties?: MumbleProto.ACL.IChanGroup);

            /** ChanGroup name. */
            public name: string;

            /** ChanGroup inherited. */
            public inherited: boolean;

            /** ChanGroup inherit. */
            public inherit: boolean;

            /** ChanGroup inheritable. */
            public inheritable: boolean;

            /** ChanGroup add. */
            public add: number[];

            /** ChanGroup remove. */
            public remove: number[];

            /** ChanGroup inheritedMembers. */
            public inheritedMembers: number[];

            /**
             * Creates a new ChanGroup instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ChanGroup instance
             */
            public static create(properties?: MumbleProto.ACL.IChanGroup): MumbleProto.ACL.ChanGroup;

            /**
             * Encodes the specified ChanGroup message. Does not implicitly {@link MumbleProto.ACL.ChanGroup.verify|verify} messages.
             * @param message ChanGroup message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: MumbleProto.ACL.IChanGroup, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ChanGroup message, length delimited. Does not implicitly {@link MumbleProto.ACL.ChanGroup.verify|verify} messages.
             * @param message ChanGroup message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: MumbleProto.ACL.IChanGroup, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ChanGroup message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ChanGroup
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.ACL.ChanGroup;

            /**
             * Decodes a ChanGroup message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ChanGroup
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.ACL.ChanGroup;

            /**
             * Verifies a ChanGroup message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a ChanGroup message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ChanGroup
             */
            public static fromObject(object: { [k: string]: any }): MumbleProto.ACL.ChanGroup;

            /**
             * Creates a plain object from a ChanGroup message. Also converts values to other types if specified.
             * @param message ChanGroup
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: MumbleProto.ACL.ChanGroup, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ChanGroup to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ChanGroup
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a ChanACL. */
        interface IChanACL {

            /** ChanACL applyHere */
            applyHere?: (boolean|null);

            /** ChanACL applySubs */
            applySubs?: (boolean|null);

            /** ChanACL inherited */
            inherited?: (boolean|null);

            /** ChanACL userId */
            userId?: (number|null);

            /** ChanACL group */
            group?: (string|null);

            /** ChanACL grant */
            grant?: (number|null);

            /** ChanACL deny */
            deny?: (number|null);
        }

        /** Represents a ChanACL. */
        class ChanACL implements IChanACL {

            /**
             * Constructs a new ChanACL.
             * @param [properties] Properties to set
             */
            constructor(properties?: MumbleProto.ACL.IChanACL);

            /** ChanACL applyHere. */
            public applyHere: boolean;

            /** ChanACL applySubs. */
            public applySubs: boolean;

            /** ChanACL inherited. */
            public inherited: boolean;

            /** ChanACL userId. */
            public userId: number;

            /** ChanACL group. */
            public group: string;

            /** ChanACL grant. */
            public grant: number;

            /** ChanACL deny. */
            public deny: number;

            /**
             * Creates a new ChanACL instance using the specified properties.
             * @param [properties] Properties to set
             * @returns ChanACL instance
             */
            public static create(properties?: MumbleProto.ACL.IChanACL): MumbleProto.ACL.ChanACL;

            /**
             * Encodes the specified ChanACL message. Does not implicitly {@link MumbleProto.ACL.ChanACL.verify|verify} messages.
             * @param message ChanACL message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: MumbleProto.ACL.IChanACL, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified ChanACL message, length delimited. Does not implicitly {@link MumbleProto.ACL.ChanACL.verify|verify} messages.
             * @param message ChanACL message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: MumbleProto.ACL.IChanACL, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a ChanACL message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns ChanACL
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.ACL.ChanACL;

            /**
             * Decodes a ChanACL message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns ChanACL
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.ACL.ChanACL;

            /**
             * Verifies a ChanACL message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a ChanACL message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns ChanACL
             */
            public static fromObject(object: { [k: string]: any }): MumbleProto.ACL.ChanACL;

            /**
             * Creates a plain object from a ChanACL message. Also converts values to other types if specified.
             * @param message ChanACL
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: MumbleProto.ACL.ChanACL, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this ChanACL to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for ChanACL
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Properties of a QueryUsers. */
    interface IQueryUsers {

        /** QueryUsers ids */
        ids?: (number[]|null);

        /** QueryUsers names */
        names?: (string[]|null);
    }

    /** Represents a QueryUsers. */
    class QueryUsers implements IQueryUsers {

        /**
         * Constructs a new QueryUsers.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IQueryUsers);

        /** QueryUsers ids. */
        public ids: number[];

        /** QueryUsers names. */
        public names: string[];

        /**
         * Creates a new QueryUsers instance using the specified properties.
         * @param [properties] Properties to set
         * @returns QueryUsers instance
         */
        public static create(properties?: MumbleProto.IQueryUsers): MumbleProto.QueryUsers;

        /**
         * Encodes the specified QueryUsers message. Does not implicitly {@link MumbleProto.QueryUsers.verify|verify} messages.
         * @param message QueryUsers message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IQueryUsers, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified QueryUsers message, length delimited. Does not implicitly {@link MumbleProto.QueryUsers.verify|verify} messages.
         * @param message QueryUsers message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IQueryUsers, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a QueryUsers message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns QueryUsers
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.QueryUsers;

        /**
         * Decodes a QueryUsers message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns QueryUsers
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.QueryUsers;

        /**
         * Verifies a QueryUsers message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a QueryUsers message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns QueryUsers
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.QueryUsers;

        /**
         * Creates a plain object from a QueryUsers message. Also converts values to other types if specified.
         * @param message QueryUsers
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.QueryUsers, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this QueryUsers to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for QueryUsers
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a CryptSetup. */
    interface ICryptSetup {

        /** CryptSetup key */
        key?: (Uint8Array|null);

        /** CryptSetup clientNonce */
        clientNonce?: (Uint8Array|null);

        /** CryptSetup serverNonce */
        serverNonce?: (Uint8Array|null);
    }

    /** Represents a CryptSetup. */
    class CryptSetup implements ICryptSetup {

        /**
         * Constructs a new CryptSetup.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.ICryptSetup);

        /** CryptSetup key. */
        public key: Uint8Array;

        /** CryptSetup clientNonce. */
        public clientNonce: Uint8Array;

        /** CryptSetup serverNonce. */
        public serverNonce: Uint8Array;

        /**
         * Creates a new CryptSetup instance using the specified properties.
         * @param [properties] Properties to set
         * @returns CryptSetup instance
         */
        public static create(properties?: MumbleProto.ICryptSetup): MumbleProto.CryptSetup;

        /**
         * Encodes the specified CryptSetup message. Does not implicitly {@link MumbleProto.CryptSetup.verify|verify} messages.
         * @param message CryptSetup message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.ICryptSetup, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified CryptSetup message, length delimited. Does not implicitly {@link MumbleProto.CryptSetup.verify|verify} messages.
         * @param message CryptSetup message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.ICryptSetup, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a CryptSetup message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns CryptSetup
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.CryptSetup;

        /**
         * Decodes a CryptSetup message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns CryptSetup
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.CryptSetup;

        /**
         * Verifies a CryptSetup message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a CryptSetup message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns CryptSetup
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.CryptSetup;

        /**
         * Creates a plain object from a CryptSetup message. Also converts values to other types if specified.
         * @param message CryptSetup
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.CryptSetup, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this CryptSetup to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for CryptSetup
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ContextActionModify. */
    interface IContextActionModify {

        /** ContextActionModify action */
        action: string;

        /** ContextActionModify text */
        text?: (string|null);

        /** ContextActionModify context */
        context?: (number|null);

        /** ContextActionModify operation */
        operation?: (MumbleProto.ContextActionModify.Operation|null);
    }

    /** Represents a ContextActionModify. */
    class ContextActionModify implements IContextActionModify {

        /**
         * Constructs a new ContextActionModify.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IContextActionModify);

        /** ContextActionModify action. */
        public action: string;

        /** ContextActionModify text. */
        public text: string;

        /** ContextActionModify context. */
        public context: number;

        /** ContextActionModify operation. */
        public operation: MumbleProto.ContextActionModify.Operation;

        /**
         * Creates a new ContextActionModify instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ContextActionModify instance
         */
        public static create(properties?: MumbleProto.IContextActionModify): MumbleProto.ContextActionModify;

        /**
         * Encodes the specified ContextActionModify message. Does not implicitly {@link MumbleProto.ContextActionModify.verify|verify} messages.
         * @param message ContextActionModify message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IContextActionModify, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ContextActionModify message, length delimited. Does not implicitly {@link MumbleProto.ContextActionModify.verify|verify} messages.
         * @param message ContextActionModify message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IContextActionModify, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ContextActionModify message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ContextActionModify
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.ContextActionModify;

        /**
         * Decodes a ContextActionModify message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ContextActionModify
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.ContextActionModify;

        /**
         * Verifies a ContextActionModify message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ContextActionModify message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ContextActionModify
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.ContextActionModify;

        /**
         * Creates a plain object from a ContextActionModify message. Also converts values to other types if specified.
         * @param message ContextActionModify
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.ContextActionModify, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ContextActionModify to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ContextActionModify
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace ContextActionModify {

        /** Context enum. */
        enum Context {
            Server = 1,
            Channel = 2,
            User = 4
        }

        /** Operation enum. */
        enum Operation {
            Add = 0,
            Remove = 1
        }
    }

    /** Properties of a ContextAction. */
    interface IContextAction {

        /** ContextAction session */
        session?: (number|null);

        /** ContextAction channelId */
        channelId?: (number|null);

        /** ContextAction action */
        action: string;
    }

    /** Represents a ContextAction. */
    class ContextAction implements IContextAction {

        /**
         * Constructs a new ContextAction.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IContextAction);

        /** ContextAction session. */
        public session: number;

        /** ContextAction channelId. */
        public channelId: number;

        /** ContextAction action. */
        public action: string;

        /**
         * Creates a new ContextAction instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ContextAction instance
         */
        public static create(properties?: MumbleProto.IContextAction): MumbleProto.ContextAction;

        /**
         * Encodes the specified ContextAction message. Does not implicitly {@link MumbleProto.ContextAction.verify|verify} messages.
         * @param message ContextAction message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IContextAction, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ContextAction message, length delimited. Does not implicitly {@link MumbleProto.ContextAction.verify|verify} messages.
         * @param message ContextAction message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IContextAction, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ContextAction message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ContextAction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.ContextAction;

        /**
         * Decodes a ContextAction message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ContextAction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.ContextAction;

        /**
         * Verifies a ContextAction message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ContextAction message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ContextAction
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.ContextAction;

        /**
         * Creates a plain object from a ContextAction message. Also converts values to other types if specified.
         * @param message ContextAction
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.ContextAction, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ContextAction to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ContextAction
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a UserList. */
    interface IUserList {

        /** UserList users */
        users?: (MumbleProto.UserList.IUser[]|null);
    }

    /** Represents a UserList. */
    class UserList implements IUserList {

        /**
         * Constructs a new UserList.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IUserList);

        /** UserList users. */
        public users: MumbleProto.UserList.IUser[];

        /**
         * Creates a new UserList instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UserList instance
         */
        public static create(properties?: MumbleProto.IUserList): MumbleProto.UserList;

        /**
         * Encodes the specified UserList message. Does not implicitly {@link MumbleProto.UserList.verify|verify} messages.
         * @param message UserList message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IUserList, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified UserList message, length delimited. Does not implicitly {@link MumbleProto.UserList.verify|verify} messages.
         * @param message UserList message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IUserList, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a UserList message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UserList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.UserList;

        /**
         * Decodes a UserList message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UserList
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.UserList;

        /**
         * Verifies a UserList message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a UserList message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UserList
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.UserList;

        /**
         * Creates a plain object from a UserList message. Also converts values to other types if specified.
         * @param message UserList
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.UserList, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this UserList to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UserList
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace UserList {

        /** Properties of a User. */
        interface IUser {

            /** User userId */
            userId: number;

            /** User name */
            name?: (string|null);

            /** User lastSeen */
            lastSeen?: (string|null);

            /** User lastChannel */
            lastChannel?: (number|null);
        }

        /** Represents a User. */
        class User implements IUser {

            /**
             * Constructs a new User.
             * @param [properties] Properties to set
             */
            constructor(properties?: MumbleProto.UserList.IUser);

            /** User userId. */
            public userId: number;

            /** User name. */
            public name: string;

            /** User lastSeen. */
            public lastSeen: string;

            /** User lastChannel. */
            public lastChannel: number;

            /**
             * Creates a new User instance using the specified properties.
             * @param [properties] Properties to set
             * @returns User instance
             */
            public static create(properties?: MumbleProto.UserList.IUser): MumbleProto.UserList.User;

            /**
             * Encodes the specified User message. Does not implicitly {@link MumbleProto.UserList.User.verify|verify} messages.
             * @param message User message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: MumbleProto.UserList.IUser, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified User message, length delimited. Does not implicitly {@link MumbleProto.UserList.User.verify|verify} messages.
             * @param message User message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: MumbleProto.UserList.IUser, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a User message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns User
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.UserList.User;

            /**
             * Decodes a User message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns User
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.UserList.User;

            /**
             * Verifies a User message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a User message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns User
             */
            public static fromObject(object: { [k: string]: any }): MumbleProto.UserList.User;

            /**
             * Creates a plain object from a User message. Also converts values to other types if specified.
             * @param message User
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: MumbleProto.UserList.User, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this User to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for User
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Properties of a VoiceTarget. */
    interface IVoiceTarget {

        /** VoiceTarget id */
        id?: (number|null);

        /** VoiceTarget targets */
        targets?: (MumbleProto.VoiceTarget.ITarget[]|null);
    }

    /** Represents a VoiceTarget. */
    class VoiceTarget implements IVoiceTarget {

        /**
         * Constructs a new VoiceTarget.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IVoiceTarget);

        /** VoiceTarget id. */
        public id: number;

        /** VoiceTarget targets. */
        public targets: MumbleProto.VoiceTarget.ITarget[];

        /**
         * Creates a new VoiceTarget instance using the specified properties.
         * @param [properties] Properties to set
         * @returns VoiceTarget instance
         */
        public static create(properties?: MumbleProto.IVoiceTarget): MumbleProto.VoiceTarget;

        /**
         * Encodes the specified VoiceTarget message. Does not implicitly {@link MumbleProto.VoiceTarget.verify|verify} messages.
         * @param message VoiceTarget message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IVoiceTarget, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified VoiceTarget message, length delimited. Does not implicitly {@link MumbleProto.VoiceTarget.verify|verify} messages.
         * @param message VoiceTarget message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IVoiceTarget, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a VoiceTarget message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns VoiceTarget
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.VoiceTarget;

        /**
         * Decodes a VoiceTarget message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns VoiceTarget
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.VoiceTarget;

        /**
         * Verifies a VoiceTarget message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a VoiceTarget message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns VoiceTarget
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.VoiceTarget;

        /**
         * Creates a plain object from a VoiceTarget message. Also converts values to other types if specified.
         * @param message VoiceTarget
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.VoiceTarget, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this VoiceTarget to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for VoiceTarget
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace VoiceTarget {

        /** Properties of a Target. */
        interface ITarget {

            /** Target session */
            session?: (number[]|null);

            /** Target channelId */
            channelId?: (number|null);

            /** Target group */
            group?: (string|null);

            /** Target links */
            links?: (boolean|null);

            /** Target children */
            children?: (boolean|null);
        }

        /** Represents a Target. */
        class Target implements ITarget {

            /**
             * Constructs a new Target.
             * @param [properties] Properties to set
             */
            constructor(properties?: MumbleProto.VoiceTarget.ITarget);

            /** Target session. */
            public session: number[];

            /** Target channelId. */
            public channelId: number;

            /** Target group. */
            public group: string;

            /** Target links. */
            public links: boolean;

            /** Target children. */
            public children: boolean;

            /**
             * Creates a new Target instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Target instance
             */
            public static create(properties?: MumbleProto.VoiceTarget.ITarget): MumbleProto.VoiceTarget.Target;

            /**
             * Encodes the specified Target message. Does not implicitly {@link MumbleProto.VoiceTarget.Target.verify|verify} messages.
             * @param message Target message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: MumbleProto.VoiceTarget.ITarget, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Target message, length delimited. Does not implicitly {@link MumbleProto.VoiceTarget.Target.verify|verify} messages.
             * @param message Target message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: MumbleProto.VoiceTarget.ITarget, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Target message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Target
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.VoiceTarget.Target;

            /**
             * Decodes a Target message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Target
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.VoiceTarget.Target;

            /**
             * Verifies a Target message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Target message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Target
             */
            public static fromObject(object: { [k: string]: any }): MumbleProto.VoiceTarget.Target;

            /**
             * Creates a plain object from a Target message. Also converts values to other types if specified.
             * @param message Target
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: MumbleProto.VoiceTarget.Target, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Target to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Target
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Properties of a PermissionQuery. */
    interface IPermissionQuery {

        /** PermissionQuery channelId */
        channelId?: (number|null);

        /** PermissionQuery permissions */
        permissions?: (number|null);

        /** PermissionQuery flush */
        flush?: (boolean|null);
    }

    /** Represents a PermissionQuery. */
    class PermissionQuery implements IPermissionQuery {

        /**
         * Constructs a new PermissionQuery.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IPermissionQuery);

        /** PermissionQuery channelId. */
        public channelId: number;

        /** PermissionQuery permissions. */
        public permissions: number;

        /** PermissionQuery flush. */
        public flush: boolean;

        /**
         * Creates a new PermissionQuery instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PermissionQuery instance
         */
        public static create(properties?: MumbleProto.IPermissionQuery): MumbleProto.PermissionQuery;

        /**
         * Encodes the specified PermissionQuery message. Does not implicitly {@link MumbleProto.PermissionQuery.verify|verify} messages.
         * @param message PermissionQuery message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IPermissionQuery, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified PermissionQuery message, length delimited. Does not implicitly {@link MumbleProto.PermissionQuery.verify|verify} messages.
         * @param message PermissionQuery message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IPermissionQuery, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a PermissionQuery message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PermissionQuery
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.PermissionQuery;

        /**
         * Decodes a PermissionQuery message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PermissionQuery
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.PermissionQuery;

        /**
         * Verifies a PermissionQuery message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a PermissionQuery message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PermissionQuery
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.PermissionQuery;

        /**
         * Creates a plain object from a PermissionQuery message. Also converts values to other types if specified.
         * @param message PermissionQuery
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.PermissionQuery, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this PermissionQuery to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PermissionQuery
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a CodecVersion. */
    interface ICodecVersion {

        /** CodecVersion alpha */
        alpha: number;

        /** CodecVersion beta */
        beta: number;

        /** CodecVersion preferAlpha */
        preferAlpha: boolean;

        /** CodecVersion opus */
        opus?: (boolean|null);
    }

    /** Represents a CodecVersion. */
    class CodecVersion implements ICodecVersion {

        /**
         * Constructs a new CodecVersion.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.ICodecVersion);

        /** CodecVersion alpha. */
        public alpha: number;

        /** CodecVersion beta. */
        public beta: number;

        /** CodecVersion preferAlpha. */
        public preferAlpha: boolean;

        /** CodecVersion opus. */
        public opus: boolean;

        /**
         * Creates a new CodecVersion instance using the specified properties.
         * @param [properties] Properties to set
         * @returns CodecVersion instance
         */
        public static create(properties?: MumbleProto.ICodecVersion): MumbleProto.CodecVersion;

        /**
         * Encodes the specified CodecVersion message. Does not implicitly {@link MumbleProto.CodecVersion.verify|verify} messages.
         * @param message CodecVersion message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.ICodecVersion, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified CodecVersion message, length delimited. Does not implicitly {@link MumbleProto.CodecVersion.verify|verify} messages.
         * @param message CodecVersion message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.ICodecVersion, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a CodecVersion message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns CodecVersion
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.CodecVersion;

        /**
         * Decodes a CodecVersion message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns CodecVersion
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.CodecVersion;

        /**
         * Verifies a CodecVersion message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a CodecVersion message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns CodecVersion
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.CodecVersion;

        /**
         * Creates a plain object from a CodecVersion message. Also converts values to other types if specified.
         * @param message CodecVersion
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.CodecVersion, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this CodecVersion to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for CodecVersion
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a UserStats. */
    interface IUserStats {

        /** UserStats session */
        session?: (number|null);

        /** UserStats statsOnly */
        statsOnly?: (boolean|null);

        /** UserStats certificates */
        certificates?: (Uint8Array[]|null);

        /** UserStats fromClient */
        fromClient?: (MumbleProto.UserStats.IStats|null);

        /** UserStats fromServer */
        fromServer?: (MumbleProto.UserStats.IStats|null);

        /** UserStats udpPackets */
        udpPackets?: (number|null);

        /** UserStats tcpPackets */
        tcpPackets?: (number|null);

        /** UserStats udpPingAvg */
        udpPingAvg?: (number|null);

        /** UserStats udpPingVar */
        udpPingVar?: (number|null);

        /** UserStats tcpPingAvg */
        tcpPingAvg?: (number|null);

        /** UserStats tcpPingVar */
        tcpPingVar?: (number|null);

        /** UserStats version */
        version?: (MumbleProto.IVersion|null);

        /** UserStats celtVersions */
        celtVersions?: (number[]|null);

        /** UserStats address */
        address?: (Uint8Array|null);

        /** UserStats bandwidth */
        bandwidth?: (number|null);

        /** UserStats onlinesecs */
        onlinesecs?: (number|null);

        /** UserStats idlesecs */
        idlesecs?: (number|null);

        /** UserStats strongCertificate */
        strongCertificate?: (boolean|null);

        /** UserStats opus */
        opus?: (boolean|null);

        /** UserStats rollingStats */
        rollingStats?: (MumbleProto.UserStats.IRollingStats|null);
    }

    /** Represents a UserStats. */
    class UserStats implements IUserStats {

        /**
         * Constructs a new UserStats.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IUserStats);

        /** UserStats session. */
        public session: number;

        /** UserStats statsOnly. */
        public statsOnly: boolean;

        /** UserStats certificates. */
        public certificates: Uint8Array[];

        /** UserStats fromClient. */
        public fromClient?: (MumbleProto.UserStats.IStats|null);

        /** UserStats fromServer. */
        public fromServer?: (MumbleProto.UserStats.IStats|null);

        /** UserStats udpPackets. */
        public udpPackets: number;

        /** UserStats tcpPackets. */
        public tcpPackets: number;

        /** UserStats udpPingAvg. */
        public udpPingAvg: number;

        /** UserStats udpPingVar. */
        public udpPingVar: number;

        /** UserStats tcpPingAvg. */
        public tcpPingAvg: number;

        /** UserStats tcpPingVar. */
        public tcpPingVar: number;

        /** UserStats version. */
        public version?: (MumbleProto.IVersion|null);

        /** UserStats celtVersions. */
        public celtVersions: number[];

        /** UserStats address. */
        public address: Uint8Array;

        /** UserStats bandwidth. */
        public bandwidth: number;

        /** UserStats onlinesecs. */
        public onlinesecs: number;

        /** UserStats idlesecs. */
        public idlesecs: number;

        /** UserStats strongCertificate. */
        public strongCertificate: boolean;

        /** UserStats opus. */
        public opus: boolean;

        /** UserStats rollingStats. */
        public rollingStats?: (MumbleProto.UserStats.IRollingStats|null);

        /**
         * Creates a new UserStats instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UserStats instance
         */
        public static create(properties?: MumbleProto.IUserStats): MumbleProto.UserStats;

        /**
         * Encodes the specified UserStats message. Does not implicitly {@link MumbleProto.UserStats.verify|verify} messages.
         * @param message UserStats message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IUserStats, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified UserStats message, length delimited. Does not implicitly {@link MumbleProto.UserStats.verify|verify} messages.
         * @param message UserStats message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IUserStats, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a UserStats message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UserStats
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.UserStats;

        /**
         * Decodes a UserStats message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UserStats
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.UserStats;

        /**
         * Verifies a UserStats message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a UserStats message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UserStats
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.UserStats;

        /**
         * Creates a plain object from a UserStats message. Also converts values to other types if specified.
         * @param message UserStats
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.UserStats, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this UserStats to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UserStats
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace UserStats {

        /** Properties of a Stats. */
        interface IStats {

            /** Stats good */
            good?: (number|null);

            /** Stats late */
            late?: (number|null);

            /** Stats lost */
            lost?: (number|null);

            /** Stats resync */
            resync?: (number|null);
        }

        /** Represents a Stats. */
        class Stats implements IStats {

            /**
             * Constructs a new Stats.
             * @param [properties] Properties to set
             */
            constructor(properties?: MumbleProto.UserStats.IStats);

            /** Stats good. */
            public good: number;

            /** Stats late. */
            public late: number;

            /** Stats lost. */
            public lost: number;

            /** Stats resync. */
            public resync: number;

            /**
             * Creates a new Stats instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Stats instance
             */
            public static create(properties?: MumbleProto.UserStats.IStats): MumbleProto.UserStats.Stats;

            /**
             * Encodes the specified Stats message. Does not implicitly {@link MumbleProto.UserStats.Stats.verify|verify} messages.
             * @param message Stats message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: MumbleProto.UserStats.IStats, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Stats message, length delimited. Does not implicitly {@link MumbleProto.UserStats.Stats.verify|verify} messages.
             * @param message Stats message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: MumbleProto.UserStats.IStats, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Stats message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Stats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.UserStats.Stats;

            /**
             * Decodes a Stats message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Stats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.UserStats.Stats;

            /**
             * Verifies a Stats message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Stats message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Stats
             */
            public static fromObject(object: { [k: string]: any }): MumbleProto.UserStats.Stats;

            /**
             * Creates a plain object from a Stats message. Also converts values to other types if specified.
             * @param message Stats
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: MumbleProto.UserStats.Stats, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Stats to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Stats
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a RollingStats. */
        interface IRollingStats {

            /** RollingStats timeWindow */
            timeWindow?: (number|null);

            /** RollingStats fromClient */
            fromClient?: (MumbleProto.UserStats.IStats|null);

            /** RollingStats fromServer */
            fromServer?: (MumbleProto.UserStats.IStats|null);
        }

        /** Represents a RollingStats. */
        class RollingStats implements IRollingStats {

            /**
             * Constructs a new RollingStats.
             * @param [properties] Properties to set
             */
            constructor(properties?: MumbleProto.UserStats.IRollingStats);

            /** RollingStats timeWindow. */
            public timeWindow: number;

            /** RollingStats fromClient. */
            public fromClient?: (MumbleProto.UserStats.IStats|null);

            /** RollingStats fromServer. */
            public fromServer?: (MumbleProto.UserStats.IStats|null);

            /**
             * Creates a new RollingStats instance using the specified properties.
             * @param [properties] Properties to set
             * @returns RollingStats instance
             */
            public static create(properties?: MumbleProto.UserStats.IRollingStats): MumbleProto.UserStats.RollingStats;

            /**
             * Encodes the specified RollingStats message. Does not implicitly {@link MumbleProto.UserStats.RollingStats.verify|verify} messages.
             * @param message RollingStats message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: MumbleProto.UserStats.IRollingStats, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified RollingStats message, length delimited. Does not implicitly {@link MumbleProto.UserStats.RollingStats.verify|verify} messages.
             * @param message RollingStats message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: MumbleProto.UserStats.IRollingStats, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a RollingStats message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns RollingStats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.UserStats.RollingStats;

            /**
             * Decodes a RollingStats message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns RollingStats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.UserStats.RollingStats;

            /**
             * Verifies a RollingStats message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a RollingStats message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns RollingStats
             */
            public static fromObject(object: { [k: string]: any }): MumbleProto.UserStats.RollingStats;

            /**
             * Creates a plain object from a RollingStats message. Also converts values to other types if specified.
             * @param message RollingStats
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: MumbleProto.UserStats.RollingStats, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this RollingStats to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for RollingStats
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }

    /** Properties of a RequestBlob. */
    interface IRequestBlob {

        /** RequestBlob sessionTexture */
        sessionTexture?: (number[]|null);

        /** RequestBlob sessionComment */
        sessionComment?: (number[]|null);

        /** RequestBlob channelDescription */
        channelDescription?: (number[]|null);
    }

    /** Represents a RequestBlob. */
    class RequestBlob implements IRequestBlob {

        /**
         * Constructs a new RequestBlob.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IRequestBlob);

        /** RequestBlob sessionTexture. */
        public sessionTexture: number[];

        /** RequestBlob sessionComment. */
        public sessionComment: number[];

        /** RequestBlob channelDescription. */
        public channelDescription: number[];

        /**
         * Creates a new RequestBlob instance using the specified properties.
         * @param [properties] Properties to set
         * @returns RequestBlob instance
         */
        public static create(properties?: MumbleProto.IRequestBlob): MumbleProto.RequestBlob;

        /**
         * Encodes the specified RequestBlob message. Does not implicitly {@link MumbleProto.RequestBlob.verify|verify} messages.
         * @param message RequestBlob message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IRequestBlob, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified RequestBlob message, length delimited. Does not implicitly {@link MumbleProto.RequestBlob.verify|verify} messages.
         * @param message RequestBlob message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IRequestBlob, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a RequestBlob message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns RequestBlob
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.RequestBlob;

        /**
         * Decodes a RequestBlob message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns RequestBlob
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.RequestBlob;

        /**
         * Verifies a RequestBlob message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a RequestBlob message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns RequestBlob
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.RequestBlob;

        /**
         * Creates a plain object from a RequestBlob message. Also converts values to other types if specified.
         * @param message RequestBlob
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.RequestBlob, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this RequestBlob to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for RequestBlob
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ServerConfig. */
    interface IServerConfig {

        /** ServerConfig maxBandwidth */
        maxBandwidth?: (number|null);

        /** ServerConfig welcomeText */
        welcomeText?: (string|null);

        /** ServerConfig allowHtml */
        allowHtml?: (boolean|null);

        /** ServerConfig messageLength */
        messageLength?: (number|null);

        /** ServerConfig imageMessageLength */
        imageMessageLength?: (number|null);

        /** ServerConfig maxUsers */
        maxUsers?: (number|null);

        /** ServerConfig recordingAllowed */
        recordingAllowed?: (boolean|null);
    }

    /** Represents a ServerConfig. */
    class ServerConfig implements IServerConfig {

        /**
         * Constructs a new ServerConfig.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IServerConfig);

        /** ServerConfig maxBandwidth. */
        public maxBandwidth: number;

        /** ServerConfig welcomeText. */
        public welcomeText: string;

        /** ServerConfig allowHtml. */
        public allowHtml: boolean;

        /** ServerConfig messageLength. */
        public messageLength: number;

        /** ServerConfig imageMessageLength. */
        public imageMessageLength: number;

        /** ServerConfig maxUsers. */
        public maxUsers: number;

        /** ServerConfig recordingAllowed. */
        public recordingAllowed: boolean;

        /**
         * Creates a new ServerConfig instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ServerConfig instance
         */
        public static create(properties?: MumbleProto.IServerConfig): MumbleProto.ServerConfig;

        /**
         * Encodes the specified ServerConfig message. Does not implicitly {@link MumbleProto.ServerConfig.verify|verify} messages.
         * @param message ServerConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IServerConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ServerConfig message, length delimited. Does not implicitly {@link MumbleProto.ServerConfig.verify|verify} messages.
         * @param message ServerConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IServerConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ServerConfig message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ServerConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.ServerConfig;

        /**
         * Decodes a ServerConfig message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ServerConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.ServerConfig;

        /**
         * Verifies a ServerConfig message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ServerConfig message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ServerConfig
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.ServerConfig;

        /**
         * Creates a plain object from a ServerConfig message. Also converts values to other types if specified.
         * @param message ServerConfig
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.ServerConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ServerConfig to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ServerConfig
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SuggestConfig. */
    interface ISuggestConfig {

        /** SuggestConfig versionV1 */
        versionV1?: (number|null);

        /** SuggestConfig versionV2 */
        versionV2?: (number|Long|null);

        /** SuggestConfig positional */
        positional?: (boolean|null);

        /** SuggestConfig pushToTalk */
        pushToTalk?: (boolean|null);
    }

    /** Represents a SuggestConfig. */
    class SuggestConfig implements ISuggestConfig {

        /**
         * Constructs a new SuggestConfig.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.ISuggestConfig);

        /** SuggestConfig versionV1. */
        public versionV1: number;

        /** SuggestConfig versionV2. */
        public versionV2: (number|Long);

        /** SuggestConfig positional. */
        public positional: boolean;

        /** SuggestConfig pushToTalk. */
        public pushToTalk: boolean;

        /**
         * Creates a new SuggestConfig instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SuggestConfig instance
         */
        public static create(properties?: MumbleProto.ISuggestConfig): MumbleProto.SuggestConfig;

        /**
         * Encodes the specified SuggestConfig message. Does not implicitly {@link MumbleProto.SuggestConfig.verify|verify} messages.
         * @param message SuggestConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.ISuggestConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SuggestConfig message, length delimited. Does not implicitly {@link MumbleProto.SuggestConfig.verify|verify} messages.
         * @param message SuggestConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.ISuggestConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SuggestConfig message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SuggestConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.SuggestConfig;

        /**
         * Decodes a SuggestConfig message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SuggestConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.SuggestConfig;

        /**
         * Verifies a SuggestConfig message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SuggestConfig message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SuggestConfig
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.SuggestConfig;

        /**
         * Creates a plain object from a SuggestConfig message. Also converts values to other types if specified.
         * @param message SuggestConfig
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.SuggestConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SuggestConfig to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SuggestConfig
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PluginDataTransmission. */
    interface IPluginDataTransmission {

        /** PluginDataTransmission senderSession */
        senderSession?: (number|null);

        /** PluginDataTransmission receiverSessions */
        receiverSessions?: (number[]|null);

        /** PluginDataTransmission data */
        data?: (Uint8Array|null);

        /** PluginDataTransmission dataID */
        dataID?: (string|null);
    }

    /** Represents a PluginDataTransmission. */
    class PluginDataTransmission implements IPluginDataTransmission {

        /**
         * Constructs a new PluginDataTransmission.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleProto.IPluginDataTransmission);

        /** PluginDataTransmission senderSession. */
        public senderSession: number;

        /** PluginDataTransmission receiverSessions. */
        public receiverSessions: number[];

        /** PluginDataTransmission data. */
        public data: Uint8Array;

        /** PluginDataTransmission dataID. */
        public dataID: string;

        /**
         * Creates a new PluginDataTransmission instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PluginDataTransmission instance
         */
        public static create(properties?: MumbleProto.IPluginDataTransmission): MumbleProto.PluginDataTransmission;

        /**
         * Encodes the specified PluginDataTransmission message. Does not implicitly {@link MumbleProto.PluginDataTransmission.verify|verify} messages.
         * @param message PluginDataTransmission message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleProto.IPluginDataTransmission, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified PluginDataTransmission message, length delimited. Does not implicitly {@link MumbleProto.PluginDataTransmission.verify|verify} messages.
         * @param message PluginDataTransmission message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleProto.IPluginDataTransmission, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a PluginDataTransmission message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PluginDataTransmission
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleProto.PluginDataTransmission;

        /**
         * Decodes a PluginDataTransmission message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PluginDataTransmission
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleProto.PluginDataTransmission;

        /**
         * Verifies a PluginDataTransmission message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a PluginDataTransmission message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PluginDataTransmission
         */
        public static fromObject(object: { [k: string]: any }): MumbleProto.PluginDataTransmission;

        /**
         * Creates a plain object from a PluginDataTransmission message. Also converts values to other types if specified.
         * @param message PluginDataTransmission
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleProto.PluginDataTransmission, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this PluginDataTransmission to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PluginDataTransmission
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}

/** Namespace MumbleUDP. */
export namespace MumbleUDP {

    /** Properties of an Audio. */
    interface IAudio {

        /** Audio target */
        target?: (number|null);

        /** Audio context */
        context?: (number|null);

        /** Audio senderSession */
        senderSession?: (number|null);

        /** Audio frameNumber */
        frameNumber?: (number|Long|null);

        /** Audio opusData */
        opusData?: (Uint8Array|null);

        /** Audio positionalData */
        positionalData?: (number[]|null);

        /** Audio volumeAdjustment */
        volumeAdjustment?: (number|null);

        /** Audio isTerminator */
        isTerminator?: (boolean|null);
    }

    /** Represents an Audio. */
    class Audio implements IAudio {

        /**
         * Constructs a new Audio.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleUDP.IAudio);

        /** Audio target. */
        public target?: (number|null);

        /** Audio context. */
        public context?: (number|null);

        /** Audio senderSession. */
        public senderSession: number;

        /** Audio frameNumber. */
        public frameNumber: (number|Long);

        /** Audio opusData. */
        public opusData: Uint8Array;

        /** Audio positionalData. */
        public positionalData: number[];

        /** Audio volumeAdjustment. */
        public volumeAdjustment: number;

        /** Audio isTerminator. */
        public isTerminator: boolean;

        /** Audio Header. */
        public Header?: ("target"|"context");

        /**
         * Creates a new Audio instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Audio instance
         */
        public static create(properties?: MumbleUDP.IAudio): MumbleUDP.Audio;

        /**
         * Encodes the specified Audio message. Does not implicitly {@link MumbleUDP.Audio.verify|verify} messages.
         * @param message Audio message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleUDP.IAudio, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Audio message, length delimited. Does not implicitly {@link MumbleUDP.Audio.verify|verify} messages.
         * @param message Audio message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleUDP.IAudio, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an Audio message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Audio
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleUDP.Audio;

        /**
         * Decodes an Audio message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Audio
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleUDP.Audio;

        /**
         * Verifies an Audio message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an Audio message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Audio
         */
        public static fromObject(object: { [k: string]: any }): MumbleUDP.Audio;

        /**
         * Creates a plain object from an Audio message. Also converts values to other types if specified.
         * @param message Audio
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleUDP.Audio, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Audio to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Audio
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Ping. */
    interface IPing {

        /** Ping timestamp */
        timestamp?: (number|Long|null);

        /** Ping requestExtendedInformation */
        requestExtendedInformation?: (boolean|null);

        /** Ping serverVersionV2 */
        serverVersionV2?: (number|Long|null);

        /** Ping userCount */
        userCount?: (number|null);

        /** Ping maxUserCount */
        maxUserCount?: (number|null);

        /** Ping maxBandwidthPerUser */
        maxBandwidthPerUser?: (number|null);
    }

    /**
     * Ping message for checking UDP connectivity (and roundtrip ping) and potentially obtaining further server
     * details (e.g. version).
     */
    class Ping implements IPing {

        /**
         * Constructs a new Ping.
         * @param [properties] Properties to set
         */
        constructor(properties?: MumbleUDP.IPing);

        /** Ping timestamp. */
        public timestamp: (number|Long);

        /** Ping requestExtendedInformation. */
        public requestExtendedInformation: boolean;

        /** Ping serverVersionV2. */
        public serverVersionV2: (number|Long);

        /** Ping userCount. */
        public userCount: number;

        /** Ping maxUserCount. */
        public maxUserCount: number;

        /** Ping maxBandwidthPerUser. */
        public maxBandwidthPerUser: number;

        /**
         * Creates a new Ping instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Ping instance
         */
        public static create(properties?: MumbleUDP.IPing): MumbleUDP.Ping;

        /**
         * Encodes the specified Ping message. Does not implicitly {@link MumbleUDP.Ping.verify|verify} messages.
         * @param message Ping message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: MumbleUDP.IPing, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Ping message, length delimited. Does not implicitly {@link MumbleUDP.Ping.verify|verify} messages.
         * @param message Ping message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: MumbleUDP.IPing, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Ping message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): MumbleUDP.Ping;

        /**
         * Decodes a Ping message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): MumbleUDP.Ping;

        /**
         * Verifies a Ping message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Ping message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Ping
         */
        public static fromObject(object: { [k: string]: any }): MumbleUDP.Ping;

        /**
         * Creates a plain object from a Ping message. Also converts values to other types if specified.
         * @param message Ping
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: MumbleUDP.Ping, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Ping to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Ping
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
