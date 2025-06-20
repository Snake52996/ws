import { get_data, add_style } from "./injection-common.js"

async function main() {
  const StorageKey = "0c853a3f-b038-446c-8457-646b754dbbf7";
  const data = await get_data(StorageKey);
  const tracked_work = Object.keys(data);

  add_style(`.tracked {
  filter: blur(5px);
  transition-duration: 0.4s;
}
.tracked:hover {
  filter: none;
}`);

  for (const toplevel of document.getElementsByTagName("article")) {
    if (toplevel.firstElementChild === null) {
      continue;
    }
    if (toplevel.firstElementChild.firstElementChild === null) {
      continue;
    }
    const title = toplevel.firstElementChild.firstElementChild.innerText;
    const match = title.match(/.+\[([^\]]+)\]$/);
    if (match === null) {
      continue;
    }
    if (tracked_work.includes(match[1])) {
      toplevel.classList.add("tracked");
    }
  }
}
main();