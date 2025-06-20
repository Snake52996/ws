import {
  MetaKey,
  load_meta,
  get_key,
  decrypt_data,
  decrypt_image,
} from "./core.js"

async function main() {
  // load metadata
  const metadata = load_meta(await (await fetch(new Request("meta.json"))).text());
  const derivation = metadata.derivation;
  const encryption = metadata.encryption;

  // get key
  const password = prompt("Please enter the password:");
  const key = await get_key(password, derivation, encryption);

  // load real data
  const data_response = await fetch(new Request("data.json"));
  const raw_string = await data_response.text();
  const list = await decrypt_data(raw_string, key, encryption);

  const container = document.getElementById("container");

  async function process(name) {
    async function load_on_click(event) {
      const response = await fetch(new Request(event.target.dataset.source));
      const encrypted_image = new Uint8Array(await response.arrayBuffer());
      const image = await decrypt_image(encrypted_image, key, encryption, list[event.target.dataset.name]);
      const blob = new Blob([image], { type: 'image/webp' });
      const url = URL.createObjectURL(blob);
      event.target.src = url;
    }
    const information = list[name];

    // build node
    let work = document.createElement("div");
    work.classList.add("work");
    let cover_container = document.createElement("div");
    let spacer0 = document.createElement("span");
    spacer0.classList.add("spacer");
    let spacer1 = document.createElement("span");
    spacer1.classList.add("spacer");
    let cover = document.createElement("img");
    cover.dataset.source = `${list[name].encrypted_name}.webp`;
    cover.dataset.name = name;
    cover.addEventListener("click", load_on_click);
    let information_container = document.createElement("div");
    for (const key of Object.keys(information)) {
      if (MetaKey.includes(key)) {
        continue;
      }
      let node = document.createElement("span");
      node.innerText = `${key}: ${information[key]}`;
      information_container.appendChild(node);
    }
    cover_container.appendChild(spacer0);
    cover_container.appendChild(cover);
    cover_container.appendChild(spacer1);
    work.appendChild(cover_container);
    work.appendChild(information_container);

    container.appendChild(work);
  }
  // process all targets
  await Promise.all(Object.keys(list).map((name) => process(name)));

}
main();