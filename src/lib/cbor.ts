// + updated version from https://github.com/code4fukui/CBOR-es
// + modified to basic TypeScript by Johannes
/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2014-2016 Patrick Gansterer <paroga@paroga.com>
 * Copyright (c) 2021 Taisuke Fukuno <fukuno@jig.jp>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const POW_2_24 = Math.pow(2, -24);
const POW_2_32 = Math.pow(2, 32);
const POW_2_53 = Math.pow(2, 53);

/**
 * Encodes a given value into CBOR (Concise Binary Object Representation) format.
 * This function takes a wide range of JavaScript data types and serializes them into
 * a compact binary format. It supports numbers, strings, arrays, objects, and more.
 *
 * @param value - The value to be encoded into CBOR format.
 *                This can be any type that is supported by the CBOR format,
 *                including primitives, arrays, and objects.
 * @returns A Uint8Array containing the CBOR-encoded data.
 *          This binary representation can be transmitted or stored
 *          and later decoded back into its original format.
 */
function encode(value: any): Uint8Array {
  let data = new ArrayBuffer(256);
  let dataView = new DataView(data);
  let lastLength: number;
  let offset = 0;

  function prepareWrite(length: number): DataView {
    let newByteLength = data.byteLength;
    const requiredLength = offset + length;
    while (newByteLength < requiredLength)
      newByteLength <<= 1;
    if (newByteLength !== data.byteLength) {
      const oldDataView = dataView;
      data = new ArrayBuffer(newByteLength);
      dataView = new DataView(data);
      const uint32count = (offset + 3) >> 2;
      for (let i = 0; i < uint32count; ++i)
        dataView.setUint32(i << 2, oldDataView.getUint32(i << 2));
    }

    lastLength = length;
    return dataView;
  }

  function commitWrite(notUsed?: any) {
    offset += lastLength;
  }

  function writeFloat64(value: number): void {
    commitWrite(prepareWrite(8).setFloat64(offset, value));
  }

  function writeUint8(value: number) {
    commitWrite(prepareWrite(1).setUint8(offset, value));
  }

  function writeUint8Array(value: Uint8Array): void {
    const dataView = prepareWrite(value.length);
    for (let i = 0; i < value.length; ++i)
      dataView.setUint8(offset + i, value[i]);
    commitWrite();
  }

  function writeUint16(value: number): void {
    commitWrite(prepareWrite(2).setUint16(offset, value));
  }

  function writeUint32(value: number): void {
    commitWrite(prepareWrite(4).setUint32(offset, value));
  }

  function writeUint64(value: number): void {
    const low = value % POW_2_32;
    const high = (value - low) / POW_2_32;
    const dataView = prepareWrite(8);
    dataView.setUint32(offset, high);
    dataView.setUint32(offset + 4, low);
    commitWrite();
  }

  function writeTypeAndLength(type: number, length: number): void {
    if (length < 24) {
      writeUint8(type << 5 | length);
    } else if (length < 0x100) {
      writeUint8(type << 5 | 24);
      writeUint8(length);
    } else if (length < 0x10000) {
      writeUint8(type << 5 | 25);
      writeUint16(length);
    } else if (length < 0x100000000) {
      writeUint8(type << 5 | 26);
      writeUint32(length);
    } else {
      writeUint8(type << 5 | 27);
      writeUint64(length);
    }
  }

  function encodeItem(value: any): void {
    if (value === false)
      return writeUint8(0xf4);
    if (value === true)
      return writeUint8(0xf5);
    if (value === null)
      return writeUint8(0xf6);
    if (value === undefined)
      return writeUint8(0xf7);

    switch (typeof value) {
      case "number":
        if (Math.floor(value) === value) {
          if (0 <= value && value <= POW_2_53)
            return writeTypeAndLength(0, value);
          if (-POW_2_53 <= value && value < 0)
            return writeTypeAndLength(1, -(value + 1));
        }
        writeUint8(0xfb);
        return writeFloat64(value);

      case "string":
        const utf8data = new TextEncoder().encode(value);
        writeTypeAndLength(3, utf8data.length);
        return writeUint8Array(utf8data);

      default:
        let length;
        if (Array.isArray(value)) {
          length = value.length;
          writeTypeAndLength(4, length);
          for (let i = 0; i < length; ++i)
            encodeItem(value[i]);
        } else if (value instanceof Uint8Array) {
          writeTypeAndLength(2, value.length);
          writeUint8Array(value);
        } else {
          const keys = Object.keys(value);
          length = keys.length;
          writeTypeAndLength(5, length);
          for (let i = 0; i < length; ++i) {
            const key = keys[i];
            encodeItem(key);
            encodeItem(value[key]);
          }
        }
    }
  }

  encodeItem(value);

  return new Uint8Array(data, 0, offset);
}

