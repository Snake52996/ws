// ask for password
const deno = typeof Deno !== 'undefined';
const ImageHeaderSize = 12;
const PBKDF2Parameter = {
  name: "PBKDF2",
  hash: "SHA-512",
  iterations: 1000000,
};
const AESParameter = { name: "AES-GCM", length: 256 };
async function main() {
  // ask password and prepare it as a base crypto key
  const password = prompt("Please enter the password:");
  const encoder = new TextEncoder();
  const encoded_password = encoder.encode(password);
  const base_key = await crypto.subtle.importKey("raw", encoded_password, "PBKDF2", false, ["deriveKey"]);

  // encryption mode is used only when running on Deno
  if (deno && Deno.args[0] === "encrypt") {
    // encrypt data files:
    //  1. (webp) images are encrypted in-place with their file header unchanged
    //  2. JSON files are combined together and encrypted into a single file

    // prepare salt for key derivation
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    // get encryption key
    const key = await crypto.subtle.deriveKey(
      { ...PBKDF2Parameter, salt: salt },
      base_key,
      AESParameter,
      false,
      ["encrypt"]
    );

    // list files and generate list of names to be processed
    let name_list = new Array();
    for (const entry of Deno.readDirSync(".")) {
      if (!entry.isFile) { continue; }
      if (!entry.name.endsWith(".webp")) { continue; }
      name_list.push(entry.name.slice(0, -5));
    }
    console.log(name_list);

    let list = {};

    // function to handle a single name
    async function process(name) {
      // prepare iv
      const iv = crypto.getRandomValues(new Uint8Array(12));
      async function process_image() {
        const image = await Deno.readFile(`${name}.webp`);
        const encrypted_body = new Uint8Array(await crypto.subtle.encrypt(
          { name: "AES-GCM", iv: iv }, key, image.slice(ImageHeaderSize)
        ));
        await Deno.writeFile(`${name}.webp`, image.slice(0, ImageHeaderSize));
        await Deno.writeFile(`${name}.webp`, encrypted_body, { append: true });
      }
      async function process_information() {
        const information = await Deno.readTextFile(`${name}.json`);
        await Deno.remove(`${name}.json`);
        list[name] = {
          image_iv: btoa(String.fromCharCode.apply(null, iv)),
          information: information,
        };
      }
      return Promise.all([process_image(), process_information()]);
    }

    // process files
    await Promise.all(name_list.map((name) => process(name)));

    console.log(list);

    // encrypt information list
    const encoded_list = encoder.encode(JSON.stringify(list));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted_list = new Uint8Array(await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv }, key, encoded_list
    ));
    let final_list = {
      iv: btoa(String.fromCharCode.apply(null, iv)),
      salt: btoa(String.fromCharCode.apply(null, salt)),
      data: btoa(String.fromCharCode.apply(null, encrypted_list)),
    };
    await Deno.writeTextFile("data.json", JSON.stringify(final_list));
  } else {
    // decrypt may happen on both Deno (when checking out) and browser
    // when running on Deno, do the reverse process of encryption
    // when in a browser, decrypt and render information on to the page

    // load information
    let raw_string;
    if (deno) {
      raw_string = await Deno.readTextFile("data.json");
    } else {
      const response = await fetch(new Request("data.json"));
      raw_string = await response.text();
    }
    const final_list = JSON.parse(raw_string);

    // prepare salt
    const salt = Uint8Array.from(Array.from(atob(final_list["salt"])).map(x => x.charCodeAt(0)));
    // prepare decryption key
    const key = await crypto.subtle.deriveKey(
      { ...PBKDF2Parameter, salt: salt },
      base_key,
      AESParameter,
      false,
      ["decrypt"]
    );

    // decrypt information
    const iv = Uint8Array.from(Array.from(atob(final_list["iv"])).map(x => x.charCodeAt(0)));
    const encrypted = Uint8Array.from(Array.from(atob(final_list["data"])).map(x => x.charCodeAt(0)));
    const encoded_list = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted));
    // decode information and prepare as object
    const decoder = new TextDecoder("utf-8");
    const list = JSON.parse(decoder.decode(encoded_list));
    console.log(list);

    // get container if running in browser
    const container = deno ? null : document.getElementById("container");

    async function decrypt_image(image, entry) {
      const iv = Uint8Array.from(
        Array.from(atob(entry["image_iv"])).map(x => x.charCodeAt(0))
      );
      const body = new Uint8Array(await crypto.subtle.decrypt(
        { name: "AES-GCM", iv }, key, image.slice(ImageHeaderSize)
      ));
      image.set(body, ImageHeaderSize);
      return image;
    }

    async function process_deno(name) {
      const write_information = Deno.writeTextFile(`${name}.json`, list[name]["information"]);
      const encrypted_image = await Deno.readFile(`${name}.webp`);
      const image = await decrypt_image(encrypted_image, list[name]);
      await Deno.writeFile(`${name}.webp`, image);
      await write_information;
    }

    async function process_browser(name) {
      const response = await fetch(new Request(`${name}.webp`));
      const encrypted_image = new Uint8Array(await response.arrayBuffer());
      const image = await decrypt_image(encrypted_image, list[name]);
      const information = JSON.parse(list[name]["information"]);

      // build node

      let work = document.createElement("div");
      work.classList.add("work");
      let cover_container = document.createElement("div");
      let cover = document.createElement("img");
      const blob = new Blob([image], { type: 'image/webp' });
      const url = URL.createObjectURL(blob);
      cover.src = url;
      let information_container = document.createElement("div");
      for (const key of Object.keys(information)) {
        let node = document.createElement("span");
        node.innerText = `${key}: ${information[key]}`;
        information_container.appendChild(node);
      }
      cover_container.appendChild(cover);
      work.appendChild(cover_container);
      work.appendChild(information_container);

      container.appendChild(work);
    }

    // select processor
    const processor = deno ? process_deno : process_browser;
    // process all targets
    await Promise.all(Object.keys(list).map((name) => processor(name)));
    if (deno) {
      await Deno.remove("data.json")
    }
  }

}
main();