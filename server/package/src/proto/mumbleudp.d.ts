import * as $protobuf from "protobufjs";
import Long = require("long");
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

    /** Represents a Ping. */
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
