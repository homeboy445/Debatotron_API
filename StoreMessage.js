const Store_Message=async (data,postgres)=>{
    await postgres('inbox')
    .returning('*')
    .insert({
        message:data.message,
        byuser:data.byuser,
        touser:data.touser,
        recievedat:new Date().toLocaleDateString()
    })
    .then(response=>{
        return 'Successfully Stored!';
    })
    .catch(err=>{
        return 'Failed';
    });
}
module.exports={
    Store_Message
};