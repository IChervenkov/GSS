const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const excelJS = require('exceljs');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const XLSX = require('xlsx');
const hpp = require('hpp');

// const RedisStore = require('connect-redis').default;
// const redis = require('redis');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Track failed login attempts (In-memory)
const failedLoginAttempts = {};
const MAX_FAILED_ATTEMPTS = 10;  // Maximum failed attempts before blocking
const BLOCK_TIME = 5 * 60 * 1000;  // Block time in milliseconds (5 minutes)
const PORT = process.env.PORT || 3000;
const repireUserId = 4;

require('dotenv').config({
    override: true,
    path: path.join(__dirname, 'connect_db.env')
});

const { Pool, ClientBase } = require('pg');

const pool = new Pool({
    user: process.env.USER,
    host: process.env.HOST,
    database: process.env.DATABASE,
    password: process.env.PASSWORD,
    port: process.env.DATABASE_PORT
});

const Joi = require('joi');

const schemaLogIn = Joi.object({
    username: Joi.string().alphanum().required(),
    password: Joi.string().alphanum().required()
});

// Define the schema
const emojiDataSchema = Joi.object({
    emoji: Joi.string().max(10).required() // emoji should be a string, maximum 10 characters, and is required
});

const getAllEmojiSchema = Joi.object({
    date1: Joi.date().iso().required(),
    date2: Joi.date().iso().required()
});

const checkBagsSchema = Joi.object({
    code: Joi.string().alphanum().required()
});

const updateBagsScanerSchema = Joi.object({
    codes: Joi.array()
        .items(Joi.string().alphanum())
        .required(),
    destination: Joi.string()
        .valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None')
        .required(),
    prev_destination: Joi.string()
        .valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None')
        .required()
});

const updateBagsSchema = Joi.object({
    code: Joi.string().alphanum().required(),
    destination: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None').required(),
    prev_destination: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None').required()
});

const checkScaningCodeSchema = Joi.object({
    code: Joi.string().alphanum().required(),
    prev_destination: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None').required(),
    permCount: Joi.number().required()
});

const checkCountScaningCodesSchema = Joi.object({
    countScaneCode: Joi.number().required(),
    prev_destination: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None').required()
});

const schemaAddBag = Joi.object({
    epc: Joi.string().alphanum().required(),
    code: Joi.string().alphanum().required(),
    type: Joi.string().regex(/^[a-zA-Z0-9\s]+$/).required(),
    maxcount: Joi.number().required(),
    isValidCode: Joi.bool().optional()
});

const shemaGetBags = Joi.object({
    isValidCode: Joi.bool().optional()
});

