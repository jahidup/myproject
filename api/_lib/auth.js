const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret";
const TOKEN_TTL = "12h";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function decodeToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function getBearerToken(headerValue = "") {
  if (!headerValue.startsWith("Bearer ")) return null;
  return headerValue.slice(7).trim();
}

function requireAuth(allowedRoles = []) {
  return (req, res, next) => {
    try {
      const token = getBearerToken(req.headers.authorization || "");
      if (!token) {
        return res.status(401).json({ error: "Missing authorization token." });
      }

      const payload = decodeToken(token);
      req.user = payload;

      if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: "You are not allowed to access this resource." });
      }

      return next();
    } catch (error) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
  };
}

module.exports = { signToken, requireAuth };
