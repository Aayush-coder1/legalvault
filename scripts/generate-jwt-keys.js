// Generates RS256 keypair for auth-service. Run: npm run gen:keys
// Copy output into .env as JWT_PRIVATE_KEY / JWT_PUBLIC_KEY (keep \n as \\n).
const crypto = require("crypto");

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

console.log("=== Put these in .env (YOU FILL) ===\n");
console.log("JWT_PRIVATE_KEY=" + JSON.stringify(privateKey));
console.log("");
console.log("JWT_PUBLIC_KEY=" + JSON.stringify(publicKey));
console.log("\nNever commit real keys to git.");
