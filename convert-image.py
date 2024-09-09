#!/bin/env python
from concurrent.futures import ProcessPoolExecutor
from json import dump as json_dump
from mimetypes import guess_type
from pathlib import Path

from PIL import Image


def resize(path: Path) -> None:
  """Resize image."""
  image = Image.open(path)
  target_size = (240, 240)
  if image.size == target_size:
    return
  image = image.resize(target_size, resample=Image.Resampling.LANCZOS)
  image.save(path, "webp")
  image.close()


def convert(path: Path) -> None:
  """Convert image to WebP and resize."""
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
  resize(path)


def main() -> None:
  """Convert/resize images."""
  executor = ProcessPoolExecutor()
  for item in Path.cwd().iterdir():
    if not item.is_file():
      continue
    guess_result = guess_type(item)[0]
    if guess_result is None or not guess_result.startswith("image/"):
      continue
    if item.suffix == ".webp":
      executor.submit(resize, item)
    else:
      executor.submit(convert, item)
  executor.shutdown(wait=True, cancel_futures=False)

if __name__ == "__main__":
  main()