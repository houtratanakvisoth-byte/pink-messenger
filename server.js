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
  socket.on('chat message', (data) => {
    // This broadcasts the message to everyone connected
    io.emit('chat message', data);
  });
});

http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});