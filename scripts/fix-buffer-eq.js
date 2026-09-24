// Durable fix for `buffer-equal-constant-time` crash on Node 20+.
// The old package does `SlowBuffer.prototype.equal` at require-time, but
// `SlowBuffer` was removed from Node's `buffer` module, so `jsonwebtoken`
// -> `jwa` -> `buffer-equal-constant-time` throws:
//   TypeError: Cannot read properties of undefined (reading 'prototype')
// This patch guards all SlowBuffer uses. Safe to run on every install.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = join(
  __dirname,
  "..",
  "node_modules",
  "buffer-equal-constant-time",
  "index.js"
);

if (!existsSync(target)) {
  console.log("[patch] buffer-equal-constant-time not installed, skipping");
  process.exit(0);
}

let src = readFileSync(target, "utf8");
let changed = false;

const replacements = [
  [
    "bufferEq.install = function() {\n  Buffer.prototype.equal = SlowBuffer.prototype.equal = function equal(that) {\n    return bufferEq(this, that);\n  };\n};",
    `bufferEq.install = function() {
  Buffer.prototype.equal = function equal(that) {
    return bufferEq(this, that);
  };
  if (typeof SlowBuffer !== "undefined" && SlowBuffer && SlowBuffer.prototype) {
    SlowBuffer.prototype.equal = Buffer.prototype.equal;
  }
};`,
  ],
  [
    "var origBufEqual = Buffer.prototype.equal;\nvar origSlowBufEqual = SlowBuffer.prototype.equal;\nbufferEq.restore = function() {\n  Buffer.prototype.equal = origBufEqual;\n  SlowBuffer.prototype.equal = origSlowBufEqual;\n};",
    `var origBufEqual = Buffer.prototype.equal;
var origSlowBufEqual = typeof SlowBuffer !== "undefined" && SlowBuffer && SlowBuffer.prototype ? SlowBuffer.prototype.equal : undefined;
bufferEq.restore = function() {
  Buffer.prototype.equal = origBufEqual;
  if (typeof SlowBuffer !== "undefined" && SlowBuffer && SlowBuffer.prototype) {
    SlowBuffer.prototype.equal = origSlowBufEqual;
  }
};`,
  ],
];

for (const [oldStr, newStr] of replacements) {
  if (src.includes(oldStr)) {
    src = src.replace(oldStr, newStr);
    changed = true;
  }
}

if (changed) {
  writeFileSync(target, src);
  console.log("[patch] buffer-equal-constant-time patched for Node 20+");
} else {
  console.log("[patch] buffer-equal-constant-time already patched, skipping");
}
