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
const moment = require('moment');

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

const shemaChangeCamp = Joi.object({
    campId: Joi.string().alphanum().optional()
});

const schemaAddCamp = Joi.object({
    campName: Joi.string().alphanum().required()
});

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

const changeAmountSchema = Joi.object({
    checkList: Joi.array().items(
        Joi.object({
            code: Joi.string().alphanum().required(),
            amount: Joi.number().integer().min(1).required()
        })
    ).required(),
    moveAmount: Joi.number().integer().min(1).required()
});

const editCleanItemSchema = Joi.object({
    itemId: Joi.string().alphanum().required(),
    editAmount: Joi.number().required(),
    isTotalAmound: Joi.boolean().required()
});

const updateBagsScanerSchema = Joi.object({
    codes: Joi.array()
        .items(Joi.string().alphanum())
        .required(),
    destination: Joi.string()
        .valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None', 'Linen Exchange service')
        .required(),
    prev_destination: Joi.string()
        .valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None')
        .required(),
    campId: Joi.string().alphanum().required()
});

const exchangeServiceSchema = Joi.object({
    code: Joi.string().alphanum().required(),
    destination: Joi.string()
        .valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None', 'Linen Exchange service')
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
    destination: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None', 'Linen Exchange service').required(),
    permCount: Joi.number().required()
});

const checkCountScaningCodesSchema = Joi.object({
    countScaneCode: Joi.number().required(),
    prev_destination: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None').required(),
    campId: Joi.string().alphanum().required()
});

const schemaAddBag = Joi.object({
    epc: Joi.string().alphanum().required(),
    code: Joi.string().alphanum().required(),
    type: Joi.string().regex(/^[a-zA-Z0-9\s]+$/).required(),
    maxcount: Joi.number().required(),
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional()
});

