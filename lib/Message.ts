const spareBytes = 512;
const isDate = (item: any): item is Date => {
  return (<Date>item).getMonth !== undefined;
}

export class MessageBuilder {
  maxBytes: number;
  buffer: Buffer;
  cursor: number;

  constructor(maxBytes?: number) {
    this.maxBytes = maxBytes || 20000000;
    this.buffer = Buffer.alloc(Math.min(this.maxBytes, 10000));
    this.cursor = 0;
  }

  public raw(): Buffer {
    var out = Buffer.alloc(this.cursor);
    this.buffer.copy(out, 0, 0, this.cursor);
    return out;
  }

  public pad(num: number): any {
    var data = Buffer.alloc(num);
    data.fill(0);
    return this.put(data);
  }

  public put(data: any): any {
    if (typeof data == 'number' && data <= 255) {
      this.ensureSize(1);
      this.buffer[this.cursor] = data;
      this.cursor += 1;
      return this;
    }

    this.ensureSize(data.length);
    data.copy(this.buffer, this.cursor);
    this.cursor += data.length;
    return this;
  }

  public putInt8(num: number | Buffer): any {
    if (Buffer.isBuffer(num)) {
      return this.put(num.slice(0, 1));
    }
    return this.put(num);
  }

  public putInt16(num: number | Buffer): any {
    if (Buffer.isBuffer(num)) {
      return this.put(num.slice(0, 2));
    }
    var data = Buffer.alloc(2);
    data.writeUInt16LE(num, 0);
    return this.put(data);
  }

  public putInt32(num: number | Buffer): any {
    if (Buffer.isBuffer(num)) {
      return this.put(num.slice(0, 4));
    } else if (isDate(num)) {
      return this.putInt32(num.getTime()/1000); // Pull timestamp from Date object
    }
    var data = Buffer.alloc(4);
    data.writeUInt32LE(num, 0);
    return this.put(data);
  }

  public putInt64(num: number | Buffer | Date): any {
    if (Buffer.isBuffer(num)) {
      return this.put(num.slice(0, 8));
    } else if (isDate(num)) {
      return this.putInt64(num.getTime()/1000); // Pull timestamp from Date object
    }
    // Pad a 32-bit number to fit in a 64-bit space
    var data = Buffer.alloc(8);
    data.fill(0);
    data.writeUInt32LE(num, 0);
    return this.put(data);
  }

  public putString(str: string): any {
    var data = Buffer.alloc(str.length);
    for(var i = 0; i < str.length; i++) {
      data[i] = str.charCodeAt(i);
    }
    return this.put(data);
  }

  public putVarInt(num: number): any {
    if (num < 0xfd) {
      return this.put(num);
    } else if (num <= 0xffff) {
      return this.put(0xfd).putInt16(num);
    } else if (num <= 0xffffffff) {
      return this.put(0xfe).putInt32(num);
    } else {
      return this.put(0xff).putInt64(num);
    }
  }

  public putVarString(str: string): any {
    return this.putVarInt(str.length).putString(str);
  }

  public ensureSize(additionalBytes: number): any {
    var requiredBytes = this.cursor + additionalBytes;

    if (requiredBytes > this.maxBytes) {
      throw new Error('Message size is limited to ' + this.maxBytes + ' bytes');
    } else if (requiredBytes > this.buffer.length) {
      var oldBuffer = this.buffer;
      this.buffer = Buffer.alloc(Math.min(this.maxBytes, requiredBytes + spareBytes));
      oldBuffer.copy(this.buffer);
    }
    return this;
  }
}

export class MessageParser {
  pointer: number;
  hasFailed: boolean;
  failedStack: boolean | string;
  buffer: Buffer;

  constructor(raw: Buffer) {
    this.buffer = Buffer.alloc(raw.length);
    raw.copy(this.buffer);

    this.pointer = 0;
    this.hasFailed = false;
    this.failedStack = false;
  }

  markFailed(): boolean {
    if (this.hasFailed) return false;
    this.hasFailed = true;
    this.failedStack = new Error().stack as string;
    return true;
  }

  pointerCheck(num? :number): boolean {
    num = (num) ? +num : 0;
    if (this.buffer.length < this.pointer+num) {
      this.markFailed();
      return false;
    }
    return true;
  }

  pointerPosition(): number {
    const pos = this.pointer;
    return pos;
  }

  incrPointer(amount: number): boolean {
    if (this.hasFailed) return false;
    if (typeof amount !== 'number') {
      this.markFailed();
      return false;
    }
    this.pointer += amount;
    this.pointerCheck();
    return true;
  }

  setPointer(amount: number): any {
    if (this.hasFailed) return false;
    if (typeof amount !== 'number') {
      this.markFailed();
      return false;
    }
    this.pointer = amount;
    this.pointerCheck();
  }

  readInt8(): any {
    if (this.hasFailed || this.pointerCheck() === false) return false;
    var out = this.buffer[this.pointer];
    this.incrPointer(1);
    return out;
  }

  readUInt16LE(): any {
    if (this.hasFailed || this.pointerCheck(2) === false) return false;
    var out = this.buffer.readUInt16LE(this.pointer);
    this.incrPointer(2);
    return out
  }

  readUInt32LE(): any {
    if (this.hasFailed || this.pointerCheck(4) === false) return false;
    var out = this.buffer.readUInt32LE(this.pointer);
    this.incrPointer(4);
    return out
  }

  readUInt64LE(): any {
    if (this.hasFailed || this.pointerCheck(8) === false) return false;
    var out = parseInt(this.raw(8).reverse().toString('hex'),16)
    this.incrPointer(8);
    return out
  }

  readVarInt(): any {
    if (this.hasFailed || this.pointerCheck() === false) return false;
    var flag = this.readInt8();
    if (flag < 0xfd) {
      return flag;
    } else if (flag == 0xfd) {
      return this.readUInt16LE();
    } else if (flag == 0xfe) {
      return this.readUInt32LE();
    } else {
      return this.readUInt64LE();
    }
  }

  readVarIntAndBytes(): any {
    if (this.hasFailed || this.pointerCheck() === false) return false;
    var flag = this.readInt8();
    if (flag < 0xfd) {
      return {
        data: flag,
        bytes: 1
      };
    } else if (flag == 0xfd) {
      return {
        data: this.readUInt16LE(),
        bytes: 2
      };
    } else if (flag == 0xfe) {
      return {
        data: this.readUInt32LE(),
        bytes: 4
      };
    } else {
      return {
        data: this.readUInt64LE(),
        bytes: 8
      };
    }
  }

  readVarString(): string | boolean {
    if (this.hasFailed || this.pointerCheck() === false) return false;
    var length = this.readVarInt();
    var str = [];
    for (var i = 0; i < length; i++) {
      str.push(String.fromCharCode(this.readInt8() as number));
    }
    return str.join('');
  }

  raw(length: number, increment: boolean = true): any {
    if (this.hasFailed || this.pointerCheck(length) === false) return false;
    if (typeof length !== 'number') {
      this.markFailed();
      return false;
    }
    var out = Buffer.alloc(length);
    this.buffer.copy(out, 0, this.pointer, this.pointer+length);
    if (increment) {
      this.incrPointer(length);
    }
    return out;
  }

  rawSegment(start: number, end: number): any {
    const length = end - start;
    if (length > this.buffer.length) {
      this.markFailed();
      return false;
    }
    let out = Buffer.alloc(length);
    this.buffer.copy(out, 0, start, end);
    return out;
  }

}
