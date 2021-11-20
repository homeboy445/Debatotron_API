const FindNameintheTarget = (Name, Target) => {
  var NameArray = Target.split("|");
  console.log(NameArray, " ", Target, " ", Name);
  return NameArray.find((ele) => ele == Name) === Name;
};

const AppendMessageToInbox = async (postgres, data) => {
  data["recievedat"] = new Date().toLocaleDateString();
  return await postgres("inbox")
    .insert(data)
    .then((response) => {
      return true;
    })
    .catch((err) => {
      return err;
    });
};

const RemoveFriendRequest = async (postgres, user1, user2) => {
  return await postgres("friends")
    .where({
      user_name: user1,
      friend_name: user2,
    })
    .del()
    .then((response) => {
      return true;
    })
    .catch((err) => {
      return false;
    });
};

const getImagebyUser = async (postgres, user) => {
  return await postgres
    .select("profile_image")
    .where({ name: user })
    .from("users")
    .then((response1) => {
      return response1[0].profile_image;
    });
};

/**
 * Generates a Json Web Token for the given values.
 * @param {*} jwt 
 * @param {*} postgres 
 * @param {*} email 
 * @param {*} hash 
 * @returns 
 */
const getJwtToken = async (jwt, postgres, email, hash) => {
  const token = {};
  token.accessToken = jwt.sign(
    { email: email, password: hash },
    process.env.ACCESS_TOKEN_KEY,
    {
      expiresIn: "15m",
    }
  );
  token.refreshToken = jwt.sign(
    { email: email, password: hash },
    process.env.REFRESH_TOKEN_KEY,
    {
      expiresIn: "100h",
    }
  );
  token.id = await postgres
    .select("id")
    .from("users")
    .where({ email: email })
    .then((response) => response[0].id);
  return await postgres
    .insert({ token: token.refreshToken })
    .into("tokens")
    .then((response) => {
      return token;
    })
    .catch((err) => {
      return false;
    });
};

const sortTheArray = (data) => {
  let result;
  try {
    result = data.sort((a, b) => {
      return new Date(a.madeon).getTime() - new Date(b.madeon).getTime();
    });
  } catch (err) {
    result = data;
  }
  return result;
};

const traverseAndSortViaTime = (data) => {
  if (data.length === 0) {
    return [];
  }
  data = sortTheArray(data);
  data = data.map((item) => {
    item.replies = traverseAndSortViaTime(item.replies);
    return item;
  });
  return data;
};

const recursivelyIterateAndAppend = (obj, main) => {
  if (!(main.commentid in obj)) {
    main.replies = [];
    return main;
  }
  main.replies = obj[main.commentid].map((item) => {
    return recursivelyIterateAndAppend(obj, item);
  });
  return main;
};

const GroupComments = (data) => {
  let commentObj = {};
  data.map((item) => {
    try {
      commentObj[item.parent].push(item);
    } catch {
      commentObj[item.parent] = [item];
    }
  });
  let result = [];
  commentObj["none"].map((item) => {
    return result.push(recursivelyIterateAndAppend(commentObj, item));
  });
  try {
    return traverseAndSortViaTime(result);
  } catch (err) {
    return result;
  }
};

const extractNameFromComment = (comment) => {
  comment += " ";
  let arr = [],
    users = [];
  for (var i = 0; i < comment.length; i++) {
    if (comment[i] === "@") {
      arr.push(i);
    }
  }
  arr.map((i) => {
    let s = "";
    for (var j = i + 1; j < comment.length && comment[j] !== " "; j++) {
      s += comment[j];
    }
    users.push(s);
  });
  return users;
};

const MatchUsersAndSendMessage = async (
  org,
  comment,
  postgres,
  user,
  debateId,
  uuidv4
) => {
  let users = extractNameFromComment(comment);
  if (users.length === 0) {
    return {};
  }
  var obj = {};
  org.map((item) => (obj[item.name] = 0));
  users.map((item) => (obj[item] = 1));
  for (const key in obj) {
    if (obj[key] === 1) {
      const inboxData = {
        message: `You have been mentioned by the user ${
          user || "hidden"
        } in this <a href="/DebPage/${debateId}">debate</a>. Go check it out!`,
        byuser: "DebManager",
        touser: key,
        additional: JSON.stringify({
          type: "mention",
          user: user,
          debid: debateId,
          title: "You have been mentioned in a debate.",
          rtype: 4,
        }),
        messageid: uuidv4(),
      };
      let res = await AppendMessageToInbox(postgres, inboxData);
    }
  }
  return obj;
};

module.exports = {
  FindNameintheTarget,
  AppendMessageToInbox,
  RemoveFriendRequest,
  GroupComments,
  extractNameFromComment,
  MatchUsersAndSendMessage,
  getImagebyUser,
  getJwtToken,
};
