import { get_data, add_style } from "./injection-common.js"

async function main() {
  const StorageKey = "637bb179-5430-4e38-955a-9de04940e205";

  const data = await get_data(StorageKey);

  function handle_user_script() {
    // we do not decrypt image or prepare detailed information when running as user script
    //  therefore, we use a dedicated function to handle such case so that we can return early
    // we only care about the word ID
    const tracked_work = Object.keys(data);
    // prepare CSS style
    add_style(`
        .tracked {
          filter: blur(5px);
          transition-duration: 0.4s;
        }
        .tracked:hover {
          filter: none;
        }
      `);
    // since we are working with a SPA, we need to detect changes made on href
    (() => {
      let last_class = "";
      const work_observers = {
        "": null,
        "work": {
          "get_work_id": function (href) {
            if (href.endsWith("/")) {
              href = href.substring(0, href.length - 1);
            }
            return href.substring(href.lastIndexOf("/") + 1);
          },
          "observer": new MutationObserver((records, observer) => {
            for (let record of records) {
              const work_id = work_observers.work.get_work_id(record.target.href);
              if (tracked_work.includes(work_id)) {
                document.getElementsByTagName("body")[0].classList.add("tracked");
                return;
              }
              document.getElementsByTagName("body")[0].classList.remove("tracked");
            }
          }),
          "observe": function (target) {
            work_observers.work.observer.observe(target, { subtree: true, attributes: true, attributeFilter: ["href"] });
            for (let node of document.querySelectorAll("a.router-link-active[href]")) {
              const work_id = work_observers.work.get_work_id(node.href);
              if (tracked_work.includes(work_id)) {
                document.getElementsByTagName("body")[0].classList.add("tracked");
                return;
              }
            }
            document.getElementsByTagName("body")[0].classList.remove("tracked");
          },
          "disconnect": function () {
            work_observers.work.observer.disconnect();
            document.getElementsByTagName("body")[0].classList.remove("tracked");
          },
        },
        "list": {
          "observer": new MutationObserver((records, observer) => {
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
          }),
          "observe": function (target) {
            work_observers.list.observer.observe(target, { childList: true });
            for (let node of target.childNodes) {
              if (tracked_work.includes(node.id)) {
                node.classList.add("tracked");
              }
            }
          },
          "disconnect": function () {
            work_observers.list.observer.disconnect();
          },
        },
      };
      const work_targets = {
        "": null,
        "work": () => (document.querySelector(".q-page-container > div:nth-child(1) > div:nth-child(1)")),
        "list": () => (document.querySelector("main>div:nth-child(2)")),
      };

      function get_path_class(path) {
        if (path.startsWith("/work/")) {
          return "work";
        }
        if (path === "/works") {
          return "list";
        }
        return "";
      }
      function dispatcher() {
        const current_class = get_path_class(window.location.pathname);
        if (current_class !== last_class) {
          if (work_observers[last_class] !== null) {
            work_observers[last_class].disconnect();
          }
          last_class = current_class;
          if (work_targets[current_class] !== null) {
            const target = work_targets[current_class]();
            if (target === null) {
              last_class = "";
              return;
            }
            work_observers[current_class].observe(target);
          }
        }
      }
      const dispatcher_observer = new MutationObserver(dispatcher);
      dispatcher_observer.observe(document, { subtree: true, childList: true });
    })();
  }
  handle_user_script();
}
try {
  main();
  document.dispatchEvent(new CustomEvent("injected_script_launched_successfully"));
} catch (error) {
  document.dispatchEvent(new CustomEvent("injected_script_launch_failed"));
}