// config 
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import path, { parse } from 'path';
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
import * as util from "./utility.js";

// blockchain config
let wsProvider = new WsProvider('ws://127.0.0.1:9944');
let api = await ApiPromise.create({ provider: wsProvider });
const keyring = new Keyring({ type: 'sr25519' });
let alice = undefined;
let bob = undefined;

// a very simple session cache
class SessionCache {
    cache = {}

    get = (key) => {
        return this.cache[key];
    }

    set = (key, value) => {
        this.cache[key] = value;
        return value;
    }

    del = (key) => {
        const val = cache[key];
        delete this.cache[key];
        return val;
    }

    has = (key) => {
        return key in this.cache;
    }
}

let oracleCache = new SessionCache();

// wait 5 secs for the wasm init
setTimeout(async () => {
    await cryptoWaitReady().then(() => {
        alice = keyring.addFromUri('//Alice');    // for running tests
        bob = keyring.addFromUri('//Bob');    // for running tests
    });
}, 5000);

// route request handlers
app.get('', (req, res) => {
    res.render('index', { text: 'This is sparta' });
});

app.post('/connect-chains', (req, res) => {
    (async function () {
        await initChains(req.body).then(() => res.send({ status: "connected", error: false }));
    })();
});

app.post('/gen-keys', (req, res) => {
    createNewUser(req.body, res);
});

app.post('/register-ptype', (req, res) => {
    createPropertyType(req.body, res);
});

app.post('/sign-in', (req, res) => {
    signInUser(req.body, res);
});

app.get('/fetch-titles', (req, res) => {
    fetchPropertyTitles(res);
});

app.post('/submit-document', (req, res) => {
    submitDocumentDetails(req.body, res);
});

app.post('/fetch-properties', (req, res) => {
    fetchPropetyDocs(req.body, res);
});

app.post('/doc-details', (req, res) => {
    loadDocumentDetails(req.body, res);
});

app.post('/transfer-property', (req, res) => {
    transferProperty(req.body, res);
});

app.post('/fetch-property', (req, res) => {
    fetchPropertyClaim(req.body, res);
});

app.post('/sign-claim', (req, res) => {
    signPropertyClaim(req.body, res);
});

app.post('/enquire', (req, res) => {
    enquirePropertyClaim(req.body, res);
});

// retreive important information to decide the validity of an individuals claim to a property
async function enquirePropertyClaim(req, res) {
    // get important values
    try {
        // store verifiers
        let property = (await getCredentials(req.property_id));
        let credential_cid = property.credential.cid;
        let claimers = property.credential.owners;
        let pkey = property.key;
        let timestamp = property.credential.timestamp;
        let verifiers = property.credential.verifiers;

        // get the canonical verifier i.e the registrar of the property type
        // fetch document type to get the registrar
        let doc = (await api.query.oracle.propertyTypeRegistry(pkey)).toHuman();
        if (!doc) throw new Error("could not locate any document type entry");

        let registrar = doc.registrar;

        // load the cid of the registrar to get its DID document
        let registrar_cid = (await api.query.oracle.userRegistry(registrar)).toHuman();
        if (!registrar_cid) throw new Error("could not locate CID of valid user");

        // query IPFS to get the DID document
        await storg.getFromIPFS(registrar_cid).then(async data => {
            let didDoc = JSON.parse(data);

            // get the credential from IPFS also
            await storg.getFromIPFS(credential_cid).then(async cdata => {
                let cred = JSON.parse(cdata);

                // create a verifiable presentation from the credential
                let presentation = await kilt.getPresentation(cred, didDoc.mnemonic);

                // check validity
                let isValid1 = kilt.verifyPresentation(presentation);     // KILTs API throws errors here

                // improvise to check validity
                let isValid2 = verifiers.includes(registrar);

                // return validity
                return res.send({
                    data: {
                        isValid: isValid1 && isValid2,
                        registrar,
                        claimers,
                        claimer: claimers[claimers.length - 1],
                        timestamp
                    },
                    error: false
                });
            });
        });
    } catch (e) {
        return res.send({
            data: {
                claimer: null
            },
            error: true
        });
    }
}

