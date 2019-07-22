/// <reference types="node" />
export declare class MessageBuilder {
    maxBytes: number;
    buffer: Buffer;
    cursor: number;
    constructor(maxBytes?: number);
    raw(): Buffer;
    pad(num: number): any;
    put(data: any): any;
    putInt8(num: number | Buffer): any;
    putInt16(num: number | Buffer): any;
    putInt32(num: number | Buffer): any;
    putInt64(num: number | Buffer | Date): any;
    putString(str: string): any;
    putVarInt(num: number): any;
    putVarString(str: string): any;
    ensureSize(additionalBytes: number): any;
}
export declare class MessageParser {
    pointer: number;
    hasFailed: boolean;
    failedStack: boolean | string;
    buffer: Buffer;
    constructor(raw: Buffer);
    markFailed(): boolean;
    pointerCheck(num?: number): boolean;
    pointerPosition(): number;
    incrPointer(amount: number): boolean;
    setPointer(amount: number): any;
    readInt8(): any;
    readUInt16LE(): any;
    readUInt32LE(): any;
    readUInt64LE(): any;
    readVarInt(): any;
    readVarString(): string | boolean;
    raw(length: number, increment?: boolean): any;
    rawSegment(start: number, end: number): any;
}
