/*
 * File: Main controller for Property Oracle
 * Author: @thewoodfish
 * Date-Time: Sat 28 Jan 02:51
 */

function qs(tag) {
    return document.querySelector(tag);
}

function ce(tag) {
    return document.createElement(tag);
}

function clearField(attr) {
    qs(attr).value = "";
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
                    await res.json().then(res => {
                        resolve(res.status);
                    });
                })();
            })
    });

    console.log(result);
    return result;
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
                attrElement.parentElement.removeChild(attrElement);
            } else if (e.classList.contains("reg-property-before")) {
                if (ptype_buffer.length > 2) {
                    hide(".reg-property-before");
                    appear(".reg-property-after");

                    // // send request to chain
                    // fetch("/register-ptype", {
                    //     method: 'post',
                    //     headers: {
                    //         'Content-Type': 'application/json'
                    //     },
                    //     body: JSON.stringify({
                    //         "attributes": ptype_buffer.join(`~`)
                    //     })
                    // })
                    //     .then(res => {
                    //         (async function () {
                    //             await res.json().then(res => {
                    //                 console.log(res);
                    //             });
                    //         })();
                    //     })
                } else {
                    toast(`You need to specify more attributes`);
                }
            } else if (e.classList.contains("gen-mnemonics-before")) {
                const name = qs(".pseudo-name").value;
                if (name) {
                    hide(".gen-mnemonics-before");
                    appear(".gen-mnemonics-after");
                    clearField(".pseudo-name");

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
                                    console.log(res);
                                });
                            })();
                        })
                } else {
                    toast(`Please fill in you name to continue`);
                }
            }
        } else {
            toast(`waiting to connect to the <code>Property Oracle</code> and <code>KILT</code> chain.`);
        }
    },
    false
);
