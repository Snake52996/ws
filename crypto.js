// ==UserScript==
// @name        WS progress tracker
// @namespace   Violentmonkey Scripts
// @match
// @grant       GM_addStyle
// @version     1.0
// ==/UserScript==

// ws progress tracker
// this script may run in three different environments:
//  1. running locally with Deno that encrypts/decrypts local files
//  2. running in web browser that decrypt files into memory and renders to webpage
//  3. running as user script injected to certain website that shows tracked work

const deno = typeof Deno !== 'undefined';
const injected = typeof GM_addStyle !== 'undefined';
const host = injected ? "https://snake.moe/ws/" : "";
const ImageHeaderSize = 12;
const MetaKey = ["iv", "encrypted_name"];
const PlainDirectoryName = "plain-data";
async function main() {
  async function get_password() {
    // get password and prepare it as a base crypto key
    // when running as injected user script, try to read cached key from local storage first
    const StorageKey = "637bb179-5430-4e38-955a-9de04940e205";
    if (injected) {
      let cached = localStorage.getItem(StorageKey);
      if (cached !== null) {
        return cached;
      }
    }
    let password = prompt("Please enter the password:");
    // cache it if running as user script
    if (injected) {
      localStorage.setItem(StorageKey, password);
    }
    return password;
  }

  function compare_object(lhs, rhs) {
    let result;
    if (typeof lhs !== typeof rhs) {
      result = false;
    } else if (typeof lhs !== "object") {
      result = lhs === rhs;
    } else {
      const keys = Object.keys(lhs);
      result = keys.map(key => (compare_object(lhs[key], rhs[key]))).every(value => value);
    }
    return result;
  }

  const password = await get_password();
  const encoder = new TextEncoder();
  const encoded_password = encoder.encode(password);
  const base_key = await crypto.subtle.importKey("raw", encoded_password, "PBKDF2", false, ["deriveKey"]);

  // create a new meta.json file containing encrypting parameters if one does not exist
  // this may only happen when running on Deno/encrypting
  if(deno){
    try{
      Deno.statSync("meta.json");
    } catch (error) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const PBKDF2Parameter = {
        name: "PBKDF2",
        hash: "SHA-512",
        iterations: 4000000,
        salt: btoa(String.fromCharCode.apply(null, salt)),
      };
      const AESParameter = { name: "AES-GCM", length: 256 };
      const metadata = {
        pbkdf2: PBKDF2Parameter,
        aes: AESParameter,
      };
      Deno.writeTextFile("meta.json", JSON.stringify(metadata));
    }
  }

  // load metadata from file
  const meta_string = deno
    ? Deno.readTextFile("meta.json")
    : (await fetch(new Request(`${host}meta.json`))).text();
  const metadata = JSON.parse(await meta_string);
  const PBKDF2Parameter = {
    ...metadata.pbkdf2,
    salt: Uint8Array.from(Array.from(atob(metadata.pbkdf2.salt)).map(x => x.charCodeAt(0))),
  };
  const AESParameter = metadata.aes;

  // get key
  const key = await crypto.subtle.deriveKey(
    PBKDF2Parameter,
    base_key,
    AESParameter,
    false,
    ["encrypt", "decrypt"]
  );

  async function load_data() {
    // load information
    let raw_string;
    if (deno) {
      try {
        Deno.statSync("data.json");
      } catch (error) {
        return {};
      }
      raw_string = await Deno.readTextFile("data.json");
    } else {
      const response = await fetch(new Request(`${host}data.json`));
      raw_string = await response.text();
    }
    const final_list = JSON.parse(raw_string);

    // decrypt information
    const iv = Uint8Array.from(Array.from(atob(final_list["iv"])).map(x => x.charCodeAt(0)));
    const encrypted = Uint8Array.from(Array.from(atob(final_list["data"])).map(x => x.charCodeAt(0)));
    const encoded_list = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted));
    // decode information and prepare as object
    const decoder = new TextDecoder("utf-8");
    const list = JSON.parse(decoder.decode(encoded_list));
    console.log(list);
    return list;
  }

  // to make sure that no failure occurred during the execution of this script can put us in an intermediate
  //  state, a temporary directory is employed and all decrypted files are put in it
  if (deno) {
    Deno.mkdirSync(PlainDirectoryName, { recursive: true });
  }

  // encryption mode is used only when running on Deno
  if (deno && Deno.args[0] === "encrypt") {
    // encrypt data files:
    //  1. (webp) images are encrypted in-place with their file header unchanged
    //  2. JSON files are combined together and encrypted into a single file

    // list files and generate list of names to be processed
    let name_list = new Array();
    for (const entry of Deno.readDirSync(PlainDirectoryName)) {
      if (!entry.isFile) { continue; }
      if (!entry.name.endsWith(".webp")) { continue; }
      name_list.push(entry.name.slice(0, -5));
    }
    console.log(name_list);

    let list = {};

    // function to handle a single name
    async function process(name) {
      const information = JSON.parse(await Deno.readTextFile(`${PlainDirectoryName}/${name}.json`));
      if(!Object.keys(information).includes("iv")){
        const iv = crypto.getRandomValues(new Uint8Array(12));
        information["iv"] = btoa(String.fromCharCode.apply(null, iv));
      }
      if(!Object.keys(information).includes("encrypted_name")){
        information["encrypted_name"] = crypto.randomUUID();
      }
      // prepare iv
      const iv = Uint8Array.from(Array.from(atob(information.iv)).map(x => x.charCodeAt(0)));
      // prepare new name of the picture: do not leak filenames
      const new_name = information.encrypted_name;
      async function process_image() {
        const image = await Deno.readFile(`${PlainDirectoryName}/${name}.webp`);
        const encrypted_body = new Uint8Array(await crypto.subtle.encrypt(
          { name: "AES-GCM", iv: iv }, key, image.slice(ImageHeaderSize)
        ));
        await Deno.writeFile(`${new_name}.webp`, image.slice(0, ImageHeaderSize));
        await Deno.writeFile(`${new_name}.webp`, encrypted_body, { append: true });
      }
      async function process_information() {
        list[name] = information;
      }
      return Promise.all([process_image(), process_information()]);
    }

    // process files
    await Promise.all(name_list.map((name) => process(name)));

    console.log(list);

    // encrypt information list
    // We first decrypt the encrypted data file again if which exists and check if any modification have been
    //  made. If the data file is not changed, we shall not rewrite it. This ensures that no extra commit will
    //  be made.
    const last_list = await load_data();
    if (!compare_object(last_list, list)) {
      const encoded_list = encoder.encode(JSON.stringify(list));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted_list = new Uint8Array(await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv }, key, encoded_list
      ));
      let final_list = {
        iv: btoa(String.fromCharCode.apply(null, iv)),
        data: btoa(String.fromCharCode.apply(null, encrypted_list)),
      };
      await Deno.writeTextFile("data.json", JSON.stringify(final_list));
    }

    // we are done here, finally we can delete the directory
    await Deno.remove(PlainDirectoryName, { recursive: true });
  } else {
    // decrypt may happen on both Deno (when checking out) and browser
    // when running on Deno, do the reverse process of encryption
    // when in a browser, decrypt and render information on to the page

    const list = await load_data();

    async function handle_user_script() {
      // we do not decrypt image or prepare detailed information when running as user script
      //  therefore, we use a dedicated function to handle such case so that we can return early
      // we only care about the word ID
      const tracked_work = Object.keys(list);
      // prepare CSS style
      GM_addStyle(`
        div.tracked {
          filter: blur(5px);
          transition-duration: 0.4s;
        }
        div.tracked:hover {
          filter: none;
        }
      `);
      // prepare callback for observer
      function observer_callback(records, observer) {
        for (let record of records) {
          if (record.type !== "childList") {
            continue;
          }
          for (let node of record.addedNodes) {
            if (tracked_work.includes(node.id)) {
              node.classList.add("tracked");
            }
          }
        }
      }
      // register observer
      let observer = new MutationObserver(observer_callback);
      const target = document.querySelector("main>div:nth-child(2)");
      observer.observe(target, { childList: true });
    }
    if (injected) {
      handle_user_script();
      return;
    }

    // get container if running in browser
    const container = deno ? null : document.getElementById("container");

    async function decrypt_image(image, entry) {
      const iv = Uint8Array.from(
        Array.from(atob(entry.iv)).map(x => x.charCodeAt(0))
      );
      const body = new Uint8Array(await crypto.subtle.decrypt(
        { name: "AES-GCM", iv }, key, image.slice(ImageHeaderSize)
      ));
      let result = new Uint8Array(ImageHeaderSize + body.length);
      result.set(image.slice(0, ImageHeaderSize));
      result.set(body, ImageHeaderSize);
      return result;
    }

    async function process_deno(name) {
      const write_information = Deno.writeTextFile(
        `${PlainDirectoryName}/${name}.json`,
        JSON.stringify(list[name])
      );
      const encrypted_image = await Deno.readFile(`${list[name].encrypted_name}.webp`);
      const image = await decrypt_image(encrypted_image, list[name]);
      await Deno.writeFile(`${PlainDirectoryName}/${name}.webp`, image);
      await write_information;
    }

    async function process_browser(name) {
      async function load_on_click(event) {
        const response = await fetch(new Request(event.target.dataset.source));
        const encrypted_image = new Uint8Array(await response.arrayBuffer());
        const image = await decrypt_image(encrypted_image, list[event.target.dataset.name]);
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
        if(MetaKey.includes(key)){
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

    // select processor
    const processor = deno ? process_deno : process_browser;
    // process all targets
    await Promise.all(Object.keys(list).map((name) => processor(name)));
  }

}
main();