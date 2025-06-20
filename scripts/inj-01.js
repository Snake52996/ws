import { get_data, add_style } from "./injection-common.js"

async function main() {
  if (!(await (async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode(
      window.location.href.substring(0, 34) + "07f65ea1-b7d8-4172-abbc-66db0f48e32e"
    );
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    const digest_array = Array.from(new Uint8Array(digest));
    const hex = digest_array.map((byte) => (byte.toString(16).padStart(2, "0"))).join("");
    return hex === "4bc26f1d36a483ec54cf7adc9d6d053b874f07fe95462dd2665e934a736522d9";
  })())) {
    return;
  }
  const StorageKey = "212d78dc-4500-4602-a171-7a2c21b44632";
  const data = await get_data(StorageKey);
  const tracked_work = Object.keys(data);

  window.addEventListener("load", (() => {
    const list = document.getElementById("search_result_img_box");
    if (list === null) { return; }

    add_style(`.tracked {
  filter: blur(5px);
  transition-duration: 0.4s;
}
.tracked:hover {
  filter: none;
}`);
    for (const node of list.children) {
      if (tracked_work.includes(node.dataset.list_item_product_id)) {
        node.classList.add("tracked");
      }
    }
  }));
}
main();