// attest an individuals claim to a property
async function signPropertyClaim(req, res) {
    try { 
        let user = authUser(req.nonce);
        if (user) {
            // get cid of property claim
            let is_signed = false;  //  to prevent double signing

            let property = (await getCredentials(req.property_id));
            let cid = property.credential.cid;
            let pkey = property.key;

            property.credential.verifiers.forEach(v => {
                if (v == /*user.keyPair.address*/ alice.address)
                    is_signed = true;
            });

            // get the canonical verifier i.e the registrar of the property type
            // fetch document type to get the registrar
            let doc = (await api.query.oracle.propertyTypeRegistry(pkey)).toHuman();
            if (!doc) throw new Error("could not locate any document type entry");

            if (!is_signed) {
                // make user has upgraded to having a full DID
                if (user.did.indexOf("light") != -1)
                    user = await upgradeToFullDid(req.nonce, user);

                // retrieve the KILT claim from IPFSx
                await storg.getFromIPFS(cid).then(async data => {
                    let claim = JSON.parse(data);
                    let success = true;

                    // only registrar can create a KILT attestation because it is only allowed once
                    if (doc.registrar == /* user.keyPair.address */ alice.address)
                        success = await kilt.createAttestation(user.did, user.fullDid.mnemonic, claim);

                    if (success) {
                        // save signoatory onchain
                        const transfer = api.tx.oracle.attestClaim(pkey, cid, doc.registrar == /*user.keyPair.address*/ alice.address);
                        const _ = await transfer.signAndSend(/* user.keyPair */alice, ({ events = [], status }) => {
                            if (status.isInBlock) {
                                events.forEach(({ event: { data, method, section }, phase }) => {
                                    // check for errors
                                    if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                                        return res.send({
                                            data: {
                                                msg: "could not record signature"
                                            },
                                            error: true
                                        })
                                    }

                                    if (section.match("oracle", "i")) {
                                        return res.send({
                                            data: {},
                                            error: false
                                        })
                                    }
                                })
                            }
                        })
                    } else
                        throw new Error("could not append signature");
                });
            } else throw new Error("could not append signature");
        } else throw new Error("User not recognized!");
    } catch (e) {
        return res.send({
            data: {},
            error: true
        });
    }
}

// fetch property from IPFS and return its properties
async function fetchPropertyClaim(req, res) {
    try {
        let property = (await getCredentials(req.property_id));
        let cid = property.credential.cid;
        let owners = property.credential.owners;
        let docTitle = property.type.title;

        await storg.getFromIPFS(cid).then(data => {
            let doc = JSON.parse(data);

            return res.send({
                data: {
                    title: docTitle,
                    attr: doc.claim.contents,
                    owner: owners[owners.length - 1]
                },
                error: false
            });
        });
    } catch (e) {
        return res.send({
            data: {},
            error: true
        });
    }
}

async function getCredentials(id) {
    // get the necessary lookup variables
    let vars = id.split("#");

    let ptype = (await api.query.oracle.propertyTypeRegistry(vars[0])).toHuman();
    if (!ptype) throw new Error("could not locate any property type entry");

    // look for important values needed for the transfer
    let credentials = (await api.query.oracle.credentialRegistry(vars[0])).toHuman();
    if (!credentials) throw new Error("could not locate any credential entry");

    return {
        key: vars[0],
        credential: credentials[parseInt(vars[1])],
        type: ptype
    }
}

