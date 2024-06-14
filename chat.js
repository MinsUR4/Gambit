// Socket.io chat functionality
io.on('connection', (socket) => {
    console.log('A user connected');
  
    socket.on('login', (username) => {
      socket.username = username; // Set username on socket
    });
  
    socket.on('chat message', (msg) => {
      if (socket.username) {
        io.emit('chat message', { username: socket.username, message: msg });
      } else {
        io.emit('chat message', { username: 'Anonymous', message: msg });
      }
    });
  
    socket.on('disconnect', () => {
      console.log('A user disconnected');
    });
  });
  