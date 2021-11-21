const express = require("express");
const PORT = process.env.PORT || 3005;
const app = express();
const http = require("http").createServer(app);
const jwt = require("jsonwebtoken");
const {
  FindNameintheTarget,
  AppendMessageToInbox,
  RemoveFriendRequest,
  GroupComments,
  MatchUsersAndSendMessage,
  getImagebyUser,
  getJwtToken,
  RemoveMessageFromInboxById,
} = require("./utility/Utility");
const { Register } = require("./models/register/Register");
const bcrypt = require("bcrypt");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const saltRounds = 10;
const knex = require("knex");
const { SignIn } = require("./models/signIn/SignIn");
const { authenticate } = require("./middleware/Authenticate");

const postgres = knex({
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  },
  production: {
    client: "pg",
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
  },
});

/**
 *  --Types of requests--
 *  Code '-1' : " Welcome to the debatotron message&"
 *  Code '0' : " Request Access to a debate"
 *  Code '1' : " Make a friend request"
 *  Code '2' : " Access to the debate granted&"
 *  Code '3' : " Friend Request Accepted&"
 *  Code '4' : " Send Mentions"
 *  Code '5' : " Replied to a comment"
 *  Code '6' : " Liked a comment"
 *  Code '7' : " Recieved a Message"
 */

app.use(cors());
app.use(express.json());

app.post("/signin", (req, res) => {
  const { email, password } = req.body;
  SignIn(res, jwt, bcrypt, postgres, email, password, getJwtToken);
});

app.post("/register", (req, res) => {
  Register(req, res, postgres, bcrypt, saltRounds, uuidv4);
});

app.post("/refresh", (req, res) => {
  const { refreshToken } = req.body;
  postgres
    .select("token")
    .from("tokens")
    .where({ token: refreshToken })
    .then(async (response) => {
      if (response.length > 0) {
        try {
          const user_data = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_KEY
          );
          if (!user_data) {
            await postgres("tokens")
              .del()
              .where({ token: refreshToken })
              .then((response) => {
                throw response;
              });
            throw user_data;
          }
          const token = await getJwtToken(
            jwt,
            postgres,
            user_data.email,
            user_data.password
          );
          if (!token) {
            throw response;
          }
          return res.json(token);
        } catch (e) {
          return res.sendStatus(401);
        }
      } else {
        throw response;
      }
    })
    .catch((err) => {
      res.sendStatus(401);
    });
});

app.get("/", (req, res) => {
  res.json("The Server's Live!");
});

app.post("/ForgotPassword", (req, res) => {
  const { email } = req.body;
  postgres("users")
    .select("recovery")
    .where("email", "=", email)
    .then((response) => {
      if (response[0].recovery) {
        res.json(response);
      } else {
        res.json("Error! Wrong Name!");
      }
    })
    .catch((err) => {
      res.status(400).json("An Error has Occured!");
    });
});

app.post("/CheckRecovery", (req, res) => {
  const { email, answer } = req.body;
  postgres("users")
    .select("email", "answer")
    .where({
      email: email,
    })
    .then((response) => {
      if (response[0].email) {
        var result = false;
        result = bcrypt.compareSync(answer, response[0].answer);
        if (result == true) {
          res.json("Found!");
        }
      } else {
        res.json("User Does not exists!");
      }
    })
    .catch((err) => {
      res.status(400).json("An Error has occured!");
    });
});

app.post("/ChangePassword", (req, res) => {
  const { email, password } = req.body;
  const hash = bcrypt.hashSync(password, saltRounds);
  postgres("login")
    .update({
      hash: hash,
    })
    .returning("email")
    .where("email", "=", email)
    .then((response) => {
      if (response.length > 0) {
        res.json("Successfull!");
      } else {
        res.json("Couldn't Change your Password!");
      }
    })
    .catch((err) => {
      res.status(400).json("An Error has occured!");
    });
});

app.post("/save", authenticate, (req, res) => {
  const {
    uniqid,
    title,
    overview,
    publishedat,
    publisher,
    flag,
    link,
    category,
    access,
  } = req.body;
  postgres("debate")
    .returning("debid")
    .insert({
      debid: uniqid,
      topic: title,
      overview: overview,
      publishedat: publishedat,
      publisher: publisher,
      flag: flag,
      category: category,
      access: access,
    })
    .then((response) => {
      var data = response;
      if (access !== "private") {
        return res.json(data);
      }
      postgres("privatedebates")
        .insert({ dbid: data[0], owner: publisher })
        .then((response) => {
          return res.json(data);
        })
        .catch((err) => {
          throw err;
        });
    })
    .catch((err) => {
      res.status(500).json("Error!");
    });
});

