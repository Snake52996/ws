// ==UserScript==
// @name        WS progress tracker injector
// @namespace   Violentmonkey Scripts
// @match       *://*/*
// @grant       GM_addStyle
// @version     1.2
// ==/UserScript==
(() => {
  const script_host = "https://snake.moe/ws/scripts";
  const script_map = {
    "1aa3a0354e2b082beaab8641c6e47501c1c389812c21ba23c5deecbeae21d678": "inj-00.js",
    "b9ce05953b157764098e994c5a57816f6580565fbee44d1703f3cbfb49cd9f71": "inj-01.js",
    "0c4b95a69ed536794e09780b044765e65684de12dae80ceea6b2289706c3e248": "inj-02.js",
  };
  async function injection_proxy() {
    const _SALT = "a3d358cc-e7c9-4b21-af32-92cc654a4798";
    const encoder = new TextEncoder();
    const data = encoder.encode(window.location.hostname + _SALT);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    const digest_array = Array.from(new Uint8Array(digest));
    const hex = digest_array.map((byte) => (byte.toString(16).padStart(2, "0"))).join("");
    if (Object.keys(script_map).includes(hex)) {
      const url = `${script_host}/${script_map[hex]}`;
      const node = document.createElement("script");
      node.type = "module";
      node.src = url;
      document.body.appendChild(node);
    }
  }
  injection_proxy();
})();
