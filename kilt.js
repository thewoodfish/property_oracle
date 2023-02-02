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

await cryptoWaitReady().then(() => {
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

export async function createFullDid() {
    const mnemonic = mnemonicGenerate()
    const { authentication, encryption, attestation, delegation } =
    generateKeypairs(mnemonic);

    // Get tx that will create the DID on chain and DID-URI that can be used to resolve the DID Document.
    const fullDidCreationTx = await Kilt.Did.getStoreTx(
    {
        authentication: [authentication],
        keyAgreement: [encryption],
        assertionMethod: [attestation],
        capabilityDelegation: [delegation],
    },

    sam.address,
    async ({ data }) => ({
        signature: authentication.sign(data),
        keyType: authentication.type,
    })
    )

    await Kilt.Blockchain.signAndSubmitTx(fullDidCreationTx, sam)

    const didUri = Kilt.Did.getFullDidUriFromKey(authentication);
    const encodedFullDid = await api.call.did.query(Kilt.Did.toChain(didUri));
    const { document } = Kilt.Did.linkedInfoFromChain(encodedFullDid);

    if (!document) {
        throw 'Full DID was not successfully created.'
    };

    return { mnemonic, fullDid: document }
}

export function generateKeypairs(mnemonic = mnemonicGenerate()) {
    const authentication = Kilt.Utils.Crypto.makeKeypairFromSeed(
        mnemonicToMiniSecret(mnemonic)
    )

    const encryption = Kilt.Utils.Crypto.makeEncryptionKeypairFromSeed(
        mnemonicToMiniSecret(mnemonic)
    )

    const attestation = authentication.derive('//attestation')

    const delegation = authentication.derive('//delegation')

    return {
        authentication,
        encryption,
        attestation,
        delegation,
    }
}


export async function mintCType({ title, attr }, did_doc) {
    // Create a new CType definition.
    const ctObj = util.strToCType(attr);
    const assert = keyring.createFromUri(did_doc.mnemonic, 'sr25519');
    const { authentication, encryption, attestation, delegation } = generateKeypairs(did_doc.mnemonic);

    // create signCallback
    let signCallback = useSignCallback(did_doc.fullDid.uri, attestation);

     // Create a new CType definition.
    const ctype = Kilt.CType.fromProperties(title, ctObj);

    // Generate a creation tx.
    const ctypeCreationTx = api.tx.ctype.add(Kilt.CType.toChain(ctype));

    // Sign it with the right DID key.
    const authorizedCtypeCreationTx = await Kilt.Did.authorizeTx(
        did_doc.fullDid.uri,
        ctypeCreationTx,
        signCallback,
        sam.address
    )

    // Submit the creation tx to the KILT blockchain
    // using the KILT account specified in the creation operation.
    await Kilt.Blockchain.signAndSubmitTx(
        authorizedCtypeCreationTx,
        sam
    );

    return ctype;
}

function useSignCallback(keyUri, didSigningKey) {
    const signCallback = async ({
        data,
        // The key relationship specifies which DID key must be used.
        keyRelationship,
        // The DID URI specifies which DID must be used. We already know which DID
        // this will be since we will use this callback just a few lines later (did === didUri).
        did,
    }) => ({
        signature: didSigningKey.sign(data),
        keyType: didSigningKey.type,
        keyUri,
    })
  
    return signCallback
}