app.get("/getdebdata/:debid", authenticate, (req, res) => {
  const { debid } = req.params;
  postgres
    .select("*")
    .from("debate")
    .where("debid", "=", debid)
    .then((response) => {
      if (response.length === 0) {
        return res.json(false);
      }
      res.json(response);
    })
    .catch((err) => {
      res.status(400).json("Failed to load resources!");
    });
});

app.post("/isdebatevalid", authenticate, (req, res) => {
  const { id } = req.body;
  postgres
    .select("debid")
    .from("debate")
    .where({ debid: id })
    .then((response) => {
      if (response.length > 0) {
        return res.json(true);
      }
      throw response;
    })
    .catch((err) => {
      return res.json(false);
    });
});

app.get("/profile_Data/:user", authenticate, (req, res) => {
  const { user } = req.params;
  postgres
    .select("name", "joinedat", "access", "about", "profile_image")
    .from("users")
    .where("name", "=", user)
    .then((response) => {
      res.json(response);
    })
    .catch((err) => {
      res.json("Error has occured!");
    });
});

app.get("/profile/:id", authenticate, (req, res) => {
  const { id } = req.params;
  postgres
    .select("name", "id", "profile_image")
    .from("users")
    .where("id", "=", id)
    .then((response) => {
      response = response[0];
      res.json([
        {
          id: response.id,
          name: response.name,
          image: response.profile_image,
        },
      ]);
    })
    .catch((err) => {
      res.status(500).json("Failed to Load Resources!");
    });
});

app.get("/debcount/:user", authenticate, (req, res) => {
  const { user } = req.params;
  var user_object = [];
  postgres
    .select("users.name")
    .count("debate.debid")
    .table("users")
    .innerJoin("debate", "users.name", "=", "debate.publisher")
    .where("users.name", "=", user)
    .groupBy("users.name", "users.joinedat")
    .then((response) => {
      res.json(response);
    })
    .catch((err) => {
      res.status(400).json("Some Error has Occured!");
    });
});

app.get("/MakeDebRequest/:ReqStr", authenticate, (req, res) => {
  const { ReqStr } = req.params,
    vl = ReqStr.split(":");
  postgres("requests")
    .insert({ item: ReqStr })
    .then((response) => {
      postgres("debate")
        .select("topic")
        .where({ debid: vl[0] })
        .then((response) => {
          if (response[0].topic) {
            var title = response[0].topic;
            postgres
              .select("owner")
              .from("privatedebates")
              .where({ dbid: vl[0] })
              .then((response) => {
                if (response[0].owner) {
                  const inboxData = {
                    message: `Access to your Debate titled : <a href=/DebPage/${vl[0]}>"${title}"</a> has been requested by user : <a href=/Profile/${vl[1]}>${vl[1]}</a>`,
                    byuser: "DebManager",
                    touser: response[0].owner,
                    additional: JSON.stringify({
                      type: "request",
                      user: vl[1],
                      debid: vl[0],
                      title: "Debate Access Request",
                      rtype: 0,
                    }),
                    messageid: uuidv4(),
                  };
                  res.json(AppendMessageToInbox(postgres, inboxData));
                }
              })
              .catch((err) => console.log(err));
          }
        });
    })
    .catch((err) => {
      res.status(400).json("Error!");
    });
});

app.get("/IsRoomRequested/:ReqStr", authenticate, (req, res) => {
  const { ReqStr } = req.params;
  postgres
    .select("*")
    .from("requests")
    .where({ item: ReqStr })
    .then((response) => {
      if (response[0].item) {
        res.json(true);
      }
      throw false;
    })
    .catch((err) => {
      res.json(false);
    });
});

app.get("/returnAllUsers", authenticate, (req, res) => {
  postgres //Redundant
    .select("name")
    .from("users")
    .then((response) => {
      res.json(response);
    })
    .catch((err) => {
      res.status(400).json("Error!");
    });
});