const schemaRemoveBag = Joi.object({
    code: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const schemaEditBag = Joi.object({
    bagId: Joi.string().alphanum().required(),
    bagType: Joi.string().regex(/^[a-zA-Z0-9 ]+$/).required(),
    maxWash: Joi.number().required()
});

const schemaEditPhoneBag = Joi.object({
    oldCode: Joi.string().alphanum().required(),
    newCode: Joi.string().alphanum().required(),
    code: Joi.string().alphanum().required(),
    type: Joi.string().regex(/^[a-zA-Z0-9 ]+$/).required(),
    maxcount: Joi.number().required(),
    isValidCode: Joi.bool().required()
});

const clientDataSchema = Joi.object({
    userId: Joi.string().required(), // userId should be a string and is required
});

const schemaReleaseAllRoom = Joi.object({
    buildId: Joi.string().alphanum().required() // buildId should be a string and is required
});

const schemaNFCRent = Joi.object({
    nfcData: Joi.string().required(), // nfcData should be a string and is required
    date: Joi.date().iso().required(), // date should be a valid ISO date and is required
    time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(), // time should be in HH:MM format and is required
    selectClient: Joi.number().required() // selectClient should be a string and is required
});

const schemaNFCReturn = Joi.object({
    nfcData: Joi.string().required(), // nfcData should be a string and is required
    date: Joi.date().iso().required(), // date should be a valid ISO date and is required
    time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(), // time should be in HH:MM format and is required
});

const schemaBike = Joi.object({
    bikeId: Joi.string().required(), // bikeId should be a string and is required
    clientId: Joi.string().allow('').optional(), // clientId should be a string
    actionId: Joi.string().required(), // actionId should be a string and is required
    dateId: Joi.date().iso().required(), // dateId should be a valid ISO date and is required (e.g., "2023-10-12")
    hourSelectId: Joi.number().integer().min(0).max(23).required(), // hourId should be an integer between 0 and 23, representing the hour
    minuteSelect: Joi.number().integer().min(0).max(59).required(), // minuteId should be an integer between 0 and 59, representing the minutes
    ltstatus: Joi.boolean().optional()
});

const schemaReport = Joi.object({
    selectedDate1: Joi.date().iso().allow('None'),
    selectedDate2: Joi.date().iso().allow('None')
});

const schemaAddBike = Joi.object({
    bikeAddId: Joi.string().alphanum().required(),
    bikeName: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required()
});

const schemaEditParameturBike = Joi.object({
    oldBikeId: Joi.string().alphanum().required(),
    newBikeId: Joi.string().alphanum().required(),
    bikeName: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required()
});

const schemaUploadBike = Joi.object({
    id: Joi.string().alphanum().required(),
    namebike: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required()
});

const schemaRemoveBike = Joi.object({
    bikeRemoveId: Joi.string().alphanum().required()
});

const schemaEditBike = Joi.object({
    bikeId: Joi.string().alphanum().required(),
    status: Joi.string().valid('Repair', 'Late', 'Long term', 'Rented').required(),
    soldierId: Joi.string().alphanum().required(),
    dateFrom: Joi.date().iso().required()
});

const schemaSearchBike = Joi.object({
    id: Joi.string().alphanum().required()
});

const schemaGetSoldier = Joi.object({
    keyId: Joi.string().alphanum().required()
});

const schemaAccommodation = Joi.object({
    numBuild: Joi.string().alphanum().allow('').optional(),
    isFirstTime: Joi.boolean().optional()
});

const schemaMoveSoldier = Joi.object({
    keyId: Joi.string().alphanum().required(),
    soldId: Joi.string().alphanum().required(),
    keyMoveId: Joi.string().alphanum().required(),
    soldMoveId: Joi.string().alphanum().allow('').required()
});

const schemaAddDestination = Joi.object({
    buildId: Joi.string().alphanum().required(),
    buildName: Joi.string().pattern(/^[A-Za-z0-9\s]+$/).required(),
    buildType: Joi.string().alphanum().required()
});

const schemaRemoveDestination = Joi.object({
    buildId: Joi.string().alphanum().required()
});

const schemaRoomToDestination = Joi.object({
    roomId: Joi.string().alphanum().required(),
    roomName: Joi.string().pattern(/^[^\/]+\/.+$/).required(),
    clickBuild: Joi.string().alphanum().required()
});

const schemaKeyToRoom = Joi.object({
    keyId: Joi.string().alphanum().required(),
    keyName: Joi.string().pattern(/^[^\/]+\/.+$/).required(),
    selectedRoomForKey: Joi.string().alphanum().required()
});

const schemaSpecialRoom = Joi.object({
    numBuild: Joi.string().alphanum().allow('').required()
});

const schemaSpecialKey = Joi.object({
    numBuild: Joi.string().alphanum().allow('').required(),
    numRoom: Joi.string().alphanum().allow('').required()
});

const schemaSpecialAssets = Joi.object({
    numRoom: Joi.string().alphanum().allow('').required()
});

const schemaDeleteAsets = Joi.object({
    code: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const schemaAddAsetsType = Joi.object({
    assetType: Joi.string().pattern(/^[a-zA-Z\s]+$/).required(),
});

const schemaRemoveAsetsType = Joi.object({
    assetTypeId: Joi.string().alphanum().required(),
});

const schemaCheckAppCode = Joi.object({
    code: Joi.string().alphanum().required()
});

const schemaAddAsset = Joi.object({
    assetEps: Joi.string().alphanum().required(),
    assetCodeSearch: Joi.string().alphanum().required(),
    assetAddName: Joi.string().pattern(/^[a-zA-Z0-9\s]+$/).required(),
    selectedAddTypeId: Joi.string().alphanum().required(),
    selectedAddLocationId: Joi.string().alphanum().required(),
    selectedAddSubLocationId: Joi.string().alphanum().allow('').optional(),
    isValidCode: Joi.bool().optional()
});

const schemaEditAsset = Joi.object({
    assetId: Joi.string().alphanum().required(),
    assetName: Joi.string().pattern(/^[a-zA-Z0-9\s]+$/).required(),
    assetType: Joi.string().alphanum().required(),
    assetLocation: Joi.string().alphanum().required(),
    assetSubLocation: Joi.string().alphanum().allow('').optional()
});

const schemaEditAssetDevice = Joi.object({
    oldCode: Joi.string().alphanum().required(),
    newCode: Joi.string().alphanum().required(),
    code: Joi.string().alphanum().required(),
    name: Joi.string().pattern(/^[a-zA-Z0-9\s]+$/).required(),
    type: Joi.string().alphanum().required(),
    location: Joi.string().alphanum().required(),
    subLocation: Joi.string().alphanum().allow('').optional(),
    isValidCode: Joi.bool().optional()
});

const schemaRemoveRoom = Joi.object({
    roomId: Joi.string().alphanum().required()
});

const schemaRemoveKey = Joi.object({
    keyId: Joi.string().alphanum().required()
});

const schemaRenameKey = Joi.object({
    oldKeyId: Joi.string().alphanum().required(),
    newKeyId: Joi.string().alphanum().required()
});

const schemaAddSoldier = Joi.object({
    soldierId: Joi.alternatives().try(
        Joi.string().pattern(/^\d+$/), // Numeric string
        Joi.string().pattern(/^unknown\d+$/), // Numeric string
        Joi.number().integer()        // Number
    ).required(),
    soldierName: Joi.string().pattern(/^[A-Za-z0-9\s\-éÉàÀèÈùÙâÂêÊîÎôÔûÛçÇÖöäÄåÅøØ]+$/).required(),
    soldierCountry: Joi.string().alphanum().required()
});

const schemaEditSoldier = Joi.object({
    soldierId: Joi.string().alphanum().required(),
    soldierNewId: Joi.string().alphanum().required(),
    soldierName: Joi.string().pattern(/^[A-Za-z0-9\s\-éÉàÀèÈùÙâÂêÊîÎôÔûÛçÇÖöäÄåÅøØ]+$/).required(),
    soldierCountry: Joi.string().alphanum().required()
});

const schemaRemoveSoldier = Joi.object({
    code: Joi.string().alphanum().required()
});

const schemaUploadSoldier = Joi.object({
    namekey: Joi.string().pattern(/^[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/).required(),
    keynumber: Joi.string().alphanum().required(),
    soldierid: Joi.alternatives().try(Joi.string().alphanum(), Joi.number()).required(),
    mealcard: Joi.alternatives().try(Joi.string().alphanum(), Joi.number()).optional(),
    laundrybag: Joi.alternatives().try(Joi.string().alphanum(), Joi.number()).optional()
});

const schemaSaveSoldier = Joi.object({
    keyCodeId: Joi.string().alphanum().required(),
    soldierId: Joi.string().alphanum().allow('').required(),
    countryId: Joi.string().alphanum().required(),
    bagId: Joi.string().alphanum().allow('').required(),
    mealCardId: Joi.string().alphanum().allow('').required()
});

const schemaViewKey = Joi.object({
    roomNumber: Joi.string().alphanum().required()
});

const schemaNFCBikeRead = Joi.object({
    nfcData: Joi.string().required(), // nfcData should be a string and is required
});

const schemaGetBagsByStatus = Joi.object({
    status: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None').required(),
});

const navItems = [];

const horizontalNavItems = [
    { href: '/', name: 'Main Page' },
    { href: 'assets', name: 'Assets' },
    { href: 'laundry', name: 'Laundry' },
    { href: 'fitness', name: 'Gym' },
    { href: 'accommodation', name: 'Accommodation and keys' },
    { href: 'bicycles', name: 'Bicycles' },
    { href: 'logout', name: 'Logout' }
];

class Server {
    constructor(port) {

        this.port = port || PORT;
        this.app = express();

        // Trust the first proxy (typically used with reverse proxies)
        this.app.set('trust proxy', 1);

        // Set up body parsing with size limits
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ limit: '10mb', extended: true }));

        // Middleware to parse JSON bodies (bodyParser is already included in Express)
        this.app.use(bodyParser.json());
        this.app.set("view engine", "ejs");
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use(express.urlencoded({ extended: false }))

        // Set security headers
        this.app.use((req, res, next) => {
            res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline';");
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('Referrer-Policy', 'no-referrer');
            res.setHeader('Permissions-Policy', "geolocation=(), microphone=(), camera=()");
            next();
        });

        // Use Helmet for additional security headers
        this.app.use(helmet());

        // Prevent HTTP parameter pollution
        this.app.use(hpp());

        // Replace with your SuperHosting Redis server details
        // const redisClient = redis.createClient({
        //     socket: {
        //         host: process.env.HOST_REDIS, // Provided by SuperHosting
        //         port: process.env.PORT_REDIS, // Default Redis port
        //         keepAlive: true
        //     }
        // });

        // redisClient.on('error', (err) => {
        //     //   console.error('Redis Client Error:', err);
        // });

        // // Use Redis as the session store
        // (async () => {
        //     try {
        //         await redisClient.connect();

        //     } catch (err) {
        //         console.error('Connection Error:', err);
        //     }
        // })();

        // Use Redis as the session store
        this.app.use(session({
            // store: new RedisStore({ client: redisClient }),
            secret: process.env.SESSION_SECRET || 'default_secret',
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: false,
                httpOnly: true,
                sameSite: 'strict',
                maxAge: 8 * 60 * 60 * 1000
            }
        }));

        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error(err.stack); // Log the error stack trace
            if (err.code === 'EBADCSRFTOKEN') {
                return res.status(403).send('Form tampered with!');
            }
            res.status(500).send('Something broke!'); // Send a response
        });

        // Define the routes

        this.defineRoutesMain();
        this.defineRoutesLogin();
        this.defineRoutesRFID();
        this.defineRoutesNFC();
        this.defineRoutesBicycles();
        this.defineRoutesAccommodation();
        this.defineRoutesFitnes();
        this.defineRoutesLaundry();
        this.defineRoutesAssets();
    }

    giveSpecificPermissionMain(username, indexs, res) {

        res.render('mainPage', {
            title: 'Main Page Layout',
            navItems: navItems,
            horizontalNavItems: indexs.map(index => horizontalNavItems[index]),
            headerTable: null,
            data: null,
            startMessage: "Welcome to Global Support System (GSS)",
            username: username
        });
    }

    giveSpecificPermissionBicycles(username, indexs, res, data, optionHour, optionMinute, totalBike, rentedBike, availableBike, repairBike, lateBike, longTermBike) {

        res.render('bicycles', {
            startMessage: "Bicycles",
            horizontalNavItems: indexs.map(index => horizontalNavItems[index]),
            data: data,
            optionHour: optionHour,
            optionMinute: optionMinute,
            totalBike: totalBike,
            rentedBike: rentedBike,
            availableBike: availableBike,
            repairBike: repairBike,
            lateBike: lateBike,
            longTermBike: longTermBike,
            username: username
        });
    }

    giveSpecificPermissionAccommodation(username, indexs, res, navBuild, totalFreeBeds, totalOccupiedBeds, type, titlePage, countBeds, headerTable, nameroomSetCount, numBuild) {

        res.render('accommodation', {
            title: "Accommodation and keys",
            navItems: navBuild,
            horizontalNavItems: indexs.map(index => horizontalNavItems[index]),
            headerTable: headerTable,
            totalFreeBeds: totalFreeBeds,
            totalOccupiedBeds: totalOccupiedBeds,
            type: type,
            titlePage: titlePage,
            countBeds: countBeds,
            nameroomSetCount: nameroomSetCount,
            numBuild: numBuild,
            username: username
        });
    }

    giveSpecificPermissionFitness(username, indexs, res, data, dataPerEmj) {

        res.render('fitness', {
            title: "Gym",
            horizontalNavItems: indexs.map(index => horizontalNavItems[index]),
            data: data,
            dataPerEmj: dataPerEmj
        });
    }

    giveSpecificPermissionLaundry(username, indexes, res, bagData, totalCounts, avgTimeData, overallAverageFormatted, headerTable, overallTotalMountFormatted) {

        res.render('laundry', {
            title: "Laundry",
            horizontalNavItems: indexes.map(index => horizontalNavItems[index]),
            bagData: bagData,
            totalCounts: totalCounts,
            avgTimeData: avgTimeData,
            overallAverageFormatted: overallAverageFormatted,
            headerTable: headerTable,
            overallTotalMountFormatted: overallTotalMountFormatted,
            username: username
        });

    }

    giveSpecificPermissionAssets(indexes, res, inventory, numBuild, numSelectBuild) {

        res.render('assets', {
            title: "Assets",
            horizontalNavItems: indexes.map(index => horizontalNavItems[index]),
            inventory: inventory,
            navItems: numBuild,
            numSelectBuild: numSelectBuild
        });

    }

    // Check if the IP or user is blocked due to too many failed login attempts
    isBlocked(username) {
        const record = failedLoginAttempts[username];

        if (record) {
            const { failedAttempts, blockExpiresAt } = record;

            if (failedAttempts >= MAX_FAILED_ATTEMPTS && blockExpiresAt > Date.now()) {
                return true; // User is still blocked
            }

            if (blockExpiresAt && blockExpiresAt <= Date.now()) {
                // Block period has expired, reset the record
                failedLoginAttempts[username] = { failedAttempts: 0 };
            }
        }
        return false;
    }

    // Middleware to check if the user is logged in
    isLoggedIn(req, res, next) {
        if (req.session && req.session.username && req.session.username !== 'PhoneUser') {
            return next(); // User is logged in, proceed to the route
        } else {
            return res.redirect('/login'); // Redirect to login if not logged in
        }
    }

    generateMonthHtml(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const numDays = lastDay.getDate();
        const startDay = firstDay.getDay();
        let day = 1;
        let html = '<div class="month"><h2>' + new Date(year, month).toLocaleString('default', { month: 'long' }) + '</h2><table><thead><tr><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr></thead><tbody>';

        for (let row = 0; row < 6; row++) {
            html += '<tr>';
            for (let col = 0; col < 7; col++) {
                if (row === 0 && col < startDay) {
                    html += '<td>&nbsp;</td>';
                } else if (day > numDays) {
                    html += '<td>&nbsp;</td>';
                } else {
                    html += '<td>' + day++ + '</td>';
                }
            }
            html += '</tr>';
        }
        html += '</tbody></table></div>';
        return html;
    }

    checkApkFileLegality(apkFilePath, res) {
        // Optionally, verify the file hash (integrity check)
        const apkHash = crypto.createHash('sha256');
        const apkFileBuffer = fs.readFileSync(apkFilePath);
        apkHash.update(apkFileBuffer);
        const hashDigest = apkHash.digest('hex');

        const expectedHashBike = process.env.HASH_APP_BIKE; // You should know the expected hash of a legal APK
        const expectedHashLaundry = process.env.HASH_APP_LAUNDRY; // You should know the expected hash of a legal APK

        if (hashDigest !== expectedHashBike && hashDigest !== expectedHashLaundry) {
            console.error('APK file hash does not match expected value');
            res.status(400).json({ message: 'File integrity check failed' }); // Send JSON response
            return false;
        }

        return true; // File is legal
    }

    // Method to define routes for main page
    defineRoutesMain() {

        // GET route for checking server status
        this.app.get('/', this.isLoggedIn.bind(this), (req, res) => {

            switch (req.session.username) {
                case 'guest':
                    this.giveSpecificPermissionMain(req.session.username, [0, 5, 6], res);
                    break;
                case 'helpDeskGatis':
                    this.giveSpecificPermissionMain(req.session.username, [0, 2, 6], res);
                    break;
                case 'admin':
                    this.giveSpecificPermissionMain(req.session.username, [0, 1, 2, 3, 4, 5, 6], res);
                    break;
                default:
                    this.giveSpecificPermissionMain(req.session.username, [0, 2, 3, 4, 5, 6], res);
                    break;
            }

        });
    }

    defineRoutesLogin() {

        // Section for Login

        this.app.get('/login', (req, res) => {
            req.session.username = null;
            res.render('index', { title: "LogIn", errorMessage: null });
        });

        // POST route for login with brute-force protection
        this.app.post('/login', async (req, res) => {

            const { error } = schemaLogIn.validate(req.body);
            if (error) {
                return res.render('index', { title: 'LogIn', errorMessage: 'Invalid username or password, username and password must contain only a-z, A-Z, 0-9 symbols' });
            }

            const { username, password } = req.body;

            // Get a client from the pool
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                // Query the database for the user
                const result = await client.query("SELECT * FROM users WHERE username = $1", [username]);

                // Check if the user exists in the result
                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.render('index', { title: 'LogIn', errorMessage: 'Invalid username or password' });
                }

                const user = result.rows[0];

                // Check if the user is blocked due to failed login attempts
                if (this.isBlocked(username)) {
                    await client.query('ROLLBACK');
                    return res.render('index', { title: 'LogIn', errorMessage: 'Too many failed attempts. Please try again later.' });
                }

                // Verify the password
                const passwordMatches = bcrypt.compareSync(password, user.password);
                if (passwordMatches) {
                    req.session.username = username;

                    // Reset failed login attempts on successful login
                    failedLoginAttempts[username] = { failedAttempts: 0 };

                    await client.query('COMMIT');
                    return res.redirect('/');
                } else {
                    // Increment failed attempts or initialize tracking
                    const record = failedLoginAttempts[username] || { failedAttempts: 0 };

                    record.failedAttempts += 1;
                    if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                        record.blockExpiresAt = Date.now() + BLOCK_TIME;
                    }
                    failedLoginAttempts[username] = record;

                    await client.query('ROLLBACK');
                    return res.render('index', { title: 'LogIn', errorMessage: 'Invalid username or password' });
                }
            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Error querying the database', err);
                return res.render('index', { title: 'LogIn', errorMessage: 'An error occurred. Please try again later.' });
            } finally {
                client.release();
            }
        });

        // POST route to handle logout
        this.app.get('/logout', (req, res) => {

            req.session.destroy();
            res.redirect('/login'); // Redirect to login page after logout
        });
    }

    defineRoutesRFID() {

        this.app.post('/checkCodeProduct', (req, res) => {
            try {
                const { error } = schemaCheckAppCode.validate(req.body);
                if (error) {
                    return res.status(400).json({ success: false, message: error.details[0].message });
                }

                const { code } = req.body;
                const codeMatches = bcrypt.compare(code, process.env.DEVISE_CODE); // Use async bcrypt

                if (codeMatches) {
                    return res.status(200).json({ success: true, message: 'Code is valid.' });
                }

                return res.status(401).json({ success: false, message: 'Invalid code.' });

            } catch (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Server error occurred.' });
            }
        });


        // POST route to handle RFID codes (only accessible after login)
        this.app.post('/rfid', (req, res) => {

            const { code } = req.body;

            if (code) {
                res.status(200).send('Code received');
            } else {
                res.status(400).send('Bad Request');
            }
        });
    }

    defineRoutesNFC() {
        // Section NFC App

        this.app.post('/readBikeNfc', async (req, res) => {

            const { error } = schemaNFCBikeRead.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const { nfcData } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT SPLIT_PART(namebike, '/', 1) AS namebike
                    FROM bicycles
                    WHERE id = $1;`, [nfcData]);

                // Check if a result was found
                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Bike not found for the provided NFC data.' });
                }

                await client.query('COMMIT');
                res.status(200).json({ namebike: result.rows[0].namebike });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Error querying the database', err);
                res.status(500).json({ error: 'Internal Server Error' });
            } finally {
                client.release();
            }
        });

        // Endpoint to get all available bikes
        this.app.get('/getClient', async (req, res) => {

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query('SELECT id, namesoldier FROM soldier');

                await client.query('COMMIT');
                res.status(200).json(result.rows);

            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Error querying the database', err);
                res.status(500).json({ error: 'Internal Server Error' });

            } finally {
                client.release();
            }
        });

        this.app.post('/nfcRent', async (req, res) => {

            const { error } = schemaNFCRent.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const { nfcData, date, time, selectClient } = req.body;

            const dateText = `${date} ${time}`;
            const recDate = new Date(dateText);

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                // Update bike status and assign to client

                const now = new Date();
                const diffTime = Math.abs(recDate - now); // Calculate time difference in milliseconds
                const diffHours = diffTime / (1000 * 60 * 60); // Convert milliseconds to hours

                let newStatus;

                if (selectClient == repireUserId) {
                    newStatus = 'Repair';
                }

                else if (diffHours > 24) {
                    newStatus = 'Late';
                }

                else {
                    newStatus = 'Rented';
                }

                await client.query(
                    "UPDATE bicycles SET status = $1 WHERE id = $2",
                    [newStatus, nfcData]
                );

                await client.query(
                    `INSERT INTO bikesoldier(id, bikeid, soldierid, datefrom) VALUES (
                    (SELECT COALESCE(MAX(id), 0) + 1 FROM bikesoldier), $1, $2, $3);`,
                    [nfcData, selectClient, recDate]
                );

                const bikeResult = await client.query(`SELECT namebike FROM bicycles WHERE id = $1;`, [nfcData]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = 'PhoneUser'), $1)",
                    [`Rented Bike with name ${bikeResult.rows[0].namebike}`]);

                await client.query('COMMIT');
                res.status(200).send('Data rent received successfully');

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error executing database query', error);
                res.status(500).send('An error occurred. Please try again later.');
            } finally {
                // Release the client back to the pool
                client.release();
            }
        });

        this.app.post('/nfcReturn', async (req, res) => {

            const { error } = schemaNFCReturn.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const { nfcData, date, time } = req.body;

            const dateText = `${date} ${time}`;
            const recDate = new Date(dateText);

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                await client.query(
                    "UPDATE bicycles SET status = 'Available' WHERE id = $1",
                    [nfcData]
                );

                await client.query(
                    "UPDATE bikesoldier SET dateto = $1 WHERE bikeid = $2 AND dateto IS NULL",
                    [recDate, nfcData]
                );

                const bikeResult = await client.query(`SELECT namebike FROM bicycles WHERE id = $1;`, [nfcData]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = 'PhoneUser'), $1)",
                    [`Return Bike with name ${bikeResult.rows[0].namebike}`]);

                await client.query('COMMIT');
                res.status(200).send('Data return received successfully');

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error executing database query', error);
                res.status(500).send('An error occurred. Please try again later.');
            } finally {
                client.release();
            }
        });

        this.app.post('/editParameturBike', async (req, res) => {

            const { error } = schemaEditParameturBike.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const { oldBikeId, newBikeId, bikeName } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                if (oldBikeId === newBikeId) {
                    await client.query(
                        "UPDATE bicycles SET namebike = $1 WHERE id = $2",
                        [bikeName, oldBikeId]);

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = 'PhoneUser'), $1)",
                        [`Edit Bike name with code ${oldBikeId}`]);

                } else {

                    await client.query(
                        "INSERT INTO bicycles VALUES ($1, $2, 'Available');",
                        [newBikeId, bikeName]
                    );

                    await client.query(
                        "UPDATE bikesoldier SET bikeid = $1 WHERE bikeid = $2",
                        [newBikeId, oldBikeId]
                    );

                    await client.query(
                        "DELETE FROM bicycles WHERE id = $1",
                        [oldBikeId]
                    );

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = 'PhoneUser'), $1)",
                        [`Edit Bike with name ${bikeName}, replace old NFC ${oldBikeId} with new NFC ${newBikeId}`]);
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'Bike edit successfully.' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error executing database query', error);
                res.status(500).send('An error occurred. Please try again later.');
            } finally {
                client.release();
            }
        });
    }

    defineRoutesBicycles() {

        // Serve APK file from local directory
        this.app.get('/download-apk-bike', this.isLoggedIn.bind(this), (req, res) => {
            const apkFilePath = path.join(__dirname, 'androidApp', 'NFCReader-1.0-release.apk');

            // Check APK file existence and legality
            if (!this.checkApkFileLegality(apkFilePath, res)) {
                return;
            }

            // Serve the APK with proper headers
            res.setHeader('Content-Type', 'application/vnd.android.package-archive');
            res.setHeader('Content-Disposition', 'attachment; filename="NFCReader-1.0-release.apk"');
            res.download(apkFilePath, (err) => {
                if (err) {
                    console.error('Error during APK download:', err);
                    res.status(500).send('Error downloading the file');
                }
            });
        });

        // Section bicycles

        this.app.get('/bicycles', this.isLoggedIn.bind(this), async (req, res) => {

            var data = [];
            var optionHour = [];
            var optionMinute = [];

            var totalBike = 0;
            var rentedBike = 0;
            var availableBike = 0;
            var repairBike = 0;
            var lateBike = 0;
            var longTermBike = 0;

            // Get a client from the pool
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                await client.query(`
                WITH bike_times AS (
                SELECT 
                    b.id AS bike_id, 
                    namebike, 
                    b.status, 
                    namesoldier, 
                    lb.datefrom,
                    EXTRACT(EPOCH FROM (NOW() - lb.datefrom)) / 3600 AS hours_passed
                FROM bicycles b 
                LEFT JOIN (
                    SELECT bikeId, soldierId, datefrom, ROW_NUMBER() OVER (PARTITION BY bikeId ORDER BY id DESC) AS rn 
                    FROM bikeSoldier
                ) lb ON b.id = lb.bikeId AND lb.rn = 1
                LEFT JOIN soldier s ON lb.soldierId = s.id
            )
            UPDATE bicycles
            SET status = 'Late'
            FROM bike_times
            WHERE bicycles.id = bike_times.bike_id 
                AND bike_times.hours_passed > 24
                AND bike_times.status = 'Rented';`);

                // Query the database for the user
                const result_bike = await client.query(
                    `SELECT 
                    namebike, 
                    b.status, 
                    namesoldier, 
                    TO_CHAR(lb.datefrom, 'FMMonth DD, YYYY HH24:MI') AS formatted_date
                FROM bicycles b 
                LEFT JOIN (SELECT bikeId, soldierId, datefrom, ROW_NUMBER() OVER (PARTITION BY bikeId ORDER BY id DESC) AS rn FROM bikeSoldier) lb ON b.id = lb.bikeId AND lb.rn = 1 
                LEFT JOIN soldier s ON lb.soldierId = s.id
                ORDER BY CASE WHEN b.status = 'Late' THEN 0 WHEN b.status = 'Repair' THEN 1 WHEN b.status = 'Rented' THEN 2 WHEN b.status = 'Available' THEN 3 ELSE 4 END, b.status;`
                );


                result_bike.rows.forEach(element => {
                    data.push({
                        name: element.namebike,
                        status: element.status,
                        hiredby: element.status == "Available" ? "None" : element.namesoldier,
                        datefrom: element.status == "Available" ? "None" : element.formatted_date
                    });

                    switch (element.status) {
                        case 'Rented':
                            rentedBike++;
                            break;

                        case 'Available':
                            availableBike++;
                            break;

                        case 'Repair':
                            repairBike++;
                            break;

                        case 'Late':
                            lateBike++;
                            break;

                        case 'Long term':
                            longTermBike++;
                            break;
                    }

                    totalBike++;
                });

                for (let index = 0; index < 24; index++) {
                    optionHour.push({ value: index, name: index });
                }

                for (let index = 0; index < 60; index++) {
                    optionMinute.push({ value: index, name: index });
                }

                await client.query('COMMIT');

                switch (req.session.username) {
                    case 'guest':
                        this.giveSpecificPermissionBicycles(req.session.username, [0, 5, 6], res, data, optionHour, optionMinute, totalBike, rentedBike, availableBike, repairBike, lateBike, longTermBike);
                        break;
                    case 'admin':
                        this.giveSpecificPermissionBicycles(req.session.username, [0, 1, 2, 3, 4, 5, 6], res, data, optionHour, optionMinute, totalBike, rentedBike, availableBike, repairBike, lateBike, longTermBike);
                        break;
                    default:
                        this.giveSpecificPermissionBicycles(req.session.username, [0, 2, 3, 4, 5, 6], res, data, optionHour, optionMinute, totalBike, rentedBike, availableBike, repairBike, lateBike, longTermBike);
                        break;
                }
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error executing database query', error);
                res.status(500).send('An error occurred. Please try again later.');

            } finally {
                client.release();
            }
        });

        this.app.post("/bikeAction", this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaBike.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { bikeId, clientId, actionId, dateId, hourSelectId, minuteSelect, ltstatus } = req.body;

            // Ensure hour and minute are valid numbers
            const hour = parseInt(hourSelectId, 10);
            const minute = parseInt(minuteSelect, 10);

            if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                return res.status(401).json({ message: 'Invalid time.' });
            }

            // Construct date string and parse it into a Date object
            const dateText = `${dateId} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const recDate = new Date(dateText);


            // Check if the constructed date is valid
            if (isNaN(recDate.getTime())) {
                return res.status(402).json({ message: 'Invalid date format.' });
            }

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const bikeResult = await client.query(`SELECT namebike FROM bicycles WHERE id = $1`, [bikeId]);

                if (actionId === 'Rent') {

                    // Update bike status and assign to client

                    const now = new Date();
                    const diffTime = Math.abs(recDate - now); // Calculate time difference in milliseconds
                    const diffHours = diffTime / (1000 * 60 * 60); // Convert milliseconds to hours

                    let newStatus;

                    if (ltstatus === 'true') {
                        newStatus = 'Long term';
                    } else if (clientId == repireUserId) {
                        newStatus = 'Repair';
                    } else if (diffHours > 24) {
                        newStatus = 'Late';
                    } else {
                        newStatus = 'Rented';
                    }

                    await client.query(
                        "UPDATE bicycles SET status = $1 WHERE id = $2",
                        [newStatus, bikeId]
                    );

                    await client.query(
                        `INSERT INTO bikesoldier(id, bikeid, soldierid, datefrom) VALUES (
                        (SELECT COALESCE(MAX(id), 0) + 1 FROM bikesoldier), $1, $2, $3);`,
                        [bikeId, clientId, recDate]
                    );

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Rented Bike with name ${bikeResult.rows[0].namebike}`]);

                    await client.query('COMMIT');
                    res.status(200).json({ message: 'The bike has been rented successfully' });

                } else {
                    // Update bike status and clear client assignment

                    await client.query(
                        "UPDATE bicycles SET status = 'Available' WHERE id = $1",
                        [bikeId]
                    );

                    await client.query(
                        "UPDATE bikesoldier SET dateto = $1 WHERE bikeid = $2 AND dateto IS NULL",
                        [recDate, bikeId]
                    );

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Return Bike with name ${bikeResult.rows[0].namebike}`]);

                    await client.query('COMMIT');
                    res.status(200).json({ message: 'The bike has been return successfully' });
                }

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error executing database query', error);
                res.status(500).json({ message: 'An error occurred. Please try again later.' });
            } finally {
                client.release();
            }
        });

        this.app.post("/bicycles/report", this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaReport.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            let { selectedDate1, selectedDate2 } = req.body;

            const client = await pool.connect();

            try {

                selectedDate1 += " 00:00";
                selectedDate2 += " 23:59";

                await client.query('BEGIN');

                // Query for bike usage details
                const result_soldior = await client.query(
                    `SELECT 
                        ROW_NUMBER() OVER (ORDER BY namebike) AS row_num, 
                        b.namebike, 
                        s.namesoldier,
                        COALESCE(TO_CHAR(datefrom, 'FMMonth DD, YYYY HH24:MI'), 'Still in use') AS date_from,
                        COALESCE(TO_CHAR(dateto, 'FMMonth DD, YYYY HH24:MI'), 'Still in use') AS date_to,
                        CASE 
                            WHEN dateto IS NOT NULL THEN CONCAT(
                                EXTRACT(DAY FROM (dateto - datefrom)), ' days, ',
                                EXTRACT(HOUR FROM (dateto - datefrom)), ' hours and ',
                                EXTRACT(MINUTE FROM (dateto - datefrom)), ' minutes'
                            )
                            ELSE 'Still in use'
                        END AS duration,
                        CASE
                            WHEN dateto IS NOT NULL AND (dateto - datefrom) > INTERVAL '24 hours' THEN 'Late'
                            ELSE 'On time'
                        END AS status
                    FROM bikesoldier bs 
                    LEFT JOIN soldier s ON bs.soldierid = s.id 
                    LEFT JOIN bicycles b ON bs.bikeid = b.id
                    WHERE datefrom BETWEEN $1 AND $2
                    ORDER BY date_from;`,
                    [selectedDate1, selectedDate2]
                );

                const data = result_soldior.rows;

                const result_bike_totals = await client.query(
                    `SELECT 
                        TO_CHAR(datefrom, 'YYYY-MM-DD') AS date, 
                        COUNT(bikeid) AS total_bikes
                    FROM bikesoldier
                    WHERE datefrom BETWEEN $1 AND $2
                    GROUP BY TO_CHAR(datefrom, 'YYYY-MM-DD')
                    ORDER BY date;`,
                    [selectedDate1, selectedDate2]
                );
                const dateTotals = result_bike_totals.rows;

                // Create a new Excel workbook
                const workbook = new excelJS.Workbook();

                // Sheet 1: Bike Usage Data
                const worksheet1 = workbook.addWorksheet('Bike Usage Data');

                // Add custom column titles for the first sheet
                const headers1 = ['Row Number', 'Bike Name', 'Soldier Name', 'Date From', 'Date To', 'Duration', 'Status'];
                const headerRow1 = worksheet1.addRow(headers1);

                // Apply styling to the headers
                headerRow1.eachCell((cell) => {
                    cell.font = { bold: true, size: 12 };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                // Set column widths for sheet 1
                worksheet1.columns = [
                    { width: 12 }, // Row Number
                    { width: 20 }, // Bike Name
                    { width: 25 }, // Soldier Name
                    { width: 20 }, // Date From
                    { width: 20 }, // Date To
                    { width: 25 }, // Duration
                    { width: 15 }, // Status
                ];

                // Add data rows to the first sheet with alternating row color styling
                data.forEach((row, index) => {
                    const dataRow = worksheet1.addRow(Object.values(row));

                    // Check if the status is "Late" and add a ⚠️ icon
                    if (row.status === 'Late') {
                        dataRow.getCell(7).value = '⚠️';
                    } else {
                        dataRow.getCell(7).value = '';
                    }

                    // Center align the "Status" column (7th column)
                    dataRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

                    // Apply borders and alternating row color
                    dataRow.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' },
                        };
                    });
                    if (index % 2 === 0) {
                        dataRow.eachCell((cell) => {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFDDDDDD' }, // Light grey
                            };
                        });
                    }
                });

                // Sheet 2: Total Bikes Used by Date
                const worksheet2 = workbook.addWorksheet('Total Bikes by Date');

                const headers2 = ['Date', 'Total Bikes Used'];
                const headerRow2 = worksheet2.addRow(headers2);

                headerRow2.eachCell((cell) => {
                    cell.font = { bold: true, size: 12 };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                worksheet2.columns = [
                    { width: 20 }, // Date
                    { width: 25 }, // Total Bikes Used
                ];

                let totalBikesUsed = 0;

                dateTotals.forEach((row, index) => {
                    const dataRow = worksheet2.addRow([row.date, row.total_bikes]);
                    totalBikesUsed += parseInt(row.total_bikes, 10);

                    dataRow.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' },
                        };
                    });
                    if (index % 2 === 0) {
                        dataRow.eachCell((cell) => {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFDDDDDD' }, // Light grey
                            };
                        });
                    }
                });

                const totalRow = worksheet2.addRow(['Total', totalBikesUsed]);
                totalRow.eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=report_bicycles.xlsx');

                await workbook.xlsx.write(res);

                await client.query('COMMIT');
                res.end();

            } catch (error) {
                await client.query('ROLLBACK');
                console.log('Error:', error);
                res.status(500).send('An error occurred');
            } finally {
                client.release();
            }

        });

        this.app.get('/bikes', async (req, res) => {

            var optionBike = [];

            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                const result_bike = await client.query(`SELECT id, namebike, status FROM bicycles;`);

                result_bike.rows.forEach(element => {
                    optionBike.push({ id: element.id, name: element.namebike, status: element.status });
                });

                await client.query('COMMIT');
                res.status(200).json(optionBike);

            } catch (error) {
                await client.query('ROLLBACK');
                console.log('Error:', error);
                res.status(500).send('An error occurred');
            } finally {
                client.release();
            }

        });

        this.app.post('/bicycles/viewReport', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaReport.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            let { selectedDate1, selectedDate2 } = req.body;

            if (selectedDate1 !== "None" && selectedDate2 !== "None") {

                const client = await pool.connect();

                try {

                    await client.query('BEGIN');

                    selectedDate1 += " 00:00";
                    selectedDate2 += " 23:59";

                    // Query for bike usage details
                    const result_soldior = await client.query(
                        `SELECT
                        ROW_NUMBER() OVER (ORDER BY namebike) AS row_num, 
                        b.namebike, 
                        s.namesoldier, 
                        COALESCE(TO_CHAR(datefrom, 'FMMonth DD, YYYY HH24:MI'), 'Still in use') AS date_from,
                        COALESCE(TO_CHAR(dateto, 'FMMonth DD, YYYY HH24:MI'), 'Still in use') AS date_to, 
                        CASE 
                            WHEN dateto IS NOT NULL THEN CONCAT(
                                EXTRACT(DAY FROM (dateto - datefrom)), ' days, ',
                                EXTRACT(HOUR FROM (dateto - datefrom)), ' hours and ',
                                EXTRACT(MINUTE FROM (dateto - datefrom)), ' minutes'
                            )
                            ELSE 'Still in use'
                        END AS duration
                    FROM bikesoldier bs 
                    LEFT JOIN soldier s ON bs.soldierid = s.id 
                    LEFT JOIN bicycles b ON bs.bikeid = b.id
                    WHERE datefrom BETWEEN $1 AND $2
                    ORDER BY date_from DESC;`,
                        [selectedDate1, selectedDate2]
                    );

                    const data = result_soldior.rows;

                    // Query for total bike usage per day in the date range
                    const result_bike_totals = await client.query(
                        `SELECT 
                        TO_CHAR(datefrom, 'YYYY-MM-DD') AS date, 
                        COUNT(bikeid) AS total_bikes
                    FROM bikesoldier
                    WHERE datefrom BETWEEN $1 AND $2
                    GROUP BY TO_CHAR(datefrom, 'YYYY-MM-DD')
                    ORDER BY date DESC;`,
                        [selectedDate1, selectedDate2]
                    );
                    const dateTotals = result_bike_totals.rows;

                    await client.query('COMMIT');
                    res.json({ data, dateTotals });

                } catch (error) {
                    await client.query('ROLLBACK');
                    console.log('Error:', error);
                    res.status(500).send('An error occurred');
                } finally {
                    client.release();
                }
            }
        });

        this.app.post('/bicycles/addBike', async (req, res) => {

            const { error } = schemaAddBike.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            let { bikeAddId, bikeName } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                // Check if bikeAddId already exists
                const result = await client.query(`SELECT * FROM bicycles WHERE id = $1`, [bikeAddId]);

                if (result.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).send({ message: 'This bike already exists.' });
                }

                // Insert new bike if bikeAddId doesn't exist
                await client.query(`INSERT INTO bicycles VALUES ($1, $2, 'Available');`, [bikeAddId, bikeName]);

                // Query the database for the user
                await client.query(
                    `INSERT INTO usermonitoring (user_id, location)
                     VALUES (
                       COALESCE((SELECT id FROM users WHERE username = $1), (SELECT id FROM users WHERE username = 'PhoneUser')),
                       $2
                     )`,
                    [req.session.username, `Add Bike with name ${bikeName}`]
                );

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Bike added successfully.' });
            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Database error:', err);
                res.status(500).send({ message: 'Internal server error.' });
            } finally {
                client.release();
            }
        });

        this.app.post('/bicycles/removeBike', async (req, res) => {

            const { error } = schemaRemoveBike.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            let { bikeRemoveId } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const bikeResult = await client.query(`SELECT namebike FROM bicycles WHERE id = $1`, [bikeRemoveId]);

                // Query the database for the user
                await client.query(
                    `INSERT INTO usermonitoring (user_id, location)
                     VALUES (
                       COALESCE((SELECT id FROM users WHERE username = $1), (SELECT id FROM users WHERE username = 'PhoneUser')),
                       $2
                     )`,
                    [req.session.username, `Remove Bike with number ${bikeResult.rows[0].namebike}`]
                );

                await client.query(`DELETE FROM bicycles WHERE id = $1;`, [bikeRemoveId]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Bike remove successfully.' });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Database error:', err);
                res.status(500).send({ error: 'Internal server error.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/bicycles/multiBike/download', this.isLoggedIn.bind(this), async (req, res) => {

            // Create a new Excel workbook
            const workbook = new excelJS.Workbook();

            // Sheet 1: Accommodation Multipul Soldiers
            const worksheet = workbook.addWorksheet('Bicycles Multipul Bike');

            const headers = ['id', 'namebike'];
            const headerRow = worksheet.addRow(headers);

            // Apply styling to the headers
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, size: 12 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });

            // Set the response headers for file download
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=templateBicyclesBike.xlsx');

            // Write the workbook to the response stream
            await workbook.xlsx.write(res);
            res.end(); // End the response

        });

        this.app.post('/bicycles/uploadMultiBike', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {

            const client = await pool.connect();
            const errors = [];

            try {

                await client.query('BEGIN');

                if (!req.file) {
                    return res.status(400).json({ error: 'No file uploaded.' });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                // Create a Set to track unique soldier IDs within the data array
                const uniqueBikeId = new Set();

                await Promise.all(data.map(async (row) => {

                    if (!row.id) {
                        return;
                    }

                    const { error } = schemaUploadBike.validate(row);

                    if (error) {
                        errors.push({ type: 'Validation', details: error.details, row });
                        return;
                    }

                    // Check for duplicates within the data array
                    if (uniqueBikeId.has(row.id)) {
                        errors.push({ type: 'UniqueIdCheck', message: `Duplicate bike id '${row.id}' found within the data.` });
                        return;
                    }

                    // Add soldier ID to the Set after checking
                    uniqueBikeId.add(row.id);

                    // Inside the backend function, when checking for duplicates
                    const result = await client.query("SELECT * FROM bicycles WHERE id = $1;", [row.id]);

                    if (result.rows.length > 0) {
                        errors.push({ type: 'CheckExist', message: `Bicycles with number '${row.id}' is alredy exists.` });
                        return;
                    }

                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row) => {

                    if (!row.id) {
                        return;
                    }

                    await client.query(
                        "INSERT INTO bicycles VALUES ($1, $2, 'Available')",
                        [row.id, row.namebike]
                    );

                }));

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), 'Multi Add Bike')", [req.session.username]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/checkBike', async (req, res) => {

            const { bikeId } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_bike = await client.query(`
                SELECT status, datefrom FROM bicycles b
                LEFT JOIN bikesoldier bs ON bs.bikeid = b.id
                WHERE b.id = $1 and b.status <> 'Available' AND dateto IS NULL;`, [bikeId]);

                if (result_bike.rows.length > 0) {
                    const statusRes = result_bike.rows[0].status ? result_bike.rows[0].status : 'Available';
                    const datefromRes = result_bike.rows[0].datefrom ? result_bike.rows[0].datefrom : 'None';

                    await client.query('COMMIT');
                    res.status(200).json({ status: statusRes, datefrom: datefromRes });
                } else {
                    await client.query('COMMIT');
                    res.status(200).json({ status: 'Available', datefrom: 'None' });
                }

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/clients', this.isLoggedIn.bind(this), async (req, res) => {

            var optionClient = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_client = await client.query(`
                    SELECT s.id, namesoldier, country, l.id as etc, l.code, s.meal_card, s.date_free, s.date_accommodation
                    FROM soldier s
                    LEFT JOIN laundrybags l ON l.id = s.laundry_bag_id;`);

                result_client.rows.forEach(element => {
                    optionClient.push({
                        id: element.id,
                        name: element.namesoldier,
                        country: element.country,
                        etc: element.etc ? element.etc : '',
                        code: element.code ? element.code : '',
                        meal_card: element.meal_card ? element.meal_card : '',
                        date_free: element.date_free ? element.date_free : '',
                        date_accommodation: element.date_accommodation ? element.date_accommodation : ''
                    });
                });

                await client.query('COMMIT');
                res.json(optionClient);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/bicycles/editBike', async (req, res) => {

            const { error } = schemaEditBike.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const { bikeId, status, soldierId, dateFrom } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                await client.query(`
                    UPDATE bicycles SET status = $1 WHERE id = $2;`, [status, bikeId]);

                await client.query(`
                    UPDATE bikesoldier SET soldierid = $1, datefrom = $2 WHERE bikeid = $3 AND dateto IS NULL;`, [soldierId, dateFrom, bikeId]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Bike data edited successfully.' });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Database error:', err);
                res.status(500).send({ error: 'Internal server error.' });

            } finally {
                client.release();
            }
        });
    }

    // Section Accommodation
    defineRoutesAccommodation() {

        this.app.get('/rooms', this.isLoggedIn.bind(this), async (req, res) => {

            var optionRoom = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');
                const result_client = await client.query(`
                    SELECT k.id, namekey, soldierid 
                    FROM key k
                    JOIN assets a ON a.location_key = k.id
                    LEFT JOIN roomskey rk ON rk.keyid = k.id
                    LEFT JOIN buildroom br ON br.roomid = rk.roomid
                    LEFT JOIN buildings b ON b.id = br.buildid AND b.type = 'Accommodation';`);

                result_client.rows.forEach(element => {
                    optionRoom.push({ id: element.id, name: `${element.namekey}${element.soldierid ? ' 🚫' : ' ✅'}` });
                });

                await client.query('COMMIT');
                res.json(optionRoom);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/bags', async (req, res) => {

            const { error } = shemaGetBags.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            var optionAllBag = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_all_bags = await client.query(`SELECT * FROM laundrybags`);

                result_all_bags.rows.forEach(element => {
                    optionAllBag.push({ id: element.id, name: element.code, status: element.status, maxcountlandry: element.maxcountlandry, type: element.type });
                });

                await client.query('COMMIT');
                res.status(200).json({ allBags: optionAllBag });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/freeBags', this.isLoggedIn.bind(this), async (req, res) => {

            var optionAllBag = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_all_bags = await client.query(`
                    SELECT * 
                    FROM laundrybags l 
                    WHERE l.id NOT IN (SELECT l.id FROM laundrybags l
                                        LEFT JOIN soldier s ON s.laundry_bag_id = l.id
                                        WHERE s.date_accommodation IS NOT NULL AND date_free IS NULL); `);

                result_all_bags.rows.forEach(element => {
                    optionAllBag.push({ id: element.id, name: element.code, status: element.status });
                });

                await client.query('COMMIT');
                res.json({ bags: optionAllBag });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/builds', this.isLoggedIn.bind(this), async (req, res) => {

            var builds = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_all_builds = await client.query(`SELECT id, namebuilding FROM buildings WHERE type = 'Accommodation'`);

                result_all_builds.rows.forEach(element => {
                    builds.push({ id: element.id, name: element.namebuilding });
                });

                await client.query('COMMIT');
                res.json(builds);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/move/getSoldier', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaGetSoldier.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const keyId = req.body.keyId;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_client = await client.query(`
                SELECT s.id, namesoldier FROM key k
                JOIN soldier s ON s.id = k.soldierid
                WHERE k.id = $1;`, [keyId]);

                const soldiername = result_client.rows.length === 0 ? 'None' : result_client.rows[0].namesoldier;
                const soldierid = result_client.rows.length === 0 ? '' : result_client.rows[0].id;

                await client.query('COMMIT');
                res.json({ id: soldierid, name: soldiername });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/searchBikes', async (req, res) => {

            const { error } = schemaSearchBike.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const selectBike = req.body.id;
            var allBikeInfo = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_client = await client.query(`
                SELECT namesoldier,
                TO_CHAR(datefrom, 'FMMonth DD, YYYY HH24:MI') AS formatted_date_from, 
                COALESCE(TO_CHAR(dateto, 'FMMonth DD, YYYY HH24:MI'), 'Still in use') AS formatted_date_to
                FROM bikesoldier bs
                LEFT JOIN soldier s ON s.id = bs.soldierid
                LEFT JOIN bicycles b ON b.id = bs.bikeid
                WHERE bikeid = $1
                ORDER BY datefrom DESC
				LIMIT 2;`, [selectBike]);


                result_client.rows.forEach(element => {
                    allBikeInfo.push({ namesoldier: element.namesoldier, datefrom: element.formatted_date_from, dateto: element.formatted_date_to });
                });

                await client.query('COMMIT');
                res.json(allBikeInfo);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/searchClient', async (req, res) => {

            const { error } = schemaSearchBike.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const selectClient = req.body.id;
            var allClientInfo = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_client = await client.query(`
                SELECT namebike,
                TO_CHAR(datefrom, 'FMMonth DD, YYYY HH24:MI') AS formatted_date_from,
                COALESCE(TO_CHAR(dateto, 'FMMonth DD, YYYY HH24:MI'), 'Still in use') AS formatted_date_to
                FROM bikesoldier bs
                LEFT JOIN soldier s ON s.id = bs.soldierid
                LEFT JOIN bicycles b ON b.id = bs.bikeid
                WHERE soldierid = $1
                ORDER BY datefrom DESC
				LIMIT 2;`, [selectClient]);

                result_client.rows.forEach(element => {
                    allClientInfo.push({ namebike: element.namebike, datefrom: element.formatted_date_from, dateto: element.formatted_date_to });
                });

                await client.query('COMMIT');
                res.json(allClientInfo);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/accommodation', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAccommodation.validate(req.query);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const { numBuild, isFirstTime } = req.query;
            var nameroomSet = new Set();

            var headerTable = [
                { name: "Number Key" },
                { name: "Key code" },
                { name: "Soldier" },
                { name: "Nationality" }
            ];

            var type = '';
            var title;
            var countFreeBeds;
            var selectBuildType;

            let roomCounts = {}; // Object to hold counts for each nameroom

            // Get a client from the pool
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                if (numBuild === 'E' || numBuild === 'D') {

                    const resultData = await client.query(`
                    SELECT nameroom,
                           COUNT(CASE WHEN namesoldier IS NULL THEN 1 END) as unassigned_count
                    FROM rooms r
                    LEFT JOIN roomskey rk ON r.id = rk.roomid
                    LEFT JOIN key k ON k.id = rk.keyid
                    LEFT JOIN soldier s ON s.id = k.soldierid
                    LEFT JOIN buildroom br ON br.roomid = r.id
                    LEFT JOIN laundrybags lb ON lb.id = s.laundry_bag_id
                    WHERE nameroom SIMILAR TO '%/' || $1 || '[0-9]%'
                    GROUP BY nameroom
                    ORDER BY nameroom;`, [numBuild]);

                    // Initialize room counts using the query result
                    resultData.rows.forEach(row => {
                        nameroomSet.add(row.nameroom);
                        roomCounts[row.nameroom] = row.unassigned_count || 0;
                    });

                    type = numBuild === 'E' ? "Entrance" : "Dryer";
                    title = numBuild === 'E' ? "Entrance" : "Dryer room";

                    selectBuildType = '';

                } else if (numBuild) {

                    const resultData = await client.query(`
                    SELECT 
                        nameroom,
                        COUNT(
                            CASE 
                                WHEN a.location_key IS NOT NULL AND k.soldierid IS NULL
                                THEN k.id 
                            END
                        ) AS count_with_location,
                        COUNT(
                            CASE 
                                WHEN s.id IS NULL
                                THEN k.id
                            END
                        ) AS count_without_location
                    FROM 
                        rooms r
                    LEFT JOIN 
                        roomskey rk ON r.id = rk.roomid
                    LEFT JOIN 
                        key k ON k.id = rk.keyid
                    LEFT JOIN 
                        soldier s ON s.id = k.soldierid
                    LEFT JOIN 
                        buildroom br ON br.roomid = r.id
                    LEFT JOIN
                        assets a ON a.location_key = k.id
                    LEFT JOIN 
                        buildings b ON br.buildid = b.id
                    WHERE 
                        br.buildid = $1
                        AND nameroom NOT SIMILAR TO '%/(E|D)[0-9]%'
                    GROUP BY 
                        nameroom
                    ORDER BY 
                        nameroom;`, [numBuild]);

                    const res_type = await client.query('SELECT type FROM buildings WHERE id = $1', [numBuild]);
                    type = res_type.rows[0].type;

                    // Initialize room counts using the query result
                    resultData.rows.forEach(row => {
                        nameroomSet.add(row.nameroom);
                        roomCounts[row.nameroom] = type === 'Accommodation' ? row.count_with_location || 0 : row.count_without_location || 0;
                    });

                    title = `Building ${numBuild}`;

                    const countFreeBedsResult = await client.query(`
                    SELECT COUNT(*) AS freebeds
                    FROM rooms r
                    LEFT JOIN roomskey rk ON r.id = rk.roomid
                    LEFT JOIN key k ON k.id = rk.keyid
                    LEFT JOIN soldier s ON s.id = k.soldierid
                    LEFT JOIN buildroom br ON br.roomid = r.id
                    JOIN assets a ON a.location_key = k.id
                    WHERE s.namesoldier IS NULL 
                    AND br.buildid = $1
                    AND r.nameroom LIKE '__/___';`, [numBuild]);

                    countFreeBeds = countFreeBedsResult.rows[0].freebeds;

                    const selectBuildTyperesult = await client.query(`SELECT type FROM buildings WHERE id = $1;`, [numBuild]);
                    selectBuildType = selectBuildTyperesult.rows[0].type;

                } else {

                    const resultData = await client.query(`
                    SELECT 
                        nameroom,
                        COUNT(CASE WHEN a.location_key IS NOT NULL AND k.soldierid IS NULL THEN k.id END) AS unassigned_count
                    FROM 
                        rooms r
                    LEFT JOIN 
                        roomskey rk ON r.id = rk.roomid
                    LEFT JOIN 
                        key k ON k.id = rk.keyid
                    LEFT JOIN 
                        soldier s ON s.id = k.soldierid
                    LEFT JOIN 
                        buildroom br ON br.roomid = r.id
                    LEFT JOIN 
                        buildings b ON br.buildid = b.id
                    LEFT JOIN
                        assets a ON a.location_key = k.id
                    WHERE 
                        nameroom NOT SIMILAR TO '%/(E|D)[0-9]%'
                        AND b.type = 'Accommodation'
                    GROUP BY 
                        nameroom
                    ORDER BY 
                        nameroom;`);

                    // Initialize room counts using the query result
                    resultData.rows.forEach(row => {
                        nameroomSet.add(row.nameroom);
                        roomCounts[row.nameroom] = row.unassigned_count || 0;
                    });

                    title = "Accommodation"

                    selectBuildType = '';
                }

                switch (type) {
                    case 'Accommodation':
                    case '':
                        // Add headers
                        headerTable.push({ name: "Meal card" });
                        headerTable.push({ name: "Laundry bag" });
                        break;
                }

                const resultBuild = await client.query(`SELECT id, namebuilding FROM buildings`);

                var navBuild = [
                    { id: "E", name: "Entrance" },
                    { id: "D", name: "Dryer room" }
                ];

                var totalFreeBeds = 0;

                const counttotalBeds = await client.query(`
                SELECT COUNT(*) AS totalbed
                FROM rooms r
                LEFT JOIN roomskey rk ON r.id = rk.roomid
                LEFT JOIN key k ON k.id = rk.keyid
                LEFT JOIN soldier s ON s.id = k.soldierid
                LEFT JOIN buildroom br ON br.roomid = r.id
                JOIN assets a ON a.location_key = k.id
                WHERE nameroom NOT LIKE '__/D_' AND nameroom NOT LIKE '__/_/E_';`);

                for (const row of resultBuild.rows) {
                    try {
                        const countFreeBedsResult = await client.query(`
                        SELECT COUNT(*) AS freebeds
                        FROM rooms r
                        LEFT JOIN roomskey rk ON r.id = rk.roomid
                        LEFT JOIN key k ON k.id = rk.keyid
                        LEFT JOIN soldier s ON s.id = k.soldierid
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        JOIN assets a ON a.location_key = k.id
                        WHERE s.namesoldier IS NULL 
                        AND br.buildid = $1
                        AND r.nameroom LIKE '__/___';`, [row.id]);

                        const selectBuildType = await client.query(`SELECT type FROM buildings WHERE id = $1;`, [row.id]);

                        const countFreeBeds = countFreeBedsResult.rows[0].freebeds;
                        totalFreeBeds += Number(countFreeBeds);

                        if (selectBuildType.rows[0].type === 'Accommodation') {
                            navBuild.push({ id: row.id, name: `${row.namebuilding}`, nameAdd: `(${countFreeBeds} free beds)`, numBuild: row.id });

                        } else {
                            navBuild.push({ id: row.id, name: `${row.namebuilding}`, numBuild: row.id });
                        }

                    } catch (error) {
                        await client.query('ROLLBACK');
                        console.error(`Error fetching data for building ${row.id}:`, error);
                    }
                }

                var totalOccupiedBeds = counttotalBeds.rows[0].totalbed - totalFreeBeds;

                let nameroomSetCount = [];

                nameroomSet.forEach(room => {
                    nameroomSetCount.push({ nameroom: room, countFreeBeds: roomCounts[room] });
                });

                if (isFirstTime) {

                    if (selectBuildType === 'Accommodation') {
                        await client.query('COMMIT');
                        res.status(200).json({ nameroomSetCount: nameroomSetCount, titlePage: title, countFreeBeds: countFreeBeds, type: type, headerTable: headerTable });
                    } else {
                        await client.query('COMMIT');
                        res.status(200).json({ nameroomSetCount: nameroomSetCount, titlePage: title, type: type, headerTable: headerTable });
                    }

                } else if (selectBuildType === 'Accommodation') {

                    await client.query('COMMIT');

                    switch (req.session.username) {
                        case 'guest':
                            this.giveSpecificPermissionAccommodation(req.session.username, [0, 4, 5], res, navBuild, totalFreeBeds, totalOccupiedBeds, type, title, countFreeBeds, headerTable, nameroomSetCount, numBuild);
                            break;

                        case 'admin':
                            this.giveSpecificPermissionAccommodation(req.session.username, [0, 1, 2, 3, 4, 5, 6], res, navBuild, totalFreeBeds, totalOccupiedBeds, type, title, countFreeBeds, headerTable, nameroomSetCount, numBuild);
                            break;

                        default:
                            this.giveSpecificPermissionAccommodation(req.session.username, [0, 2, 3, 4, 5, 6], res, navBuild, totalFreeBeds, totalOccupiedBeds, type, title, countFreeBeds, headerTable, nameroomSetCount, numBuild);
                            break;
                    }
                } else {

                    await client.query('COMMIT');

                    switch (req.session.username) {
                        case 'guest':
                            this.giveSpecificPermissionAccommodation(req.session.username, [0, 4, 5], res, navBuild, totalFreeBeds, totalOccupiedBeds, type, title, null, headerTable, nameroomSetCount, numBuild);
                            break;

                        case 'admin':
                            this.giveSpecificPermissionAccommodation(req.session.username, [0, 1, 2, 3, 4, 5, 6], res, navBuild, totalFreeBeds, totalOccupiedBeds, type, title, null, headerTable, nameroomSetCount, numBuild);
                            break;

                        default:
                            this.giveSpecificPermissionAccommodation(req.session.username, [0, 2, 3, 4, 5, 6], res, navBuild, totalFreeBeds, totalOccupiedBeds, type, title, null, headerTable, nameroomSetCount, numBuild);
                            break;
                    }
                }
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/getKeyBuildigType', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveKey.validate(req.body);

            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const { keyId } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const resultAccomm = await client.query(`
                    SELECT CASE
                        WHEN r.nameroom SIMILAR TO '%/(E)[0-9]%' THEN 'Entry'
                        WHEN r.nameroom SIMILAR TO '%/(D)[0-9]%' THEN 'Dray'
                        ELSE b.type
                    END AS type
                    FROM key k
                    JOIN roomskey rk ON rk.keyid = k.id
                    JOIN buildroom br ON rk.roomid = br.roomid
                    JOIN buildings b ON b.id = br.buildid
                    JOIN rooms r ON r.id = rk.roomid
                    WHERE k.id = $1`, [keyId]);

                const type = resultAccomm.rows[0].type;

                await client.query('COMMIT');
                res.status(200).json({ type: type });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(error);
                res.status(500).send("Server error");

            } finally {
                client.release();
            }
        });

        this.app.post('/getRoomKeys', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaViewKey.validate(req.body);

            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const roomNumber = req.body.roomNumber;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');
                const result = await client.query(`
                    SELECT namekey, k.id as code, namesoldier, country, meal_card as mealcard, lb.code as lbcode, a.location_key
                    FROM rooms r
                    LEFT JOIN roomskey rk ON r.id = rk.roomid
                    LEFT JOIN key k ON k.id = rk.keyid
                    LEFT JOIN soldier s ON s.id = k.soldierid
                    LEFT JOIN laundrybags lb ON lb.id = s.laundry_bag_id
                    LEFT JOIN assets a ON a.location_key = k.id
                    WHERE r.id = $1 AND k.id IS NOT NULL
                    ORDER BY namekey;`, [roomNumber]);

                // Send back filtered data for the specified room
                await client.query('COMMIT');
                res.json(result.rows);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error fetching room keys:", error);
                res.status(500).send("Server error");

            } finally {
                client.release();
            }
        });

        this.app.post('/saveKey', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaSaveSoldier.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { keyCodeId, soldierId, countryId, bagId, mealCardId } = req.body;

            // Get a client from the pool
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                if (soldierId !== '' && countryId === 'None') {
                    await client.query(
                        "UPDATE key SET soldierid = $1 where id = $2;",
                        [soldierId, keyCodeId]
                    );

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Give key ${keyCodeId} to ${soldierId}`]);

                } else if (soldierId !== '' && countryId !== 'None') {

                    await client.query(
                        "UPDATE key SET soldierid = NULL where soldierid = $1;",
                        [soldierId]
                    );

                    await client.query(
                        "UPDATE key SET soldierid = $1 where id = $2;",
                        [soldierId, keyCodeId]
                    );

                    await client.query(`UPDATE soldier SET date_free = NULL, date_accommodation = NULL WHERE date_free IS NOT NULL AND id = $1;`, [soldierId]);

                    const result_accommodation_soldier = await client.query(`SELECT * FROM soldier WHERE date_accommodation IS NOT NULL AND id = $1`,
                        [soldierId]
                    );

                    if (result_accommodation_soldier.rows.length === 0) {
                        await client.query(
                            "UPDATE soldier SET date_accommodation = CURRENT_DATE, meal_card = $2, laundry_bag_id = $3, used_room = $4 where id = $1;",
                            [soldierId, mealCardId, bagId === '' ? null : bagId, keyCodeId]
                        );
                    } else {
                        await client.query(
                            "UPDATE soldier SET meal_card = $2, laundry_bag_id = $3 where id = $1;",
                            [soldierId, mealCardId, bagId === '' ? null : bagId]
                        );
                    }

                    const bagsRes = await client.query(`SELECT code FROM laundrybags WHERE id = $1;`, [bagId]);

                    if (bagsRes.rows.length === 0) {
                        // Query the database for the user
                        await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                            [req.session.username, `Accommodated soldier with number ${soldierId} and without meal card and bag`]);

                    } else {
                        // Query the database for the user
                        await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                            [req.session.username, `Accommodated soldier with number ${soldierId} with meal card ${mealCardId} and bag ${bagsRes.rows[0].code}`]);
                    }

                } else if (soldierId === '' && countryId !== 'None') {

                    const res_query = await client.query(
                        "SELECT soldierid FROM key WHERE id = $1;",
                        [keyCodeId]
                    );

                    await client.query(
                        "UPDATE key SET soldierid = NULL where id = $1;",
                        [keyCodeId]
                    );

                    await client.query(
                        "UPDATE soldier SET date_free = CURRENT_DATE where id = $1;",
                        [res_query.rows[0].soldierid]
                    );

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Release soldier with number ${res_query.rows[0].soldierid}`]);

                } else {
                    await client.query(
                        "UPDATE key SET soldierid = NULL where id = $1;",
                        [keyCodeId]
                    );

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Return key ${keyCodeId}`]);
                }

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Data saved successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error("Error fetching room keys:", error);
                res.status(500).send("Server error");

            } finally {
                client.release();
            }
        });

        this.app.get('/accommodation/viewReport', async (req, res) => {

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                // Query for bike usage details
                const result_soldior = await client.query(`
                    SELECT 
						r.nameroom,
                        namesoldier, 
                        country, 
                        TO_CHAR(date_accommodation, 'Mon DD, YYYY') AS date_accommodation, 
                        TO_CHAR(date_free, 'Mon DD, YYYY') AS date_free,
                        meal_card,
						code
                    FROM 
                        soldier s
                    LEFT JOIN laundrybags lb ON lb.id = s.laundry_bag_id
					LEFT JOIN roomskey rk ON rk.keyid = s.used_room
					LEFT JOIN rooms r ON r.id = rk.roomid
                    WHERE 
                        country <> 'None';`);

                // Query for bike usage details
                const result_move = await client.query(`
                    SELECT 
                        current_rooms.nameroom AS current_room,
                        previous_rooms.nameroom AS previous_room,
                        soldier_name.namesoldier AS name_soldier,
                        TO_CHAR(ms.datemove, 'YYYY-MM-DD') AS datemove
                    FROM 
                        movesoldier ms
                    JOIN 
                        key k_current ON ms.idnewkey = k_current.id
                    JOIN 
                        roomskey rk_current ON k_current.id = rk_current.keyid
                    JOIN 
                        rooms current_rooms ON current_rooms.id = rk_current.roomid
                    JOIN 
                        key k_previous ON ms.idpreviewkey = k_previous.id
                    JOIN 
                        roomskey rk_previous ON k_previous.id = rk_previous.keyid
                    JOIN 
                        rooms previous_rooms ON previous_rooms.id = rk_previous.roomid
                    JOIN 
                        soldier soldier_name ON soldier_name.id = ms.idsoldier;`);

                const data = result_soldior.rows;
                const data_move = result_move.rows;

                await client.query('COMMIT');
                res.json({ data, data_move });

            } catch (error) {
                await client.query('ROLLBACK');
                console.log('Error:', error);
                res.status(500).send('An error occurred');
            } finally {
                client.release();
            }
        });

        this.app.post("/accommodation/report", this.isLoggedIn.bind(this), async (req, res) => {

            const { result, result_nationality } = req.body;

            if (!Array.isArray(result) || !Array.isArray(result_nationality)) {
                return res.status(400).send('Invalid input data.');
            }

            try {

                const workbook = new excelJS.Workbook();
                const worksheet1 = workbook.addWorksheet('Information about soldiers');
                const worksheet2 = workbook.addWorksheet('Movement soldiers information');

                const headers1 = ['Room Number', 'Soldier Name', 'Country', 'Accommodation Date', 'Release Date', 'Meal card', 'Laundry bag'];
                worksheet1.addRow(headers1).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                });

                const headers2 = ['Previous Room', 'New Room', 'Soldier', 'Date Relocation'];
                worksheet2.addRow(headers2).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                });

                worksheet1.columns = headers1.map(header => ({ header, width: header.length + 10 }));
                worksheet2.columns = headers2.map(header => ({ header, width: header.length + 10 }));

                result.forEach(({ roomNumber, soldierName, country, dateIn, dateOut, mealCard, laundryBag }) => {
                    worksheet1.addRow([roomNumber, soldierName, country, dateIn, dateOut, mealCard, laundryBag]);
                });

                result_nationality.forEach(({ oldRoom, newRoom, soldierName, dateRelock }) => {
                    worksheet2.addRow([oldRoom, newRoom, soldierName, dateRelock]);
                });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="report_accommodation.xlsx"');

                await workbook.xlsx.write(res);
                res.end();

            } catch (error) {
                console.error(error);
                res.status(500).send('Failed to generate the report.');
            }

        });

        this.app.post("/accommodation/moveSoldier", this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaMoveSoldier.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const { keyId, soldId, keyMoveId, soldMoveId } = req.body;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                if (soldMoveId) {
                    await client.query("INSERT INTO movesoldier VALUES ($1, $2, $3, CURRENT_DATE);", [keyMoveId, keyId, soldId]);
                    await client.query("INSERT INTO movesoldier VALUES ($1, $2, $3, CURRENT_DATE);", [keyId, keyMoveId, soldMoveId]);

                    await client.query("UPDATE key SET soldierid = $1 WHERE id = $2;", [soldId, keyMoveId]);
                    await client.query("UPDATE key SET soldierid = $1 WHERE id = $2;", [soldMoveId, keyId]);

                } else {
                    await client.query("INSERT INTO movesoldier VALUES ($1, $2, $3, CURRENT_DATE);", [keyMoveId, keyId, soldId]);

                    await client.query("UPDATE key SET soldierid = $1 WHERE id = $2;", [soldId, keyMoveId]);
                    await client.query("UPDATE key SET soldierid = NULL WHERE id = $1;", [keyId]);
                }

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Move soldier ${soldId} from room ${keyId} to room ${keyMoveId}`]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The soldier has been successfully moved' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error:', error);
                res.status(500).send('An error occurred');

            } finally {
                client.release();
            }

        });

        this.app.post('/accommodation/addSoldier', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddSoldier.validate(req.body);
            if (error) {
                return res.status(400).json({ message: "Invalid syntax. The value must contain only the letter and number character" });
            }

            const { soldierId, soldierName, soldierCountry } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                // Inside the backend function, when checking for duplicates
                const result = await client.query("SELECT * FROM soldier WHERE id = $1;", [soldierId]);

                if (result.rows.length > 0) {
                    // Duplicate soldierId found
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Soldier with id: '${soldierId}' already exists.` });
                }

                await client.query("INSERT INTO soldier VALUES ($1, $2, $3, NULL, NULL);", [soldierId, soldierName, soldierCountry]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Add soldier ${soldierName}`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Data saved successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.log('Error:', error);
                res.status(500).send('An error occurred');
            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/removeSoldier', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveSoldier.validate(req.body);
            if (error) {
                return res.status(400).json({ message: "Invalid syntax. The value must contain only the letter and number character" });
            }

            const { code } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                await client.query("DELETE FROM movesoldier WHERE idsoldier = $1;", [code]);
                await client.query("DELETE FROM key WHERE soldierid = $1;", [code]);
                await client.query("DELETE FROM fitness WHERE soldierid = $1", [code]);
                await client.query("DELETE FROM bikesoldier WHERE soldierid = $1", [code]);
                await client.query("DELETE FROM soldier WHERE id = $1;", [code]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Remove soldier ${code}`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Soldier removed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.log('Error:', error);
                res.status(500).json({ message: 'An error occurred' });
            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/editSoldier', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditSoldier.validate(req.body);
            if (error) {
                return res.status(400).json({ message: "Invalid syntax. The value must contain only the letter and number character" });
            }

            const { soldierId, soldierNewId, soldierName, soldierCountry } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query("SELECT * FROM soldier WHERE id = $1;", [soldierNewId]);

                if (soldierId !== soldierNewId && result.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Soldier with id: '${soldierNewId}' already exists.` });
                }

                if (soldierId === soldierNewId)
                    await client.query("UPDATE soldier SET namesoldier = $1, country = $2 WHERE id = $3;", [soldierName, soldierCountry, soldierId]);
                else {
                    await client.query("INSERT INTO soldier VALUES ($1, $2, $3, NULL, NULL);", [soldierNewId, soldierName, soldierCountry]);
                    await client.query("UPDATE movesoldier SET idsoldier = $1 WHERE idsoldier = $2;", [soldierNewId, soldierId]);
                    await client.query("UPDATE key SET soldierid = $1 WHERE soldierid = $2;", [soldierNewId, soldierId]);
                    await client.query("UPDATE fitness SET soldierid = $1 WHERE soldierid = $2;", [soldierNewId, soldierId]);
                    await client.query("UPDATE bikesoldier SET soldierid = $1 WHERE soldierid = $2;", [soldierNewId, soldierId]);
                    await client.query("DELETE FROM soldier WHERE id = $1;", [soldierId]);
                }

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Edit soldier ${soldierId}`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Data saved successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.log('Error:', error);
                res.status(500).json({ message: 'An error occurred' });
            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/uploadSoldier', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {
            const client = await pool.connect();
            const errors = [];

            try {
                await client.query('BEGIN');

                if (!req.file) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'No file uploaded.' });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                // Set to track unique soldierIds in the file
                const seenIds = new Set();

                await Promise.all(data.map(async (row, index) => {
                    const { error } = schemaAddSoldier.validate(row);

                    if (error) {
                        errors.push({ type: 'Validation', details: error.details, row, index });
                        return;
                    }

                    // Check for duplicates within the file
                    if (seenIds.has(row.soldierId)) {
                        errors.push({ type: 'DuplicateInFile', row, index, message: `Duplicate soldierId '${row.soldierId}' in the file.` });
                        return;
                    }
                    seenIds.add(row.soldierId);

                    // Check for duplicates in the database
                    const result = await client.query("SELECT * FROM soldier WHERE id = $1;", [row.soldierId]);
                    if (result.rows.length > 0) {
                        errors.push({ type: 'DuplicateInDB', soldierId: row.soldierId, message: `Soldier '${row.soldierName}' already exists.` });
                    }
                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row) => {
                    await client.query("INSERT INTO soldier VALUES ($1, $2, $3, NULL, NULL);", [row.soldierId, row.soldierName, row.soldierCountry]);
                }));

                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Add multi soldier`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ error: 'An error occurred while processing the file.' });
            } finally {
                client.release();
            }
        });

        this.app.get('/accommodation/uploadSoldier/download', async (req, res) => {

            // Create a new Excel workbook
            const workbook = new excelJS.Workbook();

            // Sheet 1: Soldier Data
            const worksheet = workbook.addWorksheet('Add Multipul Soldiers');

            // Add custom column titles for the first sheet
            const headers = ['soldierId', 'soldierName', 'soldierCountry'];
            const headerRow = worksheet.addRow(headers);

            // Apply styling to the headers
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, size: 12 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });

            // Set column widths for sheet 1
            worksheet.columns = [
                { width: 12 }, // Row Number
                { width: 20 }, // Bike Name
                { width: 25 }, // Soldier Name
                { width: 20 } // Time Range
            ];

            // Set the response headers for file download
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=templateAddSoldier.xlsx');

            // Write the workbook to the response stream
            await workbook.xlsx.write(res);
            res.end(); // End the response

        });

        this.app.get('/accommodation/multiSoldier/download', this.isLoggedIn.bind(this), async (req, res) => {

            // Connect to PostgreSQL
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Query data
                const result = await client.query(`
                SELECT nameKey, k.id AS keyNumber, namesoldier AS soldierId, meal_card AS mealCard, laundry_bag_id AS laundryBag
                FROM rooms r
                LEFT JOIN roomskey rk ON r.id = rk.roomid
                LEFT JOIN key k ON k.id = rk.keyid
                LEFT JOIN soldier s ON s.id = k.soldierid
                LEFT JOIN buildroom br ON br.roomid = r.id
                LEFT JOIN buildings b ON br.buildid = b.id
                JOIN assets a ON a.location_key = k.id
                WHERE nameroom NOT LIKE '%/E_' AND SUBSTRING(nameroom, POSITION('/E' IN nameroom) + 2, 1) BETWEEN '0' AND '9'
                AND nameroom NOT LIKE '%/D_' AND SUBSTRING(nameroom, POSITION('/D' IN nameroom) + 2, 1) BETWEEN '0' AND '9'
				AND namesoldier IS NULL AND k.id IS NOT NULL AND b.type = 'Accommodation'
                ORDER BY nameroom, namekey;`);

                const data = result.rows;

                // Create a new Excel workbook
                const workbook = new excelJS.Workbook();

                // Sheet 1: Accommodation Multipul Soldiers
                const worksheet = workbook.addWorksheet('Accommodation Multipul Soldiers');

                // Add column headers (modify based on your table structure)
                worksheet.columns = Object.keys(data[0]).map((key) => ({
                    header: key,
                    key: key,
                    width: 15,
                }));

                // Add rows
                data.forEach((row) => {
                    worksheet.addRow(row);
                });

                // Set the response headers for file download
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=templateAccommodationSoldier.xlsx');

                // Write the workbook to the response stream
                await workbook.xlsx.write(res);

                await client.query('COMMIT');
                res.end(); // End the response

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ error: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/uploadMultiSoldier', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {

            const client = await pool.connect();
            const errors = [];
            const bagSet = [];

            try {

                await client.query('BEGIN');

                if (!req.file) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'No file uploaded.' });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                // Create a Set to track unique soldier IDs within the data array
                const uniqueSoldierIds = new Set();

                await Promise.all(data.map(async (row) => {

                    if (!row.soldierid) {
                        return;
                    }

                    const { error } = schemaUploadSoldier.validate(row);

                    if (error) {
                        errors.push({ type: 'Validation', details: error.details, row });
                        return;
                    }

                    // Check for duplicates within the data array
                    if (uniqueSoldierIds.has(row.soldierid)) {
                        errors.push({ type: 'UniqueIdCheck', message: `Duplicate soldierId '${row.soldierid}' found within the data.` });
                        return;
                    }

                    // Add soldier ID to the Set after checking
                    uniqueSoldierIds.add(row.soldierid);

                    // Inside the backend function, when checking for duplicates
                    const result = await client.query("SELECT * FROM soldier WHERE id = $1 AND date_accommodation IS NOT NULL AND date_free IS NULL;",
                        [row.soldierid]);

                    const result_exist = await client.query("SELECT * FROM soldier WHERE id = $1;", [row.soldierid]);

                    if (result.rows.length > 0) {
                        // Duplicate soldierId found
                        errors.push({ type: 'CheckId', message: `Soldier with number '${row.soldierid}' is already accommodation.` });
                        return;
                    }

                    if (result_exist.rows.length === 0) {
                        errors.push({ type: 'CheckExist', message: `Soldier with number '${row.soldierid}' is not exists.` });
                        return;
                    }

                    if(!row.laundrybag) {
                        return;
                    }

                    const result_check_bag = await client.query("SELECT * FROM laundrybags where code = $1;", [row.laundrybag]);

                    if (result_check_bag.rows.length === 0) {
                        errors.push({ type: 'CheckBag', message: `The bag with number '${row.laundrybag}' is not exists.` });
                        return;

                    } else {
                        bagSet.push({ id: result_check_bag.rows[0].id, code: result_check_bag.rows[0].code });
                    }

                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row) => {

                    if (!row.soldierid) {
                        return;
                    }

                    const mealCardValue = row.mealcard ? row.mealcard : null;
                    const laundryBagValue = row.laundrybag
                        ? bagSet.find(code => code.code === row.laundrybag)?.id
                        : null;

                    await client.query(
                        "UPDATE key SET soldierid = $1 WHERE id = $2;",
                        [row.soldierid, row.keynumber]
                    );

                    await client.query(
                        "UPDATE soldier SET date_accommodation = CURRENT_DATE, meal_card = $2, laundry_bag_id = $3, used_room = $4 WHERE id = $1;",
                        [row.soldierid, mealCardValue, laundryBagValue, row.keynumber]
                    );

                }));

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Accommodated multi soldier`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing file:', error);
                res.status(500).json({ error: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/deleteSoldier', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaReleaseAllRoom.validate(req.body);
            if (error) {
                return res.status(400).json({ message: "Invalid syntax. The value must contain only the letter and number character" });
            }

            const { buildId } = req.body;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const res_query = await client.query(
                    `SELECT k.id, soldierid FROM key k
                        LEFT JOIN soldier s ON s.id = k.soldierid
                        LEFT JOIN roomskey rk ON rk.keyid = k.id
                        LEFT JOIN buildroom br ON br.roomid = rk.roomid
                        WHERE soldierid IS NOT NULL AND country <> 'None' AND buildid = $1;`, [buildId]
                );

                if (res_query.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: "This building is empty!" });
                }

                for (const row of res_query.rows) {

                    const queries = [];

                    queries.push(client.query(
                        "UPDATE soldier SET date_free = CURRENT_DATE WHERE id = $1;",
                        [row.soldierid]
                    ));

                    queries.push(client.query(
                        "UPDATE key SET soldierid = NULL WHERE id = $1;",
                        [row.id]
                    ));

                    await Promise.all(queries);
                }

                await client.query(
                    "INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, 'Release all soldier']
                );

                await client.query('COMMIT');
                return res.status(200).json({ message: 'All rooms are vacated' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing deleteSoldier:', error.message, error.stack);
                res.status(500).json({ error: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/addDestination', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddDestination.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { buildId, buildName, buildType } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_build = await client.query(
                    `SELECT * FROM buildings WHERE id = $1;`, [buildId]
                );

                if (result_build.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This destination already exists!' });
                }

                await client.query(
                    `INSERT INTO buildings VALUES ($1, $2, $3);`, [buildId, buildName, buildType]
                );

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Add destination ${buildName}`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Add destination is successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error add destination:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/removeDestination', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveDestination.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { buildId } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                await client.query("DELETE FROM buildings WHERE id = $1;", [buildId]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Remove destination ${buildId}`]);

                await client.query('COMMIT');
                return res.status(200).send();

            } catch (error) {
                await client.query('ROLLBACK');
                res.status(500).json({ message: 'Failed to delete destination. Please remove all rooms and try again.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/addRoomToDestination', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRoomToDestination.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { roomId, roomName, clickBuild } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const buildingName = clickBuild ?? roomName.split('/')[0];

                const result_build = await client.query(
                    `SELECT * FROM rooms WHERE id = $1;`, [roomId]
                );

                if (result_build.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This room already exists!' });
                }

                await client.query("INSERT INTO rooms VALUES ($1, $2)", [roomId, roomName]);
                await client.query("INSERT INTO buildroom VALUES ($1, $2)", [buildingName, roomId]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Add room ${roomName} to ${buildingName}`]);

                await client.query('COMMIT');
                return res.status(200).send({ message: `The room ${roomName} was added into building ${buildingName}.` });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error add destination:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/specialRooms', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaSpecialRoom.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { numBuild } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                var result;

                if (numBuild) {

                    result = await client.query(`
                    SELECT r.* 
                    FROM rooms r
                    LEFT JOIN buildroom br ON br.roomid = r.id
                    WHERE br.buildid = $1
                    AND nameroom NOT SIMILAR TO '%/(E|D)[0-9]%';`, [numBuild]);

                } else {

                    result = await client.query(`
                        SELECT r.* 
                        FROM rooms r
                        WHERE nameroom SIMILAR TO '%/(E|D)[0-9]%';`);
                }

                const result_room_data = result.rows;
                let total_res = [];

                result_room_data.forEach(row => {
                    total_res.push({ id: row.id, name: row.nameroom });
                });

                await client.query('COMMIT');
                return res.status(200).send(total_res);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error add destination:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/specialKeys', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaSpecialKey.validate(req.body);
            if (error) {
                console.error(error);
                return res.status(400).send({ message: error.details[0].message });
            }

            const { numBuild, numRoom } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                var result;

                if (numBuild === 'D') {

                    result = await client.query(`
                    SELECT k.*
                    FROM key k
                    LEFT JOIN roomskey rk ON rk.keyid = k.id
                    LEFT JOIN rooms r ON r.id = rk.roomid
                    WHERE r.id = $1
                    AND r.nameroom SIMILAR TO '%/(D)[0-9]%';`, [numRoom]);

                } else if (numBuild === 'E') {

                    result = await client.query(`
                    SELECT k.*
                    FROM key k
                    LEFT JOIN roomskey rk ON rk.keyid = k.id
                    LEFT JOIN rooms r ON r.id = rk.roomid
                    WHERE r.id = $1
                    AND r.nameroom SIMILAR TO '%/(E)[0-9]%';`, [numRoom]);

                } else {

                    result = await client.query(`
                    SELECT k.*
                    FROM key k
					LEFT JOIN roomskey rk ON rk.keyid = k.id
					LEFT JOIN rooms r ON r.id = rk.roomid
                    WHERE r.id = $1
                    AND r.nameroom NOT SIMILAR TO '%/(E|D)[0-9]%';`, [numRoom]);
                }

                const result_key_data = result.rows;
                let total_res = [];

                result_key_data.forEach(row => {
                    total_res.push({ id: row.id, name: row.namekey });
                });

                await client.query('COMMIT');
                return res.status(200).send(total_res);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error add destination:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/keys', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT k.id, k.namekey, s.namesoldier, s.country, s.meal_card, l.code, r.nameroom, r.id AS roomid FROM key k
                    LEFT JOIN soldier s ON s.id = k.soldierid
                    LEFT JOIN laundrybags l ON l.id = s.laundry_bag_id
					LEFT JOIN roomskey rk ON rk.keyid = k.id
					LEFT JOIN rooms r ON rk.roomid = r.id
					JOIN assets a ON a.location_key = k.id;`);

                const result_key_data = result.rows;
                let total_res = [];

                result_key_data.forEach(row => {
                    total_res.push({
                        id: row.id,
                        name: row.namekey,
                        soldierName: row.namesoldier ? row.namesoldier : 'Free',
                        country: row.country ? row.country : 'Undefined',
                        maleCard: row.meal_card ? row.meal_card : 'Undefined',
                        laundryBag: row.code ? row.code : 'Undefined',
                        roomid: row.roomid,
                        nameroom: row.nameroom
                    });
                });

                await client.query('COMMIT');
                return res.status(200).send(total_res);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error add destination:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/removeRoomToDestination', async (req, res) => {

            const { error } = schemaRemoveRoom.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { roomId } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                await client.query(`DELETE FROM buildroom WHERE roomid = $1;`, [roomId]);
                await client.query(`DELETE FROM rooms WHERE id = $1;`, [roomId]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Remove room ${roomId}`]);

                await client.query('COMMIT');
                return res.status(200).send({ message: `The room was removed successfully.` });

            } catch (error) {
                await client.query('ROLLBACK');
                res.status(500).json({ message: 'Failed to delete room. Please remove all keys and assets in this room and try again.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/addKeyToRoom', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaKeyToRoom.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { keyId, keyName, selectedRoomForKey } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_key = await client.query(
                    `SELECT * FROM key WHERE id = $1;`, [keyId]
                );

                if (result_key.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This key already exists!' });
                }

                await client.query("INSERT INTO key VALUES ($1, $2)", [keyId, keyName]);
                await client.query("INSERT INTO roomskey VALUES ($1, $2)", [selectedRoomForKey, keyId]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Add key ${keyName} to room ${selectedRoomForKey}`]);

                await client.query('COMMIT');
                return res.status(200).send({ message: `The key ${keyName} was added into this building.` });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error add destination:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/removeKeyToRoom', async (req, res) => {
            const { error } = schemaRenameKey.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { oldKeyId, newKeyId } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const check_new_key = await client.query(`SELECT * FROM key WHERE id = $1`, [newKeyId]);

                if (check_new_key.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).send({ message: 'This key already exists' });
                }

                await client.query(`
                    INSERT INTO key VALUES (
                        $1, 
                        (SELECT namekey FROM key WHERE id = $2), 
                        (SELECT soldierid FROM key WHERE id = $2));`, [newKeyId, oldKeyId]);

                // Update key IDs in relevant tables
                await client.query(`
                    UPDATE roomskey
                    SET keyid = $1
                    WHERE keyid = $2;`, [newKeyId, oldKeyId]);

                await client.query(`
                    UPDATE movesoldier
                    SET 
                        idnewkey = CASE WHEN idnewkey = $2 THEN $1 ELSE idnewkey END,
                        idpreviewkey = CASE WHEN idpreviewkey = $2 THEN $1 ELSE idpreviewkey END; `, [newKeyId, oldKeyId]);

                await client.query(`
                    UPDATE assets
                    SET 
                        location_key = CASE WHEN location_key = $2 THEN $1 ELSE location_key END;`, [newKeyId, oldKeyId]);

                await client.query(`DELETE FROM key WHERE id = $1;`, [oldKeyId])

                // Log user action
                await client.query(`
                    INSERT INTO usermonitoring (user_id, location) 
                    VALUES (
                        (SELECT id FROM users WHERE username = $1),
                        $2
                    )
                `, [req.session.username, `Replace key ${oldKeyId} with ${newKeyId}`]);

                await client.query('COMMIT');
                return res.status(200).send({ message: `The key was replaced successfully.` });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Error during key replacement:', err.message);
                return res.status(500).json({ message: 'Failed to replace key. Try again later.' });

            } finally {
                client.release();
            }
        });
    }

    defineRoutesFitnes() {

        this.app.post('/sendClientData', async (req, res) => {
            // Validate the request body using Joi
            const { error } = clientDataSchema.validate(req.body);

            if (error) {
                // If validation fails, return 400 with the error message
                return res.status(400).json({ message: error.details[0].message });
            }

            const { userId } = req.body;

            if (!userId) {
                return res.status(400).json({ message: 'User ID is required.' });
            }

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                // Save data to the database and get the inserted id
                const query = 'INSERT INTO fitness (id, soldierid) VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM fitness), $1) RETURNING id';
                const values = [userId];
                const result = await client.query(query, values);

                // Extract the inserted id
                const soldierId = result.rows[0].id;

                // Save the soldierId in the session
                req.session.soldierid = soldierId;

                // Respond with a success message
                await client.query('COMMIT');
                res.status(200).json({ message: 'Client saved successfully', soldierId });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error inserting data:', error);
                res.status(500).json({ message: 'Error saving client data to the database' });

            } finally {
                client.release();
            }
        });

        this.app.post('/sendEmojiData', async (req, res) => {
            // Validate the request body using Joi
            const { error } = emojiDataSchema.validate(req.body);

            if (error) {
                // If validation fails, return 400 with the error message
                return res.status(400).json({ message: error.details[0].message });
            }

            const { emoji } = req.body;

            if (!emoji) {
                return res.status(400).json({ message: 'Emoji is required.' });
            }

            // Check if soldierId exists in the session
            const soldierId = req.session.soldierid;

            if (!soldierId) {
                return res.status(400).json({ message: 'Soldier ID not found in session.' });
            }

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                // Update the fitness table with the emoji
                const query = 'UPDATE fitness SET emoji = $2 WHERE id = $1';
                const values = [soldierId, emoji];
                await client.query(query, values);

                // Respond with a success message
                await client.query('COMMIT');
                res.status(200).json({ message: 'Emoji saved successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error updating data:', error);
                res.status(500).json({ message: 'Error saving emoji data to the database' });

            } finally {
                client.release();
            }
        });

        this.app.get('/fitness', this.isLoggedIn.bind(this), async (req, res) => {

            // Get a client from the pool
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const data_emoji = await client.query(`
                    SELECT 
                        CASE
                            WHEN AVG(CASE
                                WHEN f.emoji = '😞' THEN 1
                                WHEN f.emoji = '😐' THEN 2
                                WHEN f.emoji = '😁' THEN 3
                                ELSE NULL
                            END) <= 1.5 THEN '😞'
                            WHEN AVG(CASE
                                WHEN f.emoji = '😞' THEN 1
                                WHEN f.emoji = '😐' THEN 2
                                WHEN f.emoji = '😁' THEN 3
                                ELSE NULL
                            END) <= 2.5 THEN '😐'
                            ELSE '😁'
                        END AS average_emoji,
                        f.created_at::date AS created_date,
                        COUNT(f.soldierid) AS soldier_count
                    FROM fitness f
                    LEFT JOIN soldier s ON f.soldierid = s.id
                    GROUP BY s.namesoldier, created_date
                    ORDER BY created_date;`);

                const result_percent_emoji = await client.query(`
                    SELECT 
                        COUNT(CASE WHEN f.emoji = '😞' THEN 1 END) AS percent_sad,
                        COUNT(CASE WHEN f.emoji = '😐' THEN 1 END) AS percent_neutral,
                        COUNT(CASE WHEN f.emoji = '😁' THEN 1 END) AS percent_very_happy
                    FROM fitness f`);

                const data = data_emoji.rows;
                const dataPerEmj = result_percent_emoji.rows[0];

                await client.query('COMMIT');

                switch (req.session.username) {
                    case 'guest':
                        this.giveSpecificPermissionFitness(req.session.username, [0, 4, 5], res, data, dataPerEmj);
                        break;

                    case 'admin':
                        this.giveSpecificPermissionFitness(req.session.username, [0, 1, 2, 3, 4, 5, 6], res, data, dataPerEmj);
                        break;

                    default:
                        this.giveSpecificPermissionFitness(req.session.username, [0, 2, 3, 4, 5, 6], res, data, dataPerEmj);
                        break;
                }

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error inserting data:', error);
                res.status(500).json({ message: 'Error saving emoji data to the database' });

            } finally {
                client.release();
            }
        });

        this.app.post('/getAllEmoji', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = getAllEmojiSchema.validate(req.body);

            if (error) {
                // If validation fails, return 400 with the error message
                return res.status(400).json({ message: error.details[0].message });
            }

            const { date1, date2 } = req.body;

            // Get a client from the pool
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                // Query for emoji data based on the date range
                const data_emoji = await client.query(`
                SELECT 
                    CASE
                            WHEN AVG(CASE
                                WHEN f.emoji = '😞' THEN 1
                                WHEN f.emoji = '😐' THEN 2
                                WHEN f.emoji = '😁' THEN 3
                                ELSE NULL
                            END) <= 1.5 THEN '😞'
                            WHEN AVG(CASE
                                WHEN f.emoji = '😞' THEN 1
                                WHEN f.emoji = '😐' THEN 2
                                WHEN f.emoji = '😁' THEN 3
                                ELSE NULL
                            END) <= 2.5 THEN '😐'
                            ELSE '😁'
                    END AS average_emoji,
                    f.created_at::date AS created_date,
                    COUNT(f.soldierid) AS soldier_count
                FROM fitness f
                LEFT JOIN soldier s ON f.soldierid = s.id
                WHERE f.created_at::date BETWEEN $1 AND $2
                GROUP BY s.namesoldier, created_date
                ORDER BY created_date;`, [date1, date2]);

                const data_emoji_total = await client.query(`
                    SELECT 
                        COUNT(CASE WHEN f.emoji = '😞' THEN 1 END) AS percent_sad,
                        COUNT(CASE WHEN f.emoji = '😐' THEN 1 END) AS percent_neutral,
                        COUNT(CASE WHEN f.emoji = '😁' THEN 1 END) AS percent_very_happy
                    FROM fitness f
                    WHERE f.created_at::date BETWEEN $1 AND $2`, [date1, date2]);

                const total_data = data_emoji_total.rows[0];
                const data = data_emoji.rows;

                await client.query('COMMIT');
                res.status(200).json({ data: data, total_data: total_data });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error fetching emoji data:', error);
                res.status(500).json({ message: 'Error fetching emoji data from the database' });
            } finally {
                client.release();
            }
        });

        this.app.post('/fitness/report', this.isLoggedIn.bind(this), async (req, res) => {
            try {
                const { data } = req.body;

                // Create a new Excel workbook
                const workbook = new excelJS.Workbook();
                const worksheet = workbook.addWorksheet('Gym Usage Data');

                // Define headers
                const headers = ['Date', 'Average Emoji Rating', 'Number of Visits'];
                worksheet.addRow(headers).eachCell((cell) => {
                    cell.font = { bold: true, size: 12 };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                // Set column widths
                worksheet.columns = [
                    { width: 20 }, // Date
                    { width: 20 }, // Average Emoji Rating
                    { width: 20 }, // Number of Visits
                ];

                // Populate data rows
                data.forEach((row, index) => {
                    const formattedDate = row[0]; // Use the sent date from front-end
                    const averageEmoji = row[1]; // Use the sent average rating
                    const soldierCount = row[2]; // Use the sent number of visits

                    const dataRow = worksheet.addRow([formattedDate, averageEmoji, soldierCount]);

                    // Style each cell
                    dataRow.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' },
                        };
                    });

                    // Apply alternating row color
                    if (index % 2 === 0) {
                        dataRow.eachCell((cell) => {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFDDDDDD' }, // Light grey
                            };
                        });
                    }
                });

                // Set headers for file download
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="report_gym.xlsx"');

                // Write the Excel file to the response
                await workbook.xlsx.write(res);
                res.end();

            } catch (error) {
                console.error('Error generating Excel report:', error);
                res.status(500).send('Failed to generate report.');
            }
        });
    }

    defineRoutesLaundry() {

        const statusMapping = {
            'drop off': 'avg_drop_off_duration',
            'transportation to laundry facility': 'avg_transportation_duration',
            'laundry facility': 'avg_laundry_duration',
            'transportation to drop off': 'avg_transportation_drop_off_duration',
            'ready to pick up': 'avg_ready_to_pick_up_duration'
        };

        function formatTime(seconds) {
            if (!seconds || seconds <= 0) return '0 mins';

            const days = Math.floor(seconds / (24 * 3600));
            const hours = Math.floor((seconds % (24 * 3600)) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);

            let timeString = '';

            if (days > 0) timeString += `${days} day${days > 1 ? 's' : ''}, `;
            if (hours > 0) timeString += `${hours} hour${hours > 1 ? 's' : ''}, `;
            timeString += `${minutes} min${minutes > 1 ? 's' : ''}`;

            return timeString;
        }

        // Serve APK file from local directory
        this.app.get('/download-apk-laundry', this.isLoggedIn.bind(this), (req, res) => {
            // Path to your APK file
            const apkFilePath = path.join(__dirname, 'androidApp', 'RFIDLaundryReader-1.0-release.apk');

            // Check legality and existence of the APK file
            if (!this.checkApkFileLegality(apkFilePath, res)) {
                return;
            }

            // Set proper headers for an APK file
            res.setHeader('Content-Type', 'application/vnd.android.package-archive'); // Correct MIME type for APK
            res.setHeader('Content-Disposition', 'attachment; filename="RFIDLaundryReader-1.0-release.apk"'); // Force download with custom filename

            // Use res.download() to send the file to the client
            res.download(apkFilePath, (err) => {
                if (err) {
                    console.error('Error downloading the file:', err);
                    res.status(500).send('Error downloading the file');
                }
            });
        });

        this.app.get('/laundry', this.isLoggedIn.bind(this), async (req, res) => {
            const client = await pool.connect();
            let overallTotalMountFormatted = 0;

            try {

                await client.query('BEGIN');

                // Query to get the count of bags grouped by status and type
                const result = await client.query(`
                    SELECT
                        status,
                        type,
                        COUNT(*) AS count,
                        SUM(laundrycount) AS sum
                    FROM laundrybags
                    GROUP BY status, type;`);

                const bagData = {};
                const totalCounts = {};
                const avgTimeData = {};

                const headerTable = [
                    { name: "Bag code" },
                    { name: "Date of entry" },
                    { name: "Soldier" },
                    { name: "Status" }
                ];

                let totalAvgTimeInSeconds = 0;
                let count = 0;

                // Process the count data
                result.rows.forEach(row => {
                    const { status, type, count, sum } = row;
                    const normalizedStatus = status.toLowerCase().trim();

                    if (!bagData[normalizedStatus]) {
                        bagData[normalizedStatus] = [];
                        totalCounts[normalizedStatus] = 0;
                    }

                    bagData[normalizedStatus].push({ type, count });
                    totalCounts[normalizedStatus] += parseInt(count);

                    // Ensure overallTotalMountFormatted is an integer
                    overallTotalMountFormatted += parseInt(sum);  // Or use parseInt(sum)
                });

                for (const [status, column] of Object.entries(statusMapping)) {
                    const query = `
                        SELECT ${column} as value
                        FROM laundrybags
                        WHERE ${column} <> 0
                        GROUP BY ${column};`;

                    try {
                        const results = await client.query(query);
                        var updatedTime;

                        if (results.rows.length > 0) {
                            updatedTime = results.rows[0].value;
                            totalAvgTimeInSeconds += parseInt(updatedTime, 10) || 0;
                            count += 1;
                        } else {
                            updatedTime = 0;
                        }

                        avgTimeData[status] = formatTime(updatedTime);

                    } catch (error) {
                        console.error(`Error executing query for status "${status}":`, error);
                    }
                }

                const overallAverageTimeInSeconds = count > 0 ? Math.floor(totalAvgTimeInSeconds / count) : 0;
                const overallAverageFormatted = formatTime(overallAverageTimeInSeconds);

                await client.query('COMMIT');

                switch (req.session.username) {
                    case 'guest':
                        this.giveSpecificPermissionLaundry(req.session.username, [0, 4, 5], res, bagData, totalCounts, avgTimeData, overallAverageFormatted, headerTable, overallTotalMountFormatted);
                        break;
                    case 'helpDeskGatis':
                        this.giveSpecificPermissionLaundry(req.session.username, [0, 2, 5], res, bagData, totalCounts, avgTimeData, overallAverageFormatted, headerTable, overallTotalMountFormatted);
                        break;
                    case 'admin':
                        this.giveSpecificPermissionLaundry(req.session.username, [0, 1, 2, 3, 4, 5, 6], res, bagData, totalCounts, avgTimeData, overallAverageFormatted, headerTable, overallTotalMountFormatted);
                        break;
                    default:
                        this.giveSpecificPermissionLaundry(req.session.username, [0, 2, 3, 4, 5, 6], res, bagData, totalCounts, avgTimeData, overallAverageFormatted, headerTable, overallTotalMountFormatted);
                        break;
                }

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error fetching bag types or average times:', error);
                res.status(500).send('Server Error');
            } finally {
                client.release();
            }
        });

        // POST route to handle RFID codes (only accessible after login)
        this.app.post('/check-bag', async (req, res) => {

            const { error } = checkBagsSchema.validate(req.body);

            if (error) {
                // If validation fails, return 400 with the error message
                return res.status(400).json({ message: error.details[0].message });
            }

            const { code } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(
                    'SELECT * FROM laundrybags WHERE id = $1',
                    [code] // Replace $1 with the scanned EPC code
                );

                if (result.rows.length > 0) {
                    await client.query('COMMIT');
                    res.json({ exists: true }); // Bag exists
                } else {
                    await client.query('COMMIT');
                    res.json({ exists: false }); // Bag does not exist
                }

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(err);
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }
        });

        this.app.post('/changeStatusBulk', async (req, res) => {

            const { error } = updateBagsScanerSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { codes, destination, prev_destination } = req.body;

            if (!Array.isArray(codes)) {
                return res.status(400).json({ message: "Invalid codes array" });
            }

            if (codes.length === 0) {
                return res.status(401).json({ message: "An empty list of scanned bags cannot be processed" });
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                if (prev_destination === 'None') {
                    const codesPlaceholder = codes.map((_, i) => `$${i + 1}`).join(', ');
                    const insertPromises = codes.map((code, index) =>
                        client.query(
                            `INSERT INTO laundryreport (bag_id, date_drop_off, date_ready_to_pick_up) VALUES ($1, CURRENT_TIMESTAMP, NULL) ON CONFLICT DO NOTHING;`,
                            [code]
                        )
                    );
                    await Promise.all(insertPromises);

                    await client.query(
                        `UPDATE laundrybags 
                         SET timein = NULL, timeout = NULL, avg_drop_off_duration = 0, avg_transportation_duration = 0,
                             avg_laundry_duration = 0, avg_ready_to_pick_up_duration = 0, avg_transportation_drop_off_duration = 0
                         WHERE id IN (${codesPlaceholder});`,
                        codes
                    );

                    await client.query(
                        `UPDATE laundrybags
                        SET laundrycount = laundrycount + 1
                        WHERE id IN (${codesPlaceholder});`,
                        codes
                    );
                }

                const codesPlaceholder = codes.map((_, i) => `$${i + 1}`).join(', ');
                await client.query(
                    `UPDATE laundrybags 
                     SET timeout = CURRENT_TIMESTAMP 
                     WHERE id IN (${codesPlaceholder});`,
                    codes
                );

                const avgTimeResult = await client.query(
                    `SELECT AVG(EXTRACT(EPOCH FROM (timeout - timein))) AS avg_time_in_seconds 
                     FROM laundrybags 
                     WHERE timeout IS NOT NULL AND timein IS NOT NULL AND status = $1;`,
                    [prev_destination]
                );

                const avgTimeRow = avgTimeResult.rows[0];
                if (avgTimeRow) {
                    const columnName = statusMapping[prev_destination.toLowerCase().trim()];
                    if (columnName) {
                        await client.query(
                            `UPDATE laundrybags 
                             SET ${columnName} = $1 
                             WHERE status = $2;`,
                            [Math.floor(avgTimeRow.avg_time_in_seconds), prev_destination]
                        );
                    }
                }

                if (destination !== 'None') {
                    const destinationParams = [destination, ...codes];
                    const codesPlaceholders = codes.map((_, i) => `$${i + 2}`).join(', ');
                    await client.query(
                        `UPDATE laundrybags 
                         SET status = $1, timein = CURRENT_TIMESTAMP 
                         WHERE id IN (${codesPlaceholders});`,
                        destinationParams
                    );

                    if (destination === 'Ready to pick up') {
                        const codesPlaceholders = codes.map((_, i) => `$${i + 1}`).join(', ');

                        await client.query(
                            `UPDATE laundryreport 
                            SET date_ready_to_pick_up = CURRENT_TIMESTAMP
                            WHERE bag_id IN (${codesPlaceholders}) AND date_ready_to_pick_up IS NULL;`,
                            codes
                        );
                    }

                } else {

                    const destinationParams = [destination, ...codes];
                    const codesPlaceholdersLaundrybags = codes.map((_, i) => `$${i + 2}`).join(', ');
                    await client.query(
                        `UPDATE laundrybags 
                         SET status = $1
                         WHERE id IN (${codesPlaceholdersLaundrybags});`,
                        destinationParams
                    );
                }

                await client.query('COMMIT');
                res.status(200).json({ message: "Bulk status change successful" });
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(err); // Log the error
                res.status(500).json({ message: "Internal server error" });
            } finally {
                client.release();
            }
        });

        this.app.post('/checkScaningCode', async (req, res) => {

            const { error } = checkScaningCodeSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { code, prev_destination, permCount } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                        SELECT l.code, s.namesoldier, l.status, l.laundrycount
                        FROM laundrybags l
                        JOIN soldier s ON s.laundry_bag_id = l.id
                        WHERE s.date_free IS NULL AND l.id = $1;`, [code]);

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: "Laundry bag not found" });
                }

                const bag = result.rows[0];

                // if (bag.laundrycount >= permCount) {
                //     await client.query('ROLLBACK');
                //     return res.status(402).json({ message: `Bag number ${bag.code} has already been laundered. The maximum laundry limit per month for one bag is ${permCount}` });
                // }

                const status = bag.status !== 'None' ? bag.status : 'Taking from soldier';
                const prev_stat = prev_destination !== 'None' ? prev_destination : 'Taking from soldier';

                if (bag.status !== prev_destination) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: `Status mismatch. Bag ${bag.code} is currently at ${status}, not ${prev_stat}.` });
                }

                await client.query('COMMIT');
                res.status(200).json({ code: bag.code, soldierId: bag.namesoldier });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(err); // Log detailed error for debugging
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }
        });

        this.app.post('/checkCountScanningCodes', async (req, res) => {

            const { error } = checkCountScaningCodesSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { countScaneCode, prev_destination } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                        SELECT *
                        FROM laundrybags l
                        JOIN soldier s ON s.laundry_bag_id = l.id
                        WHERE s.date_free IS NULL AND l.status = $1;`, [prev_destination]);

                const bag = result.rows;

                if (prev_destination !== 'None' && prev_destination !== 'Ready to pick up' && bag.length !== countScaneCode) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ request: false, message: `Not all bags are scanned. Please scan all ${bag.length} bags from the ${prev_destination}.` });
                }

                await client.query('COMMIT');
                res.status(200).json({ request: true });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(err); // Log detailed error for debugging
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }
        });

        this.app.post('/changeStatusConsole', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = updateBagsSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { code, destination, prev_destination } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT l.code, s.id, l.status, l.laundrycount, l.maxcountlandry
                    FROM laundrybags l
                    JOIN soldier s ON s.laundry_bag_id = l.id
                    WHERE s.date_free IS NULL AND l.id = $1;`, [code]);

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: "Laundry bag is in storage" });
                }

                // if (result.rows[0].laundrycount > result.rows[0].maxcountlandry) {
                //     await client.query('ROLLBACK');
                //     return res.status(403).json({ message: `This bag has exceeded the ${result.rows[0].maxcountlandry} wash per month limit` });
                // }

                const bag = result.rows[0];

                if (destination === 'Ready to pick up') {
                    await client.query(`
                        UPDATE laundryreport SET date_ready_to_pick_up = CURRENT_TIMESTAMP WHERE bag_id = $1 AND date_ready_to_pick_up IS NULL;`, [code]);
                }

                if (destination === 'None')
                    await client.query(`
                        UPDATE laundrybags SET status = $1 WHERE id = $2;`, [destination, code]);

                if (prev_destination === 'None') {

                    await client.query(`INSERT INTO laundryreport VALUES ($1, CURRENT_TIMESTAMP, NULL);`, [code]);

                    await client.query(`UPDATE laundrybags SET timein = NULL, timeout = NULL, avg_drop_off_duration = 0, avg_transportation_duration = 0,
                        avg_laundry_duration = 0, avg_ready_to_pick_up_duration = 0, avg_transportation_drop_off_duration = 0 WHERE id = $1;`, [code]);

                    await client.query(`
                        UPDATE laundrybags SET laundrycount = laundrycount + 1 WHERE id = $1;`, [code]);

                } else if (destination === 'None') {

                    await client.query(`UPDATE laundrybags SET timeout = CURRENT_TIMESTAMP WHERE id = $1;`, [code]);

                    const avgTimeResult = await client.query(`
                        SELECT AVG(EXTRACT(EPOCH FROM (timeout - timein))) AS avg_time_in_seconds
                        FROM laundrybags
                        WHERE timeout IS NOT NULL AND timein IS NOT NULL AND status = $1;`, [prev_destination]);

                    const avgTimeRow = avgTimeResult.rows[0];
                    if (avgTimeRow) {
                        const columnName = statusMapping[prev_destination.toLowerCase().trim()];
                        if (columnName) {
                            await client.query(`
                                UPDATE laundrybags
                                SET ${columnName} = $1
                                WHERE status = $2;`, [Math.floor(avgTimeRow.avg_time_in_seconds), prev_destination]);
                        }
                    }
                }

                await client.query(`
                    UPDATE laundrybags SET status = $1, timein = CURRENT_TIMESTAMP WHERE id = $2;`, [destination, code]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Change bag ${code} status from ${prev_destination} to ${destination}`]);

                await client.query('COMMIT');
                res.status(200).json({ code: bag.code, soldierId: bag.id, message: "The status of the bag has been changed" });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(err); // Log detailed error for debugging
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }
        });

        this.app.get('/checkLateBags', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT * 
                    FROM laundrybags 
                    WHERE status = 'Ready to pick up' 
                    AND timein < NOW() - INTERVAL '1 week';`);

                if (result.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "Latte bags!" });
                }

                await client.query('COMMIT');
                res.status(200).json({ message: "All is OK" });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(error);
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }
        });

        this.app.post('/getBagsByStatus', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaGetBagsByStatus.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { status } = req.body;

            const client = await pool.connect();
            let result;

            try {

                await client.query('BEGIN');

                result = await client.query(`
                    SELECT
                        l.id,
                        l.code, 
                        TO_CHAR(l.timein, 'YYYY-MM-DD HH24:MI') AS timein, 
                        s.namesoldier, 
                        CASE 
                            WHEN l.status = 'Ready to pick up' AND l.timein < NOW() - INTERVAL '1 week' THEN TRUE
                            ELSE FALSE
                        END AS islate
                    FROM 
                        laundrybags l
                    LEFT JOIN 
                        soldier s ON s.laundry_bag_id = l.id
                    WHERE 
                        s.date_free IS NULL AND 
                        l.status = $1
                    ORDER BY 
                        islate ASC;`, [status]);

                await client.query('COMMIT');
                // Send the result rows back to the client
                res.status(200).json(result.rows);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(error);
                res.status(500).json({ message: "Internal server error" });
            } finally {
                client.release();
            }
        });

        this.app.post('/laundry/viewReport', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaReport.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            let { selectedDate1, selectedDate2 } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                selectedDate1 += " 00:00";
                selectedDate2 += " 23:59";

                const result = await client.query(`
                    SELECT 
                        l.code,
                        l.type,
                        CASE 
                            WHEN status = 'None' THEN 'In the soldier'
                            ELSE l.status
                        END AS status,
                        s.namesoldier, 
                        s.country,
                        TO_CHAR(lr.date_drop_off, 'YYYY-MM-DD HH:MI') AS date_drop_off, 
                        CASE 
                            WHEN status = 'None' AND lr.date_ready_to_pick_up IS NULL THEN 'Remove by user'
                            ELSE TO_CHAR(lr.date_ready_to_pick_up, 'YYYY-MM-DD HH:MI')
                        END AS date_ready_to_pick_up
                    FROM laundrybags l
                    JOIN laundryreport lr ON lr.bag_id = l.id
                    JOIN soldier s ON l.id = s.laundry_bag_id
                    WHERE lr.date_drop_off BETWEEN $1 AND $2 
                    AND s.date_free IS NULL;`, [selectedDate1, selectedDate2]);

                const result_nationality = await client.query(`
                    SELECT 
                        COUNT(*) AS total_count_bags,
                        s.country
                    FROM laundrybags l
                    JOIN laundryreport lr ON lr.bag_id = l.id
                    JOIN soldier s ON l.id = s.laundry_bag_id
                    WHERE lr.date_drop_off BETWEEN $1 AND $2
                        AND s.date_free IS NULL
                    GROUP BY country;`, [selectedDate1, selectedDate2]);

                await client.query('COMMIT');
                res.status(200).json({ data: result.rows, data_nationality: result_nationality.rows });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(error);
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }
        });

        this.app.post('/laundry/report', this.isLoggedIn.bind(this), async (req, res) => {

            const { result, result_nationality } = req.body;

            if (!Array.isArray(result) || !Array.isArray(result_nationality)) {
                return res.status(400).send('Invalid input data.');
            }

            try {

                const workbook = new excelJS.Workbook();
                const worksheet1 = workbook.addWorksheet('Washed Bags');
                const worksheet2 = workbook.addWorksheet('Bags by Nationality');

                const headers1 = ['Bag number', 'Soldier name', 'Nationality', 'Bag type', 'Location', 'Date of issue', 'Collection date'];
                worksheet1.addRow(headers1).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                });

                const headers2 = ['Nationality', 'Number of Bags'];
                worksheet2.addRow(headers2).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                });

                worksheet1.columns = headers1.map(header => ({ header, width: header.length + 10 }));
                worksheet2.columns = headers2.map(header => ({ header, width: header.length + 10 }));

                result.forEach(({ bagNumber, soldierName, nationality, bagType, statusBag, dateIn, dateOut }) => {
                    worksheet1.addRow([bagNumber, soldierName, nationality, bagType, statusBag, dateIn, dateOut]).eachCell((cell) => {
                        cell.alignment = { horizontal: 'center' };
                    });
                });

                result_nationality.forEach(({ nationality, bagCount }) => {
                    worksheet2.addRow([nationality, bagCount]).eachCell((cell) => {
                        cell.alignment = { horizontal: 'center' };
                    });
                });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="report_laundry.xlsx"');

                await workbook.xlsx.write(res);
                res.end();

            } catch (error) {
                console.error(error);
                res.status(500).send('Failed to generate the report.');
            }
        });

        this.app.post('/laundry/addBag', async (req, res) => {

            const { error } = schemaAddBag.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            const { epc, code, type, maxcount } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const check_exist = await client.query(`SELECT * FROM laundrybags WHERE id = $1;`, [epc]);

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This bag already exists!' });
                }

                await client.query(`INSERT INTO laundrybags(id, code, type, status, timein, timeout, maxcountlandry) VALUES ($1, $2, $3, 'None', null, null, $4);`,
                    [epc, code, type, maxcount]
                );

                const username = req.session.username ? req.session.username : "PhoneUser";

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [username, `Add bag with code ${code}`]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Bag added successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error add bag', error);
                res.status(500).json({ message: 'Failed to add bag.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/laundry/deleteBag', async (req, res) => {

            const { error } = schemaRemoveBag.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            const { code } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`SELECT code FROM laundrybags WHERE id = $1;`, [code]);
                const bagCode = result.rows[0].code;

                const check_exist = await client.query(`SELECT * FROM soldier WHERE id = $1`, [code]);

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This bag is set to the soldier!' });
                }

                await client.query(`DELETE FROM laundryreport WHERE bag_id = $1`, [code]);
                await client.query(`DELETE FROM laundrybags WHERE id = $1`, [code]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Remove bag with code ${bagCode}`]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The bag was successfully removed' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error delete bag', error);
                res.status(500).json({ message: 'Failed to delete bag' });

            } finally {
                client.release();
            }
        });

        this.app.post('/laundry/editBag', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditBag.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { bagId, bagType, maxWash } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`SELECT code FROM laundrybags WHERE id = $1;`, [bagId]);
                const bagCode = result.rows[0].code;

                await client.query(`UPDATE laundrybags SET type = $1, maxcountlandry = $2 WHERE id = $3;`, [bagType, maxWash, bagId]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Edit bag with code ${bagCode} set type ${bagType} and max washed ${maxWash}`]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The bag was successfully removed' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error generating Excel report:', error);
                res.status(500).json({ message: 'Failed to generate report.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/laundry/editPhoneBag', async (req, res) => {

            const { error } = schemaEditPhoneBag.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            if (!req.body.isValidCode)
                return res.status(402).json({ message: "Invalid product code!" });

            const { oldCode, newCode, code, type, maxcount } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const check_exist = await client.query(`SELECT * FROM laundrybags WHERE id = $1;`, [newCode]);

                if (check_exist.rows.length > 0 && oldCode !== newCode) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This bag already exists and you cannot edit old bag with him!' });
                }

                if (oldCode === newCode) {
                    await client.query(`UPDATE laundrybags SET code = $1, type = $2, maxcountlandry = $3 WHERE id = $4;`, [code, type, maxcount, oldCode]);

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = 'PhoneUser'), $1)",
                        [`Edit bag with code ${oldCode} set code ${code}, type ${type} and max washed ${maxcount}`]);
                } else {
                    await client.query(`INSERT INTO laundrybags(id, code, type, status, timein, timeout, maxcountlandry) VALUES ($1, $2, $3, 'None', null, null, $4);`, [newCode, code, type, maxcount]);
                    await client.query(`UPDATE soldier SET laundry_bag_id = $1 WHERE laundry_bag_id = $2`, [newCode, oldCode]);
                    await client.query(`UPDATE laundryreport SET bag_id = $1 WHERE bag_id = $2`, [newCode, oldCode]);
                    await client.query(`DELETE FROM laundrybags WHERE id = $1`, [oldCode]);

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = 'PhoneUser'), $1)",
                        [`Replace bag with code ${oldCode} to new code ${newCode}, type=${type}, max washed=${maxcount}`]);
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'The bag was successfully removed' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error edit bag', error);
                res.status(500).json({ message: 'Failed to edit bag.' });

            } finally {
                client.release();
            }
        });
    }

    defineRoutesAssets() {

        this.app.post('/allAssets', async (req, res) => {
            const { error } = shemaGetBags.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }
        
            if (!req.body.isValidCode && !req.session?.username) {
                return res.status(401).json({ message: "Unauthorized access: Invalid product code or session." });
            }
        
            const client = await pool.connect();
        
            try {
                // Optional transaction for consistent reads
                await client.query('BEGIN');
        
                // Fetch all required data
                const [resultAllAssets, resultKeys, resultLocations] = await Promise.all([
                    client.query('SELECT * FROM assets'),
                    client.query(`
                        SELECT id AS id, code AS name FROM assets
                        UNION ALL
                        SELECT id AS id, namekey AS name FROM key
                        UNION ALL
                        SELECT id AS id, code AS name FROM laundrybags
                    `),
                    client.query(`
                        SELECT id, namebuilding AS name FROM buildings
                        UNION ALL
                        SELECT id, namesoldier AS name FROM soldier WHERE date_accommodation IS NOT NULL AND date_free IS NULL
                    `),
                ]);
        
                // Process data
                const assets = resultKeys.rows.map(row => ({
                    id: row.id,
                    code: row.name
                }));
        
                const locations = resultLocations.rows.map(row => ({
                    id: row.id,
                    name: row.name
                }));
        
                const allAssets = resultAllAssets.rows.map(row => ({
                    id: row.id,
                    code: row.code,
                    name_assets: row.name_assets,
                    type_id: row.type_id,
                    location_id: row.location_room,
                    sub_location_id: row.location_key
                }));
        
                // Commit transaction (optional here)
                await client.query('COMMIT');
        
                // Send response
                res.status(200).json({
                    assets,
                    locations,
                    allAssets
                });
        
            } catch (error) {
                // Rollback transaction if an error occurs
                await client.query('ROLLBACK');
                console.error('Error fetching assets:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });
            } finally {
                // Release the client back to the pool
                client.release();
            }
        });

        this.app.post('/asset/keys', async (req, res) => {
            
            const { error } = shemaGetBags.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }
        
            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });
        
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT k.id, k.namekey, r.nameroom, r.id AS roomid 
                    FROM key k
					LEFT JOIN roomskey rk ON rk.keyid = k.id
					LEFT JOIN rooms r ON rk.roomid = r.id
                    LEFT JOIN assets a ON a.location_key = k.id;`);

                const result_key_data = result.rows;
                let total_res = [];

                result_key_data.forEach(row => {
                    total_res.push({
                        id: row.id,
                        name: row.namekey,
                        soldierName: row.namesoldier ? row.namesoldier : 'Free',
                        country: row.country ? row.country : 'Undefined',
                        maleCard: row.meal_card ? row.meal_card : 'Undefined',
                        laundryBag: row.code ? row.code : 'Undefined',
                        roomid: row.roomid,
                        nameroom: row.nameroom
                    });
                });

                await client.query('COMMIT');
                return res.status(200).send(total_res);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error add destination:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/allKeys', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT k.id, k.namekey, r.nameroom, r.id AS roomid 
                    FROM key k
					LEFT JOIN roomskey rk ON rk.keyid = k.id
					LEFT JOIN rooms r ON rk.roomid = r.id
                    LEFT JOIN assets a ON a.location_key = k.id
					WHERE a.location_key IS NULL `);

                const result_key_data = result.rows;
                let total_res = [];

                result_key_data.forEach(row => {
                    total_res.push({
                        id: row.id,
                        name: row.namekey,
                        soldierName: row.namesoldier ? row.namesoldier : 'Free',
                        country: row.country ? row.country : 'Undefined',
                        maleCard: row.meal_card ? row.meal_card : 'Undefined',
                        laundryBag: row.code ? row.code : 'Undefined',
                        roomid: row.roomid,
                        nameroom: row.nameroom
                    });
                });

                await client.query('COMMIT');
                return res.status(200).send(total_res);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error add destination:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/assets', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAccommodation.validate(req.query);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { numBuild } = req.query;

            const client = await pool.connect();

            let navBuild = [];
            let inventory = [];

            try {

                await client.query('BEGIN');

                if (numBuild) {

                    const result_get_room = await client.query(`
                        SELECT r.id, nameroom, COUNT(a.id) AS count_assets
                        FROM rooms r
                        LEFT JOIN assets a ON r.id = a.location_room
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        WHERE br.buildid = $1
                        GROUP BY nameroom, r.id
                        ORDER BY nameroom;`, [numBuild]);

                    for (const row of result_get_room.rows) {
                        inventory.push({ id: row.id, name: row.nameroom, quantity: row.count_assets });
                    }

                    await client.query('COMMIT');
                    return res.status(200).json(inventory);

                } else {

                    const result_get_room = await client.query(`
                        SELECT r.id, nameroom, COUNT(a.id) AS count_assets
                        FROM rooms r
                        LEFT JOIN assets a ON r.id = a.location_room
                        GROUP BY nameroom, r.id
                        ORDER BY nameroom;`);

                    for (const row of result_get_room.rows) {
                        inventory.push({ id: row.id, name: row.nameroom, quantity: row.count_assets });
                    }
                }

                const resultBuild = await client.query(`SELECT id, namebuilding FROM buildings`);

                for (const row of resultBuild.rows) {
                    navBuild.push({ name: row.namebuilding, id: row.id });
                }

                await client.query('COMMIT');

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to open asset.' });
            } finally {
                client.release();
            }

            switch (req.session.username) {
                case 'guest':
                    this.giveSpecificPermissionAssets([0, 4, 5], res, inventory, navBuild, numBuild);
                    break;

                default:
                    this.giveSpecificPermissionAssets([0, 1, 2, 3, 4, 5, 6], res, inventory, navBuild, numBuild);
                    break;
            }
        });

        this.app.post('/assets/getSortedRoom', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAccommodation.validate(req.query);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { numBuild } = req.query;

            const client = await pool.connect();

            let nameroomSetCount = [];

            try {

                await client.query('BEGIN');

                if (numBuild) {

                    const result_get_room = await client.query(`
                        SELECT r.id, nameroom, COUNT(a.id) AS count_assets
                        FROM rooms r
                        LEFT JOIN assets a ON r.id = a.location_room
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        WHERE br.buildid = $1
                        GROUP BY nameroom, r.id
                        ORDER BY nameroom;`, [numBuild]);

                    for (const row of result_get_room.rows) {
                        nameroomSetCount.push({ id: row.id, nameroom: row.nameroom, count_assets: row.count_assets });
                    }

                } else {

                    const result_get_room = await client.query(`
                        SELECT r.id, nameroom, COUNT(a.id) AS count_assets
                        FROM rooms r
                        LEFT JOIN assets a ON r.id = a.location_room
                        GROUP BY nameroom, r.id
                        ORDER BY nameroom;`);

                    for (const row of result_get_room.rows) {
                        nameroomSetCount.push({ id: row.id, nameroom: row.nameroom, count_assets: row.count_assets });
                    }
                }

                await client.query('COMMIT');
                res.status(200).json(nameroomSetCount);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to sorted room.' });
            } finally {
                client.release();
            }
        });

        this.app.post('/assets/getSortedAssets', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaSpecialAssets.validate(req.query);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { numRoom } = req.query;

            const client = await pool.connect();

            let nameAssetSetCount = [];

            try {

                await client.query('BEGIN');

                const result_get_room = await client.query(`
                    SELECT a.id, code, name_assets, t.type_name, r.nameroom, k.namekey
                    FROM assets a
                    LEFT JOIN assetstype t ON t.id = a.type_id
                    LEFT JOIN rooms r ON r.id = a.location_room
                    LEFT JOIN key k ON k.id = a.location_key
                    WHERE location_room = $1;`, [numRoom]);

                for (const row of result_get_room.rows) {
                    nameAssetSetCount.push({
                        id: row.id,
                        code: row.code,
                        name: row.name_assets,
                        type: row.type_name,
                        location: row.nameroom,
                        namekey: row.namekey ? row.namekey : 'There is no associated key'
                    });
                }

                await client.query('COMMIT');
                res.status(200).json(nameAssetSetCount);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to sorted asset.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/getAllType', async (req, res) => {

            const { error } = shemaGetBags.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const result = await client.query('SELECT id, type_name AS name FROM assetstype;');

                const assetType = result.rows;

                await client.query('COMMIT');
                res.status(200).json(assetType);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to get all type.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/editAsset', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditAsset.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { assetId, assetName, assetType, assetLocation, assetSubLocation } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                if (assetSubLocation !== '') {
                    await client.query(`UPDATE assets SET name_assets = $2, type_id = $3, location_room = $4, location_key = $5 WHERE id = $1`,
                        [assetId, assetName, assetType, assetLocation, assetSubLocation]
                    );
                } else {
                    await client.query(`UPDATE assets SET name_assets = $2, type_id = $3, location_room = $4, location_key = NULL WHERE id = $1`,
                        [assetId, assetName, assetType, assetLocation]
                    );
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset was successfully update' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ error: 'Failed to edit asset.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/editAssetDevice', async (req, res) => {

            const { error } = schemaEditAssetDevice.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            if (!req.body.isValidCode)
                return res.status(402).json({ message: "Invalid product code!" });

            const { oldCode, newCode, code, name, type, location, subLocation } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                if(oldCode === newCode) {
                    if (subLocation !== '') {
                        await client.query(`UPDATE assets SET code = $2 name_assets = $3, type_id = $4, location_room = $5, location_key = $6 WHERE id = $1`,
                            [newCode, code, name, type, location, subLocation]
                        );
                    } else {
                        await client.query(`UPDATE assets SET code = $2, name_assets = $3, type_id = $4, location_room = $5, location_key = NULL WHERE id = $1`,
                            [newCode, code, name, type, location]
                        );
                    }
                } else {

                    if (subLocation !== '') {

                        await client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5, $6);`,
                            [newCode, code, name, type, location, subLocation]
                        );

                        await client.query(`DELETE FROM assets WHERE id = $1`,
                            [oldCode]
                        );

                    } else {
                        await client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5);`,
                            [newCode, code, name, type, location]
                        );

                        await client.query(`DELETE FROM assets WHERE id = $1`,
                            [oldCode]
                        );
                    }
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset was successfully update' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ error: 'Failed to edit asset.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/addAsset', async (req, res) => {

            const { error } = schemaAddAsset.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            const { assetEps, assetCodeSearch, assetAddName, selectedAddTypeId, selectedAddLocationId, selectedAddSubLocationId } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const check_exist = await client.query(`SELECT * FROM assets WHERE id = $1;`, [assetEps]);

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This asset already exists!' });
                }

                if (selectedAddSubLocationId !== '') {
                    await client.query(`INSERT INTO assets(id, code, name_assets, type_id, location_room, location_key) VALUES ($1, $2, $3, $4, $5, $6);`,
                        [assetEps, assetCodeSearch, assetAddName, selectedAddTypeId, selectedAddLocationId, selectedAddSubLocationId]
                    );

                } else {
                    await client.query(`INSERT INTO assets(id, code, name_assets, type_id, location_room, location_key) VALUES ($1, $2, $3, $4, $5, NULL);`,
                        [assetEps, assetCodeSearch, assetAddName, selectedAddTypeId, selectedAddLocationId]
                    );
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset was successfully added' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to add asset.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/deleteAsset', async (req, res) => {

            const { error } = schemaDeleteAsets.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            const { code } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                await client.query(`DELETE FROM assets WHERE id = $1`, [code]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset was successfully removed' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to remove asset.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/checkDeleteAsset', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaDeleteAsets.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { code } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT * 
                    FROM assets a
                    JOIN key k ON k.id = a.location_key AND k.soldierid IS NOT NULL
                    WHERE a.id = $1`, [code]);

                if (result.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: `The asset ${result.rows[0].code} is associated with a key that is in use and cannot be deleted.` });
                }

                await client.query('COMMIT');
                res.status(200).json();

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to check asset.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/addTypeAsset', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddAsetsType.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { assetType } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const check_exist = await client.query(`SELECT * FROM assetstype WHERE type_name = $1;`, [assetType]);

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This type already exists!' });
                }

                await client.query(`INSERT INTO assetstype VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM assetstype), $1);`, [assetType]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset type was successfully added' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to add asset type.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/removeTypeAsset', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveAsetsType.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { assetTypeId } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                await client.query(`DELETE FROM assetstype WHERE id = $1`, [assetTypeId]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset type was successfully removed' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to remove asset type.' });

            } finally {
                client.release();
            }
        });
    }

    // Method to start the server
    start() {
        this.app.listen(this.port, () => {
            console.log(`The server is started in http://localhost:${PORT}`)
        });
    }
}

const server = new Server(PORT);
server.start();
