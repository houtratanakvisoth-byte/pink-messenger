const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 1e7 });
const Datastore = require('nedb-promises');

const db = Datastore.create({ filename: 'chat_history.db', autoload: true });
const userDb = Datastore.create({ filename: 'users.db', autoload: true });

const PORT = process.env.PORT || 3000;
app.use(express.static(__dirname));

// Track online users
let onlineCount = 0;

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

io.on('connection', (socket) => {
    // Increase count and broadcast to everyone
    onlineCount++;
    io.emit('update online count', onlineCount);

    socket.on('verify user', async (data) => {
        const user = await userDb.findOne({ username: data.username });
        if (!user) {
            await userDb.insert({ username: data.username, password: data.password });
            socket.emit('login success', { username: data.username });
        } else if (user.password === data.password) {
            socket.emit('login success', { username: data.username });
        } else {
            socket.emit('login fail', "Wrong password!");
        }
    });

    socket.on('join room', async (roomName) => {
        socket.rooms.forEach(room => { if (room !== socket.id) socket.leave(room); });
        socket.join(roomName);
        const history = await db.find({ room: roomName }).sort({ timestamp: 1 });
        socket.emit('load history', history);
    });

    socket.on('chat message', async (data) => {
        const msg = { ...data, timestamp: Date.now() };
        await db.insert(msg);
        io.to(data.room).emit('chat message', msg);
    });

    socket.on('video-signal', (data) => {
        socket.to(data.room).emit('video-signal', data);
    });

    // Decrease count when someone leaves
    socket.on('disconnect', () => {
        onlineCount = Math.max(0, onlineCount - 1);
        io.emit('update online count', onlineCount);
    });
});

http.listen(PORT, () => { console.log(`Server live on ${PORT}`); });
