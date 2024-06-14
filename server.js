// Add this at the top of your server code
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 3000;
const USERS_DB = 'users.json';

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key', // Change this to a secure key
  resave: false,
  saveUninitialized: true
}));

// Ensure these POST routes are defined
app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();

  if (users[username]) {
    res.json({ message: 'Username already exists.' });
  } else if (username.toLowerCase() === 'admin') {
    res.json({ message: 'Cannot use username Admin.' });
  } else {
    users[username] = { password, money: 0, inventory: [] };
    writeUsers(users);
    res.json({ message: 'Account created successfully.' });
  }
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();

  if (users[username] && users[username].password === password) {
    req.session.username = username;
    res.json({ message: 'Login successful.' });
  } else {
    res.status(401).json({ message: 'Invalid username or password.' });
  }
});

// Helper functions
const readUsers = () => {
  if (!fs.existsSync(USERS_DB)) {
    fs.writeFileSync(USERS_DB, JSON.stringify({}));
  }
  const data = fs.readFileSync(USERS_DB);
  return JSON.parse(data);
};

const writeUsers = (users) => {
  fs.writeFileSync(USERS_DB, JSON.stringify(users, null, 2));
};

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
