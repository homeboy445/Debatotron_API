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
      console.log(err);
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

const AddFriend = async (postgres, user1, user2, messageData) => {
  let data = await postgres("friendslist")
    .select("friends")
    .where({ username: user1 })
    .then((response) => {
      return response[0].friends;
    })
    .catch((err) => {
      return [];
    });
  if (data.length === 0) {
    return await postgres("friendslist")
      .insert({
        username: user1,
        friends: JSON.stringify([user2]),
      })
      .returning("*")
      .then(async (response) => {
        await RemoveFriendRequest(postgres, user2, user1);
        await AppendMessageToInbox(postgres, messageData);
        return true;
      })
      .catch((err) => {
        return false;
      });
  } else {
    data = eval(data);
    data.push(user2);
    return await postgres("friendslist")
      .update({
        friends: JSON.stringify(data),
      })
      .where({
        username: user1,
      })
      .then(async (response) => {
        await RemoveFriendRequest(postgres, user2, user1);
        await AppendMessageToInbox(postgres, messageData);
        return true;
      })
      .catch((err) => {
        return false;
      });
  }
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
  AddFriend,
  GroupComments,
  extractNameFromComment,
  MatchUsersAndSendMessage,
};
