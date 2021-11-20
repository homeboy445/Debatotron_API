/**
 * Verify the user...
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 * @returns 
 */
const authenticate = (req, res, next) => {
  const header = req.headers["authorization"];
  try {
    const token = header.split(" ")[1];
    if (token === null) {
      return res.sendStatus(401);
    }
    if (jwt.verify(token, process.env.ACCESS_TOKEN_KEY)) {
      return next();
    }
    throw token;
  } catch (e) {
    res.sendStatus(401);
  }
};

module.exports = {
  authenticate,
};
