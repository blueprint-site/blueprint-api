// Import required packages
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const csurf = require('csurf');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require('passport');
const { Strategy } = require('passport-local');
const expressRateLimit = require('express-rate-limit');
const path = require("path");

// Initialize dotenv to use .env file variables
dotenv.config();

// Create Express server
const server = express();

// Port setup
const PORT = process.env.PORT || 3000;

// Middleware
server.use(helmet()); // Sets various HTTP headers for security
server.use(cors()); // Enable CORS
server.use(morgan('dev')); // Logging middleware
server.use(compression()); // Compresses response bodies for improved performance
server.use(express.json()); // Parse JSON bodies
server.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Session configuration
server.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
}));

// CSRF Protection
server.use(csurf( true));

// Rate Limiting
const limiter = expressRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

server.use(limiter);

// Routes
const addonsRoutes = require('./routes/addons');
const schematicsRoutes = require('./routes/schematics');

server.use('/addons', addonsRoutes);
server.use('/schematics', schematicsRoutes);

server.use(express.static(path.join(__dirname, 'public')));

server.get('/', (req, res) => {
    res.send('Hello, world!');
});


// Start server
server.listen(PORT, () => {
    if (process.env.NODE_ENV === 'development'){
        console.log(`Server running on http://localhost:${PORT}`);
    }else{
        console.log(`Server running on port ${PORT}`);
    }
});

