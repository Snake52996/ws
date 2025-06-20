import {
  newKeyDerivationParameter,
  newEncryptionParameter,
  compare_data,
  dump_meta,
  load_meta,
  get_key,
  decrypt_data,
  encrypt_data,
  fill_meta_keys,
  decrypt_image,
  encrypt_image,
} from "./core.js"

const PlainDirectoryName = "plain-data";
async function main() {
  // load metadata
  try {
    Deno.statSync("meta.json");
  } catch (error) {
    Deno.writeTextFile("meta.json", dump_meta(newKeyDerivationParameter(), newEncryptionParameter()));
  }
  const metadata = load_meta(Deno.readTextFileSync("meta.json"));
  const derivation = metadata.derivation;
  const encryption = metadata.encryption;

  // get key
  const password = prompt("Please enter the password:");
  const key = await get_key(password, derivation, encryption);

  async function load_data() {
    // load information
    try {
      Deno.statSync("data.json");
    } catch (error) {
      return {};
    }
    const raw_string = Deno.readTextFileSync("data.json");
    return await decrypt_data(raw_string, key, encryption);
  }

  // to make sure that no failure occurred during the execution of this script can put us in an intermediate
  //  state, a temporary directory is employed and all decrypted files are put in it
  Deno.mkdirSync(PlainDirectoryName, { recursive: true });

  // encryption mode is used only when running on Deno
  if (Deno.args[0] === "encrypt") {
    // list files and generate list of names to be processed
    const name_list = new Array();
    for (const entry of Deno.readDirSync(PlainDirectoryName)) {
      if (!entry.isFile) { continue; }
      if (!entry.name.endsWith(".webp")) { continue; }
      name_list.push(entry.name.slice(0, -5));
    }

    const list = {};

    // function to handle a single name
    async function process(name) {
      const data = JSON.parse(await Deno.readTextFile(`${PlainDirectoryName}/${name}.json`));
      fill_meta_keys(data);
      list[name] = data;
      const image = await Deno.readFile(`${PlainDirectoryName}/${name}.webp`);
      const encrypted_image = await encrypt_image(image, key, encryption, data);
      const new_name = data.encrypted_name;
      await Deno.writeFile(`${new_name}.webp`, encrypted_image);
    }

    // process files
    await Promise.all(name_list.map((name) => process(name)));

    // encrypt information list
    // We first decrypt the encrypted data file again if which exists and check if any modification have been
    //  made. If the data file is not changed, we shall not rewrite it. This ensures that no extra commit will
    //  be made.
    const old_list = await load_data();
    if (!compare_data(old_list, list)) {
      const final_list = await encrypt_data(list, key, encryption);
      await Deno.writeTextFile("data.json", final_list);
    }

    // we are done here, finally we can delete the directory
    await Deno.remove(PlainDirectoryName, { recursive: true });
  } else {
    // decrypt: do the reverse process of encryption
    const list = await load_data();

    async function process(name) {
      const write_information = Deno.writeTextFile(
        `${PlainDirectoryName}/${name}.json`,
        JSON.stringify(list[name])
      );
      const encrypted_image = await Deno.readFile(`${list[name].encrypted_name}.webp`);
      const image = await decrypt_image(encrypted_image, key, encryption, list[name]);
      await Deno.writeFile(`${PlainDirectoryName}/${name}.webp`, image);
      await write_information;
    }
    // process all targets
    await Promise.all(Object.keys(list).map((name) => process(name)));
  }
}
main();