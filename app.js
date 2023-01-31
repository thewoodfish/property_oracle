// config 
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// imports
const express = require('express');
const app = express();
const port = 4000;
const bodyParser = require('body-parser');
const cors = require("cors");

// static files
app.use(express.static('public'));
app.use('/css', express.static(__dirname + 'public/css'));
app.use('/js', express.static(__dirname + 'public/js'));
app.use('/img', express.static(__dirname + 'public/img'));

// set views
app.set('views', './views');
app.set('view engine', 'ejs');

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }))

// blockchain essentials
import { ApiPromise, WsProvider } from '@polkadot/api';
import { mnemonicGenerate, cryptoWaitReady, blake2AsHex, xxhashAsHex } from '@polkadot/util-crypto';
const { Keyring } = require('@polkadot/keyring');

// local imports
import * as kilt from "./kilt.js";
import * as storg from "./storage.js";

// blockchain config
let wsProvider = undefined;
let api = undefined;
const keyring = new Keyring({ type: 'sr25519' });

cryptoWaitReady().then(() => {
    const alice = keyring.addFromUri('//Alice');    // for running tests
});

app.get('', (req, res) => {
    res.render('index', { text: 'This is sparta' });
});

app.post('/connect-chains', (req, res) => {
    console.log(req.body);
    (async function () {
        await initChains(req.body).then(() => res.send({ status: "connected", error: false }));
    })();
});

app.post('/reg-keys', (req, res) => {
    createNewUser(req.body, res);
});

// handler functions (below)

// try to connect to the Property Oracle and KILT chains
async function initChains(req) {
    wsProvider = new WsProvider(req.addr);
    const result = await new Promise(async (resolve) => {
        api = await ApiPromise.create({ provider: wsProvider });
        if (await kilt.connect())
            resolve(api);
    });

    return api;
}

async function createNewUser(req, res) {
    // first generate the mnemonics
    const mnemonic = mnemonicGenerate();
    const user_keys = keyring.createFromUri(mnemonic, 'sr25519');

    // upload empty object to hold users credentials
    await storg.uploadToIPFS(JSON.stringify([])).then(cid => {
        console.log("The CID is  " + cid);
        
        // create a lightDID for the user
        let user_ldid = kilt.getKiltLightDID(cid);

        // modify DID document
        user_ldid.service[0].serviceEndpoint = `http://ipfs.io/ipfs/${cid}`;
    });
}


// listen on port 3000
app.listen(port, () => console.info(`listening on port ${port}`));