const { publicKeyToJwk } = require("../services/token.service");
const config = require("../config");

// Serves public keys so other services can verify JWTs themselves.
function jwks(req, res) {
  res.json({ keys: [publicKeyToJwk()] });
}

module.exports = { jwks };
