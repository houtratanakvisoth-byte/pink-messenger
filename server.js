const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('User connected');

    // 1. Logic to join a specific room
    socket.on('join room', (roomName) => {
        // Leave previous rooms first (except their own ID)
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });
        
        socket.join(roomName);
        console.log(`User joined room: ${roomName}`);
    });

    // 2. Logic to send message ONLY to that room
    socket.on('chat message', (data) => {
        // data.room is the name of the private room
        io.to(data.room).emit('chat message', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

http.listen(PORT, () => {
    console.log(`Server is live on port ${PORT}`);
});
