// server.js
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(bodyParser.json());

const users = [];

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    users.push({ username, password });
    res.send('User registered successfully!');
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        res.send('Login successful!');
    } else {
        res.status(401).send('Invalid credentials');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
