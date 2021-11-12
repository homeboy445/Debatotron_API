const app=require('express')();
const http=require('http').createServer(app);
const io=require('socket.io')(http);

app.get('/',(req,res)=>{
    res.send('working!');
});

io.on('connection',(socket)=>{
    console.log("Socket's Live!");
    socket.emit('live',"It's Live!");
    socket.on('message',(data)=>{
        socket.emit('listen',data);
    });
    socket.on('disconnect',()=>{
        console.log("Socket Disconnected!");
    });
});

http.listen(3003,()=>{
    console.log("Server's Live at port 3003");
});