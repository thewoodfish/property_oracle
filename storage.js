// config 
import { createRequire } from "module";
const require = createRequire(import.meta.url);

import * as IPFS from "ipfs-core";

import toBuffer from 'it-to-buffer';
const ipfs = await IPFS.create();

// local imports
import * as util from "./utility.js";

export async function uploadToIPFS(path) {
    const { cid } = await ipfs.add(path);
    console.info(cid);
    if (cid)
        console.log(cid.toV0().toString());
    else
        throw new Error('IPFS add failed, please try again.');
    return cid;
}

export async function getFromIPFS(cid) {
    const bufferedContents = await toBuffer(ipfs.cat(cid)); // returns a Buffer
    return util.Utf8ArrayToStr(bufferedContents);
}