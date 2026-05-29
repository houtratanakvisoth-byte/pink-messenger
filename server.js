const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 1e7 });
const Datastore = require('nedb-promises');

const db = Datastore.create({ filename: 'chat_history.db', autoload: true });
const userDb = Datastore.create({ filename: 'users.db', autoload: true });

const PORT = process.env.PORT || 3000;
app.use(express.static(__dirname));

let onlineCount = 0;
// Track tracking user locations: { socketId: { username: '...', room: '...' } }
const activeUsers = {};

// Ensure special account exists in DB automatically
async function initAdmin() {
    const admin = await userDb.findOne({ username: 'soth' });
    if (!admin) {
        await userDb.insert({ username: 'soth', password: 'thisisnotarealpassword' });
    }
}
initAdmin();

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

// Helper to broadcast room lists to admin users safely
function broadcastRoomData() {
    const data = Object.values(activeUsers);
    // Send only to the sockets belonging to 'soth'
    for (let id in io.sockets.sockets) {
        const s = io.sockets.sockets[id];
        if (s.username === 'soth') {
            s.emit('admin room data', data);
        }
    }
}

io.on('connection', (socket) => {
    onlineCount++;
    io.emit('update online count', onlineCount);

    socket.on('verify user', async (data) => {
        // Special account static verification
        if (data.username === 'soth' && data.password === '080308') {
            socket.username = 'soth';
            activeUsers[socket.id] = { username: 'soth', room: 'global' };
            socket.emit('login success', { username: 'soth', isAdmin: true });
            broadcastRoomData();
            return;
        }

        const user = await userDb.findOne({ username: data.username });
        if (!user) {
            await userDb.insert({ username: data.username, password: data.password });
            socket.username = data.username;
            socket.emit('login success', { username: data.username, isAdmin: false });
        } else if (user.password === data.password) {
            socket.username = data.username;
            socket.emit('login success', { username: data.username, isAdmin: false });
        } else {
            socket.emit('login fail', "Wrong password!");
        }
    });

    socket.on('join room', async (roomName) => {
        socket.rooms.forEach(room => { if (room !== socket.id) socket.leave(room); });
        socket.join(roomName);
        
        // Update tracking tracking
        if (socket.username) {
            activeUsers[socket.id] = { username: socket.username, room: roomName };
            broadcastRoomData();
        }

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

    socket.on('disconnect', () => {
        onlineCount = Math.max(0, onlineCount - 1);
        io.emit('update online count', onlineCount);
        
        if (activeUsers[socket.id]) {
            delete activeUsers[socket.id];
            broadcastRoomData();
        }
    });
});

http.listen(PORT, () => { console.log(`Server live on ${PORT}`); });
