/*
 * File: Main controller for Property Oracle
 * Author: @thewoodfish
 * Date-Time: Sat 28 Jan 02:51
 */

import { title } from "process";

function qs(tag) {
    return document.querySelector(tag);
}

function ce(tag) {
    return document.createElement(tag);
}

function clearField(attr) {
    qs(attr).value = "";
}

function getFirstName(name) {
    return name.split(" ")[0];
}

function appear(attr) {
    qs(attr).classList.remove("hidden");
}

function hide(attr) {
    qs(attr).classList.add("hidden");
}

function generateRandomNumber() {
    let min = 500;
    let max = 999999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function queryServerToSignIn(seed, rollup) {
    // send request to chain
    fetch("/sign-in", {
        method: 'post',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "keys": seed    // can be seed or nonce
        })
    })
        .then(res => {
            (async function () {
                await res.json().then(res => {
                    if (!res.error) {
                        clearField(".seed-phrase-ta");
                        setSessionNonce(res.data.nonce);
                        updateAuthUser(res.data.did, res.data.name);
                        hide(".sign-in-btn-after");
                        appear(".sign-in-btn-before");
                        toast(`Hey <code>${getFirstName(res.data.name)}</code>, Welcome to <code>Property Oracle</code>`);

                        // roll up the card
                        if (rollup) click(".sign-in-prompt");
                    } else {
                        toast("Could not sign you in. Please check your seed.");
                        hide(".sign-in-btn-after");
                        appear(".sign-in-btn-before");
                    }
                });
            })()
        })
}

// check if a user has been authenticated successfully
function userIsAuth() {
    if (qs(".signed-in-user-did").innerText.indexOf("xxxxx") == -1) return true;
    else {
        toast("You need to be authenticated to perform this function");
        return false;
    }
}

function toast(msg) {
    const toastLiveExample = document.getElementById('liveToast');
    const toast = new bootstrap.Toast(toastLiveExample);
    qs('.toast-body').innerHTML = msg;
    toast.show();
}

function incConnectionCount() {
    let cc = qs(".connection-count");
    cc.innerText = cc.innerText ? parseInt(cc.innerText) + 1 : 1;
}

function truncate(str, end) {
    return str.substr(0, end);
}

function updateAuthUser(did, name) {
    qs(".signed-in-user-name").innerText = name.length > 20 ? `${truncate(name, 17)}...` : name;
    qs(".signed-in-user-did").innerText = did.length > 30 ? `${truncate(did, 27)}...` : did;
}

function setSessionNonce(value) {
    sessionStorage.setItem("session_nonce", value);
}

function getSessionNonce(value) {
    return sessionStorage.getItem("session_nonce");
}

// initialize connection to Chain
async function initChainConnection(addr) {
    const result = await new Promise((resolve) => {
        // contact the server to initialize connection
        fetch("/connect-chains", {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "addr": addr
            })
        })
            .then(res => {
                (async function () {
                    await res.json().then(async res => {
                        // if nonce is still present, sign user in automatically
                        if (getSessionNonce())
                            await queryServerToSignIn(getSessionNonce(), false);      // roll up the card
                        resolve(res.status);
                    });
                })();
            })
    });

    console.log(result);
    return result;
}

function click(attr) {
    qs(attr).click();
}

// to prevent duplicate additiom of values
let ptype_buffer = ["address of property", "size of property"];

// intialize connection to chain
(async function () {
    toast(`waiting to connect to the <code>Property Oracle</code> and <code>KILT</code> chain.`);
    if (await initChainConnection('ws://127.0.0.1:9944') == "connected") {
        // update UI
        incConnectionCount();
        hide(".chain-connecting");
        appear(".chain-connected");
        toast("Connection to <code>Property Oracle chain</code> and <code>KILT chain</code> established.")
        incConnectionCount();
    };
})();

document.body.addEventListener(
    "click",
    (e) => {
        e = e.target;
        // ensure connection is established for both required chains
        if (qs(".connection-count").innerText == `2`) {
            if (e.classList.contains("add-attr")) {
                // add new attribute
                let field_val = qs(".attr-field").value;
                let code = generateRandomNumber();
                if (field_val) {
                    if (!ptype_buffer.includes(field_val)) {
                        let attr_display = qs(".attr-display");
                        attr_display.innerHTML += `<p class="xy-${code}"><code><span class="xx-${code} minus blue pointer">-</span> ${field_val}</code></p>`;
                        clearField(".attr-field");
                        ptype_buffer.push(field_val.toLowerCase());
                    }
                }
            } else if (e.classList.contains("minus")) {
                // delete specified attribute
                console.log(e);
                let attrElement = qs(`.xy-${e.classList[0].split('-')[1]}`);
                let title = qs(".doc-title-field").value;
                attrElement.parentElement.removeChild(attrElement);
            } else if (e.classList.contains("reg-property-before")) {
                if (ptype_buffer.length > 2) {
                    if (userIsAuth()) {
                        hide(".reg-property-before");
                        appear(".reg-property-after");

                        // send request to chain
                        fetch("/register-ptype", {
                            method: 'post',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                "attributes": ptype_buffer.join(`~`),
                                title,
                                "nonce": getSessionNonce()
                            })
                        })
                            .then(res => {
                                (async function () {
                                    await res.json().then(res => {
                                        console.log(res);
                                    });
                                })();
                            })
                    }
                } else {
                    toast(`You need to specify more attributes`);
                }
            } else if (e.classList.contains("gen-mnemonics-before")) {
                const name = qs(".pseudo-name").value;
                if (name) {
                    hide(".gen-mnemonics-before");
                    appear(".gen-mnemonics-after");

                    // send request to chain
                    fetch("/gen-keys", {
                        method: 'post',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            "name": name
                        })
                    })
                        .then(res => {
                            (async function () {
                                await res.json().then(res => {
                                    const did = res.data.did.split(`:`, 4).join(`:`);

                                    clearField(".pseudo-name");
                                    hide(".gen-mnemonics-after");
                                    appear(".gen-mnemonics-before");

                                    appear(".mnemonics-container");
                                    toast(`You have <code class="bold">10 seconds</code> to copy your keys`);

                                    qs(".mnemonic-seed").innerText = res.data.seed;
                                    qs(".kilt-did-result").innerText = did;
                                    updateAuthUser(did, name);

                                    // set session nonce
                                    setSessionNonce(res.data.nonce);

                                    // set timeout to remove div
                                    setTimeout(() => hide(".mnemonics-container"), 10000);
                                });
                            })();
                        })
                } else {
                    toast(`Please fill in you name to continue`);
                }
            } else if (e.classList.contains("sign-in-btn-before")) {
                let seed = qs(".seed-phrase-ta").value;
                if (seed.split(` `).length != 12)
                    toast("seed phrases must be complete 12 words only.");
                else {
                    hide(".sign-in-btn-before");
                    appear(".sign-in-btn-after");

                    queryServerToSignIn(seed, true);
                }
            }
        } else {
            toast(`waiting to connect to the <code>Property Oracle</code> and <code>KILT</code> chain.`);
        }
    },
    false
);