// transfer property to another entity
async function transferProperty(req, res) {
    try {
        let user = authUser(req.nonce);
        if (user) {
            // first check for existence/validity of the recipients substrate address
            let phantom = (await api.query.oracle.userRegistry(req.recipient)).toHuman();
            if (!phantom) throw new Error("invalid recipient substrate address given!");

            // make sure sender != reciever
            if (bob.address /* user.address */ == req.recipient) throw new Error("you cannot transfer to yourself!");

            let property = (await getCredentials(req.property_id));
            let original_cid = property.credential.cid;
            let new_sender_cid = "";
            let pkey = property.key;

            if (original_cid && pkey) {
                // get the property document fields and populate with the new ones we have now for the recipient
                let doc = (await api.query.oracle.propertyTypeRegistry(req.property_id.split('#')[0])).toHuman();
                if (!doc) throw new Error("could not locate any document type entry");

                // get the cid of the Ctype and retrieve from IPFS
                await storg.getFromIPFS(doc.cid).then(async cType => {
                    let matchedProps = util.matchProperty(doc.attributes.split("~"), req.values.split("~"));

                    // create a dummy light DID to become the credential subject. 
                    // Thank God for the abstraction of the substrate address, this bump is not visible
                    let user_ldid = await kilt.getKiltLightDID("");

                    // generate credential
                    let cred = kilt.createClaim(JSON.parse(cType), matchedProps, user_ldid.uri);

                    //  get original cid and change the value of size of properties being transferred, if its not everything being transferred
                    await storg.getFromIPFS(original_cid).then(async o_cred => {
                        let original_cred = JSON.parse(o_cred);

                        // if the guy is not giving it all out
                        if (!req.transfer_all) {
                            // get the total property
                            let total_property = req.total_size.split(' ');
                            original_cred.claim.contents["Size of property"] = `${parseInt(total_property[1]) - parseInt(req.property_size)} ${total_property[2]}`;

                            // upload to IPFS and get new CID
                            new_sender_cid = await new Promise(async (resolve) => {
                                await storg.uploadToIPFS(JSON.stringify(original_cred)).then(async ncid => {
                                    resolve(ncid);
                                })
                            });
                        }

                        // upload to IPFS and retrieve the CID
                        if (cred) {
                            await storg.uploadToIPFS(JSON.stringify(cred)).then(async cid => {
                                // intiate transfer
                                const transfer = api.tx.oracle.transferProperty(req.recipient, pkey, original_cid, new_sender_cid, cid, req.transfer_all);
                                const _ = await transfer.signAndSend(/* user.keyPair */bob, ({ events = [], status }) => {
                                    if (status.isInBlock) {
                                        events.forEach(({ event: { data, method, section }, phase }) => {
                                            // check for errors
                                            if (section.match("system", "i") && data.toString().indexOf("error") != -1) {
                                                console.log(data.toString());
                                                return res.send({
                                                    data: {
                                                        msg: "property not found, please check the property id."
                                                    },
                                                    error: true
                                                })
                                            }

                                            if (section.match("oracle", "i")) {
                                                return res.send({
                                                    data: {},
                                                    error: false
                                                })
                                            }
                                        })
                                    }

                                })
                            })
                        }
                    })
                })

            } else throw new Error(`Could not find a property belonging to you with the id "${req.property_id}"`);
        } else throw new Error("User not recognized!");
    } catch (e) {
        return res.send({
            data: {
                msg: e.toString()
            },
            error: true
        })
    }
}

// load document details from IPFS 
async function loadDocumentDetails(req, res) {
    try {
        await storg.getFromIPFS(req.cid).then(data => {
            let doc = JSON.parse(data);
            return res.send({
                data: doc.claim.contents,
                error: false
            });
        })
    } catch (e) {
        return res.send({
            data: {},
            error: true
        })
    }
}

// fetch all properties based on input
async function fetchPropetyDocs(req, res) {
    try {
        // first check if the properties are rquested by document title type
        if (req.type == "property-title") {
            // get hash key
            let hkey = blake2AsHex(req.value);

            // query the credential registry
            let property_data = [];
            let credentials = (await api.query.oracle.credentialRegistry(hkey)).toHuman();
            if (!credentials) throw new Error("could not locate any credential entry");

            // fetch document type to get the registrar
            let doc = (await api.query.oracle.propertyTypeRegistry(hkey)).toHuman();
            if (!doc) throw new Error("could not locate any document type entry");

            let index = 0;
            credentials.forEach((p) => {
                property_data.push({
                    id: `${hkey}#${index}`,     // the unique id is an hash of the CID. The CID is always unique
                    owner: p.owners[p.owners.length - 1],
                    cid: p.cid,
                    verifiers: p.verifiers,
                    timestamp: p.timestamp,
                    ptype_registrar: doc.registrar
                })

                index++;
            });

            if (property_data.length)
                return res.send({
                    data: util.sortBy("timestamp", property_data),
                    error: false
                })
            else throw new Error("No property found!");

        } else {
            // select properties belonging to a specific entity
            let property_data = [];
            let credentials = await api.query.oracle.credentialRegistry.entries();
            let keyStore = [];

            credentials.forEach(([key, property]) => {
                // now get all entries for the property
                let realKey = key.toHuman()[0];
                keyStore.push(realKey);
            });

            for (var i = 0; i < keyStore.length; i++) {
                let index = 0;
                let hkey = keyStore[i];
                let creds = (await api.query.oracle.credentialRegistry(hkey)).toHuman();

                // fetch document type to get the registrar
                let doc = (await api.query.oracle.propertyTypeRegistry(hkey)).toHuman();
                if (!doc) throw new Error("could not locate any document type entry");

                creds.forEach(c => {
                    if (c.owners[c.owners.length - 1] == req.value) {
                        property_data.push({
                            id: `${hkey}#${index}`,     // the unique id is an hash of the CID. The CID is always unique
                            owner: c.owners[c.owners.length - 1],
                            cid: c.cid,
                            verifiers: c.verifiers,
                            timestamp: c.timestamp,
                            ptype_registrar: doc.registrar
                        });
                    }

                    index++;
                });

            }

            if (!property_data.length)
                throw new Error("No property found!");
            else {
                return res.send({
                    data: util.sortBy("timestamp", property_data),
                    error: false
                })
            }
        }
    } catch (e) {
        return res.send({
            data: [],
            error: true
        })
    }
}

