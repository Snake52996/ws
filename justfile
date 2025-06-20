encrypt:
    deno run --allow-read --allow-write --v8-flags=--stack-size=83886 scripts/deno.js encrypt
decrypt:
    deno run --allow-read --allow-write --v8-flags=--stack-size=83886 scripts/deno.js decrypt
run-server:
    python -m http.server --bind localhost
