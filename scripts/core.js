// encode an Uint8Array using base64 encoding, returns a string
export function base64Encode(array) {
  return btoa(String.fromCharCode.apply(null, array));
}
// decode a string containing valid base64 encoded content to an Uint8Array
export function base64Decode(string) {
  return Uint8Array.from(Array.from(atob(string)).map(x => x.charCodeAt(0)));
}

function compare_object(lhs, rhs) {
  let result;
  if (typeof lhs !== typeof rhs) {
    result = false;
  } else if (typeof lhs !== "object") {
    result = lhs === rhs;
  } else {
    const keys = Object.keys(lhs);
    if (keys.length !== Object.keys(rhs).length) {
      result = false;
    } else {
      result = keys.map(key => (compare_object(lhs[key], rhs[key]))).every(value => value);
    }
  }
  return result;
}

// utility: compare two set of data, return if they are identical
export function compare_data(old, mew) {
  // return if there two lists are identical
  const old_works = Object.keys(old);
  const new_works = Object.keys(mew);
  const shared_works = new Array();
  let result = true;
  for (const key of old_works) {
    if (!new_works.includes(key)) {
      result = false;
      console.log("Remove: ", old_works[key]);
    } else {
      shared_works.push(key);
    }
  }
  for (const key of new_works) {
    if (!old_works.includes(key)) {
      result = false;
      console.log("Add: ", mew[key]);
    }
  }
  for (const key of shared_works) {
    if (!compare_object(old[key], mew[key])) {
      result = false;
      console.log("Change: ", old[key], " --> ", mew[key]);
    }
  }
  return result;
}

// generate a new parameter for SubtleCrypto.deriveKey
export function newKeyDerivationParameter() {
  const PBKDF2Parameter = {
    name: "PBKDF2",
    hash: "SHA-512",
    iterations: 4000000,
    salt: crypto.getRandomValues(new Uint8Array(16)),
  };
  return PBKDF2Parameter;
}
// generate a new parameter for SubtleCrypto.encrypt
export function newEncryptionParameter() {
  return { name: "AES-GCM", length: 256 };
}

// load parameters from meta information
export function load_meta(meta_string) {
  const metadata = JSON.parse(meta_string);
  const derivation = {
    ...metadata.pbkdf2,
    salt: base64Decode(metadata.pbkdf2.salt),
  };
  const encryption = metadata.aes;
  return {
    derivation: derivation,
    encryption: encryption,
  };
}
// export parameters as meta information
export function dump_meta(derivation, encryption) {
  const metadata = {
    pbkdf2: {
      ...derivation,
      salt: base64Encode(derivation.salt),
    },
    aes: encryption,
  };
  return JSON.stringify(metadata);
}

// get key used to do encryption
export async function get_key(password, derivation, encryption) {
  const encoder = new TextEncoder();
  const encoded_password = encoder.encode(password);
  const base_key = await crypto.subtle.importKey(
    "raw",
    encoded_password,
    derivation.name,
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    derivation,
    base_key,
    encryption,
    false,
    ["encrypt", "decrypt"],
  );
  return key;
}

// decrypt data
export async function decrypt_data(encrypted_data, key, encryption) {
  const structural_encrypted_data = JSON.parse(encrypted_data);
  const iv = base64Decode(structural_encrypted_data.iv);
  const encrypted = base64Decode(structural_encrypted_data.data);
  const encoded = new Uint8Array(await crypto.subtle.decrypt({ name: encryption.name, iv }, key, encrypted));
  const decoder = new TextDecoder("utf-8");
  const data = JSON.parse(decoder.decode(encoded));
  return data;
}
const _ImageHeaderSize = 12;
export async function decrypt_image(encrypted_bytes, key, encryption, associated_data) {
  const iv = base64Decode(associated_data.iv);
  const body = new Uint8Array(await crypto.subtle.decrypt(
    { name: encryption.name, iv },
    key,
    encrypted_bytes.slice(_ImageHeaderSize),
  ));
  const result = new Uint8Array(_ImageHeaderSize + body.length);
  result.set(encrypted_bytes.slice(0, _ImageHeaderSize));
  result.set(body, _ImageHeaderSize);
  return result;
}

export const MetaKey = ["iv", "encrypted_name"];
// fill value for meta keys if required
export function fill_meta_keys(data) {
  const keys = Object.keys(data);
  if (!keys.includes("iv")) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    data["iv"] = base64Encode(iv);
  }
  if (!keys.includes("encrypted_name")) {
    data["encrypted_name"] = crypto.randomUUID();
  }
  return data;
}
export async function encrypt_data(data, key, encryption) {
  // encode the structured data
  const encoder = new TextEncoder();
  const encoded = encoder.encode(JSON.stringify(data));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: encryption.name, iv: iv }, key, encoded
  ));
  const final_list = {
    iv: base64Encode(iv),
    data: base64Encode(encrypted),
  };
  return JSON.stringify(final_list);
}
export async function encrypt_image(image, key, encryption, associated_data) {
  const iv = base64Decode(associated_data.iv);
  const body = new Uint8Array(await crypto.subtle.encrypt(
    { name: encryption.name, iv },
    key,
    image.slice(_ImageHeaderSize),
  ));
  const result = new Uint8Array(_ImageHeaderSize + body.length);
  result.set(image.slice(0, _ImageHeaderSize));
  result.set(body, _ImageHeaderSize);
  return result;
}