const shemaGetBags = Joi.object({
    isValidCode: Joi.bool().optional(),
    campId: Joi.string().alphanum().optional()
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
    selectClient: Joi.string().pattern(/^[a-zA-Z0-9]+$/).required(), // selectClient should be a string and is required
    helmetId: Joi.string().allow('').alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const schemaNFCReturn = Joi.object({
    nfcData: Joi.string().required(), // nfcData should be a string and is required
    date: Joi.date().iso().required(), // date should be a valid ISO date and is required
    time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(), // time should be in HH:MM format and is required
    isValidCode: Joi.bool().optional()
});

const schemaBike = Joi.object({
    bikeId: Joi.string().required(), // bikeId should be a string and is required
    clientId: Joi.string().allow('').optional(), // clientId should be a string
    actionId: Joi.string().required(), // actionId should be a string and is required
    dateId: Joi.date().iso().required(), // dateId should be a valid ISO date and is required (e.g., "2023-10-12")
    hourSelectId: Joi.number().integer().min(0).max(23).required(), // hourId should be an integer between 0 and 23, representing the hour
    minuteSelect: Joi.number().integer().min(0).max(59).required(), // minuteId should be an integer between 0 and 59, representing the minutes
    ltstatus: Joi.boolean().optional(),
    helmetId: Joi.string().allow('').alphanum().optional()
});

const schemaReport = Joi.object({
    selectedDate1: Joi.date().iso().allow('None'),
    selectedDate2: Joi.date().iso().allow('None')
});

const schemaReportBike = Joi.object({
    selectedDate1: Joi.date().iso().allow('None'),
    selectedDate2: Joi.date().iso().allow('None'),
    filtersBike: Joi.object().required(),
    filtersBikeDate: Joi.object().required()
});

const schemaAddBike = Joi.object({
    bikeAddId: Joi.string().alphanum().required(),
    bikeName: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required(),
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional()
});

const schemaAddHelmet = Joi.object({
    helmetAddId: Joi.string().alphanum().required(),
    helmetName: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required(),
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional()
});

const schemaEditParameturBike = Joi.object({
    oldBikeId: Joi.string().alphanum().required(),
    newBikeId: Joi.string().alphanum().required(),
    bikeName: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required(),
    campId: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const schemaEditParameturHelmet = Joi.object({
    oldHelmetId: Joi.string().alphanum().required(),
    newHelmetId: Joi.string().alphanum().required(),
    helmetName: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required(),
    campId: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const schemaUploadBike = Joi.object({
    id: Joi.string().alphanum().required(),
    namebike: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required()
});

const schemaUploadHelmet = Joi.object({
    id: Joi.string().alphanum().required(),
    code: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required()
});

const schemaRemoveBike = Joi.object({
    bikeRemoveId: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const schemaCheckBike = Joi.object({
    bikeId: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const schemaEditBike = Joi.object({
    bikeId: Joi.string().alphanum().required(),
    status: Joi.string().valid('Repair', 'Late', 'Long term', 'Rented').required(),
    soldierId: Joi.string().alphanum().required(),
    helmetId: Joi.string().allow('').alphanum().required(),
    dateFrom: Joi.date().iso().required()
});

const schemaSearchBike = Joi.object({
    id: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
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
    roomName: Joi.string().pattern(/^[^\/]+\/([^\/]+\/)?.+$/).required(),
    clickBuild: Joi.string().allow('').alphanum().required()
});

const schemaKeyToRoom = Joi.object({
    keyId: Joi.string().alphanum().required(),
    keyName: Joi.string().pattern(/^[^\/]+\/[^\/]+\/.+$/).required(),
    selectedRoomForKey: Joi.string().pattern(/^[^\/]+\/.+$/).required()
});

const schemaSpecialRoom = Joi.object({
    numBuild: Joi.string().alphanum().allow('').required()
});

const schemaSpecialKey = Joi.object({
    numRoom: Joi.string().pattern(/^([a-zA-Z0-9]+(\/[a-zA-Z0-9])?\/[a-zA-Z0-9]+)*$/).required()
});

const schemaSpecialAssets = Joi.object({
    numRoom: Joi.string().alphanum().allow('').optional()
});

const schemaDeleteAsets = Joi.object({
    code: Joi.string().alphanum().required(),
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional()
});

const schemaAddAsetsType = Joi.object({
    assetType: Joi.string().pattern(/^[a-zA-Z\s]+$/).required()
});

const schemaRemoveAsetsType = Joi.object({
    assetTypeId: Joi.string().alphanum().required()
});

const schemaCheckAppCode = Joi.object({
    code: Joi.string().alphanum().required()
});

const schemaLostItems = Joi.object({
    itemName: Joi.string().alphanum().required(),
    description: Joi.string().allow('').pattern(/^[a-zA-Z0-9\s]*$/).required(),
    soldierId: Joi.string().alphanum().required(),
    lostQuantity: Joi.number().required()
});

const schemaRestorItems = Joi.object({
    code: Joi.string().alphanum().required(),
    lost_quantity: Joi.number().required()
});

const schemaAddAsset = Joi.object({
    assetEps: Joi.string().alphanum().required(),
    assetCodeSearch: Joi.string().alphanum().required(),
    assetAddName: Joi.string().pattern(/^[a-zA-Z0-9\s]+$/).required(),
    selectedAddTypeId: Joi.string().alphanum().required(),
    selectedAddLocationId: Joi.string().alphanum().required(),
    selectedAddSubLocationId: Joi.string().alphanum().allow('').optional(),
    assetAddCategorie: Joi.string().pattern(/^[a-zA-Z\s]+$/).required(),
    assetQuantity: Joi.number().integer().required(),
    assetAddMrah: Joi.string().pattern(/^[a-zA-Z\s]+$/).required(),
    assetAddOwner: Joi.string().pattern(/^[a-zA-Z\s]+$/).required(),
    assetStatus: Joi.number().integer().required(),
    assetAddExpandable: Joi.valid('Expandable', 'Non Expandable').required(),
    assetAddDescription: Joi.string().allow('').pattern(/^[a-zA-Z0-9\s]*$/).required(),
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional()
});

const schemaEditAsset = Joi.object({
    assetId: Joi.string().alphanum().required(),
    assetName: Joi.string().pattern(/^[a-zA-Z0-9\s]+$/).required(),
    assetType: Joi.string().alphanum().required(),
    assetLocation: Joi.string().alphanum().required(),
    assetSubLocation: Joi.string().alphanum().allow('').optional(),
    assetCategory: Joi.string().pattern(/^[a-zA-Z\s]+$/).required(),
    assetQuantity: Joi.number().integer().required(),
    assetMrah: Joi.string().pattern(/^[a-zA-Z\s]+$/).required(),
    assetOwner: Joi.string().pattern(/^[a-zA-Z\s]+$/).required(),
    assetStatus: Joi.number().integer().required(),
    assetExpandable: Joi.valid('Expandable', 'Non Expandable').required(),
    assetDescription: Joi.string().allow('').pattern(/^[a-zA-Z0-9\s]*$/).required()
});

const schemaEditAssetDevice = Joi.object({
    oldCode: Joi.string().alphanum().required(),
    newCode: Joi.string().alphanum().required(),
    code: Joi.string().alphanum().required(),
    name: Joi.string().pattern(/^[a-zA-Z0-9\s]+$/).required(),
    type: Joi.string().alphanum().required(),
    location: Joi.string().alphanum().required(),
    subLocation: Joi.string().alphanum().allow('').optional(),
    category: Joi.string().pattern(/^[a-zA-Z\s]+$/).required(),
    quantity: Joi.number().integer().required(),
    mrah: Joi.string().pattern(/^[a-zA-Z\s]+$/).required(),
    owner: Joi.string().pattern(/^[a-zA-Z\s]+$/).required(),
    status: Joi.number().integer().required(),
    expandable: Joi.valid('Expandable', 'Non Expandable').required(),
    description: Joi.string().pattern(/^[a-zA-Z0-9\s]+$/).required(),
    campId: Joi.string().alphanum().required(),
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

const schemaAddAdditionalItem = Joi.object({
    soldierId: Joi.string().alphanum().required(),
    description: Joi.string().pattern(/^[a-zA-Z0-9\s]+$/).required(),
    bagId: Joi.string().allow('').alphanum().required(),
    quantity: Joi.number().integer().required()
});

const schemaReturnAdditionalItem = Joi.object({
    id: Joi.string().uuid().required(),
    quantity: Joi.number().integer().required()
});

const schemaAddSoldier = Joi.object({
    soldierId: Joi.string().alphanum().required(),
    soldierName: Joi.string().pattern(/^[A-Za-z0-9\s\-éÉàÀèÈùÙâÂêÊîÎôÔûÛçÇÖöäÄåÅøØ]+$/).required(),
    soldierCountry: Joi.string().alphanum().required(),
    upcomingAccommodationDate: Joi.date().allow('').iso().optional(),
    upcomingReleaseDate: Joi.date().allow('').iso().optional()
});

const schemaEditSoldier = Joi.object({
    soldierId: Joi.string().alphanum().required(),
    soldierNewId: Joi.string().alphanum().required(),
    soldierName: Joi.string().pattern(/^[A-Za-z0-9\s\-éÉàÀèÈùÙâÂêÊîÎôÔûÛçÇÖöäÄåÅøØ]+$/).required(),
    soldierCountry: Joi.string().alphanum().required(),
    soldierUpcomeAccom: Joi.date().allow('').iso().required(),
    soldierUpcomeRel: Joi.date().allow('').iso().required()
});

const schemaAddCleanItem = Joi.object({
    itemName: Joi.string().pattern(/^[a-zA-Z0-9\s]+$/).required(),
    totalAmount: Joi.number().integer().min(1).required()
});

const schemaRemoveCleanItem = Joi.object({
    itemId: Joi.string().alphanum().required()
});

const schemaRemoveSoldier = Joi.object({
    code: Joi.string().alphanum().required()
});

const schemaRemoveHelmet = Joi.object({
    code: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
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
    roomNumber: Joi.string().pattern(/^([a-zA-Z0-9]+(\/[a-zA-Z0-9])?\/[a-zA-Z0-9]+)*$/).required()
});

const schemaNFCBikeRead = Joi.object({
    nfcData: Joi.string().required(), // nfcData should be a string and is required
    isValidCode: Joi.bool().optional()
});

const shemaClientNfc = Joi.object({
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional()
});

const shemaHelmetBike = Joi.object({
    bikeId: Joi.string().allow('').alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const schemaGetBagsByStatus = Joi.object({
    status: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to drop off', 'Ready to pick up', 'None', '').required(),
});

const schemaAssetReport = Joi.object({
    result: Joi.array().items(Joi.object()).required(),
    result_nationality: Joi.array().items(Joi.object()).required(),
    filtersAssets: Joi.object().required(),
    filtersAssetsData: Joi.object().required()
});

const schemaLaundryReport = Joi.object({
    result: Joi.array().items(Joi.object()).required(),
    result_nationality: Joi.array().items(Joi.object()).required(),
    filtersBags: Joi.object().required(),
    filtersNationalBags: Joi.object().required()
});

const schemaAccommodationReport = Joi.object({
    result: Joi.array().items(Joi.object()).required(),
    result_nationality: Joi.array().items(Joi.object()).required(),
    filtersSoldier: Joi.object().required(),
    filtersSoldierMove: Joi.object().required()
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

    giveSpecificPermissionMain(username, indexs, res, navItems, isFirstLogin, campId) {

        res.render('mainPage', {
            title: 'Main Page Layout',
            navItems: navItems,
            horizontalNavItems: indexs.map(index => horizontalNavItems[index]),
            headerTable: null,
            data: null,
            startMessage: "Welcome to Global Support System (GSS)",
            username: username,
            firstLogin: isFirstLogin,
            campId: campId
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
            dataPerEmj: dataPerEmj,
            username: username
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

    giveSpecificPermissionAssets(username, indexes, res, inventory, numBuild, numSelectBuild) {

        res.render('assets', {
            title: "Assets",
            horizontalNavItems: indexes.map(index => horizontalNavItems[index]),
            inventory: inventory,
            navItems: numBuild,
            numSelectBuild: numSelectBuild,
            username: username
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
        const expectedHashAsset = process.env.HASH_APP_ASSET; // You should know the expected hash of a legal APK
        const expectedHashGym = process.env.HASH_APP_GYM; // You should know the expected hash of a legal APK

        if (hashDigest !== expectedHashBike && hashDigest !== expectedHashLaundry && hashDigest !== expectedHashAsset && hashDigest !== expectedHashGym) {
            console.error('APK file hash does not match expected value');
            res.status(400).json({ message: 'File integrity check failed' }); // Send JSON response
            return false;
        }

        return true; // File is legal
    }

    // Method to define routes for main page
    defineRoutesMain() {

        // GET route for checking server status
        this.app.get('/', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            let navItems = [];

            try {

                await client.query('BEGIN');

                const get_all_camp = await client.query(`SELECT * FROM camps ORDER BY created_at ASC`);
                navItems = get_all_camp.rows;
                if (req.session.firstLogin)
                    req.session.camp = navItems.length > 0 ? navItems[0].id : '';

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Surver error: ', error);
                res.status(500).json({ error: 'Failed to load camp data.' });

            } finally {
                client.release();
            }

            const isFirstLogin = req.session.firstLogin;
            req.session.firstLogin = false;

            switch (req.session.username) {
                case 'helpDeskGatis':
                case 'laundrySupervaizer':
                    this.giveSpecificPermissionMain(req.session.username, [0, 2, 6], res, navItems, isFirstLogin, req.session.camp);
                    break;
                case 'admin':
                    this.giveSpecificPermissionMain(req.session.username, [0, 1, 2, 3, 4, 5, 6], res, navItems, isFirstLogin, req.session.camp);
                    break;
                default:
                    this.giveSpecificPermissionMain(req.session.username, [0, 1, 2, 4, 5, 6], res, navItems, isFirstLogin, req.session.camp);
                    break;
            }

        });

        this.app.post('/setCampValue', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = shemaChangeCamp.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { campId } = req.body;

            if (campId)
                req.session.camp = campId;

            return res.status(200).json({ message: '' })

        });

        this.app.post('/addCamp', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddCamp.validate(req.body);
            if (error) {
                return res.status(400).json({ message: 'Invalid camp name' });
            }

            const { campName } = req.body;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                const uniqueId = crypto.randomBytes(16).toString('hex');

                await Promise.all([
                    client.query('INSERT INTO camps VALUES ($1, $2);', [uniqueId, campName]),
                    client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Camp ${campName} added`])
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Camp added successfully' });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Error querying the database', err);
                res.status(500).send('An error occurred. Please try again later.');

            } finally {
                client.release();
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
                    req.session.firstLogin = true;

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

        this.app.get('/getAllCamp', async (req, res) => {

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`SELECT * FROM camps`);

                await client.query('COMMIT');
                return res.status(200).json(result.rows);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(error);
                res.status(500);

            } finally {
                client.release();
            }

        });

        this.app.post('/checkCodeProduct', async (req, res) => {
            try {
                const { error } = schemaCheckAppCode.validate(req.body);
                if (error) {
                    return res.status(400).json({ success: false, message: error.details[0].message });
                }

                const { code } = req.body;
                const codeMatches = await bcrypt.compare(code, process.env.DEVISE_CODE); // Use async bcrypt
                const codeMatchesNFC = await bcrypt.compare(code, process.env.DEVISE_CODE_NFC); // Use async bcrypt

                if (codeMatches || codeMatchesNFC) {
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

            if (!req.body.isValidCode)
                return res.status(400).json({ message: "Invalid product code!" });

            const { nfcData } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT SPLIT_PART(namebike, '/', 1) AS namebike
                    FROM bicycles
                    WHERE id = $1`, [nfcData]);

                const resultHelmet = await client.query(`
                    SELECT SPLIT_PART(code, '/', 1) AS code
                    FROM helmets
                    WHERE id = $1;`, [nfcData]);

                const getBikeHelmet = await client.query(`
                    SELECT SPLIT_PART(code, '/', 1) AS code
                    FROM helmets
                    WHERE id = (SELECT helmet_id FROM bikesoldier WHERE bikeid = $1 AND dateto IS NULL);`, [nfcData]);

                // Check if a result was found
                if (result.rows.length === 0 && resultHelmet.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ error: 'Not found bike or helmet with provided NFC data.' });
                }

                await client.query('COMMIT');
                res.status(200).json({
                    namebike: result.rows.length > 0 ? result.rows[0].namebike : '',
                    code: resultHelmet.rows.length > 0 ? resultHelmet.rows[0].code : '',
                    getBikeHelmet: getBikeHelmet.rows.length > 0 ? getBikeHelmet.rows[0].code : ''
                });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Error querying the database', err);
                res.status(500).json({ error: 'Internal Server Error' });
            } finally {
                client.release();
            }
        });

        // Endpoint to get all available bikes
        this.app.post('/getClient', async (req, res) => {

            const { error } = shemaClientNfc.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            if (!req.body.isValidCode)
                return res.status(402).json({ message: "Invalid product code!" });

            const { campId } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT s.id, namesoldier, k.namekey, k.id AS keyid, 
                    (SELECT COUNT(*) FROM bikesoldier WHERE soldierid = s.id AND datefrom IS NOT NULL AND dateto IS NULL) AS count_get_bike
                    FROM soldier s
                    LEFT JOIN key k ON k.soldierid = s.id
                    WHERE date_accommodation IS NOT NULL AND date_free IS NULL AND s.camp_id = $1`, [campId]);

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

            if (!req.body.isValidCode)
                return res.status(402).json({ message: "Invalid product code!" });

            const { nfcData, date, time, selectClient, helmetId } = req.body;

            const dateText = `${date} ${time}`;
            const recDate = new Date(dateText);

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const count_result = await client.query(
                    `SELECT COUNT(*) FROM bikesoldier WHERE bikeid = $1 AND dateto IS NULL`,
                    [nfcData]
                );

                const bikeResult = await client.query(`SELECT namebike FROM bicycles WHERE id = $1;`, [nfcData]);

                if (count_result.rows[0].count > 0) {
                    await client.query('ROLLBACK');
                    return res.status(403).json({ message: 'The bike is already rented.' });
                }

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

                await Promise.all([
                    client.query(
                        "UPDATE bicycles SET status = $1 WHERE id = $2",
                        [newStatus, nfcData]
                    ),
                    client.query(
                        `INSERT INTO bikesoldier(id, bikeid, soldierid, datefrom, status_bike, helmet_id) VALUES (
                        (SELECT COALESCE(MAX(id), 0) + 1 FROM bikesoldier), $1, $2, $3, $4, $5);`,
                        [nfcData, selectClient, recDate, newStatus, helmetId ? helmetId : null]
                    ),
                    client.query(
                        `INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = 'PhoneUser'), $1)`,
                        [`Rented Bike with name ${bikeResult.rows[0].namebike}`]
                    )
                ]);

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

            if (!req.body.isValidCode)
                return res.status(402).json({ message: "Invalid product code!" });

            const { nfcData, date, time } = req.body;

            const dateText = `${date} ${time}`;
            const recDate = new Date(dateText);

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const bikeResult = await client.query(`SELECT namebike FROM bicycles WHERE id = $1;`, [nfcData]);

                await Promise.all([
                    client.query(
                        "UPDATE bicycles SET status = 'Available' WHERE id = $1",
                        [nfcData]
                    ),
                    client.query(
                        "UPDATE bikesoldier SET dateto = $1 WHERE bikeid = $2 AND dateto IS NULL",
                        [recDate, nfcData]
                    ),
                    client.query(
                        `INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = 'PhoneUser'), $1)`,
                        [`Return Bike with name ${bikeResult.rows[0].namebike}`]
                    )
                ]);

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

            if (!req.body.isValidCode)
                return res.status(402).json({ message: "Invalid product code!" });

            const { oldBikeId, newBikeId, bikeName, campId } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                if (oldBikeId === newBikeId) {
                    await Promise.all([
                        client.query(
                            "UPDATE bicycles SET namebike = $1 WHERE id = $2",
                            [bikeName, oldBikeId]
                        ),
                        client.query(
                            `INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = 'PhoneUser'), $1)`,
                            [`Edit Bike name with code ${oldBikeId}`]
                        )
                    ]);

                } else {
                    await Promise.all([
                        client.query(
                            "INSERT INTO bicycles VALUES ($1, $2, 'Available', $3);",
                            [newBikeId, bikeName, campId]
                        ),
                        client.query(
                            "UPDATE bikesoldier SET bikeid = $1 WHERE bikeid = $2",
                            [newBikeId, oldBikeId]
                        ),
                        client.query(
                            "DELETE FROM bicycles WHERE id = $1",
                            [oldBikeId]
                        ),
                        client.query(
                            `INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = 'PhoneUser'), $1)`,
                            [`Edit Bike with name ${bikeName}, replace old NFC ${oldBikeId} with new NFC ${newBikeId}`]
                        )
                    ]);
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

        this.app.post('/editParameturHelmet', async (req, res) => {

            const { error } = schemaEditParameturHelmet.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            if (!req.body.isValidCode)
                return res.status(402).json({ message: "Invalid product code!" });

            const { oldHelmetId, newHelmetId, helmetName, campId } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                if (oldHelmetId === newHelmetId) {
                    await Promise.all([
                        client.query(
                            "UPDATE helmets SET code = $1 WHERE id = $2",
                            [helmetName, oldHelmetId]
                        ),
                        client.query(
                            `INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = 'PhoneUser'), $1)`,
                            [`Edit Helmet name with code ${oldHelmetId}`]
                        )
                    ]);

                } else {
                    await Promise.all([
                        client.query(
                            "INSERT INTO helmets VALUES ($1, $2, $3);",
                            [newHelmetId, helmetName, campId]
                        ),
                        client.query(
                            "UPDATE bikesoldier SET helmet_id = $1 WHERE helmet_id = $2",
                            [newHelmetId, oldHelmetId]
                        ),
                        client.query(
                            "DELETE FROM helmets WHERE id = $1",
                            [oldHelmetId]
                        ),
                        client.query(
                            `INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = 'PhoneUser'), $1)`,
                            [`Edit Bike with name ${helmetName}, replace old NFC ${oldHelmetId} with new NFC ${newHelmetId}`]
                        )
                    ]);
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
                    h.code,
                    TO_CHAR(lb.datefrom, 'FMMonth DD, YYYY HH24:MI') AS formatted_date
                FROM bicycles b 
                LEFT JOIN (SELECT bikeId, soldierId, datefrom, helmet_id, ROW_NUMBER() OVER (PARTITION BY bikeId ORDER BY id DESC) AS rn FROM bikeSoldier) lb ON b.id = lb.bikeId AND lb.rn = 1 
                LEFT JOIN soldier s ON lb.soldierId = s.id
                LEFT JOIN helmets h ON lb.helmet_id = h.id
                WHERE b.camp_id = $1
                ORDER BY CASE WHEN b.status = 'Late' THEN 0 WHEN b.status = 'Repair' THEN 1 WHEN b.status = 'Rented' THEN 2 WHEN b.status = 'Available' THEN 3 ELSE 4 END, b.status;`
                    , [req.session.camp]);

                result_bike.rows.forEach(element => {
                    data.push({
                        name: element.namebike,
                        status: element.status,
                        hiredby: element.status == "Available" ? "None" : element.namesoldier,
                        helmet: element.code ? element.code : "None",
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
                    case 'admin':
                        this.giveSpecificPermissionBicycles(req.session.username, [0, 1, 2, 3, 4, 5, 6], res, data, optionHour, optionMinute, totalBike, rentedBike, availableBike, repairBike, lateBike, longTermBike);
                        break;
                    default:
                        this.giveSpecificPermissionBicycles(req.session.username, [0, 1, 2, 4, 5, 6], res, data, optionHour, optionMinute, totalBike, rentedBike, availableBike, repairBike, lateBike, longTermBike);
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

            const { bikeId, clientId, actionId, dateId, hourSelectId, minuteSelect, ltstatus, helmetId } = req.body;

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

                    const count_result = await client.query(
                        `SELECT COUNT(*) FROM bikesoldier WHERE bikeid = $1 AND dateto IS NULL`,
                        [bikeId]
                    );

                    if (count_result.rows[0].count > 0) {
                        await client.query('ROLLBACK');
                        return res.status(403).json({ message: 'The bike is already rented.' });
                    }

                    const check_helmet = await client.query(
                        `SELECT COUNT(*) FROM bikesoldier WHERE helmet_id = $1 AND dateto IS NULL`,
                        [helmetId]
                    );

                    if (check_helmet.rows[0].count > 0) {
                        await client.query('ROLLBACK');
                        return res.status(403).json({ message: 'The helmet is already rented.' });
                    }

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

                    await Promise.all([
                        client.query(
                            "UPDATE bicycles SET status = $1 WHERE id = $2",
                            [newStatus, bikeId]
                        ),
                        client.query(
                            `INSERT INTO bikesoldier(id, bikeid, soldierid, datefrom, status_bike, helmet_id) VALUES (
                            (SELECT COALESCE(MAX(id), 0) + 1 FROM bikesoldier), $1, $2, $3, $4, $5);`,
                            [bikeId, clientId, recDate, newStatus, helmetId ? helmetId : null]
                        ),
                        client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                            [req.session.username, `Rented Bike with name ${bikeResult.rows[0].namebike}`])
                    ]);

                    await client.query('COMMIT');
                    res.status(200).json({ message: 'The bike has been rented successfully' });

                } else {
                    // Update bike status and clear client assignment

                    await Promise.all([
                        client.query(
                            "UPDATE bicycles SET status = 'Available' WHERE id = $1",
                            [bikeId]
                        ),
                        client.query(
                            "UPDATE bikesoldier SET dateto = $1 WHERE bikeid = $2 AND dateto IS NULL",
                            [recDate, bikeId]
                        ),
                        client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                            [req.session.username, `Return Bike with name ${bikeResult.rows[0].namebike}`])
                    ]);

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

            const { error } = schemaReportBike.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            let { selectedDate1, selectedDate2, filtersBike, filtersBikeDate } = req.body;

            const client = await pool.connect();

            // Function to filter data based on inputs
            const filterData = (data, filters) => {
                return data.filter(item => {
                    return Object.keys(filters).every(key => {
                        if (!filters[key]) return true; // Skip empty filters
                        return String(item[key] || '').toLowerCase().includes(filters[key].toLowerCase());
                    });
                });
            };

            try {

                selectedDate1 += " 00:00";
                selectedDate2 += " 23:59";

                await client.query('BEGIN');

                // Query for bike usage details
                const [result_soldior, result_bike_totals] = await Promise.all([
                    client.query(
                        `SELECT DISTINCT
                        b.namebike, 
                        COALESCE(s.namesoldier, 'N/A') AS namesoldier,
                        COALESCE(h.code, 'N/A') AS helmet_code,
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
                            WHEN dateto IS NOT NULL AND (dateto - datefrom) > INTERVAL '24 hours' AND status_bike <> 'Repair' AND status_bike <> 'Long term' THEN 'Late'
                            ELSE 'On time'
                            END AS status
                        FROM bikesoldier bs 
                        LEFT JOIN soldier s ON bs.soldierid = s.id 
                        LEFT JOIN bicycles b ON bs.bikeid = b.id
                        LEFT JOIN helmets h ON bs.helmet_id = h.id
                        WHERE datefrom BETWEEN $1 AND $2 AND b.camp_id = $3
                        ORDER BY date_from;`,
                        [selectedDate1, selectedDate2, req.session.camp]
                    ),
                    client.query(
                        `SELECT 
                            TO_CHAR(datefrom, 'YYYY-MM-DD') AS date, 
                            COUNT(*) AS total_bikes
                        FROM (
                            SELECT DISTINCT ON (bs.bikeid, bs.soldierid, bs.datefrom, bs.dateto) bs.bikeid, bs.datefrom
                            FROM bikesoldier bs
                            LEFT JOIN bicycles b ON b.id = bs.bikeid
                            WHERE bs.datefrom BETWEEN $1 AND $2 AND b.camp_id = $3
                        ) subquery
                        GROUP BY TO_CHAR(datefrom, 'YYYY-MM-DD')
                        ORDER BY date;`,
                        [selectedDate1, selectedDate2, req.session.camp]
                    )
                ]);

                const data = result_soldior.rows;
                const dateTotals = result_bike_totals.rows;

                // Filter both datasets
                const filteredSoldier = filterData(data, filtersBike);
                const filteredSoldierMove = filterData(dateTotals, filtersBikeDate);

                // Create a new Excel workbook
                const workbook = new excelJS.Workbook();

                // Sheet 1: Bike Usage Data
                const worksheet1 = workbook.addWorksheet('Bike Usage Data');

                // Add custom column titles for the first sheet
                const headers1 = ['Bike Name', 'Soldier Name', 'Helmet Code', 'Date From', 'Date To', 'Duration', 'Status', 'Overdue Status'];
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
                    { width: 20 }, // Bike Name
                    { width: 25 }, // Soldier Name
                    { width: 20 }, // Date From
                    { width: 20 }, // Date To
                    { width: 25 }, // Duration
                    { width: 15 }, // Status
                    { width: 20 },
                    { width: 25 }
                ];

                // Add data rows to the first sheet with alternating row color styling
                filteredSoldier.forEach((row, index) => {
                    const dataRow = worksheet1.addRow(Object.values(row));

                    // Check if the status is "Late" and add a ⚠️ icon
                    if (row.status === 'Late') {
                        dataRow.getCell(8).value = '⚠️';
                    } else {
                        dataRow.getCell(8).value = '';
                    }

                    // Center align the "Status" column (8th column)
                    dataRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

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

                filteredSoldierMove.forEach((row, index) => {
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

        this.app.post('/bikes', async (req, res) => {

            const { error } = shemaClientNfc.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            var optionBike = [];

            const client = await pool.connect();

            const campId = req.session.username ? req.session.camp : req.body.campId;

            try {
                await client.query('BEGIN');
                const result_bike = await client.query(`SELECT id, namebike, status FROM bicycles WHERE camp_id = $1;`, [campId]);

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

        this.app.post('/helmets', async (req, res) => {

            const { error } = shemaClientNfc.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            var optionsHelmets = [];

            const client = await pool.connect();

            const campId = req.session.username ? req.session.camp : req.body.campId;

            try {
                await client.query('BEGIN');
                const result_bike = await client.query(`
                    SELECT h.id, 
                        CASE 
                            WHEN bs.helmet_id IS NOT NULL AND bs.dateto IS NULL THEN CONCAT(h.code, ' (Rented)') 
                            ELSE CONCAT(h.code, ' (Available)') 
                        END AS code_status,
                        h.code
                    FROM helmets h
                    LEFT JOIN bikesoldier bs ON h.id = bs.helmet_id AND bs.dateto IS NULL
                    WHERE h.camp_id = $1;`, [campId]);

                result_bike.rows.forEach(element => {
                    optionsHelmets.push({ id: element.id, name: element.code, code: element.code_status });
                });

                await client.query('COMMIT');
                res.status(200).json(optionsHelmets);

            } catch (error) {
                await client.query('ROLLBACK');
                console.log('Error:', error);
                res.status(500).send('An error occurred');
            } finally {
                client.release();
            }

        });

        this.app.post('/getHelmetByBike', async (req, res) => {

            const { error } = shemaHelmetBike.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            const { bikeId } = req.body;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                const result_bike = await client.query(`
                    SELECT h.id, h.code FROM helmets h
                    LEFT JOIN bikesoldier bs ON bs.helmet_id = h.id
                    WHERE bs.dateto IS NULL AND bs.bikeid = $1`, [bikeId]);

                await client.query('COMMIT');
                res.status(200).json({
                    code: result_bike.rows.length > 0 ? result_bike.rows[0].code : '',
                    helmetId: result_bike.rows.length > 0 ? result_bike.rows[0].id : ''
                });

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

                    // Query for bike usage details and total bike usage per day in the date range
                    const [result_soldior, result_bike_totals] = await Promise.all([
                        client.query(
                            `SELECT DISTINCT
                                b.namebike, 
                                s.namesoldier,
                                h.code AS helmet_code,
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
                            LEFT JOIN helmets h ON bs.helmet_id = h.id
                            WHERE datefrom BETWEEN $1 AND $2 AND b.camp_id = $3
                            ORDER BY date_from DESC;`,
                            [selectedDate1, selectedDate2, req.session.camp]
                        ),
                        client.query(
                            `SELECT 
                                TO_CHAR(datefrom, 'YYYY-MM-DD') AS date, 
                                COUNT(*) AS total_bikes
                            FROM (
                                SELECT DISTINCT ON (bs.bikeid, bs.soldierid, bs.datefrom, bs.dateto) bs.bikeid, bs.datefrom
                                FROM bikesoldier bs
                                LEFT JOIN bicycles b ON b.id = bs.bikeid
                                WHERE datefrom BETWEEN $1 AND $2 AND b.camp_id = $3
                            ) subquery
                            GROUP BY TO_CHAR(datefrom, 'YYYY-MM-DD')
                            ORDER BY date;`,
                            [selectedDate1, selectedDate2, req.session.camp]
                        )
                    ]);

                    const data = result_soldior.rows;
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

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            let { bikeAddId, bikeName } = req.body;

            const campId = req.session.username ? req.session.camp : req.body.campId;

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
                await client.query(`INSERT INTO bicycles VALUES ($1, $2, 'Available', $3);`, [bikeAddId, bikeName, campId]);

                // Query the database for the user
                await client.query(
                    `INSERT INTO usermonitoring (user_id, location)
                    VALUES ( COALESCE((SELECT id FROM users WHERE username = $1), (SELECT id FROM users WHERE username = 'PhoneUser')), $2)`,
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

        this.app.post('/bicycles/addHelmet', async (req, res) => {

            const { error } = schemaAddHelmet.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            let { helmetAddId, helmetName } = req.body;

            const campId = req.session.username ? req.session.camp : req.body.campId;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                // Check if bikeAddId already exists
                const result = await client.query(`SELECT * FROM helmets WHERE id = $1`, [helmetAddId]);

                if (result.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).send({ message: 'This helmet already exists.' });
                }

                // Insert new bike if bikeAddId doesn't exist
                await client.query(`INSERT INTO helmets VALUES ($1, $2, $3);`, [helmetAddId, helmetName, campId]);

                // Query the database for the user
                await client.query(
                    `INSERT INTO usermonitoring (user_id, location)
                    VALUES ( COALESCE((SELECT id FROM users WHERE username = $1), (SELECT id FROM users WHERE username = 'PhoneUser')), $2)`,
                    [req.session.username, `Add Helmet with name ${helmetName}`]
                );

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Helmet added successfully.' });
            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Database error:', err);
                res.status(500).send({ message: 'Internal server error.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/bicycles/removeHelmet', async (req, res) => {

            const { error } = schemaRemoveHelmet.validate(req.body);
            if (error) {
                return res.status(400).json({ message: "Invalid syntax. The value must contain only the letter and number character" });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            const { code } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const check_give_helmet = await client.query(`SELECT helmet_id FROM bikesoldier WHERE helmet_id = $1 AND dateto IS NULL`, [code]);

                if (check_give_helmet.rows.length > 0) {
                    return;
                }

                await Promise.all([
                    client.query(`DELETE FROM bikesoldier WHERE helmet_id = $1;`, [code]),
                    client.query(`DELETE FROM helmets WHERE id = $1`, [code])
                ]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Remove helmet ${code}`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Helmet removed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.log('Error:', error);
                res.status(500).json({ message: 'An error occurred' });
            } finally {
                client.release();
            }
        });

        this.app.post('/bicycles/removeBike', async (req, res) => {

            const { error } = schemaRemoveBike.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            let { bikeRemoveId } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const bikeResult = await client.query(`SELECT namebike FROM bicycles WHERE id = $1`, [bikeRemoveId]);

                await Promise.all([
                    client.query(
                        `INSERT INTO usermonitoring (user_id, location)
                        VALUES (
                            COALESCE((SELECT id FROM users WHERE username = $1), (SELECT id FROM users WHERE username = 'PhoneUser')),
                            $2
                        )`,
                        [req.session.username, `Remove Bike with number ${bikeResult.rows[0].namebike}`]
                    ),
                    client.query(`DELETE FROM bicycles WHERE id = $1;`, [bikeRemoveId])
                ]);

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

        this.app.get('/bicycles/multiHelmet/download', this.isLoggedIn.bind(this), async (req, res) => {

            // Create a new Excel workbook
            const workbook = new excelJS.Workbook();

            // Sheet 1: Accommodation Multipul Soldiers
            const worksheet = workbook.addWorksheet('Helmets Multipul Bike');

            const headers = ['id', 'code'];
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
            res.setHeader('Content-Disposition', 'attachment; filename=templateHelmetsBike.xlsx');

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

                // Create a Set to track unique bike IDs within the data array
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

                    // Add bike ID to the Set after checking
                    uniqueBikeId.add(row.id);

                    // Inside the backend function, when checking for duplicates
                    const result = await client.query("SELECT * FROM bicycles WHERE id = $1;", [row.id]);

                    if (result.rows.length > 0) {
                        errors.push({ type: 'CheckExist', message: `Bicycles with number '${row.id}' already exists.` });
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
                        "INSERT INTO bicycles VALUES ($1, $2, 'Available', $3)",
                        [row.id, row.namebike, req.session.camp]
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

        this.app.post('/bicycles/uploadMultiHelmet', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {

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

                // Create a Set to track unique bike IDs within the data array
                const uniqueHelmetId = new Set();

                await Promise.all(data.map(async (row) => {

                    if (!row.id) {
                        return;
                    }

                    const { error } = schemaUploadHelmet.validate(row);

                    if (error) {
                        errors.push({ type: 'Validation', details: error.details, row });
                        return;
                    }

                    // Check for duplicates within the data array
                    if (uniqueHelmetId.has(row.id)) {
                        errors.push({ type: 'UniqueIdCheck', message: `Duplicate helmet id '${row.id}' found within the data.` });
                        return;
                    }

                    // Add bike ID to the Set after checking
                    uniqueHelmetId.add(row.id);

                    // Inside the backend function, when checking for duplicates
                    const result = await client.query("SELECT * FROM helmets WHERE id = $1;", [row.id]);

                    if (result.rows.length > 0) {
                        errors.push({ type: 'CheckExist', message: `Helmet with number '${row.id}' already exists.` });
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
                        "INSERT INTO helmets VALUES ($1, $2, $3)",
                        [row.id, row.code, req.session.camp]
                    );

                }));

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), 'Multi Add Helmets')", [req.session.username]);

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

            const { error } = schemaCheckBike.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            const { bikeId } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const [result_check_bike, result_bike] = await Promise.all([
                    client.query(`SELECT * FROM bicycles WHERE id = $1;`, [bikeId]),
                    client.query(`
                        SELECT status, datefrom FROM bicycles b
                        LEFT JOIN bikesoldier bs ON bs.bikeid = b.id
                        WHERE b.id = $1 and b.status <> 'Available' AND dateto IS NULL;`, [bikeId])
                ]);

                if (result_check_bike.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'Bike not found' });
                }

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
                    SELECT s.id, namesoldier, country, upcoming_accommodation, upcoming_release, namekey, l.id as etc, l.code, s.meal_card, s.date_free, s.date_accommodation, k.id AS keyid
                    FROM soldier s
                    LEFT JOIN key k ON k.soldierid = s.id
                    LEFT JOIN laundrybags l ON l.id = s.laundry_bag_id
                    WHERE s.camp_id = $1;`, [req.session.camp]);

                result_client.rows.forEach(element => {
                    optionClient.push({
                        id: element.id,
                        name: element.namesoldier,
                        country: element.country,
                        upcoming_accommodation: element.upcoming_accommodation ? element.upcoming_accommodation : '',
                        upcoming_release: element.upcoming_release ? element.upcoming_release : '',
                        keyid: element.keyid ? element.keyid : '',
                        namekey: element.namekey ? element.namekey : '',
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

        this.app.post('/bicycles/editBike', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditBike.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            const { bikeId, status, soldierId, helmetId, dateFrom } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                await Promise.all([
                    client.query(`UPDATE bicycles SET status = $1 WHERE id = $2;`, [status, bikeId]),
                    client.query(`UPDATE bikesoldier SET soldierid = $1, datefrom = $2, status_bike = $4, helmet_id = $5 WHERE bikeid = $3 AND dateto IS NULL;`, [soldierId, dateFrom, bikeId, status, helmetId || null]),
                ]);

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

        this.app.get('/checkUpcomingDate', this.isLoggedIn.bind(this), async (req, res) => {
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Combine both queries into one
                const query = `
                    SELECT *
                    FROM soldier
                    WHERE camp_id = $1 
                        AND (upcoming_accommodation = CURRENT_DATE OR upcoming_release = CURRENT_DATE);`;
                const result = await client.query(query, [req.session.camp]);

                await client.query('COMMIT');

                function convertDate(date) {
                    const dateObj = new Date(date);
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                    const day = String(dateObj.getDate()).padStart(2, "0");

                    return `${year}-${month}-${day}`;
                }

                // Determine accommodations and releases
                const isAccommodation = result.rows.some(row => convertDate(row.upcoming_accommodation) === new Date().toISOString().slice(0, 10));
                const isRelease = result.rows.some(row => convertDate(row.upcoming_release) === new Date().toISOString().slice(0, 10));

                // Send response
                return res.status(200).json({
                    isAccommodation,
                    isRelease,
                    accommodationList: result.rows
                        .filter(row => convertDate(row.upcoming_accommodation) === new Date().toISOString().slice(0, 10))
                        .map(row => row.namesoldier), // Assuming soldier has a `name` field
                    releaseList: result.rows
                        .filter(row => convertDate(row.upcoming_release) === new Date().toISOString().slice(0, 10))
                        .map(row => row.namesoldier)
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing request:', error.message);
                return res.status(500).json({ message: 'An internal error occurred while processing your request.' });
            } finally {
                client.release();
            }
        });

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
                    JOIN buildings b ON b.id = br.buildid AND b.type = 'Accommodation' AND b.camp_id = $1;`, [req.session.camp]);

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

            const campId = !req.body.isValidCode && req.session.username ? req.session.camp : req.body.campId;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_all_bags = await client.query(`SELECT * FROM laundrybags WHERE camp_id = $1`, [campId]);

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
										LEFT JOIN additionalitem ai ON ai.bag_id = l.id
                                        LEFT JOIN soldier s ON s.laundry_bag_id = l.id OR ai.soldier_id = s.id
                                        WHERE s.date_accommodation IS NOT NULL AND s.date_free IS NULL)
                    AND l.camp_id = $1;`, [req.session.camp]);

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

                const result_all_builds = await client.query(`SELECT id, namebuilding FROM buildings WHERE type = 'Accommodation' AND camp_id = $1;`, [req.session.camp]);

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

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            const selectBike = req.body.id;
            var allBikeInfo = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_client = await client.query(`
                SELECT DISTINCT
                namesoldier,
                TO_CHAR(datefrom, 'FMMonth DD, YYYY HH24:MI') AS formatted_date_from,
                datefrom,
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

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            const selectClient = req.body.id;
            var allClientInfo = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_client = await client.query(`
                SELECT DISTINCT
                namebike,
                TO_CHAR(datefrom, 'FMMonth DD, YYYY HH24:MI') AS formatted_date_from,
                datefrom,
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

        this.app.post('/searchHelmet', async (req, res) => {

            const { error } = schemaSearchBike.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session.username)
                return res.status(402).json({ message: "Invalid product code!" });

            const { id } = req.body;
            var allHelmetInfo = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result_helmet = await client.query(`
                SELECT DISTINCT
                namesoldier,
                TO_CHAR(datefrom, 'FMMonth DD, YYYY HH24:MI') AS formatted_date_from,
                datefrom,
                COALESCE(TO_CHAR(dateto, 'FMMonth DD, YYYY HH24:MI'), 'Still in use') AS formatted_date_to
                FROM bikesoldier bs
                LEFT JOIN soldier s ON s.id = bs.soldierid
                LEFT JOIN helmets h ON h.id = bs.helmet_id
                WHERE helmet_id = $1
                ORDER BY datefrom DESC
                LIMIT 2;`, [id]);

                result_helmet.rows.forEach(element => {
                    allHelmetInfo.push({ namesoldier: element.namesoldier, datefrom: element.formatted_date_from, dateto: element.formatted_date_to });
                });

                await client.query('COMMIT');
                res.status(200).json(allHelmetInfo);

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
                    LEFT JOIN buildings b ON br.buildid = b.id
                    LEFT JOIN laundrybags lb ON lb.id = s.laundry_bag_id
                    WHERE nameroom SIMILAR TO '%/' || $1 || '[0-9]%' AND b.camp_id = $2
                    GROUP BY nameroom
                    ORDER BY nameroom;`, [numBuild, req.session.camp]);

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

                    const res_type = await client.query('SELECT type, namebuilding FROM buildings WHERE id = $1', [numBuild]);
                    type = res_type.rows[0].type;
                    title = res_type.rows[0].namebuilding;

                    // Initialize room counts using the query result
                    resultData.rows.forEach(row => {
                        nameroomSet.add(row.nameroom);
                        roomCounts[row.nameroom] = type === 'Accommodation' ? row.count_with_location || 0 : row.count_without_location || 0;
                    });

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
                    selectBuildType = type;

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
                        AND b.camp_id = $1
                    GROUP BY 
                        nameroom
                    ORDER BY 
                        nameroom;`, [req.session.camp]);

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

                const resultBuild = await client.query(`SELECT id, namebuilding FROM buildings WHERE camp_id = $1`, [req.session.camp]);

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
                LEFT JOIN buildings b ON b.id = br.buildid
                JOIN assets a ON a.location_key = k.id
                WHERE nameroom NOT LIKE '__/D_' AND nameroom NOT LIKE '__/_/E_' AND b.camp_id = $1;`, [req.session.camp]);

                await Promise.all(resultBuild.rows.map(async (row) => {
                    try {
                        const [countFreeBedsResult, selectBuildTypeResult] = await Promise.all([
                            client.query(`
                                SELECT COUNT(*) AS freebeds
                                FROM rooms r
                                LEFT JOIN roomskey rk ON r.id = rk.roomid
                                LEFT JOIN key k ON k.id = rk.keyid
                                LEFT JOIN soldier s ON s.id = k.soldierid
                                LEFT JOIN buildroom br ON br.roomid = r.id
                                JOIN assets a ON a.location_key = k.id
                                WHERE s.namesoldier IS NULL 
                                AND br.buildid = $1
                                AND r.nameroom LIKE '__/___';`, [row.id]),
                            client.query(`SELECT type FROM buildings WHERE id = $1;`, [row.id])
                        ]);

                        const countFreeBeds = countFreeBedsResult.rows[0].freebeds;
                        totalFreeBeds += Number(countFreeBeds);

                        const [firstPart, secondPart] = row.namebuilding.split(/\s/);

                        if (selectBuildTypeResult.rows[0].type === 'Accommodation') {
                            navBuild.push({ id: row.id, name: `${row.namebuilding}`, nameAdd: `(${countFreeBeds} free beds)`, numBuild: row.id, nameBuilding: secondPart });

                        } else {
                            navBuild.push({ id: row.id, name: `${row.namebuilding}`, numBuild: row.id, nameBuilding: secondPart });
                        }

                    } catch (error) {
                        await client.query('ROLLBACK');
                        console.error(`Error fetching data for building ${row.id}:`, error);
                    }
                }));

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
                        case 'admin':
                            this.giveSpecificPermissionAccommodation(req.session.username, [0, 1, 2, 3, 4, 5, 6], res, navBuild, totalFreeBeds, totalOccupiedBeds, type, title, countFreeBeds, headerTable, nameroomSetCount, numBuild);
                            break;

                        default:
                            this.giveSpecificPermissionAccommodation(req.session.username, [0, 1, 2, 4, 5, 6], res, navBuild, totalFreeBeds, totalOccupiedBeds, type, title, countFreeBeds, headerTable, nameroomSetCount, numBuild);
                            break;
                    }
                } else {

                    await client.query('COMMIT');

                    switch (req.session.username) {
                        case 'admin':
                            this.giveSpecificPermissionAccommodation(req.session.username, [0, 1, 2, 3, 4, 5, 6], res, navBuild, totalFreeBeds, totalOccupiedBeds, type, title, null, headerTable, nameroomSetCount, numBuild);
                            break;

                        default:
                            this.giveSpecificPermissionAccommodation(req.session.username, [0, 1, 2, 4, 5, 6], res, navBuild, totalFreeBeds, totalOccupiedBeds, type, title, null, headerTable, nameroomSetCount, numBuild);
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
                    LEFT JOIN buildroom br ON br.roomid = r.id
                    LEFT JOIN buildings b ON b.id = br.buildid
                    WHERE r.nameroom = $1 AND k.id IS NOT NULL AND b.camp_id = $2
                    ORDER BY namekey;`, [roomNumber, req.session.camp]);

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

                    const get_bag_soldier = await client.query(`
                        SELECT l.status, l.id FROM laundrybags l 
                        LEFT JOIN soldier s ON l.id = s.laundry_bag_id
                        WHERE s.id = $1 AND s.date_accommodation IS NOT NULL AND s.date_free IS NULL;`, [soldierId]);

                    if (get_bag_soldier.rows.length > 0 && get_bag_soldier.rows[0].id !== bagId) {

                        const check_laundry_bag_2 = await client.query(`SELECT status FROM laundrybags WHERE id = $1;`, [bagId]);

                        if (get_bag_soldier.rows[0].status !== 'None' || (check_laundry_bag_2.rows.length > 0 && check_laundry_bag_2.rows[0].status !== 'None')) {
                            return res.status(401).json({ message: "The soldier has an laundry bag an laundry and cannot change bag code." });
                        }
                    }

                    await Promise.all([
                        client.query("UPDATE key SET soldierid = NULL WHERE soldierid = $1;", [soldierId]),
                        client.query("UPDATE key SET soldierid = $1 WHERE id = $2;", [soldierId, keyCodeId]),
                        client.query("UPDATE soldier SET date_free = NULL, date_accommodation = NULL WHERE date_free IS NOT NULL AND id = $1;", [soldierId])
                    ]);

                    const result_accommodation_soldier = await client.query(`SELECT * FROM soldier WHERE date_accommodation IS NOT NULL AND id = $1`,
                        [soldierId]
                    );

                    if (result_accommodation_soldier.rows.length === 0) {
                        await client.query(
                            "UPDATE soldier SET date_accommodation = CURRENT_DATE, date_free = NULL, meal_card = $2, laundry_bag_id = $3, used_room = $4, upcoming_accommodation = NULL WHERE id = $1;",
                            [soldierId, mealCardId, bagId === '' ? null : bagId, keyCodeId]
                        );
                    } else {
                        await client.query(
                            "UPDATE soldier SET meal_card = $2, laundry_bag_id = $3 WHERE id = $1;",
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

                    const [check_laundry_bag, check_bike, check_additional_item] = await Promise.all([
                        client.query(`SELECT l.status FROM laundrybags l
                                        LEFT JOIN soldier s ON s.laundry_bag_id = l.id
                                        LEFT JOIN additionalitem ai ON ai.bag_id = l.id
                                        WHERE s.id = $1 OR ai.soldier_id = $1;`, [res_query.rows[0].soldierid]),
                        client.query(`
                            SELECT * FROM soldier s
                            LEFT JOIN bikesoldier bs ON s.id = bs.soldierid
                            WHERE s.id = $1 AND datefrom IS NOT NULL AND dateto IS NULL;`, [res_query.rows[0].soldierid]),

                        client.query(`SELECT * FROM additionalitem WHERE soldier_id = $1;`, [res_query.rows[0].soldierid])
                    ]);

                    if (check_laundry_bag.rows.length > 0) {
                        const activeBags = check_laundry_bag.rows.filter(bag => bag.status !== 'None');
                        if (activeBags.length > 0) {
                            return res.status(401).json({ message: "The soldier has an active laundry bag and cannot be released." });
                        }
                    }

                    if (check_bike.rows.length > 0) {
                        return res.status(402).json({ message: "The soldier has an active bike rental and cannot be released." });
                    }

                    if (check_additional_item.rows.length > 0) {
                        return res.status(403).json({ message: "The soldier has a non returned additional items!" });
                    }

                    await Promise.all([
                        client.query("UPDATE key SET soldierid = NULL WHERE id = $1;", [keyCodeId]),
                        client.query("UPDATE soldier SET date_free = CURRENT_DATE, upcoming_release = NULL WHERE id = $1;", [res_query.rows[0].soldierid])
                    ]);

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Release soldier with number ${res_query.rows[0].soldierid}`]);

                } else {
                    await client.query(
                        "UPDATE key SET soldierid = NULL WHERE id = $1;",
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

        this.app.post('/accommodation/viewReport', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaReport.validate(req.body);
            if (error) {
                return res.status(400).send({ error: error.details[0].message });
            }

            let { selectedDate1, selectedDate2 } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                // Query for bike usage details
                const [result_soldior, result_move] = await Promise.all([
                    client.query(`
                        SELECT 
                            k.namekey,
                            namesoldier, 
                            country, 
                            TO_CHAR(date_accommodation, 'Mon DD, YYYY') AS date_accommodation, 
                            TO_CHAR(date_free, 'Mon DD, YYYY') AS date_free,
                            meal_card,
                            code
                        FROM 
                            soldier s
                        LEFT JOIN laundrybags lb ON lb.id = s.laundry_bag_id
                        LEFT JOIN key k ON k.id = s.used_room
                        WHERE 
                            country <> 'None' AND s.camp_id = $1;`, [req.session.camp]),
                    client.query(`
                        SELECT 
                            k_current.namekey AS current_room,
                            k_previous.namekey AS previous_room,
                            soldier_name.namesoldier AS name_soldier,
                            TO_CHAR(ms.datemove, 'YYYY-MM-DD') AS datemove
                        FROM 
                            movesoldier ms
                        JOIN 
                            key k_current ON ms.idnewkey = k_current.id
                        JOIN 
                            key k_previous ON ms.idpreviewkey = k_previous.id
                        JOIN 
                            soldier soldier_name ON soldier_name.id = ms.idsoldier
                        WHERE
                            datemove BETWEEN TO_DATE($1, 'YYYY-MM-DD') AND TO_DATE($2, 'YYYY-MM-DD') AND soldier_name.camp_id = $3;`,
                        [selectedDate1, selectedDate2, req.session.camp])
                ]);

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

            const { error } = schemaAccommodationReport.validate(req.body);
            if (error) {
                return res.status(400).send('Invalid input data.');
            }

            const { result, result_nationality, filtersSoldier, filtersSoldierMove } = req.body;

            // Function to filter data based on inputs
            const filterData = (data, filters) => {
                return data.filter(item => {
                    return Object.keys(filters).every(key => {
                        if (!filters[key]) return true; // Skip empty filters
                        return String(item[key] || '').toLowerCase().includes(filters[key].toLowerCase());
                    });
                });
            };

            try {

                // Filter both datasets
                const filteredSoldier = filterData(result, filtersSoldier);
                const filteredSoldierMove = filterData(result_nationality, filtersSoldierMove);

                const workbook = new excelJS.Workbook();
                const worksheet1 = workbook.addWorksheet('Information about soldiers');
                const worksheet2 = workbook.addWorksheet('Movement soldiers information');

                const headers1 = ['Key Number', 'Soldier Name', 'Country', 'Accommodation Date', 'Release Date', 'Meal card', 'Laundry bag'];
                worksheet1.addRow(headers1).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                const headers2 = ['Previous Key', 'New Key', 'Soldier', 'Date Relocation'];
                worksheet2.addRow(headers2).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                worksheet1.columns = headers1.map(header => ({ header, width: header.length + 10 }));
                worksheet2.columns = headers2.map(header => ({ header, width: header.length + 10 }));

                await Promise.all(filteredSoldier.map(async ({ roomNumber, soldierName, country, dateIn, dateOut, mealCard, laundryBag }, index) => {
                    const dataRow = worksheet1.addRow([roomNumber, soldierName, country, dateIn, dateOut, mealCard, laundryBag]);

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
                }));

                await Promise.all(filteredSoldierMove.map(async ({ oldRoom, newRoom, soldierName, dateRelock }, index) => {
                    const dataRow = worksheet2.addRow([oldRoom, newRoom, soldierName, dateRelock]);

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
                }));

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

            try {
                const { moves } = req.body;

                const client = await pool.connect();

                try {
                    await client.query('BEGIN');

                    let firstSingleMove = true;

                    for (const move of moves) {

                        const { error } = schemaMoveSoldier.validate(move);
                        if (error) {
                            throw new Error(error.details[0].message);
                        }

                        const { keyId, soldId, keyMoveId, soldMoveId } = move;

                        if (soldMoveId) {
                            await client.query("INSERT INTO movesoldier VALUES ($1, $2, $3, CURRENT_DATE);", [keyMoveId, keyId, soldId]);
                            await client.query("INSERT INTO movesoldier VALUES ($1, $2, $3, CURRENT_DATE);", [keyId, keyMoveId, soldMoveId]);
                            await client.query("UPDATE key SET soldierid = $1 WHERE id = $2;", [soldId, keyMoveId]);
                            await client.query("UPDATE key SET soldierid = $1 WHERE id = $2;", [soldMoveId, keyId]);
                            await client.query(`UPDATE soldier SET used_room = $1 WHERE id = $2;`, [keyMoveId, soldId]);
                            await client.query(`UPDATE soldier SET used_room = $1 WHERE id = $2;`, [keyId, soldMoveId]);
                            await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                                [req.session.username, `Swap soldier ${soldId} and ${soldMoveId}`]);

                        } else {
                            await client.query("INSERT INTO movesoldier VALUES ($1, $2, $3, CURRENT_DATE);", [keyMoveId, keyId, soldId]);
                            await client.query("UPDATE key SET soldierid = $1 WHERE id = $2;", [soldId, keyMoveId]);

                            if (firstSingleMove) {
                                await client.query("UPDATE key SET soldierid = NULL WHERE id = $1;", [keyId]);
                                firstSingleMove = false;
                            }

                            await client.query(`UPDATE soldier SET used_room = $1 WHERE id = $2;`, [keyMoveId, soldId]);
                            await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                                [req.session.username, `Move soldier ${soldId} from room ${keyId} to room ${keyMoveId}`]);
                        }
                    }

                    await client.query('COMMIT');
                    res.status(200).json({ message: 'The soldier has been successfully moved' });

                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error('Error:', error);
                    res.status(500).send('An error occurred');

                } finally {
                    client.release();
                }

            } catch (error) {
                console.error(error);
                res.status(500).send('An error occurred');
            }

        });

        this.app.post('/accommodation/addSoldier', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddSoldier.validate(req.body);
            if (error) {
                return res.status(400).json({ message: "Invalid syntax. The value must contain only the letter and number character" });
            }

            const { soldierId, soldierName, soldierCountry, upcomingAccommodationDate, upcomingReleaseDate } = req.body;
            const client = await pool.connect();

            if (upcomingAccommodationDate && upcomingReleaseDate && new Date(upcomingAccommodationDate) > new Date(upcomingReleaseDate))
                return res.status(400).json({ message: "The date of accommodation cannot be greater than the date of release" });

            try {

                await client.query('BEGIN');

                // Inside the backend function, when checking for duplicates
                const result = await client.query("SELECT * FROM soldier WHERE id = $1;", [soldierId]);

                if (result.rows.length > 0) {
                    // Duplicate soldierId found
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Soldier with id: '${soldierId}' already exists.` });
                }

                if (soldierName.endsWith(' ')) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: `Soldier name '${soldierName}' should not end with a space.` });
                }

                await Promise.all([
                    client.query("INSERT INTO soldier VALUES ($1, $2, $3, NULL, NULL, NULL, NULL, NULL, $4, $5, $6);", [soldierId, soldierName, soldierCountry, req.session.camp, upcomingAccommodationDate || null, upcomingReleaseDate || null]),
                    client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)", [req.session.username, `Add soldier ${soldierName}`])
                ]);

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

                const check_soldier_accommodatation = await client.query(`SELECT id FROM soldier WHERE date_accommodation IS NOT NULL AND date_free IS NULL AND id = $1`, [code]);

                if (check_soldier_accommodatation.rows.length > 0) {
                    return res.status(401).json({ message: "The soldier is deployed to reduce him from the system first release him" });
                }

                await Promise.all([
                    client.query("DELETE FROM movesoldier WHERE idsoldier = $1;", [code]),
                    client.query("UPDATE laundrybags SET soldier_id = NULL WHERE soldier_id = $1", [code]),
                    client.query("DELETE FROM lostitem WHERE soldier_id = $1", [code]),
                    client.query("UPDATE key SET soldierid = NULL WHERE soldierid = $1;", [code]),
                    client.query("DELETE FROM fitness WHERE soldierid = $1", [code]),
                    client.query("DELETE FROM bikesoldier WHERE soldierid = $1", [code]),
                    client.query("DELETE FROM soldier WHERE id = $1;", [code])
                ]);

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

            const { soldierId, soldierNewId, soldierName, soldierCountry, soldierUpcomeAccom, soldierUpcomeRel } = req.body;
            const client = await pool.connect();

            if (soldierUpcomeAccom && soldierUpcomeRel && new Date(soldierUpcomeAccom) > new Date(soldierUpcomeRel))
                return res.status(400).json({ message: "The date of accommodation cannot be greater than the date of release" });

            try {

                await client.query('BEGIN');

                const result = await client.query("SELECT * FROM soldier WHERE id = $1;", [soldierNewId]);

                if (soldierId !== soldierNewId && result.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Soldier with id: '${soldierNewId}' already exists.` });
                }

                if (soldierName.endsWith(' ')) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: `Soldier name '${soldierName}' should not end with a space.` });
                }

                if (soldierId === soldierNewId) {
                    await client.query("UPDATE soldier SET namesoldier = $1, country = $2, upcoming_accommodation = $4, upcoming_release = $5 WHERE id = $3;", [soldierName, soldierCountry, soldierId, soldierUpcomeAccom || null, soldierUpcomeRel || null]);
                } else {
                    const result = await client.query("SELECT * FROM soldier WHERE id = $1;", [soldierId]);
                    const respons = result.rows[0];

                    await client.query("INSERT INTO soldier VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);", [soldierNewId, soldierName, soldierCountry, respons.date_accommodation || null, respons.date_free || null, respons.meal_card || null, respons.laundry_bag_id || null, respons.used_room || null, respons.camp_id, soldierUpcomeAccom || null, soldierUpcomeRel || null]);

                    await Promise.all([
                        client.query("UPDATE movesoldier SET idsoldier = $1 WHERE idsoldier = $2;", [soldierNewId, soldierId]),
                        client.query("UPDATE key SET soldierid = $1 WHERE soldierid = $2;", [soldierNewId, soldierId]),
                        client.query("UPDATE fitness SET soldierid = $1 WHERE soldierid = $2;", [soldierNewId, soldierId]),
                        client.query("UPDATE bikesoldier SET soldierid = $1 WHERE soldierid = $2;", [soldierNewId, soldierId]),
                        client.query("UPDATE lostitem SET soldier_id = $1 WHERE soldier_id = $2;", [soldierNewId, soldierId]),
                        client.query("UPDATE laundrybags SET soldier_id = $1 WHERE soldier_id = $2;", [soldierNewId, soldierId]),
                        client.query("UPDATE additionalItem SET soldier_id = $1 WHERE soldier_id = $2;", [soldierNewId, soldierId]),
                        client.query("DELETE FROM soldier WHERE id = $1;", [soldierId])
                    ]);
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
                        return;
                    }

                    if (!new RegExp(`^${row.soldierId} [A-Za-z0-9\\s\\-éÉàÀèÈùÙâÂêÊîÎôÔûÛçÇÖöäÄåÅøØ]+$`).test(row.soldierName)) {
                        errors.push({ type: 'InvalidFormat', message: `Soldier name '${row.soldierName}' has an invalid format. All names must be in the format: 'soldierNumber soldierName'.` });
                        return;
                    }

                    if (row.soldierName.endsWith(' ')) {
                        errors.push({ type: 'InvalidFormat', message: `Soldier name '${row.soldierName}' should not end with a space.` });
                        return;
                    }

                    if (row.upcomingReleaseDate && row.upcomingAccommodationDate && new Date(row.upcomingAccommodationDate) > new Date(row.upcomingReleaseDate)) {
                        errors.push({ type: 'InvalidDate', message: `The date of accommodation cannot be greater than the date of release` });
                        return;
                    }
                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row) => {
                    await client.query("INSERT INTO soldier VALUES ($1, $2, $3, NULL, NULL, NULL, NULL, NULL, $4, $5, $6);", [row.soldierId, row.soldierName, row.soldierCountry, req.session.camp, row.upcomingAccommodationDate || null, row.upcomingReleaseDate || null]);
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
            const headers = ['soldierId', 'soldierName', 'soldierCountry', 'upcomingAccommodationDate', 'upcomingReleaseDate'];
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
                { width: 12 },
                { width: 20 },
                { width: 25 },
                { width: 25 },
                { width: 25 },
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
                AND b.camp_id = $1
                ORDER BY nameroom, namekey;`, [req.session.camp]);

                const data = result.rows;

                // Create a new Excel workbook
                const workbook = new excelJS.Workbook();

                // Sheet 1: Accommodation Multipul Soldiers
                const worksheet = workbook.addWorksheet('Accommodation Multipul Soldiers');

                // Add column headers (modify based on your table structure)
                if (data.length > 0) {
                    worksheet.columns = Object.keys(data[0]).map((key) => ({
                        header: key,
                        key: key,
                        width: 15,
                    }));
                }

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
                    const [result, result_exist] = await Promise.all([
                        client.query("SELECT * FROM soldier WHERE id = $1 AND date_accommodation IS NOT NULL AND date_free IS NULL;", [row.soldierid]),
                        client.query("SELECT * FROM soldier WHERE id = $1;", [row.soldierid])
                    ]);

                    if (result.rows.length > 0) {
                        // Duplicate soldierId found
                        errors.push({ type: 'CheckId', message: `Soldier with number '${row.soldierid}' is already accommodation.` });
                        return;
                    }

                    if (result_exist.rows.length === 0) {
                        errors.push({ type: 'CheckExist', message: `Soldier with number '${row.soldierid}' is not exists.` });
                        return;
                    }

                    if (!row.laundrybag) {
                        return;
                    }

                    const [result_check_bag, result_check_bag_soldier] = await Promise.all([
                        client.query("SELECT * FROM laundrybags WHERE code = $1 AND camp_id = $2;", [row.laundrybag, req.session.camp]),
                        client.query(`
                            SELECT * FROM soldier s 
							LEFT JOIN additionalitem ai ON s.id = ai.soldier_id
                            LEFT JOIN laundrybags l ON s.laundry_bag_id = l.id OR l.id = ai.bag_id
                            WHERE l.code = $1 AND s.date_accommodation IS NOT NULL AND date_free IS NULL AND l.camp_id = $2;`, [row.laundrybag, req.session.camp])
                    ]);

                    if (result_check_bag.rows.length === 0) {
                        errors.push({ type: 'CheckBag', message: `The bag with number '${row.laundrybag}' is not exists.` });
                        return;

                    } else if (result_check_bag_soldier.rows.length > 0) {
                        errors.push({ type: 'CheckBag', message: `The bag with number '${row.laundrybag}' has already been taken by someone.` });
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

                    await Promise.all([
                        client.query("UPDATE key SET soldierid = $1 WHERE id = $2;", [row.soldierid, row.keynumber]),
                        client.query("UPDATE soldier SET date_accommodation = CURRENT_DATE, date_free = NULL, meal_card = $2, laundry_bag_id = $3, used_room = $4 WHERE id = $1;", [row.soldierid, mealCardValue, laundryBagValue, row.keynumber])
                    ]);

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
                return res.status(400).json({ message: "Invalid syntax. Only alphanumeric characters are allowed." });
            }

            const { buildId } = req.body;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const res_query = await client.query(`
                    SELECT k.id AS key_id, s.id AS soldier_id, s.namesoldier AS soldier_name, lb.id AS laundry_bag_id, lb.status AS laundry_status,
                        EXISTS (
                            SELECT 1
                            FROM bikesoldier bs
                            WHERE bs.soldierid = s.id AND bs.datefrom IS NOT NULL AND bs.dateto IS NULL
                        ) AS has_active_bike
                    FROM key k
                    JOIN soldier s ON s.id = k.soldierid
					LEFT JOIN additionalitem ai ON s.id = ai.soldier_id
                    LEFT JOIN laundrybags lb ON lb.id = s.laundry_bag_id OR ai.bag_id = lb.id
                    LEFT JOIN roomskey rk ON rk.keyid = k.id
                    LEFT JOIN buildroom br ON br.roomid = rk.roomid
                    WHERE s.id IS NOT NULL AND s.country <> 'None' AND br.buildid = $1;`, [buildId]);

                if (res_query.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: "This building is empty." });
                }

                for (const row of res_query.rows) {
                    if (row.laundry_status !== 'None') {
                        return res.status(402).json({
                            message: `Soldier ${row.soldier_name} has an active laundry bag and cannot be released.`
                        });
                    }
                    if (row.has_active_bike) {
                        return res.status(403).json({
                            message: `Soldier ${row.soldier_name} has an active bike rental and cannot be released.`
                        });
                    }
                }

                const soldierIds = res_query.rows.map(row => row.soldier_id);
                const keyIds = res_query.rows.map(row => row.key_id);

                await Promise.all([
                    client.query("UPDATE soldier SET date_free = CURRENT_DATE WHERE id = ANY($1)", [soldierIds]),
                    client.query("UPDATE key SET soldierid = NULL WHERE id = ANY($1)", [keyIds])
                ]);

                await client.query(`
                    INSERT INTO usermonitoring (user_id, location)
                    VALUES ((SELECT id FROM users WHERE username = $1), $2);`,
                    [req.session.username, `Release all soldier in building ${buildId}`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: "All rooms are vacated." });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error processing deleteSoldier:', error.message, error.stack);
                return res.status(500).json({ message: "An error occurred while processing the data." });
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
                    `SELECT * FROM buildings WHERE namebuilding = $1 AND camp_id = $2;`, [buildName, req.session.camp]
                );

                if (result_build.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This destination already exists!' });
                }

                const randomBuildId = crypto.randomBytes(16).toString('hex');

                await Promise.all([
                    client.query(
                        `INSERT INTO buildings VALUES ($1, $2, $3, $4);`, [randomBuildId, buildName, buildType, req.session.camp]
                    ),
                    client.query(
                        "INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Add destination ${buildName}`]
                    )
                ]);

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

                await Promise.all([
                    client.query("DELETE FROM buildings WHERE id = $1;", [buildId]),
                    client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Remove destination ${buildId}`])
                ]);

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

                let buildingName;

                if (clickBuild !== '')
                    buildingName = clickBuild;

                else {
                    const build_id = await client.query(`SELECT id FROM buildings WHERE namebuilding = $1 AND camp_id = $2`,
                        [`Building ${roomName.split('/')[0]}`, req.session.camp]);

                    buildingName = build_id.rows[0].id;
                }

                const result_build = await client.query(
                    `SELECT * FROM rooms r
                    LEFT JOIN buildroom br ON br.roomid = r.id
                    LEFT JOIN buildings b ON b.id = br.buildid
                    WHERE nameroom = $1 AND b.camp_id = $2;`, [roomName, req.session.camp]
                );

                if (result_build.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This room already exists!' });
                }

                const randomRoomId = crypto.randomBytes(16).toString('hex');

                await Promise.all([
                    client.query("INSERT INTO rooms VALUES ($1, $2)", [randomRoomId, roomName]),
                    client.query("INSERT INTO buildroom VALUES ($1, $2)", [buildingName, randomRoomId]),
                    client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Add room ${roomName} to ${roomName.split('/')[0]}`])
                ]);

                await client.query('COMMIT');
                return res.status(200).send({ message: `The room ${roomName} was added into building ${roomName.split('/')[0]}.` });

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

                let result;

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
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        LEFT JOIN buildings b ON br.buildid = b.id
                        WHERE nameroom SIMILAR TO '%/(E|D)[0-9]%' AND b.camp_id = $1;`, [req.session.camp]);
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

            const { numRoom } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT k.*
                    FROM key k
                    LEFT JOIN roomskey rk ON rk.keyid = k.id
                    LEFT JOIN rooms r ON r.id = rk.roomid
                    LEFT JOIN buildroom br ON br.roomid = r.id
                    LEFT JOIN buildings b ON br.buildid = b.id
                    WHERE r.nameroom = $1 AND b.camp_id = $2;`, [numRoom, req.session.camp]);

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
					LEFT JOIN buildroom br ON br.roomid = r.id
					LEFT JOIN buildings b ON br.buildid = b.id
                    JOIN assets a ON a.location_key = k.id
                    WHERE b.camp_id = $1;`, [req.session.camp]);

                const result_key_data = result.rows;
                let total_res = [];

                await Promise.all(result_key_data.map(async (row) => {
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
                }));

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

                await Promise.all([
                    client.query(`DELETE FROM buildroom WHERE roomid = $1;`, [roomId]),
                    client.query(`DELETE FROM rooms WHERE id = $1;`, [roomId]),
                    client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Remove room ${roomId}`])
                ]);

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

                const get_room_id = await client.query(`
                    SELECT r.id FROM rooms r
                    LEFT JOIN buildroom br ON br.roomid = r.id
                    LEFT JOIN buildings b ON br.buildid = b.id
                    WHERE r.nameroom = $1 AND b.camp_id = $2`, [selectedRoomForKey, req.session.camp]);

                if (result_key.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This key already exists!' });
                }

                await Promise.all([
                    client.query("INSERT INTO key VALUES ($1, $2)", [keyId, keyName]),
                    client.query("INSERT INTO roomskey VALUES ($1, $2)", [get_room_id.rows[0].id, keyId]),
                    client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Add key ${keyName} to room ${selectedRoomForKey}`])
                ]);

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
                await Promise.all([
                    client.query(`
                        UPDATE roomskey
                        SET keyid = $1
                        WHERE keyid = $2;`, [newKeyId, oldKeyId]),

                    client.query(`
                        UPDATE movesoldier
                        SET 
                            idnewkey = CASE WHEN idnewkey = $2 THEN $1 ELSE idnewkey END,
                            idpreviewkey = CASE WHEN idpreviewkey = $2 THEN $1 ELSE idpreviewkey END; `, [newKeyId, oldKeyId]),

                    client.query(`
                        UPDATE assets
                        SET 
                            location_key = CASE WHEN location_key = $2 THEN $1 ELSE location_key END;`, [newKeyId, oldKeyId])
                ]);

                await client.query(`DELETE FROM key WHERE id = $1;`, [oldKeyId]);

                // Log user action
                await client.query(`
                    INSERT INTO usermonitoring (user_id, location) 
                    VALUES (
                        (SELECT id FROM users WHERE username = $1),
                            $2
                        )`, [req.session.username, `Replace key ${oldKeyId} with ${newKeyId}`]);

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

        this.app.post('/accommodation/addAdditionalItems', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = schemaAddAdditionalItem.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { soldierId, description, bagId, quantity } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                if (bagId !== '') {
                    await Promise.all([
                        client.query(`
                            INSERT INTO additionalitem (id, soldier_id, description, bag_id, quantity) VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM additionalitem), $1, $2, $3, $4);`, [soldierId, description, bagId, quantity]),
                        client.query(`
                            UPDATE laundrybags SET soldier_id = $1 WHERE id = $2;`, [soldierId, bagId]),
                        client.query(`
                            INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2);`,
                            [req.session.username, `Add additional bag with number ${bagId} to soldier ${soldierId}`])
                    ]);
                } else {
                    await Promise.all([
                        client.query(`
                            INSERT INTO additionalitem (id, soldier_id, description, bag_id, quantity) VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM additionalitem), $1, $2, NULL, $3);`, [soldierId, description, quantity]),
                        client.query(`
                            INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2);`,
                            [req.session.username, `Add additional item to soldier ${soldierId}`])
                    ]);
                }

                await client.query('COMMIT');
                return res.status(200).send({ message: 'Additional item added successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error add item:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });
            } finally {
                client.release();
            }
        });

        this.app.get('/accommodation/getAllAdditionalItem', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT ai.id, s.namesoldier, ai.description, ai.quantity, lb.code
                    FROM additionalitem ai
					LEFT JOIN soldier s ON s.id = ai.soldier_id
                    LEFT JOIN laundrybags lb ON lb.id = ai.bag_id
                    WHERE s.camp_id = $1;`, [req.session.camp]);

                const result_data = result.rows;
                let total_res = [];

                await Promise.all(result_data.map(async (row) => {
                    total_res.push({
                        id: row.id,
                        soldierName: row.namesoldier,
                        description: row.description,
                        quantity: row.quantity,
                        code: row.code
                    });
                }));

                await client.query('COMMIT');
                return res.status(200).json(total_res);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error fetching data:', error);
                res.status(500).json({ message: 'Error fetching data from the database' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/returnAddtionalItem', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaReturnAdditionalItem.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { id, quantity } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const check_bag = await client.query(`
                SELECT bag_id FROM additionalitem ai
                LEFT JOIN laundrybags l ON l.id = ai.bag_id
                WHERE ai.id = $1 AND l.status <> 'None';`, [id]);

                if (check_bag.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This bag is an active laundry bag and cannot be returned.' });
                }

                const result_quantity = await client.query(`
                SELECT quantity FROM additionalitem WHERE id = $1;`, [id]);

                if (result_quantity.rows[0].quantity === quantity) {
                    await Promise.all([
                        client.query(`DELETE FROM additionalitem WHERE id = $1;`, [id]),
                        client.query(`INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2);`,
                            [req.session.username, `Return additional item`])
                    ]);
                } else {
                    await Promise.all([
                        client.query(`UPDATE additionalitem SET quantity = quantity::NUMERIC - $2 WHERE id = $1;`, [id, quantity]),
                        client.query(`INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2);`,
                            [req.session.username, `Reduced quantity of item with id ${id}`])
                    ]);
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'Item returned successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error return item:', error);
                res.status(500).json({ message: 'Error returning item!' });

            } finally {
                client.release();
            }
        });
    }

    defineRoutesFitnes() {

        // Serve APK file from local directory
        this.app.get('/download-apk-gym', this.isLoggedIn.bind(this), (req, res) => {
            // Path to your APK file
            const apkFilePath = path.join(__dirname, 'androidApp', 'RateFitnesCleaning-1.0-release.apk');

            // Check legality and existence of the APK file
            if (!this.checkApkFileLegality(apkFilePath, res)) {
                return;
            }

            // Set proper headers for an APK file
            res.setHeader('Content-Type', 'application/vnd.android.package-archive'); // Correct MIME type for APK
            res.setHeader('Content-Disposition', 'attachment; filename="RateFitnesCleaning-1.0-release.apk"'); // Force download with custom filename

            // Use res.download() to send the file to the client
            res.download(apkFilePath, (err) => {
                if (err) {
                    console.error('Error downloading the file:', err);
                    res.status(500).send('Error downloading the file');
                }
            });
        });

        this.app.post('/sendClientData', async (req, res) => {
            const { error } = clientDataSchema.validate(req.body);

            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { userId } = req.body;

            if (!userId) {
                return res.status(400).json({ message: 'User ID is required.' });
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const query = 'INSERT INTO fitness (id, soldierid) VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM fitness), $1) RETURNING id';
                const values = [userId];
                const result = await client.query(query, values);

                const soldierId = result.rows[0].id;

                req.session.soldierid = soldierId;

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
            const { error } = emojiDataSchema.validate(req.body);

            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { emoji } = req.body;

            if (!emoji) {
                return res.status(400).json({ message: 'Emoji is required.' });
            }

            const soldierId = req.session.soldierid;

            if (!soldierId) {
                return res.status(400).json({ message: 'Soldier ID not found in session.' });
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const query = 'UPDATE fitness SET emoji = $2 WHERE id = $1';
                const values = [soldierId, emoji];
                await client.query(query, values);

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
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const [data_emoji, result_percent_emoji] = await Promise.all([
                    client.query(`
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
                        WHERE s.camp_id = $1
                        GROUP BY s.namesoldier, created_date
                        ORDER BY created_date;`, [req.session.camp]),
                    client.query(`
                        SELECT 
                            COUNT(CASE WHEN f.emoji = '😞' THEN 1 END) AS percent_sad,
                            COUNT(CASE WHEN f.emoji = '😐' THEN 1 END) AS percent_neutral,
                            COUNT(CASE WHEN f.emoji = '😁' THEN 1 END) AS percent_very_happy
                        FROM fitness f
                        LEFT JOIN soldier s ON f.soldierid = s.id
                        WHERE s.camp_id = $1;`, [req.session.camp])
                ]);

                const data = data_emoji.rows;
                const dataPerEmj = result_percent_emoji.rows[0];

                await client.query('COMMIT');

                switch (req.session.username) {

                    case 'admin':
                        this.giveSpecificPermissionFitness(req.session.username, [0, 1, 2, 3, 4, 5, 6], res, data, dataPerEmj);
                        break;

                    default:
                        this.giveSpecificPermissionFitness(req.session.username, [0, 1, 2, 4, 5, 6], res, data, dataPerEmj);
                        break;
                }

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error fetching data:', error);
                res.status(500).json({ message: 'Error fetching data from the database' });

            } finally {
                client.release();
            }
        });

        this.app.post('/getAllEmoji', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = getAllEmojiSchema.validate(req.body);

            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { date1, date2 } = req.body;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const [data_emoji, data_emoji_total] = await Promise.all([
                    client.query(`
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
                        WHERE f.created_at::date BETWEEN $1 AND $2 AND s.camp_id = $3
                        GROUP BY s.namesoldier, created_date
                        ORDER BY created_date;
                    `, [date1, date2, req.session.camp]),
                    client.query(`
                        SELECT 
                            COUNT(CASE WHEN f.emoji = '😞' THEN 1 END) AS percent_sad,
                            COUNT(CASE WHEN f.emoji = '😐' THEN 1 END) AS percent_neutral,
                            COUNT(CASE WHEN f.emoji = '😁' THEN 1 END) AS percent_very_happy
                        FROM fitness f
                        LEFT JOIN soldier s ON f.soldierid = s.id
                        WHERE f.created_at::date BETWEEN $1 AND $2 AND s.camp_id = $3
                    `, [date1, date2, req.session.camp])
                ]);

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

                const workbook = new excelJS.Workbook();
                const worksheet = workbook.addWorksheet('Gym Usage Data');

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

                worksheet.columns = [
                    { width: 20 },
                    { width: 20 },
                    { width: 20 },
                ];

                data.forEach((row, index) => {
                    const formattedDate = row[0];
                    const averageEmoji = row[1];
                    const soldierCount = row[2];

                    const dataRow = worksheet.addRow([formattedDate, averageEmoji, soldierCount]);

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
                                fgColor: { argb: 'FFDDDDDD' },
                            };
                        });
                    }
                });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="report_gym.xlsx"');

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
                    WHERE camp_id = $1
                    GROUP BY status, type;`, [req.session.camp]);

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

                await Promise.all(Object.entries(statusMapping).map(async ([status, column]) => {
                    const query = `
                        SELECT ${column} as value
                        FROM laundrybags
                        WHERE ${column} <> 0 AND camp_id = $1;`;

                    try {
                        const results = await client.query(query, [req.session.camp]);

                        let totalTime = 0;
                        let localCount = 0;

                        results.rows.forEach(row => {
                            totalTime += parseInt(row.value, 10) || 0;
                            localCount += 1;
                        });

                        let updatedTime = localCount > 0 ? Math.floor(totalTime / localCount) : 0;
                        totalAvgTimeInSeconds += updatedTime;
                        count += localCount;

                        avgTimeData[status] = formatTime(updatedTime);

                    } catch (error) {
                        console.error(`Error executing query for status "${status}":`, error);
                    }
                }));

                const overallAverageTimeInSeconds = count > 0 ? Math.floor(totalAvgTimeInSeconds / count) : 0;
                const overallAverageFormatted = formatTime(overallAverageTimeInSeconds);

                await client.query('COMMIT');

                switch (req.session.username) {
                    case 'helpDeskGatis':
                    case 'laundrySupervaizer':
                        this.giveSpecificPermissionLaundry(req.session.username, [0, 2, 6], res, bagData, totalCounts, avgTimeData, overallAverageFormatted, headerTable, overallTotalMountFormatted);
                        break;
                    case 'admin':
                        this.giveSpecificPermissionLaundry(req.session.username, [0, 1, 2, 3, 4, 5, 6], res, bagData, totalCounts, avgTimeData, overallAverageFormatted, headerTable, overallTotalMountFormatted);
                        break;
                    default:
                        this.giveSpecificPermissionLaundry(req.session.username, [0, 1, 2, 4, 5, 6], res, bagData, totalCounts, avgTimeData, overallAverageFormatted, headerTable, overallTotalMountFormatted);
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

            const { codes, destination, prev_destination, campId } = req.body;

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

                    const insertPromises = codes.map((code) =>
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
                     WHERE timeout IS NOT NULL AND timein IS NOT NULL AND status = $1 AND camp_id = $2;`,
                    [prev_destination, campId]
                );

                const avgTimeRow = avgTimeResult.rows[0];
                if (avgTimeRow) {
                    const columnName = statusMapping[prev_destination.toLowerCase().trim()];
                    if (columnName) {
                        await client.query(
                            `UPDATE laundrybags 
                             SET ${columnName} = $1 
                             WHERE status = $2 AND camp_id = $3;`,
                            [Math.floor(avgTimeRow.avg_time_in_seconds), prev_destination, campId]
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

        this.app.post('/changeEndToEndStatus', async (req, res) => {

            const { error } = updateBagsScanerSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { codes, destination, prev_destination, campId } = req.body;

            if (!Array.isArray(codes)) {
                return res.status(400).json({ message: "Invalid codes array" });
            }

            if (codes.length === 0) {
                return res.status(401).json({ message: "An empty list of scanned bags cannot be processed" });
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const insertPromises = codes.map((code) =>
                    client.query(
                        `INSERT INTO laundryreport (bag_id, date_drop_off, date_ready_to_pick_up) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;`,
                        [code]
                    )
                );
                await Promise.all(insertPromises);

                await client.query('COMMIT');
                res.status(200).json({ message: "Bulk status change successful" });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(error);
                res.status(500).json({ message: "Internal server error" });
            } finally {
                client.release();
            }
        });

        this.app.post('/changeEndToEndStatusConsole', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = exchangeServiceSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { code, destination, prev_destination } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                await Promise.all([
                    client.query(
                        `INSERT INTO laundryreport (bag_id, date_drop_off, date_ready_to_pick_up) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;`,
                        [code]
                    )
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: "Bulk status change successful" });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(error); // Log the error
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

            const { code, prev_destination, destination, permCount } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const [result, resultCount] = await Promise.all([
                    client.query(`
                        SELECT l.code, s.namesoldier, l.status, l.laundrycount
                        FROM laundrybags l
						LEFT JOIN additionalitem ai ON ai.bag_id = l.id
                        LEFT JOIN soldier s ON s.laundry_bag_id = l.id OR ai.soldier_id = s.id
                        WHERE s.date_accommodation IS NOT NULL AND s.date_free IS NULL AND l.id = $1;`, [code]),
                    client.query(`
                        SELECT COUNT(*) AS count
                        FROM laundryreport
                        WHERE bag_id = $1 AND date_drop_off > NOW() - INTERVAL '30 minutes';`, [code])
                ]);

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

                if (destination === 'Linen Exchange service' && parseInt(resultCount.rows[0].count) > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: `The bag with number ${code} is already scanned with use Linen Exchange service` });
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

            const { countScaneCode, prev_destination, campId } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT *
                    FROM laundrybags l
					LEFT JOIN additionalitem ai ON ai.bag_id = l.id
                    LEFT JOIN soldier s ON s.laundry_bag_id = l.id OR ai.soldier_id = s.id
                    WHERE s.date_accommodation IS NOT NULL AND s.date_free IS NULL AND l.status = $1 AND l.camp_id = $2;`, [prev_destination, campId]);

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
					LEFT JOIN additionalitem ai ON ai.bag_id = l.id
                    LEFT JOIN soldier s ON s.laundry_bag_id = l.id OR ai.soldier_id = s.id
                    WHERE s.date_accommodation IS NOT NULL AND s.date_free IS NULL AND l.id = $1;`, [code]);

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: "Laundry bag is in storage" });
                }

                // if (result.rows[0].laundrycount > result.rows[0].maxcountlandry) {
                //     await client.query('ROLLBACK');
                //     return res.status(403).json({ message: `This bag has exceeded the ${result.rows[0].maxcountlandry} wash per month limit` });
                // }

                const bag = result.rows[0];

                const queries = [];

                if (destination === 'Ready to pick up') {
                    queries.push(client.query(`
                        UPDATE laundryreport SET date_ready_to_pick_up = CURRENT_TIMESTAMP WHERE bag_id = $1 AND date_ready_to_pick_up IS NULL;`, [code]));
                }

                if (prev_destination === 'None') {
                    queries.push(client.query(`
                        INSERT INTO laundryreport VALUES ($1, CURRENT_TIMESTAMP, NULL);`, [code]));

                    queries.push(client.query(`
                        UPDATE laundrybags SET timein = NULL, timeout = NULL, avg_drop_off_duration = 0, avg_transportation_duration = 0,
                        avg_laundry_duration = 0, avg_ready_to_pick_up_duration = 0, avg_transportation_drop_off_duration = 0 WHERE id = $1;`, [code]));

                    queries.push(client.query(`
                        UPDATE laundrybags SET laundrycount = laundrycount + 1 WHERE id = $1;`, [code]));

                } else {
                    queries.push(client.query(`
                        UPDATE laundrybags SET timeout = CURRENT_TIMESTAMP WHERE id = $1;`, [code]));

                    const avgTimeResult = await client.query(`
                        SELECT AVG(EXTRACT(EPOCH FROM (timeout - timein))) AS avg_time_in_seconds
                        FROM laundrybags
                        WHERE timeout IS NOT NULL AND timein IS NOT NULL AND status = $1 AND camp_id = $2;`, [prev_destination, req.session.camp]);

                    const avgTimeRow = avgTimeResult.rows[0];
                    if (avgTimeRow) {
                        const columnName = statusMapping[prev_destination.toLowerCase().trim()];
                        if (columnName) {
                            queries.push(client.query(`
                                UPDATE laundrybags
                                SET ${columnName} = $1
                                WHERE status = $2 AND camp_id = $3;`, [Math.floor(avgTimeRow.avg_time_in_seconds), prev_destination, req.session.camp]));
                        }
                    }
                }

                queries.push(client.query(`
                    UPDATE laundrybags SET status = $1, timein = CURRENT_TIMESTAMP WHERE id = $2;`, [destination, code]));

                queries.push(client.query(`
                    INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)`,
                    [req.session.username, `Change bag ${code} status from ${prev_destination} to ${destination}`]));

                await Promise.all(queries);

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
                    AND timein < NOW() - INTERVAL '1 week' AND camp_id = $1;`, [req.session.camp]);

                if (result.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "Late bags!" });
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

                if (status !== '') {
                    result = await client.query(`
                        WITH query1 AS (SELECT
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
                            s.date_accommodation IS NOT NULL AND
                            s.date_free IS NULL AND 
                            l.status = $1 AND
                            l.camp_id = $2
                        ORDER BY 
                        islate ASC),
                        query2 AS (SELECT
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
                            soldier s ON l.soldier_id = s.id
                        WHERE 
                            s.date_accommodation IS NOT NULL AND
                            s.date_free IS NULL AND 
                            l.status = $1 AND 
                            l.camp_id = $2
                        ORDER BY 
                        islate ASC)
						SELECT * FROM query1
						UNION ALL
						SELECT * FROM query2
						WHERE NOT EXISTS (SELECT 1 FROM query1);`, [status, req.session.camp]);
                } else {
                    result = await client.query(`
                        WITH query1 AS (SELECT
                            l.id,
                            l.code
                        FROM 
                            laundrybags l
                        LEFT JOIN 
                            additionalitem ai ON ai.bag_id = l.id
                        LEFT JOIN 
                            soldier s ON s.laundry_bag_id = l.id
                        WHERE 
                            s.date_accommodation IS NOT NULL AND
                            s.date_free IS NULL
                            AND l.camp_id = $1),
                        query2 AS (SELECT
                            l.id,
                            l.code
                        FROM 
                            laundrybags l
                        LEFT JOIN 
                            additionalitem ai ON ai.bag_id = l.id
                        LEFT JOIN 
                            soldier s ON ai.soldier_id = s.id
                        WHERE 
                            s.date_accommodation IS NOT NULL AND
                            s.date_free IS NULL
                            AND l.camp_id = $1)
						SELECT * FROM query1
						UNION ALL
						SELECT * FROM query2
						WHERE NOT EXISTS (SELECT 1 FROM query1);`, [req.session.camp]);
                }

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

                const [result, result_nationality] = await Promise.all([
                    client.query(`
                        WITH latest_soldier AS (
                            SELECT DISTINCT ON (s.laundry_bag_id)
                                s.id,
                                s.laundry_bag_id,
                                s.namesoldier,
                                s.country
                            FROM soldier s
                            WHERE s.laundry_bag_id IS NOT NULL AND s.camp_id = $3
                            ORDER BY s.laundry_bag_id, 
                                    (s.date_free IS NULL) DESC, 
                                    s.date_free DESC
                        ),
                        query1 AS (
                            SELECT 
                                l.code,
                                l.type,
                                CASE 
                                    WHEN l.status = 'None' THEN 'In the soldier'
                                    ELSE l.status
                                END AS status,
                                ls.namesoldier, 
                                ls.country,
                                TO_CHAR(lr.date_drop_off, 'YYYY-MM-DD HH:MI') AS date_drop_off, 
                                CASE 
                                    WHEN l.status = 'None' AND lr.date_ready_to_pick_up IS NULL THEN 'Remove by user'
                                    ELSE TO_CHAR(lr.date_ready_to_pick_up, 'YYYY-MM-DD HH:MI')
                                END AS date_ready_to_pick_up
                            FROM laundrybags l
                            JOIN laundryreport lr ON lr.bag_id = l.id
                            JOIN latest_soldier ls ON l.id = ls.laundry_bag_id
                            WHERE lr.date_drop_off BETWEEN $1 AND $2 AND l.camp_id = $3
                        ),
                        query2 AS (
                            SELECT 
                                l.code,
                                l.type,
                                CASE 
                                    WHEN l.status = 'None' THEN 'In the soldier'
                                    ELSE l.status
                                END AS status,
                                s.namesoldier, 
                                s.country,
                                TO_CHAR(lr.date_drop_off, 'YYYY-MM-DD HH:MI') AS date_drop_off, 
                                CASE 
                                    WHEN l.status = 'None' AND lr.date_ready_to_pick_up IS NULL THEN 'Remove by user'
                                    ELSE TO_CHAR(lr.date_ready_to_pick_up, 'YYYY-MM-DD HH:MI')
                                END AS date_ready_to_pick_up
                            FROM laundrybags l
                            JOIN laundryreport lr ON lr.bag_id = l.id
                            JOIN soldier s ON l.soldier_id = s.id
                            WHERE lr.date_drop_off BETWEEN $1 AND $2 AND l.camp_id = $3
                        )
                        SELECT * FROM query1
                        UNION ALL
                        SELECT * FROM query2
                        WHERE NOT EXISTS (SELECT 1 FROM query1);`, [selectedDate1, selectedDate2, req.session.camp]),
                    client.query(`
                        WITH latest_soldier AS (
                            SELECT DISTINCT ON (s.laundry_bag_id)
                            s.id,
                            s.laundry_bag_id,
                            s.country
                            FROM soldier s
                            WHERE s.laundry_bag_id IS NOT NULL AND s.camp_id = $3
                            ORDER BY s.laundry_bag_id, 
                                (s.date_free IS NULL) DESC, 
                                s.date_free DESC
                        ),
                        query1 AS (SELECT 
                            COUNT(*) AS total_count_bags,
                            ls.country
                        FROM laundrybags l
                        JOIN laundryreport lr ON lr.bag_id = l.id
                        JOIN latest_soldier ls ON l.id = ls.laundry_bag_id
                        WHERE lr.date_drop_off BETWEEN $1 AND $2 AND l.camp_id = $3
                        GROUP BY ls.country),
						query2 AS (SELECT 
                            COUNT(*) AS total_count_bags,
                            s.country
                        FROM laundrybags l
                        JOIN laundryreport lr ON lr.bag_id = l.id
						JOIN soldier s ON l.soldier_id = s.id
                        WHERE lr.date_drop_off BETWEEN $1 AND $2 AND l.camp_id = $3
                        GROUP BY s.country)
						SELECT * FROM query1
						UNION ALL
						SELECT * FROM query2
						WHERE NOT EXISTS (SELECT 1 FROM query1);`, [selectedDate1, selectedDate2, req.session.camp])
                ]);

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

            const { error } = schemaLaundryReport.validate(req.body);
            if (error) {
                return res.status(400).send('Invalid input data.');
            }

            const { result, result_nationality, filtersBags, filtersNationalBags } = req.body;

            // Function to filter data based on inputs
            const filterData = (data, filters) => {
                return data.filter(item => {
                    return Object.keys(filters).every(key => {
                        if (!filters[key]) return true; // Skip empty filters
                        return String(item[key] || '').toLowerCase().includes(filters[key].toLowerCase());
                    });
                });
            };

            try {

                // Filter both datasets
                const filteredLaundry = filterData(result, filtersBags);
                const filteredLaundryNational = filterData(result_nationality, filtersNationalBags);

                const workbook = new excelJS.Workbook();
                const worksheet1 = workbook.addWorksheet('Washed Bags');
                const worksheet2 = workbook.addWorksheet('Bags by Nationality');

                const headers1 = ['Bag number', 'Soldier name', 'Nationality', 'Bag type', 'Location', 'Date of issue', 'Collection date'];
                worksheet1.addRow(headers1).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                const headers2 = ['Nationality', 'Number of Bags'];
                worksheet2.addRow(headers2).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                worksheet1.columns = headers1.map(header => ({ header, width: header.length + 10 }));
                worksheet2.columns = headers2.map(header => ({ header, width: header.length + 10 }));

                await Promise.all(filteredLaundry.map(async ({ bagNumber, soldierName, nationality, bagType, statusBag, dateIn, dateOut }, index) => {
                    const row = worksheet1.addRow([bagNumber, soldierName, nationality, bagType, statusBag, dateIn, dateOut]);
                    row.eachCell((cell) => {
                        cell.alignment = { horizontal: 'center' };
                    });

                    // Style each cell
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' },
                        };
                    });

                    // Apply alternating row color
                    if (index % 2 === 0) {
                        row.eachCell((cell) => {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFDDDDDD' }, // Light grey
                            };
                        });
                    }

                    if (dateIn === dateOut) {
                        row.eachCell((cell) => {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFFFF00' } // Yellow color
                            };
                        });
                    }
                }));

                await Promise.all(filteredLaundryNational.map(async ({ nationality, bagCount }, index) => {
                    const row = worksheet2.addRow([nationality, bagCount]);
                    row.eachCell((cell) => {
                        cell.alignment = { horizontal: 'center' };
                    });

                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' },
                        };
                    });

                    // Apply alternating row color
                    if (index % 2 === 0) {
                        row.eachCell((cell) => {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFDDDDDD' }, // Light grey
                            };
                        });
                    }

                }));

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
            const campId = !req.body.isValidCode && req.session.username ? req.session.camp : req.body.campId;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const check_exist = await client.query(`SELECT * FROM laundrybags WHERE id = $1;`, [epc]);

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This bag already exists!' });
                }

                await client.query(`INSERT INTO laundrybags(id, code, type, status, timein, timeout, maxcountlandry, soldier_id, camp_id) VALUES ($1, $2, $3, 'None', NULL, NULL, $4, NULL, $5);`,
                    [epc, code, type, maxcount, campId]
                );

                const username = req.session.username ? req.session.username : "PhoneUser";

                // Query the database for the user
                await Promise.all([
                    client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [username, `Add bag with code ${code}`])
                ]);

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

                const check_exist = await client.query(`
                    SELECT * FROM soldier s
					LEFT JOIN additionalitem ai ON ai.soldier_id = s.id
                    LEFT JOIN laundrybags l ON l.id = s.laundry_bag_id OR ai.soldier_id = s.id
                    WHERE s.date_accommodation IS NOT NULL AND date_free IS NULL AND l.id = $1`, [code]);

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This bag is set to the soldier!' });
                }

                const username = req.session.username ? req.session.username : "PhoneUser";

                await Promise.all([
                    client.query(`DELETE FROM laundryreport WHERE bag_id = $1`, [code]),
                    client.query(`DELETE FROM laundrybags WHERE id = $1`, [code]),
                    client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [username, `Remove bag with code ${bagCode}`])
                ]);

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

                await Promise.all([
                    client.query(`UPDATE laundrybags SET type = $1, maxcountlandry = $2 WHERE id = $3;`, [bagType, maxWash, bagId]),
                    client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Edit bag with code ${bagCode} set type ${bagType} and max washed ${maxWash}`])
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The bag was successfully updated' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error updating bag:', error);
                res.status(500).json({ message: 'Failed to update bag.' });

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

                    const result = await client.query(`SELECT * FROM laundrybags WHERE id = $1;`, [oldCode]);
                    const response = result.rows[0];

                    await client.query(`INSERT INTO laundrybags VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);`, [
                        newCode,
                        code,
                        type,
                        response.status || 'None',
                        response.timein || null,
                        response.timeout || null,
                        response.avg_drop_off_duration || 0,
                        response.avg_transportation_duration || 0,
                        response.avg_laundry_duration || 0,
                        response.avg_ready_to_pick_up_duration || 0,
                        response.avg_transportation_drop_off_duration || 0,
                        response.laundrycount || 0,
                        maxcount,
                        response.soldier_id || null,
                        response.camp_id]);

                    await Promise.all([
                        client.query(`UPDATE additionalItem SET bag_id = $1 WHERE bag_id = $2`, [newCode, oldCode]),
                        client.query(`UPDATE soldier SET laundry_bag_id = $1 WHERE laundry_bag_id = $2`, [newCode, oldCode]),
                        client.query(`UPDATE laundryreport SET bag_id = $1 WHERE bag_id = $2`, [newCode, oldCode]),
                        client.query(`DELETE FROM laundrybags WHERE id = $1`, [oldCode])
                    ]);

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

        // Serve APK file from local directory
        this.app.get('/download-apk-asset', this.isLoggedIn.bind(this), (req, res) => {
            // Path to your APK file
            const apkFilePath = path.join(__dirname, 'androidApp', 'RFIDLaundryAsset-1.0-release.apk');

            // Check legality and existence of the APK file
            if (!this.checkApkFileLegality(apkFilePath, res)) {
                return;
            }

            // Set proper headers for an APK file
            res.setHeader('Content-Type', 'application/vnd.android.package-archive'); // Correct MIME type for APK
            res.setHeader('Content-Disposition', 'attachment; filename="RFIDLaundryAsset-1.0-release.apk"'); // Force download with custom filename

            // Use res.download() to send the file to the client
            res.download(apkFilePath, (err) => {
                if (err) {
                    console.error('Error downloading the file:', err);
                    res.status(500).send('Error downloading the file');
                }
            });
        });

        this.app.post('/allAssets', async (req, res) => {
            const { error } = shemaGetBags.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            if (!req.body.isValidCode && !req.session?.username) {
                return res.status(401).json({ message: "Unauthorized access: Invalid product code or session." });
            }

            const client = await pool.connect();

            const camp_id = !req.body.isValidCode && req.session.username ? req.session.camp : req.body.campId;

            try {
                // Optional transaction for consistent reads
                await client.query('BEGIN');

                const [resultAllAssets, resultKeys, resultLocations, resultAllLostItem] = await Promise.all([
                    client.query('SELECT * FROM assets WHERE camp_id = $1', [camp_id]),
                    client.query(`
                        SELECT id AS id, code AS name, quantity FROM assets WHERE camp_id = $1;`, [camp_id]),
                    client.query(`
                        SELECT id, namesoldier AS name FROM soldier WHERE date_accommodation IS NOT NULL AND date_free IS NULL AND camp_id = $1;`, [camp_id]),
                    client.query(`
                        SELECT nameitem, description, namesoldier, lost_quantity FROM lostitem l
                        LEFT JOIN soldier s ON s.id = l.soldier_id
                        WHERE l.camp_id = $1;`, [camp_id])
                ]);

                // Process data
                const assets = resultKeys.rows.map(row => ({
                    id: row.id,
                    code: row.name,
                    quantity: row.quantity
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
                    sub_location_id: row.location_key,
                    categorie: row.categorie,
                    quantity: row.quantity,
                    mrah: row.mrah,
                    owner: row.asset_owner,
                    status: row.status,
                    expandable: row.expandable,
                    description: row.description,
                }));

                const allLostItem = resultAllLostItem.rows.map(row => ({
                    nameItem: row.nameitem,
                    description: row.description,
                    soldierName: row.namesoldier,
                    lostQuantity: row.lost_quantity
                }));

                // Commit transaction (optional here)
                await client.query('COMMIT');

                // Send response
                res.status(200).json({
                    assets,
                    locations,
                    allAssets,
                    allLostItem
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

        this.app.get('/getAllAssets', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                const result = await client.query(`
                    SELECT * FROM assets WHERE camp_id = $1`, [req.session.camp]);

                res.status(200).json(result.rows);
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Error fetching all assets:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });
            } finally {
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
                const camp_id = !req.body.isValidCode && req.session.username ? req.session.camp : req.body.campId;

                const result = await client.query(`
                        SELECT k.id, k.namekey, r.nameroom, r.id AS roomid, camp_id
                        FROM key k
                        LEFT JOIN roomskey rk ON rk.keyid = k.id
                        LEFT JOIN rooms r ON rk.roomid = r.id
						LEFT JOIN buildroom br ON br.roomid = r.id
						LEFT JOIN buildings b ON b.id = br.buildid
						WHERE b.camp_id = $1;`, [camp_id]);

                const result_key_data = result.rows;
                let total_res = [];

                await Promise.all(result_key_data.map(async (row) => {
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
                }));

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
                    LEFT JOIN buildroom br ON br.roomid = r.id
                    LEFT JOIN buildings b ON b.id = br.buildid
                    WHERE b.camp_id = $1;`, [req.session.camp]);

                const result_key_data = result.rows;
                let total_res = [];

                await Promise.all(result_key_data.map(async (row) => {
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
                }));

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
                        SELECT r.id, nameroom, COALESCE(SUM(a.quantity::NUMERIC), 0) AS count_assets
                        FROM rooms r
                        LEFT JOIN assets a ON r.id = a.location_room
                        LEFT JOIN buildroom br ON br.roomid = r.id 
                        JOIN buildings b ON b.id = br.buildid AND b.camp_id = $2
                        WHERE br.buildid = $1
                        GROUP BY nameroom, r.id
                        ORDER BY nameroom;`, [numBuild, req.session.camp]);

                    inventory = result_get_room.rows.map(row => ({
                        id: row.id,
                        name: row.nameroom,
                        quantity: row.count_assets
                    }));

                } else {

                    const result_get_room = await client.query(`
                        SELECT r.id, nameroom, COALESCE(SUM(a.quantity::NUMERIC), 0) AS count_assets
                        FROM rooms r
                        LEFT JOIN assets a ON r.id = a.location_room
                        LEFT JOIN buildroom br ON r.id = br.roomid
						JOIN buildings b ON b.id = br.buildid AND b.camp_id = $1
                        GROUP BY nameroom, r.id
                        ORDER BY nameroom;`, [req.session.camp]);

                    inventory = result_get_room.rows.map(row => ({
                        id: row.id,
                        name: row.nameroom,
                        quantity: row.count_assets
                    }));
                }

                const resultBuild = await client.query(`SELECT id, namebuilding FROM buildings WHERE camp_id = $1`, [req.session.camp]);

                navBuild = resultBuild.rows.map(row => ({
                    name: row.namebuilding,
                    id: row.id
                }));

                await client.query('COMMIT');

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to open asset.' });
            } finally {
                client.release();
            }

            switch (req.session.username) {
                case 'admin':
                    this.giveSpecificPermissionAssets(req.session.username, [0, 1, 2, 3, 4, 5, 6], res, inventory, navBuild, numBuild);
                    break;

                default:
                    this.giveSpecificPermissionAssets(req.session.username, [0, 1, 2, 4, 5, 6], res, inventory, navBuild, numBuild);
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

                let result_get_room;

                if (numBuild) {
                    result_get_room = await client.query(`
                        SELECT r.id, nameroom, COALESCE(SUM(a.quantity::NUMERIC), 0) AS count_assets
                        FROM rooms r
                        LEFT JOIN assets a ON r.id = a.location_room
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        JOIN buildings b ON b.id = br.buildid AND b.camp_id = $2
                        WHERE br.buildid = $1
                        GROUP BY nameroom, r.id
                        ORDER BY nameroom;`, [numBuild, req.session.camp]);
                } else {
                    result_get_room = await client.query(`
                        SELECT r.id, nameroom, COALESCE(SUM(a.quantity::NUMERIC), 0) AS count_assets
                        FROM rooms r
                        LEFT JOIN assets a ON r.id = a.location_room
                        LEFT JOIN buildroom br ON r.id = br.roomid
						JOIN buildings b ON b.id = br.buildid AND b.camp_id = $1
                        GROUP BY nameroom, r.id
                        ORDER BY nameroom;`, [req.session.camp]);
                }

                await Promise.all(result_get_room.rows.map(async (row) => {
                    nameroomSetCount.push({ id: row.id, nameroom: row.nameroom, count_assets: row.count_assets });
                }));

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

                let result_get_room;

                if (numRoom)
                    result_get_room = await client.query(`
                        SELECT a.id, code, name_assets, t.type_name, r.nameroom, k.id AS keyid, k.namekey, categorie, quantity, mrah, asset_owner, status, expandable, description
                        FROM assets a
                        LEFT JOIN assetstype t ON t.id = a.type_id
                        LEFT JOIN rooms r ON r.id = a.location_room
                        LEFT JOIN key k ON k.id = a.location_key
                        WHERE location_room = $1;`, [numRoom]);
                else
                    result_get_room = await client.query(`
                        SELECT a.id, code, name_assets, t.type_name, r.nameroom, k.id AS keyid, k.namekey, categorie, quantity, mrah, asset_owner, status, expandable, description
                        FROM assets a
                        LEFT JOIN assetstype t ON t.id = a.type_id
                        LEFT JOIN rooms r ON r.id = a.location_room
                        LEFT JOIN key k ON k.id = a.location_key;`);

                await Promise.all(result_get_room.rows.map(async (row) => {
                    nameAssetSetCount.push({
                        id: row.id,
                        code: row.code,
                        name: row.name_assets,
                        type: row.type_name,
                        location: row.nameroom,
                        keyid: row.keyid,
                        namekey: row.namekey ? row.namekey : 'There is no associated key',
                        categorie: row.categorie,
                        quantity: row.quantity,
                        mrah: row.mrah,
                        owner: row.asset_owner,
                        status: row.status,
                        expandable: row.expandable,
                        description: row.description
                    });
                }));

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

                const [result] = await Promise.all([
                    client.query('SELECT id, type_name AS name FROM assetstype;')
                ]);

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

            const { assetId,
                assetName,
                assetType,
                assetLocation,
                assetSubLocation,
                assetCategory,
                assetQuantity,
                assetMrah,
                assetOwner,
                assetStatus,
                assetExpandable,
                assetDescription
            } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const result_asset_quantity = await client.query(`SELECT quantity FROM assets WHERE id = $1;`, [assetId]);
                const asset_quantity = result_asset_quantity.rows[0].quantity;

                if (assetSubLocation !== '') {
                    await client.query(`UPDATE assets SET 
                        name_assets = $2, 
                        type_id = $3, 
                        location_room = $4, 
                        location_key = $5,
                        categorie = $6,
                        quantity = $7,
                        mrah = $8,
                        asset_owner = $9,
                        status = $10,
                        expandable = $11,
                        description = $12 WHERE id = $1`,
                        [assetId, assetName, assetType, assetLocation, assetSubLocation, assetCategory, assetQuantity, assetMrah, assetOwner, assetStatus, assetExpandable, assetDescription ? assetDescription : null]
                    );
                } else {
                    await client.query(`UPDATE assets SET 
                        name_assets = $2, 
                        type_id = $3, 
                        location_room = $4, 
                        location_key = NULL,
                        categorie = $5,
                        quantity = $6,
                        mrah = $7,
                        asset_owner = $8,
                        status = $9,
                        expandable = $10,
                        description = $11 WHERE id = $1`,
                        [assetId, assetName, assetType, assetLocation, assetCategory, assetQuantity, assetMrah, assetOwner, assetStatus, assetExpandable, assetDescription ? assetDescription : null]
                    );
                }

                const result_exist_date = await client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [req.session.camp]);

                const queries = [];

                if (result_exist_date.rows.length > 0) {
                    if (asset_quantity === assetQuantity)
                        queries.push(client.query(`UPDATE asset_actions SET change_modificate_asset_quantity = change_modificate_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [assetQuantity, req.session.camp]));

                    else if (asset_quantity > assetQuantity)
                        queries.push(client.query(`UPDATE asset_actions SET change_remove_asset_quantity = change_remove_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [asset_quantity - assetQuantity, req.session.camp]));

                    else
                        queries.push(client.query(`UPDATE asset_actions SET change_asset_quantity = change_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [assetQuantity - asset_quantity, req.session.camp]));

                } else {
                    if (asset_quantity === assetQuantity)
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, 0, $1, $2);`, [assetQuantity, req.session.camp]));

                    else if (asset_quantity > assetQuantity)
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, $1, 0, 0, $2);`, [asset_quantity - assetQuantity, req.session.camp]));

                    else
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, $1, 0, 0, 0, $2);`, [assetQuantity - asset_quantity, req.session.camp]));
                }

                queries.push(client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Edit asset with code ${assetId} set name ${assetName}, type ${assetType}, location ${assetLocation}, sublocation ${assetSubLocation}, category ${assetCategory}, quantity ${assetQuantity}, mrah ${assetMrah}, owner ${assetOwner}, status ${assetStatus}, expandable ${assetExpandable}, description ${assetDescription}`]));

                await Promise.all(queries);

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

            const { oldCode, newCode, code, name, type, location, subLocation, category, quantity, mrah, owner, status, expandable, description, campId } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const result_asset_quantity = await client.query(`SELECT quantity, camp_id FROM assets WHERE id = $1;`, [oldCode]);
                const asset_quantity = result_asset_quantity.rows[0].quantity;
                const oldCampId = result_asset_quantity.rows[0].camp_id;

                if (oldCode === newCode) {
                    if (subLocation !== '') {
                        await client.query(`UPDATE assets SET 
                            code = $2,
                            name_assets = $3, 
                            type_id = $4, 
                            location_room = $5, 
                            location_key = $6, 
                            categorie = $7, 
                            quantity = $8,
                            mrah = $9, 
                            asset_owner = $10, 
                            status = $11,
                            expandable = $12,
                            description = $13
                            WHERE id = $1`,
                            [newCode, code, name, type, location, subLocation, category, quantity, mrah, owner, status, expandable, description ? description : null]
                        );
                    } else {
                        await client.query(`UPDATE assets SET 
                            code = $2, 
                            name_assets = $3, 
                            type_id = $4, 
                            location_room = $5, 
                            location_key = NULL,
                            categorie = $6, 
                            quantity = $7,
                            mrah = $8, 
                            asset_owner = $9, 
                            status = $10,
                            expandable = $11,
                            description = $12
                            WHERE id = $1`,
                            [newCode, code, name, type, location, category, quantity, mrah, owner, status, expandable, description ? description : null]
                        );
                    }

                } else {

                    if (subLocation !== '') {

                        await client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
                            [newCode, code, name, type, location, subLocation, category, quantity, mrah, owner, status, expandable, description ? description : null, oldCampId]
                        );

                    } else {
                        await client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9, $10, $11, $12, $13);`,
                            [newCode, code, name, type, location, category, quantity, mrah, owner, status, expandable, description ? description : null, oldCampId]
                        );
                    }

                    await client.query(`DELETE FROM assets WHERE id = $1`,
                        [oldCode]
                    );
                }

                const result_exist_date = await client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [campId]);

                const queries = [];

                if (result_exist_date.rows.length > 0) {
                    if (asset_quantity === quantity)
                        queries.push(client.query(`UPDATE asset_actions SET change_modificate_asset_quantity = change_modificate_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [quantity, campId]));

                    else if (asset_quantity > quantity)
                        queries.push(client.query(`UPDATE asset_actions SET change_remove_asset_quantity = change_remove_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [asset_quantity - quantity, campId]));

                    else
                        queries.push(client.query(`UPDATE asset_actions SET change_asset_quantity = change_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [quantity - asset_quantity, campId]));

                } else {
                    if (asset_quantity === quantity)
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, 0, $1, $2);`, [quantity, campId]));

                    else if (asset_quantity > quantity)
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, $1, 0, 0, $2);`, [asset_quantity - quantity, campId]));

                    else
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, $1, 0, 0, 0, $2);`, [quantity - asset_quantity, campId]));
                }

                queries.push(client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    ['PhoneUser', `Edit asset with code ${oldCode} set code ${newCode}, type=${type}, location=${location}, sublocation=${subLocation}, category=${category}, quantity=${quantity}, mrah=${mrah}, owner=${owner}, status=${status}, expandable=${expandable}, description=${description}`]));

                await Promise.all(queries);

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

            const {
                assetEps,
                assetCodeSearch,
                assetAddName,
                selectedAddTypeId,
                selectedAddLocationId,
                selectedAddSubLocationId,
                assetAddCategorie,
                assetQuantity,
                assetAddMrah,
                assetAddOwner,
                assetStatus,
                assetAddExpandable,
                assetAddDescription } = req.body;

            const client = await pool.connect();
            const campId = !req.body.isValidCode && req.session.username ? req.session.camp : req.body.campId;

            try {
                await client.query('BEGIN');

                const check_exist = await client.query(`SELECT * FROM assets WHERE id = $1;`, [assetEps]);

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This asset already exists!' });
                }

                const queries = [];

                if (selectedAddSubLocationId !== '') {
                    queries.push(client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
                        [assetEps, assetCodeSearch, assetAddName, selectedAddTypeId, selectedAddLocationId, selectedAddSubLocationId, assetAddCategorie, assetQuantity, assetAddMrah, assetAddOwner, assetStatus, assetAddExpandable, assetAddDescription ? assetAddDescription : null, campId]
                    ));

                } else {
                    queries.push(client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9, $10, $11, $12, $13);`,
                        [assetEps, assetCodeSearch, assetAddName, selectedAddTypeId, selectedAddLocationId, assetAddCategorie, assetQuantity, assetAddMrah, assetAddOwner, assetStatus, assetAddExpandable, assetAddDescription ? assetAddDescription : null, campId]
                    ));
                }

                const result_exist_date = await client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [campId]);
                if (result_exist_date.rows.length > 0) {
                    queries.push(client.query(`UPDATE asset_actions SET change_asset_quantity = change_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [assetQuantity, campId]));

                } else {
                    queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, $1, 0, 0, 0, $2);`, [assetQuantity, campId]));
                }

                const username = req.session.username ? req.session.username : 'PhoneUser';

                queries.push(client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [username, `Add asset with code ${assetEps} and name ${assetAddName}`]));

                await Promise.all(queries);

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
            const campId = !req.body.isValidCode && req.session.username ? req.session.camp : req.body.campId;

            try {
                await client.query('BEGIN');

                const result_quantity = await client.query(`SELECT quantity FROM assets WHERE id = $1`, [code]);
                const asset_quantity = result_quantity.rows[0].quantity;

                const result_exist_date = await client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [campId]);
                const queries = [];

                if (result_exist_date.rows.length > 0) {
                    queries.push(client.query(`UPDATE asset_actions SET change_remove_asset_quantity = change_remove_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [asset_quantity, campId]));
                } else {
                    queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, $1, 0, 0, $2);`, [asset_quantity, campId]));
                }

                queries.push(client.query(`DELETE FROM assets WHERE id = $1`, [code]));

                const username = req.session.username ? req.session.username : 'PhoneUser';
                queries.push(client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [username, `Remove asset with code ${code}`]));

                await Promise.all(queries);

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

                await Promise.all([
                    client.query(`INSERT INTO assetstype VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM assetstype), $1);`, [assetType]),
                    client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Add asset type with name ${assetType}`])
                ]);

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

                const check_exist = await client.query(`SELECT * FROM assets WHERE type_id = $1;`, [assetTypeId]);

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This type is associated with an asset and cannot be deleted!' });
                }

                await Promise.all([
                    client.query(`DELETE FROM assetstype WHERE id = $1`, [assetTypeId]),
                    client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Remove asset type with name ${check_exist.rows[0].type_name}`])
                ]);

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

        this.app.post('/assets/lostItem', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaLostItems.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            if (!req.session.camp) {
                return res.status(401).json({ message: "You not select camp. First select camp then add lost item?!" });
            }

            const { itemName, description, soldierId, lostQuantity } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`SELECT * FROM assets WHERE code = $1 AND camp_id = $2;`, [itemName, req.session.camp]);
                const item_into = result.rows[0];

                const get_exist_lost_item = await client.query(`SELECT * FROM lostitem WHERE nameitem = $1 AND camp_id = $2;`, [itemName, req.session.camp]);

                const queries = [];

                if (get_exist_lost_item.rows.length > 0) {
                    queries.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC + $1 WHERE nameitem = $2 AND camp_id = $3;`, [lostQuantity, itemName, req.session.camp]));
                } else {
                    queries.push(client.query(`INSERT INTO lostitem VALUES (
                        (SELECT COALESCE(MAX(id)::integer, 0) + 1 FROM lostitem), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);`,
                        [
                            itemName,
                            description !== '' ? description : null,
                            soldierId,
                            lostQuantity,
                            item_into.id,
                            item_into.name_assets,
                            item_into.type_id,
                            item_into.location_room,
                            item_into.location_key,
                            item_into.categorie,
                            item_into.mrah,
                            item_into.asset_owner,
                            item_into.status,
                            item_into.expandable,
                            item_into.description,
                            item_into.camp_id
                        ]));
                }

                const asset_quantity = result.rows[0].quantity;
                const asset_id = result.rows[0].id;

                const result_exist_date = await client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [req.session.camp]);

                if (result.rows.length > 0) {
                    if (result_exist_date.rows.length > 0) {
                        queries.push(client.query(`UPDATE asset_actions SET change_lost_asset_quantity = change_lost_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [lostQuantity, req.session.camp]));
                    } else {
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, $1, 0, $2);`, [lostQuantity, req.session.camp]));
                    }

                    if (asset_quantity - lostQuantity > 0) {
                        queries.push(client.query(`UPDATE assets SET quantity = quantity::NUMERIC - $1 WHERE id = $2`, [lostQuantity, asset_id]));
                    } else {
                        queries.push(client.query(`DELETE FROM assets WHERE id = $1`, [asset_id]));
                    }

                    queries.push(client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                        [req.session.username, `Lost asset with code ${itemName}`]));
                }

                await Promise.all(queries);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Lost item added successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to add lost item' });

            } finally {
                client.release();
            }

        });

        this.app.post('/assets/restorLostAsset', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = schemaRestorItems.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { code, lost_quantity } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const [check_exist, result_exist_date, result_restor_data] = await Promise.all([
                    client.query(`SELECT * FROM assets WHERE code = $1 AND camp_id = $2;`, [code, req.session.camp]),
                    client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [req.session.camp]),
                    client.query(`SELECT * FROM lostitem WHERE nameitem = $1 AND camp_id = $2;`, [code, req.session.camp])
                ]);

                const restor_data = result_restor_data.rows[0];

                if (check_exist.rows.length > 0) {
                    await Promise.all([
                        client.query(`UPDATE assets SET quantity = quantity::NUMERIC + $1 WHERE id = $2;`, [lost_quantity, restor_data.item_id]),
                        client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC - $1 WHERE item_id = $2;`, [lost_quantity, restor_data.item_id]),
                        result_exist_date.rows.length > 0
                            ? client.query(`UPDATE asset_actions SET change_asset_quantity = change_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [lost_quantity, req.session.camp])
                            : client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, $1, 0, 0, 0, $2);`, [lost_quantity, req.session.camp])
                    ]);
                } else {
                    await Promise.all([
                        client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`, [
                            restor_data.item_id,
                            restor_data.nameitem,
                            restor_data.item_name,
                            restor_data.item_type_id,
                            restor_data.item_location_room,
                            restor_data.item_location_key,
                            restor_data.item_category,
                            lost_quantity,
                            restor_data.item_mrah,
                            restor_data.item_owner,
                            restor_data.item_status,
                            restor_data.item_expandable,
                            restor_data.item_description,
                            restor_data.camp_id
                        ]),
                        client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC - $1 WHERE item_id = $2;`, [lost_quantity, restor_data.item_id]),
                        result_exist_date.rows.length > 0
                            ? client.query(`UPDATE asset_actions SET change_asset_quantity = change_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [lost_quantity, req.session.camp])
                            : client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, $1, 0, 0, 0, $2);`, [lost_quantity, req.session.camp])
                    ]);
                }

                await client.query(`DELETE FROM lostitem WHERE lost_quantity::NUMERIC = 0;`);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Lost item restored successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to restore lost item' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/viewReport', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = schemaReport.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            let { selectedDate1, selectedDate2 } = req.body;

            // Ensure the dates are formatted correctly
            selectedDate1 = moment(selectedDate1).startOf('day').format('YYYY-MM-DD HH:mm:ss');
            selectedDate2 = moment(selectedDate2).endOf('day').format('YYYY-MM-DD HH:mm:ss');

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Query for asset details
                const [result, result_count_asset] = await Promise.all([
                    client.query(
                        `SELECT 
                            a.id, 
                            code,
                            name_assets,
                            type_name AS type, 
                            b.namebuilding AS location_building,
                            r.nameroom AS location_room,
                            categorie,
                            quantity,
                            mrah,
                            asset_owner,
                            status,
                            expandable,
                            description
                        FROM assets a
                        LEFT JOIN assetstype at ON a.type_id = at.id
                        LEFT JOIN rooms r ON r.id = a.location_room
                        LEFT JOIN buildroom br ON br.roomid = a.location_room
                        JOIN buildings b ON b.id = br.buildid AND b.camp_id = $1;`, [req.session.camp]
                    ),
                    client.query(
                        `WITH date_series AS (
                            SELECT generate_series(
                            $1::DATE, 
                            $2::DATE, 
                            '1 day'
                            )::DATE AS event_date
                        ),
                        asset_changes AS (
                            SELECT 
                            date_change::DATE AS event_date, 
                            change_asset_quantity::NUMERIC AS total_added, 
                            change_modificate_asset_quantity::NUMERIC AS total_modifain, 
                            change_remove_asset_quantity::NUMERIC AS total_remove, 
                            change_lost_asset_quantity::NUMERIC AS total_lost
                            FROM asset_actions 
                            WHERE date_change BETWEEN $1 AND $2 + INTERVAL '1 day' AND camp_id = $3
                        ),
                        asset_after_changes AS (
                            SELECT 
                            change_asset_quantity::NUMERIC AS total_added, 
                            change_modificate_asset_quantity::NUMERIC AS total_modifain, 
                            change_remove_asset_quantity::NUMERIC AS total_remove, 
                            change_lost_asset_quantity::NUMERIC AS total_lost
                            FROM asset_actions 
                            WHERE date_change > $2 + INTERVAL '1 day' AND camp_id = $3
                        ),
                        initial_assets AS (
                            SELECT SUM(quantity::NUMERIC) AS initial_asset_count FROM assets WHERE camp_id = $3
                        ),
                        after_change_totals AS (
                            SELECT COALESCE(SUM(total_added - total_remove - total_lost), 0) AS after_changes_total
                            FROM asset_after_changes
                        ),
                        between_change_totals AS (
                            SELECT COALESCE(SUM(total_added - total_remove - total_lost), 0) AS between_changes_total
                            FROM asset_changes
                        ),
                        daily_assets AS (
                            SELECT 
                            ds.event_date,
                            COALESCE(SUM(ac.total_added), 0) AS total_new_assets,
                            COALESCE(SUM(ac.total_modifain), 0) AS total_updated_assets,
                            COALESCE(SUM(ac.total_remove), 0) AS total_removed_assets,
                            COALESCE(SUM(ac.total_lost), 0) AS total_missing_assets
                            FROM date_series ds
                            LEFT JOIN asset_changes ac ON ds.event_date = ac.event_date
                            GROUP BY ds.event_date
                        ),
                        cumulative_assets AS (
                            SELECT 
                            da.event_date,
                            SUM(total_new_assets - total_removed_assets - total_missing_assets) 
                            OVER (ORDER BY da.event_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) 
                            + ia.initial_asset_count 
                            - bect.between_changes_total 
                            - act.after_changes_total AS total_assets,
                            total_new_assets,
                            total_updated_assets,
                            total_removed_assets,
                            total_missing_assets
                            FROM daily_assets da
                            CROSS JOIN initial_assets ia
                            CROSS JOIN between_change_totals bect
                            CROSS JOIN after_change_totals act
                        )
                        SELECT 
                            to_char(event_date, 'YYYY-MM-DD') AS event_date, 
                            total_assets, 
                            total_updated_assets, 
                            total_new_assets, 
                            total_removed_assets, 
                            total_missing_assets
                        FROM cumulative_assets
                        WHERE total_assets IS NOT NULL
                        ORDER BY event_date;`, [selectedDate1, selectedDate2, req.session.camp]
                    )
                ]);

                await client.query('COMMIT');
                res.status(200).json({ data: result.rows, data_asset_count: result_count_asset.rows });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(error);
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/report', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAssetReport.validate(req.body);
            if (error) {
                return res.status(400).send('Invalid input data.');
            }

            const { result, result_nationality, filtersAssets, filtersAssetsData } = req.body;

            // Function to filter data based on inputs
            const filterData = (data, filters) => {
                return data.filter(item => {
                    return Object.keys(filters).every(key => {
                        if (!filters[key]) return true; // Skip empty filters
                        return String(item[key] || '').toLowerCase().includes(filters[key].toLowerCase());
                    });
                });
            };

            try {

                // Filter both datasets
                const filteredAssets = filterData(result, filtersAssets);
                const filteredAssetDates = filterData(result_nationality, filtersAssetsData);

                const workbook = new excelJS.Workbook();
                const worksheet1 = workbook.addWorksheet('Assets Data');
                const worksheet2 = workbook.addWorksheet('Assets Traceability');

                // Dynamically create headers for worksheet1 (Assets Data) based on the first item of result
                if (filteredAssets.length > 0) {
                    const headers1 = Object.keys(filteredAssets[0]); // Get keys of the first object as headers
                    worksheet1.addRow(headers1).eachCell((cell) => {
                        cell.font = { bold: true };
                        cell.alignment = { horizontal: 'center' };
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' },
                        };
                    });
                    worksheet1.columns = headers1.map(header => ({ header, width: header.length + 10 }));
                }

                // Dynamically create headers for worksheet2 (Assets Traceability) based on the first item of result_nationality
                if (filteredAssetDates.length > 0) {
                    const headers2 = Object.keys(filteredAssetDates[0]); // Get keys of the first object as headers
                    worksheet2.addRow(headers2).eachCell((cell) => {
                        cell.font = { bold: true };
                        cell.alignment = { horizontal: 'center' };
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' },
                        };
                    });
                    worksheet2.columns = headers2.map(header => ({ header, width: header.length + 10 }));
                }

                // Add data to worksheet1 (Assets Data)
                await Promise.all(filteredAssets.map(async (data, index) => {
                    const row = worksheet1.addRow(Object.values(data)); // Convert object values to array
                    row.eachCell((cell) => {
                        cell.alignment = { horizontal: 'center' };
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' },
                        };
                    });

                    if (index % 2 === 0) {
                        row.eachCell((cell) => {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFDDDDDD' }, // Light grey for alternating rows
                            };
                        });
                    }
                }));

                // Add data to worksheet2 (Assets Traceability)
                await Promise.all(filteredAssetDates.map(async (data, index) => {
                    const row = worksheet2.addRow(Object.values(data)); // Convert object values to array
                    row.eachCell((cell) => {
                        cell.alignment = { horizontal: 'center' };
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' },
                        };
                    });

                    if (index % 2 === 0) {
                        row.eachCell((cell) => {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFDDDDDD' }, // Light grey for alternating rows
                            };
                        });
                    }
                }));

                // Set headers for download and send the file
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="report_laundry.xlsx"');

                // Write the workbook to the response
                await workbook.xlsx.write(res);
                res.end();

            } catch (error) {
                console.error('Error generating the report:', error);
                res.status(500).send('Failed to generate the report.');
            }
        });

        this.app.get('/cleanItem', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const result = await client.query(`SELECT id, itemname AS name, total_amount, count_get_item FROM clearitem WHERE camp_id = $1;`, [req.session.camp]);

                await client.query('COMMIT');
                res.status(200).json(result.rows);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to get clean items' });

            } finally {
                client.release();
            }
        });

        this.app.post('/addCleanItem', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddCleanItem.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { itemName, totalAmount } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const check_exist = await client.query(`SELECT * FROM clearitem WHERE itemname = $1 AND camp_id = $2;`, [itemName, req.session.camp]);

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(401).json({ message: 'This item already exists!' });
                }

                const uniqueId = crypto.randomBytes(16).toString('hex');
                const uniqueId1 = crypto.randomBytes(16).toString('hex');
                await client.query(`INSERT INTO clearitem VALUES ($1, $2, $3, 0, $4);`, [uniqueId, itemName, totalAmount, req.session.camp]);
                await client.query(`INSERT INTO cleanitemtraceability VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5);`, [uniqueId1, itemName, totalAmount, 'Added item amount in large warehouse', req.session.camp]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The item was successfully added' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to add item.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/uploadCleanItem/download', async (req, res) => {

            // Create a new Excel workbook
            const workbook = new excelJS.Workbook();

            // Sheet 1: Soldier Data
            const worksheet = workbook.addWorksheet('Add Multipul Clean Items');

            // Add custom column titles for the first sheet
            const headers = ['itemName', 'totalAmount'];
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
                { width: 25 },
                { width: 20 }
            ];

            // Set the response headers for file download
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=templateAddCleanItems.xlsx');

            // Write the workbook to the response stream
            await workbook.xlsx.write(res);
            res.end(); // End the response

        });

        this.app.post('/uploadCleanItems', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {
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
                    const { error } = schemaAddCleanItem.validate(row);

                    if (error) {
                        errors.push({ type: 'Validation', details: error.details, row, index });
                        return;
                    }

                    // Check for duplicates within the file
                    if (seenIds.has(row.itemName)) {
                        errors.push({ type: 'DuplicateInFile', row, index, message: `Duplicate item name '${row.itemName}' in the file.` });
                        return;
                    }
                    seenIds.add(row.itemName);

                    // Check for duplicates in the database
                    const result = await client.query("SELECT * FROM clearitem WHERE itemname = $1;", [row.itemName]);
                    if (result.rows.length > 0) {
                        errors.push({ type: 'DuplicateInDB', message: `Item '${row.itemName}' already exists.` });
                        return;
                    }

                    if (row.itemName.endsWith(' ')) {
                        errors.push({ type: 'InvalidFormat', message: `Item name '${row.itemName}' should not end with a space.` });
                        return;
                    }
                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row) => {
                    const uniqueId = crypto.randomBytes(16).toString('hex');
                    const uniqueId1 = crypto.randomBytes(16).toString('hex');
                    await client.query("INSERT INTO clearitem VALUES ($1, $2, $3, 0, $4);", [uniqueId, row.itemName, row.totalAmount, req.session.camp]);
                    await client.query(`INSERT INTO cleanitemtraceability VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5);`, [uniqueId1, row.itemName, row.totalAmount, 'Added item amount in large warehouse', req.session.camp]);
                }));

                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Add multi clean items`]);

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

        this.app.post('/removeCleanItem', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveCleanItem.validate(req.body);
            if (error) {
                return res.status(400).send({ message: error.details[0].message });
            }

            const { itemId } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                await client.query(`DELETE FROM clearitem WHERE id = $1;`, [itemId]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The item was successfully removed' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to remove item.' });

            } finally {
                client.release();
            }

        });

        this.app.post('/changeAmountLargeToSmall', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = changeAmountSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { checkList, moveAmount } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                for (const item of checkList) {

                    const itemId = item.code;
                    const itemAmount = item.amount;

                    await client.query(`UPDATE clearitem SET total_amount = $1, count_get_item = count_get_item + $2 WHERE id = $3;`,
                        [itemAmount - moveAmount, moveAmount, itemId]);
                }

                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Move item from large to small workhouse`]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Item amount move succesful' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to move item.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/changeAmountSmallToLarge', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = changeAmountSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { checkList, moveAmount } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                for (const item of checkList) {

                    const itemId = item.code;
                    const itemAmount = item.amount;

                    await client.query(`UPDATE clearitem SET total_amount = total_amount + $1, count_get_item = $2 WHERE id = $3;`,
                        [moveAmount, itemAmount - moveAmount, itemId]);
                }

                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Move item from small to large workhouse`]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Item amount move succesful' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to move item.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/editCleanItem', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = editCleanItemSchema.validate(req.body);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            const { itemId, editAmount, isTotalAmound } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const uniqueId = crypto.randomBytes(16).toString('hex');

                if (isTotalAmound) {
                    await client.query(`UPDATE clearitem SET total_amount = total_amount + $2 WHERE id = $1;`, [itemId, editAmount]);
                    await client.query(`INSERT INTO cleanitemtraceability VALUES ($1, (SELECT itemname FROM clearitem WHERE id = $2), $3, CURRENT_TIMESTAMP, $4, $5);`, [uniqueId, itemId, editAmount, 'Added item amount in large warehouse', req.session.camp]);
                } else {
                    await client.query(`UPDATE clearitem SET count_get_item = count_get_item - $2 WHERE id = $1;`, [itemId, editAmount]);
                    await client.query(`INSERT INTO cleanitemtraceability VALUES ($1, (SELECT itemname FROM clearitem WHERE id = $2), $3, CURRENT_TIMESTAMP, $4, $5);`, [uniqueId, itemId, editAmount, 'Taken item amount from small warehouse', req.session.camp]);
                }

                await client.query("INSERT INTO usermonitoring (user_id, location) VALUES ((SELECT id FROM users WHERE username = $1), $2)",
                    [req.session.username, `Change item amount with code ${itemId}`]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Item is change succesful' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to change item.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/getItemTraceability', this.isLoggedIn.bind(this), async (req, res) => {
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const result = await client.query(`SELECT * FROM cleanitemtraceability WHERE camp_id = $1;`, [req.session.camp]);

                await client.query('COMMIT');
                res.status(200).json(result.rows);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to get item traceability' });
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