app.post("/AddParticipant", authenticate, (req, res) => {
  const { debid, participant } = req.body;
  postgres("privatedebates")
    .select("*")
    .where({ dbid: debid })
    .then(async (response) => {
      await postgres("privatedebates")
        .update({
          dbid: response[0].dbid,
          owner: response[0].owner,
          participants:
            response[0].participants === null
              ? participant
              : response[0].participants + "|" + participant,
        })
        .where({ dbid: debid })
        .then(async (response) => {
          const inboxData = {
            message: `<p>Congratulations, You've been granted access to this <a href="/DebPage/${debid}">debate</a></p>`,
            byuser: "DebManager",
            touser: participant,
            additional: JSON.stringify({
              type: "notification",
              title: "Debate Access Approved",
              rtype: 2,
            }),
            messageid: uuidv4(),
          };
          await AppendMessageToInbox(postgres, inboxData);
          return res.json(true);
        })
        .catch((err) => {
          res.status(400).json("false");
        });
    })
    .catch((err) => {
      res.status(400).json(false);
    });
});

app.post("/removeMessage", authenticate, (req, res) => {
  const { mId } = req.body;
  postgres("inbox")
    .where({ messageid: mId })
    .del()
    .then((response) => {
      res.json(true);
    })
    .catch((err) => {
      res.status(400).json(false);
    });
});

app.get("/CheckAccess/:id/:name", authenticate, (req, res) => {
  const { id, name } = req.params;
  postgres("privatedebates") //Redundant
    .select("*")
    .where({
      dbid: id,
    })
    .then((response) => {
      if (response[0].dbid) {
        if (
          response[0].owner === name ||
          FindNameintheTarget(name, response[0].participants)
        ) {
          return res.json(true);
        }
      }
      throw false;
    })
    .catch((err) => {
      res.json(false);
    });
});

app.get("/getDebates/:name", authenticate, (req, res) => {
  const { name } = req.params;
  postgres
    .select("*")
    .from("debate")
    .where({
      publisher: name,
    })
    .then((response) => {
      res.json(response);
    })
    .catch((err) => {
      res.status(404).json("Failed!");
    });
});

app.get("/getActivity/:name", authenticate, async (req, res) => {
  const { name } = req.params;
  let result = [];
  /**
   * Type 0 -> Comments
   * Type 1 -> Debates in which the user took part in
   */
  let f = await postgres
    .select("comment", "debateid", "madeon")
    .from("comments")
    .where({
      byuser: name,
    })
    .then(async (response1) => {
      return await postgres
        .select("debid", "username")
        .from("participation")
        .then(async (response2) => {
          let obj = await postgres
            .select("*")
            .from("debate")
            .then((response3) => {
              let o = {};
              response3.map((item) => {
                o[item.debid] = item;
              });
              return o;
            })
            .catch((err) => {
              return {};
            });
          response1.map((item) => {
            return result.push({
              activity:
                item.comment.slice(0, Math.min(item.comment.length - 1, 50)) +
                "...",
              type: 0,
              id: item.debateid,
              debtitle: obj[item.debateid].topic,
            });
          });
          let r = {};
          response2.map((item) => {
            if (r[item.debid]) {
              return;
            }
            r[item.debid] = 1;
            return result.push({
              activity: obj[item.debid].topic,
              type: 1,
              id: item.debid,
              debtitle: obj[item.debid].topic,
            });
          });
          return true;
        });
    })
    .catch((err) => {
      return false;
    });
  if (f) {
    res.json(result);
  } else {
    return res.status(401).json("Failed!");
  }
});

app.get("/friends/:name", authenticate, (req, res) => {
  const { name } = req.params;
  postgres
    .select("*")
    .from("friends")
    .where({ user_name: name })
    .then((response) => {
      res.json(response);
    })
    .catch((err) => {
      res.status(400).json(null);
    });
});

app.post("/MakeFriendReq", authenticate, (req, res) => {
  const { user, fuser, message } = req.body;
  /*
    Currently, the status of the request would be false if the friend request
    already exists and I think it's better to modify it to something more descriptive.
  */
  postgres("friends")
    .returning("*")
    .insert({
      user_name: user,
      friend_name: fuser,
      req_recieved: message,
      req_code: user + "_" + fuser,
    })
    .then(async (response) => {
      const data = {
        message: `<p>You've got a Friend Request from <a href="/Profile/${user}">${user}</a></p>`,
        byuser: "DebManager",
        touser: fuser,
        additional: JSON.stringify({
          type: "request",
          user: user,
          debid: null,
          title: "New Friend Request",
          rtype: 1,
        }),
        messageid: uuidv4(),
      };
      await AppendMessageToInbox(postgres, data);
      res.json(response);
    })
    .catch((err) => {
      res.status(400).json(null);
    });
});

