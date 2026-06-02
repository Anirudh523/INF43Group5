import crypto from "node:crypto";

const PBKDF2_ITERATIONS = 120000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(String(password), salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST)
    .toString("hex");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  if (!stored.startsWith("pbkdf2$")) {
    return String(password) === stored;
  }

  const [, iterations, salt, expected] = stored.split("$");
  if (!iterations || !salt || !expected) return false;
  const actual = crypto
    .pbkdf2Sync(String(password), salt, Number(iterations), KEY_LENGTH, DIGEST)
    .toString("hex");

  return timingSafeEqualHex(actual, expected);
}

export function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function timingSafeEqualHex(a, b) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
