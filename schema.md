

login Table
columns: email: string, hash: string

users Table
columns: email: string, name: string, joinedat: string, access: string, recovery: string, answer: string, profile_image: string, about: string

tutorial Table
columns: username: string, debatepage: boolean, profilepage: boolean

inbox Table (all the columns are strings)
columns: message, byuser, touser, recievedat, additional, messageid

tokens Table
columns: tockens: string

debate Table
columns: debid: string, topic: string, overview: string, publishedat: string, publisher: string, flag: boolean,
      category: string,
      access: string

privatedebates Table
columns: dbid: string, owner: string, participants: string

requests Table
columns: item: string

comments Table
columns:  comment: string, commentid: string, byuser: string, userid: string, madeon: string,
      parent: string,
      debateid: string

participation Table
columns: debid: string, username: string, userid: string, withdeb: string

friends Table (check FrontEnd for its usage)
columns: user_name: string, friend_name: string, req_recieved: string, req_code: string, status: string

likes Table
columns: commentid: string, debid: string, userid: string

feed Table
columns: id: string,
      post: string,
      byuser: string,
      userid: string,
      publishedat: string,

feedlikes Table (Check FE)
columns: userid: string, typeoflike: string, id: id, type: string

reports Table
columns: debateid: string, userid: int, reporterid: int