app.post("/AddFriend", authenticate, async (req, res) => {
  /**
   *  Add user1 is the one who sent the request in the first place whereas user2
   *  is who recieved it.
   */
  const { user1, user2 } = req.body;
  await postgres("friends")
    .update({ status: true })
    .where({ user_name: user1, friend_name: user2 })
    .then(async (response) => {
      const rMes = (user) => {
        return `<p>Hoo-ray! <a href="/Profile/${user}">${user}</a> has accepted your friend request! You guys are pals now... ENJOY!</p>`;
      };
      let messageData = {
        message: rMes(user2),
        byuser: "DebManager",
        touser: user1,
        additional: JSON.stringify({
          type: "request",
          title: "Friend Request Accepted",
          rtype: 3,
        }),
        messageid: uuidv4(),
      };
      await AppendMessageToInbox(postgres, messageData);
      res.json("Done!");
      postgres
        .select("additional", "messageid")
        .where({ touser: user2 })
        .from("inbox")
        .then(async (response) => {
          let id = "-1";
          response.map((item) => {
            if (id !== "-1") {
              return null;
            }
            const jsonObj = JSON.parse(item.additional);
            if (jsonObj.rtype === 1) {
              if (jsonObj.user === user1) {
                return (id = item.messageid);
              }
            }
          });
          await RemoveMessageFromInboxById(postgres, id);
        });
    })
    .catch((err) => res.status(400).json("Failed!"));
});

app.get("/friendslist/:user", authenticate, (req, res) => {
  const { user } = req.params;
  postgres("friends")
    .select("friend_name", "status")
    .where({ user_name: user })
    .then(async (response) => {
      let response1 = await postgres("friends")
        .select("user_name", "status")
        .where({ friend_name: user })
        .then((response) => {
          return response;
        });
      let result = [];
      response.map((item) => {
        result.push({ ...item, owner: true });
      });
      response1.map((item) => {
        let k = {
          friend_name: item.user_name,
          owner: false,
          status: item.status,
        };
        result.push(k);
      });
      for (let i = 0; i < result.length; i++) {
        result[i].image = await getImagebyUser(postgres, result[i].friend_name);
      }
      res.json(result);
    })
    .catch((err) => {
      res.status(404).json(false);
    });
});

app.post("/DeclineFriendReq", authenticate, async (req, res) => {
  const { user1, user2 } = req.body;
  const result = await RemoveFriendRequest(postgres, user1, user2);
  res.json(result);
});

app.get("/GetDebs/:type", authenticate, (req, res) => {
  const { type } = req.params;
  postgres
    .select("*")
    .from("debate")
    .where({ access: type })
    .then((response) => {
      res.json(response);
    })
    .catch((err) => {
      res.status(400).json("Failed to load debates!");
    });
});

app.get("/Inbox/:user", authenticate, (req, res) => {
  const { user } = req.params;
  postgres
    .select("*")
    .from("inbox")
    .where({ touser: user })
    .then((response) => {
      if (response.length < 1) {
        return res.json("none");
      }
      res.json(response);
    })
    .catch((err) => {
      res.status(400).json("Failed!");
    });
});

app.get("/WipeInbox/:user", authenticate, (req, res) => {
  const { user } = req.params;
  postgres("inbox")
    .where("touser", "=", user)
    .del()
    .then((response) => {
      res.json("Done!");
    })
    .catch((err) => {
      res.status("400").json("Error!");
    });
});

app.get("/Draft/:user", authenticate, (req, res) => {
  const { user } = req.params;
  postgres
    .select("topic", "debid")
    .from("debate")
    .where({
      publisher: user,
      flag: "draft",
    })
    .then((response) => {
      res.json(response);
    })
    .catch((err) => {
      res.status(400).json("Failed to Load Drafts!?");
    });
});

app.get("/deletedeb/:id", authenticate, (req, res) => {
  const { id } = req.params;
  postgres("debate")
    .where("debid", "=", id)
    .del()
    .then((response) => {
      res.json("Successfully Deleted!");
    })
    .catch((err) => {
      res.status(400).json("Some error has occured!");
    });
});

