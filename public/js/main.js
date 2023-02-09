/*
 * File: Main controller for Property Oracle
 * Author: @thewoodfish
 * Date-Time: Sat 28 Jan 02:51
 */

function qs(tag) {
    return document.querySelector(tag);
}

function qsa(tag) {
    return document.querySelectorAll(tag);
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
    if (!qs(attr).classList.contains("hidden"))
        qs(attr).classList.add("hidden");
}

function generateRandomNumber() {
    let min = 500;
    let max = 999999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function convertTimestamp(timestamp) {
    // Create a new date object from the timestamp
    var date = new Date(timestamp * 1000);

    // Get the day of the week
    var daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var dayOfWeek = daysOfWeek[date.getUTCDay()];

    // Get the month and day of month
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var month = months[date.getUTCMonth()];
    var dayOfMonth = date.getUTCDate();

    // Get the hours, minutes, and format for AM/PM
    var hours = date.getUTCHours();
    var minutes = date.getUTCMinutes().toString().padStart(2, '0');
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = (hours % 12 || 12).toString().padStart(2, '0');

    // Return the nicely formatted date time string
    return `${dayOfWeek} ${hours}:${minutes}${ampm}, ${dayOfMonth}${getOrdinalIndicator(dayOfMonth)} of ${month}, ${date.getUTCFullYear()}`;
}

// Function to get the ordinal indicator (e.g. st, nd, rd, th) for a number
function getOrdinalIndicator(num) {
    if (num > 3 && num < 21) return 'th';
    switch (num % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
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
        .then(async res => {
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
                    toast("❌ Could not sign you in. Please check your seed.");
                    hide(".sign-in-btn-after");
                    appear(".sign-in-btn-before");
                }
            });

        })
}

// check if a user has been authenticated successfully
function userIsAuth() {
    if (qs(".signed-in-user-did").innerText.indexOf("xxxxx") == -1) return true;
    else {
        toast("❌ You need to be authenticated to perform this action");
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

async function populatePropertyTitles() {
    // fetch all the property titles from the chain
    fetch("/fetch-titles", {
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(async res => {
            await res.json().then(res => {
                // populate UI
                let select = qs(".document-type-selector");
                res.data.forEach(p => {
                    select.innerHTML += `<option value="${p.title}$$$${p.cid}$$$${p.attr}$$$${p.key}">${p.title}</option>`;
                });

                // populate UI of type selector
                let select1 = qs(".property-type-selector");
                res.data.forEach(p => {
                    select1.innerHTML += `<option value="${p.title}">${p.title}</option>`;
                });
            });
            ;
        })
}

async function populateProperties(value, type) {
    // fetch all the property titles from the chain
    fetch("/fetch-properties", {
        method: 'post',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            value, type
        })
    })
        .then(async res => {
            await res.json().then(res => {
                // first enable the select box
                qs(".property-search-filter").disabled = false;

                // change the buttons
                const index = qs(".property-search-filter").dataset.index;
                hide(`.property-search${index}-btn-after`);
                appear(`.property-search${index}-btn-before`);

                let cc = qs(".credential-container");
                cc.innerHTML = "";
                if (!res.error) {
                    // update the UI
                    let i = 0;
                    res.data.forEach(p => {
                        i++;

                        // prepare the verifiers
                        let verifiers = "";
                        p.verifiers.forEach(v => {
                            console.log(p.ptype_registrar);
                            if (p.ptype_registrar == v)
                                verifiers += `<div>⭐️ ${v}</div>`;
                            else
                                verifiers += `<div>${v}</div>`;
                        })
                        cc.innerHTML += `
                        <hr>
                        <div class="mt-10 row pr-10">
                            <div class="col-4 pt-30">
                                <img src="img/file.png" class="width-100">
                            </div>
                            <div class="col-8 card border-0">
                                <div class="card-body">
                                    <code class="bold small">Property #${i}</code>
                                    <div class="mt-20 bold">
                                        <code>ID:</code>
                                        ${p.id}
                                    </div>
                                    <div class="">
                                        <code>Owner:</code>
                                        ${p.owner}
                                    </div>
                                    <div>
                                        <code>Verified and signed by:</code>
                                        <div class="pl-45">
                                            ${verifiers}
                                        </div>
                                    </div>
                                    <div>
                                        <code>Details:</code>
                                        <div class="pl-20">
                                            <a class="load-property-details underline pointer" data-cid=${p.cid}>load property details</a>
                                        </div>
                                    </div>
                                    <div class="">
                                        <code>Timestamp:</code> ${convertTimestamp(parseInt(p.timestamp.replaceAll(',', '')))}
                                    </div>
                                </div>
                            </div>
                        </div> 
                    `;
                    });
                } else {
                    appear(".prop-search-error");
                    setTimeout(() => hide(".prop-search-error"), 5000);
                }
            });
        })
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
            .then(async res => {
                await res.json().then(async res => {
                    // if nonce is still present, sign user in automatically
                    if (getSessionNonce())
                        await queryServerToSignIn(getSessionNonce(), false);      // roll up the card
                    resolve(res.status);
                });
                ;
            })
    });

    console.log(result);
    return result;
}