// handler functions (below)
async function upgradeToFullDid(nonce, user) {
    // upgrade to full DID
    let fullDidDoc = await kilt.createFullDid();
    // add name of user to document
    fullDidDoc["name"] = user.name;
    const result = await new Promise(async (resolve) => {
        // upload to ipfs and get new cid
        await storg.uploadToIPFS(JSON.stringify(fullDidDoc)).then(cid => {
            // update cid
            (async function () {
                const transfer = api.tx.oracle.recordUser(cid);
                const _ = await transfer.signAndSend(/* user.keyPair */alice, ({ events = [], status }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event: { data, method, section }, phase }) => {
                            // check for errors
                            if (section.match("system", "i") && data.toString().indexOf("error") != -1)
                                throw new Error("could not update DID")

                            if (section.match("oracle", "i")) {
                                // update the session data
                                user.fullDid = fullDidDoc;
                                user.did = fullDidDoc.fullDid.uri;
                                user.cid = cid;

                                oracleCache.set(nonce, user);
                                resolve(fullDidDoc);
                            }
                        })
                    }
                })
            })()
        })
    })

    return user;
}

// submit filled document and generate a credential
async function submitDocumentDetails(req, res) {
    // try {
    let user = authUser(req.nonce);
    if (user) {
        // retrieve the document properties from the chain
        let property = (await api.query.oracle.propertyTypeRegistry(req.key)).toHuman();
        if (!property) throw new Error(`could not retrieve properties of document`);

        // retrieve the document cType from IPFS
        await storg.getFromIPFS(property.cid).then(cType => {
            let matchedProps = util.matchProperty(property.attributes.split("~"), req.values.split("~"));

            (async function () {
                // generate credential
                let cred = kilt.createClaim(JSON.parse(cType), matchedProps, util.getUri(user.fullDid));

                // upload to IPFS and retrieve the CID
                if (cred) {
                    await storg.uploadToIPFS(JSON.stringify(cred)).then(async cid => {
                        // get hash
                        let hash = blake2AsHex(req.title);
                        // record onchain
                        const transfer = api.tx.oracle.recordCredential(hash, cid);
                        const _ = await transfer.signAndSend(/* user.keyPair */bob, ({ events = [], status }) => {
                            if (status.isInBlock) {
                                events.forEach(({ event: { data, method, section }, phase }) => {
                                    // check for errors
                                    if (section.match("system", "i") && data.toString().indexOf("error") != -1)
                                        throw new Error("could not record credential onchain")

                                    if (section.match("oracle", "i")) {
                                        return res.send({
                                            data: {},
                                            error: false
                                        })
                                    }
                                })
                            }
                        })
                    });
                } else throw new Error("could not create credential")
            })();
        });
    }
    // } catch (e) {
    //     return res.send({
    //         data: {},
    //         error: true
    //     })
    // }
}

// retreive the properties available onchain
async function fetchPropertyTitles(res) {
    try {
        let property_data = [];
        let properties = await api.query.oracle.propertyTypeRegistry.entries();
        properties.forEach(([key, property]) => {
            let parsed_property = property.toHuman();
            property_data.push({
                title: parsed_property.title,
                cid: parsed_property.cid,
                attr: parsed_property.attributes,
                key: key.toHuman()[0]
            })
        });

        return res.send({
            data: util.sortBy("title", property_data),
            error: false
        })
    } catch (e) {
        return res.send({
            data: [],
            error: true
        })
    }
}

// try to connect to the Property Oracle and KILT chains
async function initChains(req) {
    const result = await new Promise(async (resolve) => {
        let io = await kilt.connect();
        resolve(io);
    });

    return result;
}

async function createPropertyType(req, res) {
    // try {
    let user = authUser(req.nonce);
    if (user) {
        // first make sure that the user has a full DID and not a light one
        if (user.did.indexOf("light") != -1)
            user = await upgradeToFullDid(req.nonce, user);

        // now that we are sure that the user has a full did, we can create a KILT Ctype
        let ptype = await kilt.mintCType({ title: req.title, attr: req.attributes }, user.fullDid);

        // we'll store it on IPFS and keep its cid
        await storg.uploadToIPFS(JSON.stringify(ptype)).then(async ptypeCid => {
            // create hash of property title/label
            let ptHash = await getUniquePtypeHash(req.title);

            // record it on chain
            (async function () {
                const transfer = api.tx.oracle.recordPtype(ptHash, req.title, ptypeCid, req.attributes);
                const _ = await transfer.signAndSend(/* user.keyPair */alice, ({ events = [], status }) => {
                    if (status.isInBlock) {
                        events.forEach(({ event: { data, method, section }, phase }) => {
                            // check for errors
                            if (section.match("system", "i") && data.toString().indexOf("error") != -1)
                                throw new Error("could not record property type")

                            if (section.match("oracle", "i")) {
                                // return success
                                return res.send({
                                    data: {},
                                    error: false
                                })
                            }
                        })
                    }
                })
            })()
        });
    } else throw new Error("User not recognized!");
    // } catch (e) {
    //     return res.send({
    //         data: {},
    //         error: true
    //     })
    // }
}