/**
 * Decodes CBOR formatted data.
 *
 * @param data - The binary data to be decoded in CBOR format.
 * @param tagger - A function to process tagged values. It takes a tag number and its associated value, returning a processed value.
 * @param simpleValue - A function to handle CBOR's simple values. If not a function, it is interpreted as undefined.
 * @param decodeFirstFlag - If set to true, only the first element will be decoded.
 * @returns Returns the decoded value.
 */
function decode(
  data: Uint8Array,
  tagger?: (tag: number, value: any) => any,
  simpleValue?: ((value: any) => any),
  decodeFirstFlag: boolean = false
): any {
  const dataByteLength = data.length;
  const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  if (typeof tagger !== "function")
    tagger = function(value) { return value; };
  if (typeof simpleValue !== "function")
    simpleValue = function() { return undefined; };

  function commitRead(length: number, value: any): any {
    offset += length;
    return value;
  }

  function readArrayBuffer(length: number): Uint8Array {
    return commitRead(length, new Uint8Array(data.buffer, data.byteOffset + offset, length));
  }

  function readFloat16(): number {
    const tempArrayBuffer = new ArrayBuffer(4);
    const tempDataView = new DataView(tempArrayBuffer);
    const value = readUint16();

    const sign = value & 0x8000;
    let exponent = value & 0x7c00;
    const fraction = value & 0x03ff;

    if (exponent === 0x7c00)
      exponent = 0xff << 10;
    else if (exponent !== 0)
      exponent += (127 - 15) << 10;
    else if (fraction !== 0)
      return (sign ? -1 : 1) * fraction * POW_2_24;

    tempDataView.setUint32(0, sign << 16 | exponent << 13 | fraction << 13);
    return tempDataView.getFloat32(0);
  }

  function readFloat32() {
    return commitRead(4, dataView.getFloat32(offset));
  }

  function readFloat64() {
    return commitRead(8, dataView.getFloat64(offset));
  }

  function readUint8() {
    return commitRead(1, dataView.getUint8(offset));
  }

  function readUint16() {
    return commitRead(2, dataView.getUint16(offset));
  }

  function readUint32() {
    return commitRead(4, dataView.getUint32(offset));
  }

  function readUint64() {
    return readUint32() * POW_2_32 + readUint32();
  }

  function readBreak() {
    if (dataView.getUint8(offset) !== 0xff)
      return false;
    offset += 1;
    return true;
  }

  function readLength(additionalInformation: number): number {
    if (additionalInformation < 24)
      return additionalInformation;
    if (additionalInformation === 24)
      return readUint8();
    if (additionalInformation === 25)
      return readUint16();
    if (additionalInformation === 26)
      return readUint32();
    if (additionalInformation === 27)
      return readUint64();
    if (additionalInformation === 31)
      return -1;
    throw "Invalid length encoding";
  }

  function readIndefiniteStringLength(majorType: number): number {
    const initialByte = readUint8();
    if (initialByte === 0xff)
      return -1;
    const length = readLength(initialByte & 0x1f);
    if (length < 0 || (initialByte >> 5) !== majorType)
      throw "Invalid indefinite length element";
    return length;
  }

  function decodeItem(): any {
    const initialByte = readUint8();
    const majorType = initialByte >> 5;
    const additionalInformation = initialByte & 0x1f;
    let length;

    if (majorType === 7) {
      switch (additionalInformation) {
        case 25:
          return readFloat16();
        case 26:
          return readFloat32();
        case 27:
          return readFloat64();
      }
    }

    length = readLength(additionalInformation);
    if (length < 0 && (majorType < 2 || 6 < majorType))
      throw "Invalid length";

    switch (majorType) {
      case 0:
        return length;
      case 1:
        return -1 - length;
      case 2:
        if (length < 0) {
          const elements = [];
          let fullArrayLength = 0;
          while ((length = readIndefiniteStringLength(majorType)) >= 0) {
            fullArrayLength += length;
            elements.push(readArrayBuffer(length));
          }
          const fullArray = new Uint8Array(fullArrayLength);
          let fullArrayOffset = 0;
          for (let i = 0; i < elements.length; ++i) {
            fullArray.set(elements[i], fullArrayOffset);
            fullArrayOffset += elements[i].length;
          }
          return fullArray;
        }
        return readArrayBuffer(length);
      case 3:
        const data = (() => { // copy from case 2
          if (length < 0) {
            const elements = [];
            let fullArrayLength = 0;
            while ((length = readIndefiniteStringLength(majorType)) >= 0) {
              fullArrayLength += length;
              elements.push(readArrayBuffer(length));
            }
            const fullArray = new Uint8Array(fullArrayLength);
            let fullArrayOffset = 0;
            for (let i = 0; i < elements.length; ++i) {
              fullArray.set(elements[i], fullArrayOffset);
              fullArrayOffset += elements[i].length;
            }
            return fullArray;
          }
          return readArrayBuffer(length);
        })();
        return new TextDecoder().decode(data);
      case 4:
        let retArray;
        if (length < 0) {
          retArray = [];
          while (!readBreak())
            retArray.push(decodeItem());
        } else {
          retArray = new Array(length);
          for (let i = 0; i < length; ++i)
            retArray[i] = decodeItem();
        }
        return retArray;
      case 5:
        const retObject = {} as any;
        for (let i = 0; i < length || length < 0 && !readBreak(); ++i) {
          const key = decodeItem();
          retObject[key] = decodeItem();
        }
        return retObject;
      case 6:
        return tagger!(decodeItem(), length);
      case 7:
        switch (length) {
          case 20:
            return false;
          case 21:
            return true;
          case 22:
            return null;
          case 23:
            return undefined;
          default:
            return simpleValue!(length);
        }
    }
  }

  const ret = decodeItem();
  if (offset !== dataByteLength && !decodeFirstFlag) {
    throw new Error("Remaining bytes: " + offset + " is not " + dataByteLength);
  }
  return ret;
}


/**
 * Decodes the first element from a given CBOR (Concise Binary Object Representation) encoded data.
 * This function is particularly useful when dealing with CBOR data that contains multiple elements,
 * but only the first element is needed. It utilizes the 'decode' function internally but stops
 * after decoding the first element.
 * @param data - The binary data to be decoded in CBOR format.
 * @param tagger - A function to process tagged values. It takes a tag number and its associated value, returning a processed value.
 * @param simpleValue- A function to handle CBOR's simple values. If not a function, it is interpreted as undefined.
 * @returns Returns the decoded value.
 */
function decodeFirst(
  data: Uint8Array,
  tagger?: (tag: number, value: any) => any,
  simpleValue?: ((value: any) => any),
): any {
  return decode(data, tagger, simpleValue, true);
}

export const CBOR = { encode, decode, decodeFirst };