function click(attr) {
    qs(attr).click();
}

// to prevent duplicate additiom of values
let ptype_buffer = ["Address of property", "Size of property"];
let pseudo_buffer = ["address of property", "size of property"];

// intialize connection to chain

toast(`waiting to connect to the <code>Property Oracle</code> and <code>KILT</code> chain.`);
(async function () {
    if (await initChainConnection('ws://127.0.0.1:9944') == "connected") {
        // update UI
        await populatePropertyTitles();   // populate the document titles
        incConnectionCount();
        hide(".chain-connecting");
        appear(".chain-connected");
        toast("✅ Connection to <code>Property Oracle chain</code> and <code>KILT chain</code> established.")
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
                    if (!pseudo_buffer.includes(field_val.toLowerCase())) {
                        let attr_display = qs(".attr-display");
                        attr_display.innerHTML += `<p class="xy-${code}"><code><span class="xx-${code} minus blue pointer">-</span> 
                            <span class="zz-${code}">${field_val}</span></code></p>`;
                        clearField(".attr-field");
                        ptype_buffer.push(field_val);
                        pseudo_buffer.push(field_val.toLowerCase());
                    } else
                        toast(`❌ "${field_val}" has been added already`);
                }
            } else if (e.classList.contains("minus")) {
                // delete specified attribute
                let attrElement = qs(`.xy-${e.classList[0].split('-')[1]}`);
                let innerText = qs(`.zz-${e.classList[0].split('-')[1]}`).innerText;

                for (var i = 0; i < ptype_buffer.length; i++) {
                    if (ptype_buffer[i] == innerText) {
                        ptype_buffer.splice(i, 1);
                        pseudo_buffer.splice(i, 1);
                    }
                };

                attrElement.parentElement.removeChild(attrElement);
            } else if (e.classList.contains("reg-property-before")) {
                let title = qs(".doc-title-field").value;
                if (!qs(".doc-title-field").value) {
                    toast(`❌ Please specify the title of the document.`)
                    return;
                }

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
                            .then(async res => {
                                await res.json().then(res => {
                                    hide(".reg-property-after");
                                    appear(".reg-property-before");

                                    if (!res.error) {
                                        appear(".ptype-reg-success");
                                        clearField(".doc-title-field");
                                        setTimeout(() => hide(".ptype-reg-success"), 5000);
                                        populatePropertyTitles();
                                    } else {
                                        appear(".ptype-reg-error");
                                        setTimeout(() => hide(".ptype-reg-error"), 5000);
                                    }
                                });
                                ;
                            })
                    }
                } else {
                    toast(`❌ You need to specify more attributes.`);
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
                        .then(async res => {
                            await res.json().then(res => {
                                hide(".gen-mnemonics-after");
                                appear(".gen-mnemonics-before");

                                if (!res.error) {
                                    const did = res.data.did.split(`:`, 4).join(`:`);
                                    clearField(".pseudo-name");
                                    appear(".mnemonics-container");
                                    toast(`You have <code class="bold">10 seconds</code> to copy your keys`);

                                    qs(".mnemonic-seed").innerText = res.data.seed;
                                    qs(".kilt-did-result").innerText = did;
                                    updateAuthUser(did, name);

                                    // set session nonce
                                    setSessionNonce(res.data.nonce);

                                    // set timeout to remove div
                                    setTimeout(() => hide(".mnemonics-container"), 10000);
                                } else {
                                    appear(".mnemonic-error-text");
                                    setTimeout(() => hide(".mnemonic-error-text"), 5000);
                                }
                            });
                            ;
                        })
                } else {
                    toast(`❌ Please fill in you name to continue`);
                }
            } else if (e.classList.contains("sign-in-btn-before")) {
                let seed = qs(".seed-phrase-ta").value;
                if (seed.split(` `).length != 12)
                    toast("❌ seed phrases must be complete 12 words only.");
                else {
                    hide(".sign-in-btn-before");
                    appear(".sign-in-btn-after");

                    queryServerToSignIn(seed, true);
                }
            } else if (e.classList.contains("submit-filled-document-before")) {
                if (userIsAuth()) {
                    let allFilled = true;
                    qsa(".form-document-properties").forEach(e => {
                        if (!e.value)
                            allFilled = false;
                    });

                    if (allFilled) {
                        hide(".submit-filled-document-before");
                        appear(".submit-filled-document-after");

                        // take all the values
                        let values = [];
                        qsa(".form-document-properties").forEach(e => {
                            values.push(e.value);
                        })

                        const important_vals = qs(".document-type-selector").value.split("$$$");

                        // send to server
                        fetch("/submit-document", {
                            method: 'post',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                "values": values.join("~"),
                                "title": important_vals[0],
                                "key": important_vals[3],
                                "nonce": getSessionNonce()
                            })
                        })
                            .then(async res => {
                                await res.json().then(res => {
                                    hide(".submit-filled-document-after");
                                    appear(".submit-filled-document-before");

                                    if (!res.error) {
                                        appear(".document-reg-success");
                                        setTimeout(() => hide(".document-reg-success"), 5000);
                                        hide(".document-indicator");
                                        hide(".property-document-container");
                                        qs(".document-property-body").innerHTML = "";

                                    } else {
                                        appear(".document-reg-error");
                                        setTimeout(() => hide(".document-reg-error"), 5000);
                                    }
                                });
                                ;
                            })
                    } else {
                        toast(`❌ Please fill out all fields of the document.`);
                    }
                }
            } else if (e.classList.contains("property-search0-btn-before")) {
                let substrate_addr = qs(".substrate-address-input").value;
                if (substrate_addr) {
                    hide(".property-search0-btn-before");
                    appear(".property-search0-btn-after");

                    // disable filter
                    qs(".property-search-filter").disabled = true;
                    qs(".property-search-filter").dataset.index = "0";

                    (async function () {
                        await populateProperties(substrate_addr, "substrate-addr");
                    })();
                } else {
                    toast("❌ Please input a valid substrate address");
                }
            } else if (e.classList.contains("property-search1-btn-before")) {
                if (qs(".property-type-selector").value != "zero") {
                    hide(".property-search1-btn-before");
                    appear(".property-search1-btn-after");
                    clearField(".substrate-address-input");
                    
                    // disable filter
                    qs(".property-search-filter").disabled = true;
                    qs(".property-search-filter").dataset.index = "1";

                    (async function () {
                        await populateProperties(qs(".property-type-selector").value, "property-title");
                    })();
                }
            } else if (e.classList.contains("load-property-details")) {
                // load property details from IPFS
                e.innerText = "loading...";
                fetch("/doc-details", {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        "cid": e.dataset.cid
                    })
                })
                    .then(async res => {
                        await res.json().then(res => {
                            let div = e.parentElement;
                            div.innerHTML = "";

                            Object.entries(res.data).forEach(([k, v]) => {
                                div.innerHTML += `
                                        <div>
                                            <code>${k}:</code> <span>${v}</span>
                                        </div>
                                    `;
                            })
                        });
                        ;
                    })
            } else if (e.classList.contains("transfer-property-btn-before")) {
                const propertID = qs(".property-id").value;
                const substrateAddr = qs(".sub-address").value;
                if (propertID && substrateAddr) {
                    hide(".transfer-property-btn-before");
                    appear(".transfer-property-btn-after");

                    fetch("/transfer-property", {
                        method: 'post',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            "property_id": propertID,
                            "recipient": substrateAddr,
                            "nonce": getSessionNonce()
                        })
                    })
                        .then(async res => {
                            await res.json().then(res => {
                                appear(".transfer-property-btn-before");
                                hide(".transfer-property-btn-after");

                                if (!res.error) {
                                    appear(".property-transfer-success");
                                    setTimeout(() => hide(".property-transfer-success"), 5000);

                                    clearField(".sub-address");
                                    clearField(".property-id");
                                } else {
                                    qs(".main-error-text").innerText = `Could not transfer property. Please check your input or try again later`;
                                    appear(".property-transfer-error");
                                    setTimeout(() => hide(".property-transfer-error"), 5000);
                                }
                            });
                            ;
                        })
                } else {
                    toast(`❌ please fill in all the input areas.`)
                }
            } else if (e.classList.contains("search-pdoc-btn-before")) {
                let propertID = qs(".input-for-signature").value;
                if (propertID) {
                    hide(".search-pdoc-btn-before");
                    appear(".search-pdoc-btn-after");

                    // fetch specific document from IPFS
                    fetch("/fetch-property", {
                        method: 'post',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            "property_id": propertID,
                        })
                    })
                        .then(async res => {
                            await res.json().then(res => {
                                appear(".search-pdoc-btn-before");
                                hide(".search-pdoc-btn-after");

                                if (!res.error) {
                                    appear(".document-sig-indicator");
                                    appear(".document-sig-container");
                                    qs(".sig-document-title").innerText = res.data.title;
                                    qs(".sig-document-title").dataset.pid = propertID;
                                    qs(".property-claimer").innerText = res.data.owner;

                                    let div = qs(".document-sig-body");
                                    div.innerHTML = "";
                                    Object.entries(res.data.attr).forEach(([k, v]) => {
                                        div.innerHTML += `
                                                <div class="mb-3 col-6">
                                                    <label for="size of property" class="form-label">${k}</label>
                                                    <input type="text"
                                                        class="form-control form-control-sm sig-document-properties"
                                                        id="" placeholder="" value="${v}" disabled>
                                                </div>
                                            `;
                                    })
                                } else {
                                    hide(".document-sig-indicator");
                                    hide(".document-sig-container");
                                    qs(".document-sig-error").innerText = `❌ Could not locate property claim. Please check your input.`;
                                    appear(".document-sig-error");
                                    setTimeout(() => hide(".document-sig-error"), 5000);
                                }
                            });
                            ;
                        })
                } else {
                    toast(`❌ please fill in a valid property ID.`);
                }
            } else if (e.classList.contains("sign-document-btn-before")) {
                hide(".sign-document-btn-before");
                appear(".sign-document-btn-after");
                qs(".search-pdoc-btn-before").disabled = true;
                let propertID = qs(".input-for-signature").value;

                // fetch specific document from IPFS
                fetch("/sign-claim", {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        "property_id": propertID,
                        "nonce": getSessionNonce()
                    })
                })
                    .then(async res => {
                        await res.json().then(res => {
                            appear(".sign-document-btn-before");
                            hide(".sign-document-btn-after");
                            qs(".search-pdoc-btn-before").disabled = false;

                            if (!res.error) {
                                clearField(".input-for-signature");
                                hide(".document-sig-indicator");
                                hide(".document-sig-container");

                                appear(".document-sig-success");
                                setTimeout(() => hide(".document-sig-success"), 5000);
                            } else {
                                qs(".document-sig-error").innerText = `❌ Could not append signature. Please try again later`;
                                appear(".document-sig-error");
                                setTimeout(() => hide(".document-sig-error"), 5000);
                            }
                        });
                        ;
                    })
            } else if (e.classList.contains("make-enquiry-btn-before")) {
                let propertID = qs(".pid-for-enquiry").value;
                if (propertID) {
                    hide(".make-enquiry-btn-before");
                    appear(".make-enquiry-btn-after");

                    // fetch specific document from IPFS
                    fetch("/enquire", {
                        method: 'post',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            "property_id": propertID,
                        })
                    })
                        .then(async res => {
                            await res.json().then(res => {
                                appear(".make-enquiry-btn-before");
                                hide(".make-enquiry-btn-after");

                                if (!res.error) {
                                    clearField(".pid-for-enquiry");

                                    qsa(".prop-id").forEach(p => {
                                        p.innerText = propertID;
                                    });

                                    qsa(".claimer-id").forEach(p => {
                                        p.innerText = res.data.claimer;
                                    });

                                    if (res.data.isValid) {
                                        appear(".positive-verdict");
                                        hide(".negative-verdict");
                                        qs(".verdict-datetime").innerText = convertTimestamp(res.data.timestamp.replaceAll(',', ''));
                                    } else {
                                        hide(".positive-verdict");
                                        appear(".negative-verdict");
                                    }
                                } else {
                                    hide(".negative-verdict");
                                    hide(".positive-verdict");
                                    appear(".enquiry-error");
                                    setTimeout(() => hide(".enquiry-error"), 5000);
                                }
                            });
                            ;
                        })
                } else {
                    toast(`❌ please fill in a valid property ID.`);
                }
            }
        } else {
            toast(`waiting to connect to the <code>Property Oracle</code> and <code>KILT</code> chain.`);
        }
    },
    false
);

document.body.addEventListener("change", (e) => {
    e = e.target;
    if (e.classList.contains("document-type-selector")) {
        // fetch the details from the network
        let docBody = qs(".document-property-body");
        docBody.innerHTML = "";
        if (e.value != "zero") {
            const selected = e.value.split("$$$");
            const attributes = selected[2].split('~');
            const cid = selected[1];

            appear(".document-indicator");
            appear(".property-document-container");
            qs(".document-title").innerText = selected[0];

            attributes.forEach(a => {
                docBody.innerHTML += `
                    <div class="mb-3 col-6">
                        <label for="${a}"
                            class="form-label">${a}</label>
                        <input type="text" class="form-control form-control-sm form-document-properties"
                            id="${a}"
                            placeholder="">
                    </div>
                `;
            });
        } else {
            hide(".document-indicator");
            hide(".property-document-container");
        }
    } else if (e.classList.contains("property-search-filter")) {
        if (!e.selectedIndex) {
            hide(".document-select-option-1");
            appear(".document-select-option-2");
        } else {
            appear(".document-select-option-1");
            hide(".document-select-option-2");
        }
    }
}, false);