async function getUniquePtypeHash(title) {
    // check if it already exists
    let hash = blake2AsHex(title);
    let data = (await api.query.oracle.propertyTypeRegistry(hash)).toHuman();

    if (!data) {
        title += ` ${util.generateRandomNumber()}`;
        getUniquePtypeHash(title);
    }

    return hash;
}

// check keyring and test for equality
function authUser(nonce) {
    if (oracleCache.has(nonce)) {
        return oracleCache.get(nonce);
    }

    return false;
}

async function createNewUser(req, res) {
    try {
        // first generate the mnemonics
        const mnemonic = mnemonicGenerate();
        const user = keyring.createFromUri(mnemonic, 'sr25519');

        // upload empty object to hold users credentials
        await storg.uploadToIPFS(JSON.stringify([])).then(credential_cid => {
            console.log("The CID is  " + credential_cid);

            (async function () {
                // create a lightDID for the user
                let user_ldid = await kilt.getKiltLightDID(credential_cid);

                // modify DID document
                user_ldid["name"] = req.name;

                // upload the user DID document to IPFS
                await storg.uploadToIPFS(JSON.stringify(user_ldid)).then(cid => {
                    (async function () {
                        // record new user entry onchain
                        const transfer = api.tx.oracle.recordUser(cid);
                        const _ = await transfer.signAndSend(/*user */bob, ({ events = [], status }) => {
                            if (status.isInBlock) {
                                events.forEach(({ event: { data, method, section }, phase }) => {
                                    // check for errors
                                    if (section.match("system", "i") && data.toString().indexOf("error") != -1)
                                        throw new Error("could not record newly created user.")

                                    if (section.match("oracle", "i")) {
                                        // save session 
                                        let session_nonce = blake2AsHex(mnemonicGenerate());
                                        oracleCache.set(session_nonce, {
                                            keyPair: user,
                                            fullDid: user_ldid,
                                            did: user_ldid.uri.split(`:`, 4).join(`:`),
                                            cid,
                                            name: req.name
                                        });

                                        return res.send({
                                            data: {
                                                did: user_ldid.uri,
                                                seed: mnemonic,
                                                nonce: session_nonce
                                            },
                                            error: false
                                        })
                                    }
                                })
                            }
                        })
                    })();
                })
            })();
        })
    } catch (e) {
        return res.send({
            data: {
                seed: "",
                did: "",
                nonce: ""
            },
            error: true
        })
    }
}

async function signInUser(req, res) {
    try {
        // first check if its a nonce that was sent, maybe the user reloaded the tab and the nonce has nont been cleared
        if (req.keys.indexOf(" ") == -1 && oracleCache.has(req.keys)) {
            let data = oracleCache.get(req.keys);
            return res.send({
                data: {
                    did: data.did,
                    nonce: req.keys,
                    name: data.name
                },
                error: false
            });
        }

        // first generate account from seed
        const user = keyring.createFromUri(req.keys, 'sr25519');

        // try to get retrieve CID from chain
        let cid = (await api.query.oracle.userRegistry(/* user.address */ alice.address)).toHuman();
        if (!cid) throw new Error(`could not retrieve user CID`);

        // get did document from IPFS
        await storg.getFromIPFS(cid).then(did_doc => {
            let doc = JSON.parse(did_doc);
            doc = typeof doc === "string" ? JSON.parse(doc) : doc;
            // save session 
            let session_nonce = blake2AsHex(mnemonicGenerate());
            oracleCache.set(session_nonce, {
                keyPair: user,
                fullDid: doc,
                did: util.getDid(doc),
                cid,
                name: doc.name
            });

            return res.send({
                data: {
                    did: util.getDid(doc),
                    nonce: session_nonce,
                    name: doc.name
                },
                error: false
            })
        });
    } catch (e) {
        return res.send({
            data: {
                msg: "could not sign you in"
            },
            error: true
        })
    }
}

// listen on port 4000
app.listen(port, () => console.info(`listening on port ${port}`));