app.post("/sendMessage", authenticate, async (req, res) => {
  const { sender, recipient, message } = req.body;
  const inboxData = {
    message: message,
    byuser: sender,
    touser: recipient,
    additional: JSON.stringify({
      type: "message",
      user: sender,
      debid: "none",
      title: `You've recieved a message from ${sender}`,
      rtype: 7,
    }),
    messageid: uuidv4(),
  };
  await AppendMessageToInbox(postgres, inboxData);
  res.json("Sent!");
});

app.get("/getComments/:id", authenticate, (req, res) => {
  const { id } = req.params;
  postgres
    .select("*")
    .from("comments")
    .where({ debateid: id })
    .then((response) => {
      if (response.length === 0) {
        return res.json([]);
      }
      return res.json(GroupComments(response));
    })
    .catch((err) => {
      return res.status(404).json(err);
    });
});

app.post("/makeComment", authenticate, (req, res) => {
  const { comment, commentId, user, userId, debateId, parentId, date } =
    req.body;
  postgres
    .insert({
      comment: comment,
      commentid: commentId,
      byuser: user,
      userid: userId,
      madeon: date,
      parent: parentId,
      debateid: debateId,
    })
    .into("comments")
    .then(async (response) => {
      await postgres
        .select("name")
        .from("users")
        .then(async (response) => {
          return await MatchUsersAndSendMessage(
            response,
            comment,
            postgres,
            user,
            debateId,
            uuidv4
          );
        })
        .catch((err) => {
          throw err;
        });
      if (parentId === "none") {
        return res.json("Done!");
      }
      await postgres
        .select("*")
        .from("comments")
        .where({ commentid: parentId })
        .then(async (response) => {
          if (response.length === 0) {
            return null;
          }
          if (response[0].byuser === user) {
            return null;
          }
          const inboxData = {
            message: `${user} replied to your comment \"${response[0].comment}\" in this <a href="/DebPage/${debateId}">debate</a>. Go check it out!`,
            byuser: "DebManager",
            touser: response[0].byuser,
            additional: JSON.stringify({
              type: "reply",
              user: response[0].byuser,
              debid: debateId,
              title: "A user replied to your comment",
              rtype: 5,
            }),
            messageid: uuidv4(),
          };
          await AppendMessageToInbox(postgres, inboxData);
        })
        .catch((err) => {
          throw err;
        });
      return res.json("Done!");
    })
    .catch((err) => {
      return res.status(500).json("Failed!");
    });
});

app.post("/updateParticipation", authenticate, (req, res) => {
  const { debId, userId, user, status } = req.body;
  postgres
    .insert({
      debid: debId,
      username: user,
      userid: userId,
      withdeb: status,
    })
    .into("participation")
    .then((response) => {
      res.json("Done!");
    })
    .catch((err) => {
      res.status(400).json("Failed!");
    });
});

app.get("/getParticipation/:debid", authenticate, (req, res) => {
  const { debid } = req.params;
  postgres
    .select("*")
    .from("participation")
    .where({
      debid: debid,
    })
    .then(async (response) => {
      for (let i = 0; i < response.length; i++) {
        response[i].image = await getImagebyUser(
          postgres,
          response[i].username
        );
      }
      res.json(response);
    })
    .catch((err) => {
      console.log(err);
      res.status(404).json("Not Found!");
    });
});

app.get("/getLikes/:debId/:userId", authenticate, (req, res) => {
  const { debId, userId } = req.params;
  postgres
    .select("commentid")
    .from("likes")
    .where({
      debid: debId,
      userid: userId,
    })
    .then((response) => {
      res.json(response);
    })
    .catch((err) => {
      return;
    });
});

app.post("/changeSide", authenticate, (req, res) => {
  const { debid, id, status } = req.body;
  postgres("participation")
    .update({
      withdeb: status,
    })
    .where({
      debid: debid,
      userid: id,
    })
    .then((response) => {
      res.json("Done!");
    })
    .catch((err) => {
      res.status(404).json("Failed!");
    });
});

