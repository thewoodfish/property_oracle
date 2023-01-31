// config 
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// important imports
import * as Kilt from '@kiltprotocol/sdk-js'
import { mnemonicGenerate, cryptoWaitReady, blake2AsHex, xxhashAsHex, mnemonicToMiniSecret } from '@polkadot/util-crypto';
import { Keyring } from '@polkadot/keyring';

// utility functions
// const util = require("./utility.cjs");

// set up the samaritan test account
const keyring = new Keyring({ type: 'sr25519' });
let api = undefined;
let sam = undefined;

cryptoWaitReady().then(() => {
    sam = keyring.createFromUri("yellow obscure salmon affair extra six bubble clutch fly bread away tired", 'sr25519');
});

export async function connect() {
    try {
        // set up the samaritan test account
        api = await Kilt.connect('wss://peregrine.kilt.io/parachain-public-ws');
    } catch (e) {
        return false;
    }
    return true;
}

export async function getKiltLightDID(cid) {
    const keyring = new Keyring({ type: 'sr25519' });
    const mnemonic = mnemonicGenerate();
    const auth = keyring.createFromUri(mnemonic, 'sr25519');
    const service = [
        {
            id: '#claims-repo',
            type: ['KiltPublishedCredentialCollectionV1'],
            serviceEndpoint: [`http://ipfs.io/ipfs/${cid}`],
        },
    ];

    // Create a light DID from the generated authentication key.
    const lightDID = Kilt.Did.createLightDidDocument({
        authentication: [auth],
        service
    })

    return lightDID
}