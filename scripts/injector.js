// ==UserScript==
// @name        WS progress tracker injector
// @namespace   Violentmonkey Scripts
// @match       *://*/*
// @grant       GM_addStyle
// @version     1.3
// ==/UserScript==
(() => {
  const script_host = "https://snake.moe/ws/scripts";
  const script_map = {
    "1aa3a0354e2b082beaab8641c6e47501c1c389812c21ba23c5deecbeae21d678": "inj-00.js",
    "b9ce05953b157764098e994c5a57816f6580565fbee44d1703f3cbfb49cd9f71": "inj-01.js",
    "0c4b95a69ed536794e09780b044765e65684de12dae80ceea6b2289706c3e248": "inj-02.js",
  };
  function create_indicator(retry_callable) {
    GM_addStyle(`
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
      .indicator-container {
        overflow: hidden;
        position: fixed;
        top: 0;
        right: 0;
        margin: 12px;
        width: 50px;
        height: 50px;
      }
      .indicator-content {
        width: 100%;
        height: 100%;
        border-style: solid;
        border-width: 6px;
        border-radius: 50%;
      }
      .indicator-loading {
        border-color: #c0c0c0;
        border-top-color: #007bff;
        animation: spin 1s linear infinite;
      }
      .indicator-succeed {
        border-color: #0cfc0c;
      }
      .indicator-failed {
        border-color: #fc0c0c;
      }
    `);
    const container = document.createElement("div");
    container.classList.add("indicator-container");
    const indicator = document.createElement("div");
    indicator.classList.add("indicator-content", "indicator-loading");
    container.appendChild(indicator);
    document.body.appendChild(container);
    const _helper = {
      status: "loading",
      failed: function () {
        indicator.classList.remove(`indicator-${_helper.status}`);
        indicator.classList.add("indicator-failed");
        indicator.addEventListener("click", () => { retry_callable(); _helper.loading(); });
        _helper.status = "failed";
      },
      succeed: function () {
        indicator.classList.remove(`indicator-${_helper.status}`);
        indicator.classList.add("indicator-succeed");
        _helper.status = "succeed";
      },
      loading: function () {
        indicator.classList.remove(`indicator-${_helper.status}`);
        indicator.classList.add("indicator-loading");
        indicator.removeEventListener("click", retry_callable);
        _helper.status = "loading";
      },
    }
    return _helper;
  }
  async function injection_proxy() {
    const _SALT = "a3d358cc-e7c9-4b21-af32-92cc654a4798";
    const encoder = new TextEncoder();
    const data = encoder.encode(window.location.hostname + _SALT);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    const digest_array = Array.from(new Uint8Array(digest));
    const hex = digest_array.map((byte) => (byte.toString(16).padStart(2, "0"))).join("");
    if (!Object.keys(script_map).includes(hex)) {
      return;
    }
    const url = `${script_host}/${script_map[hex]}`;
    const node = document.createElement("script");
    node.type = "module";
    node.src = url;
    const indicator = create_indicator(() => {
      document.body.removeChild(node);
      document.body.appendChild(node);
    });
    node.addEventListener("error", () => { indicator.failed(); });
    document.addEventListener("injected_script_launch_failed", () => { indicator.failed(); });
    document.addEventListener("injected_script_launched_successfully", () => { indicator.succeed(); });
    document.body.appendChild(node);
  }
  injection_proxy();
})();