app.post("/UpdateLike", authenticate, (req, res) => {
  const { debId, user, userId, commentId, comment, value, state } = req.body;
  postgres("comments")
    .update({
      likes: value,
    })
    .where({
      commentid: commentId,
    })
    .then(async (response) => {
      let r = await postgres
        .insert({
          debid: debId,
          userid: userId,
          commentid: commentId,
        })
        .into("likes")
        .then((response) => {
          return "Done!";
        })
        .catch((err) => {
          throw err;
        });
      const inboxData = {
        message: `A user liked your comment \"${comment}\" in this <a href="/DebPage/${debId}">debate</a>. Go check it out!`,
        byuser: "DebManager",
        touser: user,
        additional: JSON.stringify({
          type: "like",
          user: user,
          debid: debId,
          title: "A user liked your comment",
          rtype: 6,
        }),
        messageid: uuidv4(),
      };
      if (state) {
        await AppendMessageToInbox(postgres, inboxData);
      }
      return res.json(r);
    })
    .catch((err) => {
      res.status(500).json("Failed!");
    });
});

app.post("/UpdateProfile", authenticate, (req, res) => {
  const { user, about, image } = req.body;
  postgres("users")
    .where("name", "=", user)
    .update({
      about: about,
      profile_image: image,
    })
    .then((response) => {
      res.json("Done!");
    })
    .catch((err) => {
      res.status(400).json("An Error has occured!");
    });
});

// FEED API

app.post("/makePost", authenticate, (req, res) => {
  const { user, userId, post, date } = req.body;
  postgres
    .insert({
      id: uuidv4(),
      post: post,
      byuser: user,
      userid: userId,
      publishedat: date,
    })
    .into("feed")
    .then((response) => {
      res.json("Done!");
    })
    .catch((err) => {
      res.status(400).json("Failed to post!");
    });
});

app.get("/popularUsers", authenticate, (req, res) => {
  postgres
    .select("byuser", "likes")
    .from("comments")
    .then(async (response) => {
      let result = response.sort((c1, c2) => {
        return c1.likes < c2.likes ? 1 : c1.likes > c2.likes ? -1 : 0;
      });
      let finalResults = new Set();
      response.map((item) => {
        if (finalResults.length > 5) {
          return null;
        }
        finalResults.add({ name: item.byuser });
      });
      finalResults = [...finalResults];
      for (let i = 0; i < finalResults.length; i++) {
        finalResults[i].image = await getImagebyUser(
          postgres,
          finalResults[i].name
        );
      }
      const ls = {};
      result = [];
      finalResults.map((item) => {
        ls[item.name] = item;
      });
      for (const key in ls) {
        result.push(ls[key]);
      }
      res.json(result);
    })
    .catch((err) => {
      res.status(400).json("Failed to fetch!");
    });
});

app.get("/topContributors", authenticate, (req, res) => {
  postgres
    .select("publisher")
    .from("debate")
    .then(async (response) => {
      let obj = {};
      response.map((item) => {
        if (obj[item.publisher] !== undefined) {
          obj[item.publisher]++;
        } else {
          obj[item.publisher] = 1;
        }
      });
      let finalResults = [],
        arr = [];
      for (const key in obj) {
        arr.push({ i: obj[key], name: key });
      }
      arr = arr.sort((c1, c2) => (c1.i < c2.i ? 1 : c1.i > c2.i ? -1 : 0));
      arr.map((item) => {
        if (finalResults.length > 10) {
          return null;
        }
        finalResults.push({ name: item.name });
      });
      for (let i = 0; i < finalResults.length; i++) {
        finalResults[i].image = await getImagebyUser(
          postgres,
          finalResults[i].name
        );
      }
      res.json(finalResults);
    })
    .catch((err) => {
      res.status(400).json("Failed to fetch!");
    });
});

app.get("/getfeedlikes/:id", authenticate, (req, res) => {
  const { id } = req.params;
  postgres
    .select("*")
    .from("feedlikes")
    .where({ userid: id })
    .then((response) => {
      res.json(response);
    })
    .catch((err) => {
      res.status(500).json("Failed!");
    });
});

