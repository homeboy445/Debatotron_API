const LocalStrategy=require('passport-local').Strategy;
const bcrypt=require('bcrypt');

const IntializePassport=(passport,postgres)=>{    
    const authenticator=async (email,password,done)=>{
        const user=await postgres.select("email","id").from("users")
        .where({email:email})
        .then(response=>{return response[0].email?response[0]:null;})
        .catch(err=>null);
        if(user==null)
        {
            return done(null,false,{message:"User Doesn't Exists!"});
        }var hash=await postgres.select("hash").from("login").where({email:email})
        .then(response=>{return response[0].hash?response[0].hash:null})
        .catch(err=>null);
        return await bcrypt.compare(password,hash,(err,result)=>{
            if(result)
            {
                return done(null,user);
            }return done(null,false,{message:"Wrong Password!"});
        })
    }
    passport.use(new LocalStrategy({
        usernameField:'email'
    },authenticator));
    passport.serializeUser((user,done)=>{done(null,user.id);});
    passport.deserializeUser((id,done)=>{
        postgres.select("email,id").from("users").where({id:id})
        .then(response=>{
            return done(null,response[0]);
        })
        .catch(err=>{
            return done(err);
        })
    });    
}
module.exports={
    IntializePassport
};