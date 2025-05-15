encrypt:
    deno run --allow-read --allow-write --v8-flags=--stack-size=83886 crypto.js encrypt
decrypt:
    deno run --allow-read --allow-write --v8-flags=--stack-size=83886 crypto.js decrypt
run-server:
    python -m http.server --bind localhost
