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

// to prevent duplicate additiom of values
let ptype_buffer = ["address of property", "size of property"];

document.body.addEventListener(
    "click",
    (e) => {
        e = e.target;
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
        } else if (e.classList.contains("reg-property")) {
            if (ptype_buffer.length) {
                appear(".add-attr-spinner");

                // send request to chain
                fetch("/register-ptype", {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        "attributes": ptype_buffer.join(`~`)
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
        }
    },
    false
);
