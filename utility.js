export function Utf8ArrayToStr(array) {

    // adopted from:
    //   http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt

    /* utf.js - UTF-8 <=> UTF-16 convertion
    *
    * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
    * Version: 1.0
    * LastModified: Dec 25 1999
    * This library is free.  You can redistribute it and/or modify it.
    */

    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;

    while (i < len) {
        c = array[i++];
        switch (c >> 4) {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12: case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
                break;
        }
    }

    return out;
}

export function getDid(didDoc) {
    // it might be a light or full kilt DID
    didDoc = typeof didDoc === "string" ? JSON.parse(didDoc) : didDoc;
    if (didDoc.uri) // ligth
        return didDoc.uri.split(`:`, 4).join(`:`);
    else
        return didDoc.fullDid.uri;
}

export function strToCType(str) {
    let obj = {};
    let buf = str.split("~");
    for (const i in buf) {
        obj[i] = {
            type: "string"
        };
    }

    return obj;
}

export function generateRandomNumber() {
    var min = 1;
    var max = 100;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sortBy(key, arr) {
    return arr.sort((a, b) => {
        if (a[key] < b[key]) {
            return -1;
        } else if (a[key] > b[key]) {
            return 1;
        } else {
            return 0;
        }
    });
}

export function matchProperty(attr, values) {
    let props = {};
    attr.map((x, i) => props[x] = values[i]);
    return props;
}
