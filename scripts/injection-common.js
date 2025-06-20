import {
  load_meta,
  get_key,
  decrypt_data,
} from "./core.js";

function get_password(cache_key) {
  // get password and prepare it as a base crypto key, try to read cached key from local storage first
  let cached = localStorage.getItem(cache_key);
  if (cached !== null) {
    return cached;
  }
  let password = prompt("Please enter the password:");
  // cache it
  localStorage.setItem(cache_key, password);
  return password;
}

export async function get_data(cache_key) {
  const _Host = "https://snake.moe/ws/";

  // load metadata
  const metadata = load_meta(await (await fetch(new Request(`${_Host}meta.json`))).text());
  const derivation = metadata.derivation;
  const encryption = metadata.encryption;

  // get key
  const password = get_password(cache_key);
  const key = await get_key(password, derivation, encryption);

  // load data
  const response = await fetch(new Request(`${_Host}data.json`));
  const raw_string = await response.text();
  const data = await decrypt_data(raw_string, key, encryption);
  return data;
}

export function add_style(style) {
  const node = document.createElement("style");
  node.innerHTML = style;
  document.head.appendChild(node);
}