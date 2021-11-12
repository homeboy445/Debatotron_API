const StoreComment=async (data,postgres)=>{
    await postgres('commentor')
   .returning('comment')
   .insert({
       comment:data.comment,
       deb_id:data.room,
       byuser:data.byuser
    })
   .then(response=>{
       return "Successfull!";
    })
   .catch(err=>{
       return 'Error!';
    });
}
module.exports={
    StoreComment
};