const express = require("express");
const c = require("../controllers/auth.controller");
const { checkSignup, checkLogin } = require("../middleware/validate");
const { jwks } = require("../keys/jwks");

const router = express.Router();

router.post("/signup", checkSignup, c.signup);
router.post("/register", checkSignup, c.signup); // alias for frontend
router.post("/login", checkLogin, c.login);
router.post("/refresh", c.refresh);
router.post("/logout", c.logout);
router.get("/me", c.me);
router.get("/jwks.json", jwks);

module.exports = router;
