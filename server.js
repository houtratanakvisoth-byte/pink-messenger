const express = require('express');
const app = express();
const http = require('http').Server(app);
// Increase file upload limit to handle photos
const io = require('socket.io')(http, {
    maxHttpBufferSize: 1e7 // 10MB limit for photos
});
const Datastore = require('nedb-promises');

const db = Datastore.create({ filename: 'chat_history.db', autoload: true });
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    
    // Handle loading history when joining a room
    socket.on('join room', async (roomName) => {
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });
        
        socket.join(roomName);
        
        try {
            const history = await db.find({ room: roomName }).sort({ timestamp: 1 });
            socket.emit('load history', history);
        } catch (err) {
            console.error("Error loading history:", err);
        }
    });

    // Handle oncoming messages (Text or Images)
    socket.on('chat message', async (data) => {
        const messageToSave = {
            user: data.user,
            avatar: data.avatar,
            text: data.text || null,
            image: data.image || null, // Stores base64 image string
            room: data.room,
            timestamp: Date.now()
        };

        try {
            await db.insert(messageToSave);
            io.to(data.room).emit('chat message', messageToSave);
        } catch (err) {
            console.error("Error saving message:", err);
        }
    });
});

http.listen(PORT, () => {
    console.log(`Server is live on port ${PORT}`);
});
