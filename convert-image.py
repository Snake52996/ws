#!/bin/env python
from pathlib import Path
from PIL import Image
from concurrent.futures import ProcessPoolExecutor
from mimetypes import guess_type
from json import dump as json_dump
def process(path: Path):
  print(path)
  image = Image.open(path)
  image.save(path.with_suffix(".webp"), "webp")
  image.close()
  path.unlink(missing_ok=False)

  default_information = {
    "code": "",
    "title": "",
    "available_on": "",
    "status": "",
    "rating": "",
    "comment": "",
  }
  with path.with_suffix(".json").open("w", encoding="utf-8") as information_file:
    json_dump(default_information, information_file, indent=2)

def main():
  executor = ProcessPoolExecutor()
  for item in Path.cwd().iterdir():
    if not item.is_file():
      continue
    guess_result = guess_type(item)[0]
    if guess_result is None or not guess_result.startswith("image/"):
      continue
    if item.suffix == ".webp":
      continue
    executor.submit(process, item)
  executor.shutdown(wait=True, cancel_futures=False)

if __name__ == "__main__":
  main()