app.post("/likepost", authenticate, async (req, res) => {
  const { id, type, data, userid, typeoflike } = req.body;
  let status = await postgres("feedlikes")
    .select("typeoflike")
    .where({ id: id, userid: userid, type: type })
    .then(async (response) => {
      if (response.length === 0) {
        return 1e9;
      }
      if (response[0].typeoflike !== typeoflike) {
        data[response[0].typeoflike] = Math.max(
          data[response[0].typeoflike] - 1,
          0
        );
        await postgres("feedlikes")
          .update({ typeoflike: typeoflike })
          .where({ id: id, userid: userid, type: type })
          .then((response) => {});
        return 10;
      }
      throw response;
    })
    .catch((err) => 11);
  if (status === 11) {
    return res.json("Done!");
  }
  if (type === "post") {
    return postgres("feed")
      .update({ likes: data })
      .where({ id: id })
      .then((response) => {
        if (status !== 1e9) {
          return;
        }
        postgres
          .insert({
            id: id,
            userid: userid,
            type: type,
            typeoflike: typeoflike,
          })
          .into("feedlikes")
          .then((response) => {
            res.json("Done!");
          });
      })
      .catch((err) => {
        res.status(500).json("Failed!");
      });
  }
  if (type === "debate") {
    return postgres("debate")
      .update({ likes: data })
      .where({ debid: id })
      .then((response) => {
        if (status !== 1e9) {
          return;
        }
        postgres
          .insert({
            id: id,
            userid: userid,
            type: type,
            typeoflike: typeoflike,
          })
          .into("feedlikes")
          .then((response) => {
            res.json("Done!");
          });
      })
      .catch((err) => {
        res.status(500).json("Failed!");
      });
  }
});

app.get("/feed/:id", authenticate, (req, res) => {
  const { id } = req.params; //TODO: Alter this route to show the results specify to a particular user.
  let feed = [];
  postgres
    .select("publisher", "publishedat", "topic", "debid", "likes")
    .from("debate")
    .then(async (response) => {
      feed = response.map((item) => {
        return {
          user: item.publisher,
          type: 0,
          debate: {
            id: item.debid,
            title: item.topic,
          },
          publishedAt: item.publishedat,
          likes: item.likes,
        };
      });
      let arr = await postgres
        .select("*")
        .from("feed")
        .then((response) => {
          return response.map((item) => {
            return {
              user: item.byuser,
              type: 1,
              post: {
                text: item.post,
                id: item.id,
              },
              publishedAt: item.publishedat,
              likes: item.likes,
            };
          });
        });
      let result = feed.concat(arr);
      result = result.sort((c1, c2) => {
        let a = new Date(c1.publishedAt),
          b = new Date(c2.publishedAt);
        return a < b ? 1 : a > b ? -1 : 0;
      });
      for (let i = 0; i < result.length; i++) {
        result[i].image = await getImagebyUser(postgres, result[i].user);
      }
      res.json(result);
    })
    .catch((err) => {
      res.status(400).json("Failed to fetch!");
    });
});

// END OF FEED API

app.post("/reportUser", authenticate, (req, res) => {
  const { debateId, userId, reporterId } = req.body;
  postgres
    .select("*")
    .from("reports")
    .where({
      debateid: debateId,
      userid: parseInt(userId),
      reporterid: parseInt(reporterId),
    })
    .then((response) => {
      if (response.length === 0) {
        return postgres
          .insert({
            debateid: debateId,
            userid: userId,
            reporterid: reporterId,
          })
          .into("reports")
          .then((response) => {
            res.json("Done!");
          });
      }
      throw response;
    })
    .catch((err) => {
      res.status(400).json("Request already administed!");
    });
});

app.get("/tutorial/:user", authenticate, (req, res) => {
  const { user } = req.params;
  postgres
    .select("*")
    .from("tutorial")
    .where({ username: user })
    .then((response) => {
      res.json(response);
    })
    .catch((err) => {
      res.status(400).json("Failed!");
    });
});

app.patch("/tutorial", (req, res) => {
  const { user, debateStatus, profileStatus } = req.body;
  postgres("tutorial")
    .update({
      debatepage: debateStatus,
      profilepage: profileStatus,
    })
    .where({
      username: user,
    })
    .then((response) => {
      res.json("Done!");
    })
    .catch((err) => {
      res.status(400).json("Failed!");
    });
});

app.delete("/signout", (req, res) => {
  const { refreshToken } = req.body;
  postgres("tokens")
    .del()
    .where({ token: refreshToken })
    .then((response) => {
      res.json("Done!");
    })
    .catch((err) => {
      res.status(404).json("Failed!");
    });
});

http.listen(PORT, () => {
  console.log(`Server is Running at port ${PORT}`);
});
