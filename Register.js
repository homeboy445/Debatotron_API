const EmailParser = (email) => {
  var str, in1, inl;
  for (var i = 0; i < email.length; i++) {
    if (email[i] === "@") {
      in1 = i + 1;
    }
    if (email[i] === ".") {
      inl = i;
    }
  }
  str = email.substring(in1, inl);
  return str;
};
const HandleRegister = (req, res, postgres, bcrypt, saltRounds, uuidv4) => {
  const { user, email, password, recovery, answer } = req.body;
  var mailP = EmailParser(email);
  if (!email || !user || !password) {
    return res.status(400).json("Nothing recieved!");
  }
  if (mailP !== "gmail" && mailP !== "yahoo") {
    return res.status(400).json("Enter a valid email!");
  }
  const hash = bcrypt.hashSync(password, saltRounds);
  const answer_hash = bcrypt.hashSync(answer, saltRounds);
  postgres
    .transaction((trx) => {
      trx
        .insert({
          hash: hash,
          email: email,
        })
        .into("login")
        .returning("email")
        .then((LoginEmail) => {
          return trx("users")
            .returning("id", "name")
            .insert({
              email: LoginEmail[0],
              name: user,
              joinedat: new Date().toLocaleDateString(),
              access: "public",
              recovery: recovery,
              answer: answer_hash,
              profile_image: Math.random().toString(),
              about: "A debatotron user."
            })
            .then((user) => {
              res.json(user);
              postgres("inbox")
                .insert({
                  message: `Welcome to the Debatotron ${user[0].name}! We hope you'll like it here!`,
                  byuser: "DebManager",
                  touser: user[0].name,
                  recievedat: new Date().toLocaleDateString(),
                  additional: JSON.stringify({
                    type: "request",
                    rtype: -1,
                  }),
                  messageid: uuidv4(),
                })
                .then((response) => {
                  return;
                });
            });
        })
        .then(trx.commit)
        .catch(trx.rollback);
    })
    .catch((err) => {
      console.log(err);
      res.status(400).json("unable to register!");
    });
};
module.exports = {
  HandleRegister,
};
