/**
 * Function for signing the user in.
 * @param {*} res 
 * @param {*} jwt 
 * @param {*} bcrypt 
 * @param {*} postgres 
 * @param {*} email 
 * @param {*} password 
 * @param {*} getJwtToken 
 */
const SignIn = async (res, jwt, bcrypt, postgres, email, password, getJwtToken) => {
  postgres
    .select("hash")
    .from("login")
    .where({ email: email })
    .then(async (response) => {
      if (response.length === 0) {
        throw response;
      }
      const passwordMatchResult = await bcrypt.compare(password, response[0].hash);
      if (!passwordMatchResult) {
        return res.sendStatus(401);
      }
      const token = await getJwtToken(jwt, postgres, email, response[0].hash);
      console.log("~~> ", token);
      if (!token) {
        return res.sendStatus(401);
      }
      res.json(token);
    })
    .catch((err) => {
      console.log("sgn_in: ", err);
      res.status(500).json("Failed!");
    });
};

module.exports = {
  SignIn,
};
