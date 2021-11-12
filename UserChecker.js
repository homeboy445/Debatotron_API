const UserParser=(string)=>{
    var user_string='';
    for(var i=0;i<string.length;i++)
    {
        if(string[i]=='@')
        {
            for(var j=i+1;j<string.length;j++)
            {
                if(string[i]=='')
                {
                    break;
                }
                user_string+=string[j];
            }break;
        }
    }
    if(user_string!='')
    {
        return user_string;
    }
    else
    {
        return null;
    }
}

const CheckUser=async (data,postgres)=>{
    return await postgres
    .select('name')
    .from('users')
    .where('name','=',data)
    .then(response=>{
        return response;
    })
    .catch(err=>{
        return 'No such user exists!'
    });
}

module.exports={
    CheckUser,
    UserParser
};
