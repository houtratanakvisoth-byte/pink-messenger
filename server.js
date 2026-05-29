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
// We will use ONE object to track everyone's location
const activeUsers = {}; 

// Ensure admin account exists
async function initAdmin() {
    const admin = await userDb.findOne({ username: 'soth' });
    if (!admin) {
        await userDb.insert({ username: 'soth', password: '080308' });
    }
}
initAdmin();

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

// SINGLE helper function to send room data to soth
function broadcastAdminData() {
    const data = Object.values(activeUsers);
    io.sockets.sockets.forEach((s) => {
        if (s.username === 'soth') {
            s.emit('admin room data', data);
        }
    });
}

io.on('connection', (socket) => {
    onlineCount++;
    io.emit('update online count', onlineCount);

    socket.on('verify user', async (data) => {
        // 1. Check for Soth (Special Admin)
        if (data.username === 'soth' && data.password === '080308') {
            socket.username = 'soth';
            socket.isAdmin = true;
            activeUsers[socket.id] = { username: 'soth', room: 'global' };
            socket.emit('login success', { username: 'soth', isAdmin: true });
            broadcastAdminData();
            return;
        }

        // 2. Regular User Login
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
        
        // Update tracking when anyone joins a room
        if (socket.username) {
            activeUsers[socket.id] = { username: socket.username, room: roomName };
            broadcastAdminData(); // Tell soth immediately
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
            broadcastAdminData(); // Refresh soth's list
        }
    });
});

http.listen(PORT, () => { console.log(`Server live on ${PORT}`); });
