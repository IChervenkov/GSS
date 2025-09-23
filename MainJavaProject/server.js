const express = require('express');
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
const csurf = require('csurf');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

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

const { Pool, _ } = require('pg');

const pool = new Pool({
    user: process.env.USER,
    host: process.env.HOST,
    database: process.env.DATABASE,
    password: process.env.PASSWORD,
    port: process.env.DATABASE_PORT
});

const Joi = require('joi');

const safeUsernamePattern = /^[\w.@+-]+$/;
const safeStringPattern = /^[a-zA-Z0-9\s!&@$!%&\)\(._\/:,\-]*$/;
const safePasswordPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9!&@$!%&\)\(._\/:,\-]{8,}$/;

const assetReportColumnName = ['a.id', 'code', 'name_assets', 'type_name', 'namebuilding',
    'nameroom', 'categorie', 'quantity', 'mrah', 'asset_owner',
    'status', 'expandable', 'description', 'create_date', 'last_inventory_date',
    'service', 'm2_inside', 'is_fixed', 'is_mobile', 'date_purchase',
    'date_written_off', 'purchase_price', 'comments', 'replaced_off', 'year_of_life_cycle',
    'rest_of_life_cycle', 'replaced_by', 'rest_value',
    'namesoldier', 'country', 'type', 'date_drop_off',
    'date_ready_to_pick_up', 'k.namekey', 'date_accommodation', 'date_free',
    'meal_card', 'namebike', 'helmet_code', 'date_from', 'date_to', 'duration'];

const assetDateReportColumnName = ['event_date', 'total_assets', 'total_new_assets', 'total_updated_assets',
    'total_removed_assets', 'total_missing_assets', 'country', 'total_count_bags',
    'k_current.namekey', 'k_previous.namekey', 'soldier_name.namesoldier', 'ms.datemove',
    'date', 'total_bikes'];

const lostItemColumnName = ['nameitem', 'description', 'lost_quantity'];

const assetCleanItemColumnName = ['itemname', 'total_amount', 'count_get_item'];

const assetItemTraceabilityColumnName = ['item_name', 'amount', 'date_change', 'description'];

const assetItemPermissionsColumnName = ['permission_name'];

const sortedAssetColumnName = ['code', 'name_assets', 'type_name', 'nameroom', 'description'];

const mainAssetColumnName = ['nameroom', 'count_assets'];

const mainAccommodationColumnName = ['nameroom', 'room_status', 'countFreeBeds'];

const listBagsColumnName = ['code', 'type', 'maxcountlandry'];

const bagStatusColumnName = ['code', 'timein', 'namesoldier', 'islate'];

const mainFitnessColumnName = ['created_date', 'average_emoji', 'soldier_count'];

const additionalItemsColumnName = ['s.namesoldier', 'ai.description', 'lb.code', 'ai.quantity'];

const upcomingDataColumnName = ['s.namesoldier', 'l.code', 's.meal_card', 'k.namekey',
    's.upcoming_accommodation', 's.upcoming_release'];

const soldierListColumnName = ['s.id', 'namesoldier', 'country', 'upcoming_key', 'code',
    'meal_card', 'upcoming_accommodation', 'upcoming_release'];

const userListColumnName = ['username'];

const keysListColumnName = ['namekey', 'k.id', 'namesoldier', 'country', 'meal_card', 'lb.code'];

const mainBikeColumnName = ['namebike', 'b.status', 'namesoldier', 'h.code', 'formatted_date'];

const mainBikeStatusColumnName = ['namebike', 'namesoldier', 'lb.datefrom'];

const helmetColumnName = ['h.id', 'h.code'];

const shemaChangeCamp = Joi.object({
    campId: Joi.string().alphanum().optional()
});

const schema2FAVerify = Joi.object({
    code: Joi.string().alphanum().required()
});

const schemaAddCamp = Joi.object({
    campName: Joi.string().alphanum().required()
});

const schemaLogIn = Joi.object({
    username: Joi.string().pattern(safeUsernamePattern).required(),
    password: Joi.string().pattern(safeStringPattern).required(),
});

const schemaChangePassword = Joi.object({
    username: Joi.string().pattern(safeUsernamePattern).required(),
    currentPassword: Joi.string().pattern(safePasswordPattern).required(),
    newPassword: Joi.string().pattern(safePasswordPattern).required(),
});

const schemaAdminVerify = Joi.object({
    id: Joi.string().alphanum().required(),
    decision: Joi.string().valid('approved', 'denied').required()
});

const schemaAddUser = Joi.object({
    username: Joi.string().pattern(safeUsernamePattern).required()
});

const schemaEditUser = Joi.object({
    id: Joi.string().alphanum().required(),
    username: Joi.string().pattern(safeUsernamePattern).required(),
    password: Joi.string().pattern(safePasswordPattern).required(),
});

// Define the schema
const emojiDataSchema = Joi.object({
    emoji: Joi.string().max(10).required(), // emoji should be a string, maximum 10 characters, and is required
    userId: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const checkAssetSchema = Joi.object({
    assetId: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const checkAndChangeAssetSchema = Joi.object({
    code: Joi.string().alphanum().required(),
    location: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
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

const shemaUpdateQuantityAsset = Joi.object({
    id: Joi.string().alphanum().required(),
    newQuantity: Joi.number().integer().required(),
    username: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().required(),
    campId: Joi.string().alphanum().required()
});

const shemaUpdateLocationAsset = Joi.object({
    id: Joi.string().alphanum().required(),
    locationId: Joi.string().alphanum().required(),
    sublocationId: Joi.string().alphanum().allow('').optional(),
    username: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().required(),
    campId: Joi.string().alphanum().required()
});

const updateBagsScanerSchema = Joi.object({
    codes: Joi.array()
        .items(Joi.string().alphanum())
        .required(),
    destination: Joi.string()
        .valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to pick up', 'Ready to pick up', 'None', 'Linen Exchange service')
        .required(),
    prev_destination: Joi.string()
        .valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to pick up', 'Ready to pick up', 'None')
        .required(),
    campId: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const exchangeServiceSchema = Joi.object({
    code: Joi.string().alphanum().required(),
    destination: Joi.string()
        .valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to pick up', 'Ready to pick up', 'None', 'Linen Exchange service')
        .required(),
    prev_destination: Joi.string()
        .valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to pick up', 'Ready to pick up', 'None')
        .required()
});

const updateBagsSchema = Joi.object({
    code: Joi.string().alphanum().required(),
    destination: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to pick up', 'Ready to pick up', 'None').required(),
    prev_destination: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to pick up', 'Ready to pick up', 'None').required()
});

const checkScaningCodeSchema = Joi.object({
    code: Joi.string().alphanum().required(),
    prev_destination: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to pick up', 'Ready to pick up', 'None').required(),
    destination: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to pick up', 'Ready to pick up', 'None', 'Linen Exchange service').required(),
    permCount: Joi.number().required(),
    isValidCode: Joi.bool().optional()
});

const schemaAddBag = Joi.object({
    epc: Joi.string().alphanum().required(),
    code: Joi.string().alphanum().required(),
    type: Joi.string().regex(/^[a-zA-Z0-9\s]+$/).required(),
    maxcount: Joi.number().required(),
    username: Joi.string().alphanum().optional(),
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional()
});

const schemaGetBike = Joi.object({
    isFirstTime: Joi.boolean().optional(),
    limit: Joi.number().optional(),
    offset: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...mainBikeColumnName),
        Joi.array().items(Joi.string().valid(...mainBikeColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional()
});

const schemaGetStatusBike = Joi.object({
    status: Joi.string().valid('Rented', 'Available', 'Repair', 'Late', 'Long term').required(),
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...mainBikeStatusColumnName),
        Joi.array().items(Joi.string().valid(...mainBikeStatusColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional()
});

const shemaGetBags = Joi.object({
    isValidCode: Joi.bool().optional(),
    campId: Joi.string().alphanum().optional(),
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...listBagsColumnName),
        Joi.array().items(Joi.string().valid(...listBagsColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional(),
});

const schemaUpcomingAction = Joi.object({
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...upcomingDataColumnName),
        Joi.array().items(Joi.string().valid(...upcomingDataColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional(),
});

const shemaGetLostItem = Joi.object({
    isValidCode: Joi.bool().optional(),
    campId: Joi.string().alphanum().optional(),
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...lostItemColumnName),
        Joi.array().items(Joi.string().valid(...lostItemColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional(),
});

const schemaGetAdditionalItem = Joi.object({
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...additionalItemsColumnName),
        Joi.array().items(Joi.string().valid(...additionalItemsColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional(),
});

const shemaInventory = Joi.object({
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
});

const schemaRemoveBag = Joi.object({
    code: Joi.string().alphanum().required(),
    username: Joi.string().optional(),
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
    username: Joi.string().alphanum().required(),
    campId: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().required()
});

const clientDataSchema = Joi.object({
    userId: Joi.string().required(), // userId should be a string and is required
    isValidCode: Joi.bool().optional()
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
    username: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional()
});

const schemaNFCReturn = Joi.object({
    nfcData: Joi.string().required(), // nfcData should be a string and is required
    date: Joi.date().iso().required(), // date should be a valid ISO date and is required
    time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(), // time should be in HH:MM format and is required
    username: Joi.string().alphanum().optional(),
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
    selectedDate2: Joi.date().iso().allow('None'),
    page: Joi.number().optional(),
    pageDate: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...assetReportColumnName),
        Joi.array().items(Joi.string().valid(...assetReportColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional(),
    searchColumnDate: Joi.alternatives().try(
        Joi.string().valid(...assetDateReportColumnName),
        Joi.array().items(Joi.string().valid(...assetDateReportColumnName))
    ).optional(),
    searchValueDate: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional(),
});

const schemaCleanItems = Joi.object({
    pageLarge: Joi.number().optional(),
    pageSmall: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumnLarge: Joi.alternatives().try(
        Joi.string().valid(...assetCleanItemColumnName),
        Joi.array().items(Joi.string().valid(...assetCleanItemColumnName))
    ).optional(),
    searchValueLarge: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional(),
    searchColumnSmall: Joi.alternatives().try(
        Joi.string().valid(...assetCleanItemColumnName),
        Joi.array().items(Joi.string().valid(...assetCleanItemColumnName))
    ).optional(),
    searchValueSmall: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional(),
});

const schemaTraceability = Joi.object({
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...assetItemTraceabilityColumnName),
        Joi.array().items(Joi.string().valid(...assetItemTraceabilityColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional()
});

const schemaPermissions = Joi.object({
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...assetItemPermissionsColumnName),
        Joi.array().items(Joi.string().valid(...assetItemPermissionsColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional()
});

const schemaGetListSoldier = Joi.object({
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...soldierListColumnName),
        Joi.array().items(Joi.string().valid(...soldierListColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional()
});

const schemaGetListSUsers = Joi.object({
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...userListColumnName),
        Joi.array().items(Joi.string().valid(...userListColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional()
});

const schemaReportBike = Joi.object({
    selectedDate1: Joi.date().iso().allow('None'),
    selectedDate2: Joi.date().iso().allow('None'),
    filtersBike: Joi.array().items(Joi.object({
        column: Joi.string().required(),
        value: Joi.string().required()
    })).required(),
    filtersBikeDate: Joi.array().items(Joi.object({
        column: Joi.string().required(),
        value: Joi.string().required()
    })).required()
});

const schemaAddBike = Joi.object({
    bikeAddId: Joi.string().alphanum().required(),
    bikeName: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required(),
    username: Joi.string().alphanum().optional(),
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional()
});

const schemaAddHelmet = Joi.object({
    helmetAddId: Joi.string().alphanum().required(),
    helmetName: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required(),
    username: Joi.string().alphanum().optional(),
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional()
});

const schemaEditParameturBike = Joi.object({
    oldBikeId: Joi.string().alphanum().required(),
    newBikeId: Joi.string().alphanum().required(),
    bikeName: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required(),
    username: Joi.string().alphanum().optional(),
    campId: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const schemaEditParameturHelmet = Joi.object({
    oldHelmetId: Joi.string().alphanum().required(),
    newHelmetId: Joi.string().alphanum().required(),
    helmetName: Joi.string().pattern(/^[0-9]+\/[A-Za-z\s]+$/).required(),
    username: Joi.string().alphanum().optional(),
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
    username: Joi.string().alphanum().optional(),
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
    isFirstTime: Joi.boolean().optional(),
    offset: Joi.number().optional(),
    limit: Joi.number().optional(),
    sortedDirection: Joi.string().valid('asc', 'desc').optional(),
    sortedColumn: Joi.string().valid(...mainAccommodationColumnName).optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...mainAccommodationColumnName),
        Joi.array().items(Joi.string().valid(...mainAccommodationColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional()
});

const schemaAssets = Joi.object({
    numBuild: Joi.string().alphanum().allow('').optional(),
    isFirstTime: Joi.boolean().optional(),
    offset: Joi.number().optional(),
    limit: Joi.number().optional(),
    sortedDirection: Joi.string().valid('asc', 'desc').optional(),
    sortedColumn: Joi.string().valid(...mainAssetColumnName).optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...mainAssetColumnName),
        Joi.array().items(Joi.string().valid(...mainAssetColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional()
});

const schemaFitness = Joi.object({
    formattedDate1: Joi.date().iso().allow('').optional(),
    formattedDate2: Joi.date().iso().allow('').optional(),
    isFirstTime: Joi.boolean().optional(),
    offset: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...mainFitnessColumnName),
        Joi.array().items(Joi.string().valid(...mainFitnessColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern).allow('😞', '😐', '😁'),
        Joi.array().items(Joi.string().pattern(safeStringPattern).allow('😞', '😐', '😁'))
    ).optional()
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
    roomId: Joi.string().pattern(/^[a-zA-Z0-9\s\-]+$/).required(),
    roomName: Joi.string().pattern(/^[^\/]+\/([^\/]+\/)?.+$/).required(),
    clickBuild: Joi.string().allow('').alphanum().optional()
});

const schemaReleaseMultiRoom = Joi.object({
    keyName: Joi.string().pattern(/^[^\/]+\/[^\/]+\/.+$/).required()
});

const schemaKeyToRoom = Joi.object({
    keyId: Joi.string().alphanum().required(),
    keyName: Joi.string().pattern(/^[^\/]+\/[^\/]+\/.+$/).required(),
    selectedRoomForKey: Joi.string().pattern(/^[^\/]+\/.+$/).optional()
});

const schemaSpecialRoom = Joi.object({
    numBuild: Joi.string().alphanum().allow('').required()
});

const schemaSpecialKey = Joi.object({
    numRoom: Joi.string().pattern(/^([a-zA-Z0-9]+(\/[a-zA-Z0-9\s\-])?\/[a-zA-Z0-9\s\-]+)*$/).required()
});

const schemaSpecialAssets = Joi.object({
    numRoom: Joi.string().alphanum().allow('').optional(),
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional(),
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    sortedDirection: Joi.string().valid('asc', 'desc').optional(),
    sortedColumn: Joi.string().valid(...sortedAssetColumnName).optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...sortedAssetColumnName),
        Joi.array().items(Joi.string().valid(...sortedAssetColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional(),
});

const schemaDeleteAsets = Joi.object({
    code: Joi.string().alphanum().required(),
    username: Joi.string().alphanum().optional(),
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional()
});

const schemaDeleteUsers = Joi.object({
    code: Joi.string().alphanum().required()
});

const schemaAddAsetsType = Joi.object({
    assetType: Joi.string().pattern(/^[a-zA-Z\s]+$/).required()
});

const schemaRemoveAsetsType = Joi.object({
    assetTypeId: Joi.string().alphanum().required()
});

const schemaLostItems = Joi.object({
    itemName: Joi.string().alphanum().required(),
    description: Joi.string().allow('').pattern(safeStringPattern).required(),
    lostQuantity: Joi.number().required()
});

const schemaRestorItems = Joi.object({
    code: Joi.string().alphanum().required(),
    lost_quantity: Joi.number().required()
});

const schemaAddAsset = Joi.object({
    assetEps: Joi.string().alphanum().required(),
    assetCodeSearch: Joi.string().alphanum().required(),
    assetAddName: Joi.string().pattern(safeStringPattern).required(),
    selectedAddTypeId: Joi.string().alphanum().required(),
    selectedAddLocationId: Joi.string().alphanum().required(),
    selectedAddSubLocationId: Joi.string().alphanum().allow('').optional(),
    assetAddCategorie: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetQuantity: Joi.number().integer().min(1).required(),
    assetAddMrah: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetAddOwner: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetStatus: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetAddExpandable: Joi.valid('Expandable', 'Non Expandable', '').required(),
    assetAddService: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetAddDescription: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetAddM2Inside: Joi.string().allow('').pattern(/^([0-9]+,[0-9]+)?$/).required(),
    assetAddIsFixed: Joi.boolean().required(),
    assetAddDatePurchase: Joi.alternatives().try(
        Joi.string().isoDate(),
        Joi.string().valid('')
    ).required(),
    assetAddDateWrittenOff: Joi.alternatives().try(
        Joi.string().isoDate(),
        Joi.string().valid('')
    ).required(),
    assetAddPurchasePrice: Joi.string().allow('').pattern(/^([0-9]+,[0-9]+)?$/).required(),
    assetAddComments: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetAddReplacedOff: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetAddYearOfLifeCycle: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
    assetAddRestOfLifeCycle: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
    assetAddReplacedBy: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetAddRestValue: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
    username: Joi.string().alphanum().optional(),
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional()
});

const schemaEditAsset = Joi.object({
    assetId: Joi.string().alphanum().required(),
    assetName: Joi.string().pattern(safeStringPattern).required(),
    assetType: Joi.string().alphanum().required(),
    assetLocation: Joi.string().alphanum().required(),
    assetSubLocation: Joi.string().alphanum().allow('').optional(),
    assetCategory: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetQuantity: Joi.number().integer().min(1).required(),
    assetMrah: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetOwner: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetService: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetStatus: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetExpandable: Joi.valid('Expandable', 'Non Expandable', '').required(),
    assetDescription: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetM2Inside: Joi.string().allow('').pattern(/^([0-9]+,[0-9]+)?$/).required(),
    assetIsFixed: Joi.boolean().required(),
    assetDatePurchase: Joi.alternatives().try(
        Joi.string().isoDate(),
        Joi.string().valid('')
    ).required(),
    assetDateWrittenOff: Joi.alternatives().try(
        Joi.string().isoDate(),
        Joi.string().valid('')
    ).required(),
    assetPurchasePrice: Joi.string().allow('').pattern(/^([0-9]+,[0-9]+)?$/).required(),
    assetComments: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetReplacedOff: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetYearOfLifeCycle: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
    assetRestOfLifeCycle: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
    assetReplacedBy: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetRestValue: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
});

const schemaEditAssetDevice = Joi.object({
    oldCode: Joi.string().alphanum().required(),
    newCode: Joi.string().alphanum().required(),
    code: Joi.string().alphanum().required(),
    name: Joi.string().pattern(safeStringPattern).required(),
    type: Joi.string().alphanum().required(),
    location: Joi.string().alphanum().required(),
    subLocation: Joi.string().alphanum().allow('').optional(),
    category: Joi.string().allow('').pattern(safeStringPattern).required(),
    quantity: Joi.number().integer().min(1).required(),
    mrah: Joi.string().allow('').pattern(safeStringPattern).required(),
    owner: Joi.string().allow('').pattern(safeStringPattern).required(),
    status: Joi.string().allow('').pattern(safeStringPattern).required(),
    expandable: Joi.valid('Expandable', 'Non Expandable', '').required(),
    service: Joi.string().allow('').pattern(safeStringPattern).required(),
    description: Joi.string().allow('').pattern(safeStringPattern).required(),
    m2Inside: Joi.string().allow('').pattern(/^([0-9]+,[0-9]+)?$/).required(),
    isFixed: Joi.boolean().required(),
    datePurchase: Joi.alternatives().try(
        Joi.string().isoDate(),
        Joi.string().valid('')
    ).required(),
    dateWrittenOff: Joi.alternatives().try(
        Joi.string().isoDate(),
        Joi.string().valid('')
    ).required(),
    purchasePrice: Joi.string().allow('').pattern(/^([0-9]+,[0-9]+)?$/).required(),
    comments: Joi.string().allow('').pattern(safeStringPattern).required(),
    replacedOff: Joi.string().allow('').pattern(safeStringPattern).required(),
    yearOfLifeCycle: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
    restOfLifeCycle: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
    replacedBy: Joi.string().allow('').pattern(safeStringPattern).required(),
    restValue: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
    username: Joi.string().alphanum().optional(),
    campId: Joi.string().alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const schemaEditMultiAsset = Joi.object({
    id: Joi.string().alphanum().required(),
    code: Joi.alternatives().try(
        Joi.string().alphanum().required(),
        Joi.number().integer().required().custom((val) => val.toString())
    ),
    name_assets: Joi.string().pattern(safeStringPattern).required(),
    asset_type: Joi.string().pattern(safeStringPattern).required(),
    location_room: Joi.string().pattern(/^[^\/]+\/([^\/]+\/)?.+$/).required(),
    location_key: Joi.string().allow('').pattern(/^[^\/]+\/[^\/]+\/.+$/).required(),
    categorie: Joi.string().allow('').pattern(safeStringPattern).required(),
    quantity: Joi.number().integer().min(1).required(),
    mrah: Joi.string().allow('').pattern(safeStringPattern).required(),
    asset_owner: Joi.string().allow('').pattern(safeStringPattern).required(),
    status: Joi.string().allow('').pattern(safeStringPattern).required(),
    expandable: Joi.valid('Expandable', 'Non Expandable', '').required(),
    description: Joi.string().allow('').pattern(safeStringPattern).required(),
    service: Joi.string().allow('').pattern(safeStringPattern).required(),
    m2_inside: Joi.string().allow('').pattern(/^([0-9]+,[0-9]+)?$/).required(),
    is_fixed: Joi.boolean().required(),
    date_purchase: Joi.alternatives().try(
        Joi.string().isoDate(),
        Joi.string().valid('')
    ).required(),
    date_written_off: Joi.alternatives().try(
        Joi.string().isoDate(),
        Joi.string().valid('')
    ).required(),
    purchase_price: Joi.string().allow('').pattern(/^([0-9]+,[0-9]+)?$/).required(),
    comments: Joi.string().allow('').pattern(safeStringPattern).required(),
    replaced_off: Joi.string().allow('').pattern(safeStringPattern).required(),
    year_of_life_cycle: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
    rest_of_life_cycle: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
    replaced_by: Joi.string().allow('').pattern(safeStringPattern).required(),
    rest_value: Joi.string().allow('').pattern(/^[0-9]*$/).required()
});

const schemaAddMultiAsset = Joi.object({
    assetEpc: Joi.string().alphanum().required(),
    assetCode: Joi.alternatives().try(
        Joi.string().alphanum().required(),
        Joi.number().integer().required().custom((val) => val.toString())
    ),
    assetName: Joi.string().pattern(safeStringPattern).required(),
    assetTypeName: Joi.string().pattern(safeStringPattern).required(),
    assetLocation: Joi.string().pattern(/^[^\/]+\/([^\/]+\/)?.+$/).required(),
    assetSubLocation: Joi.string().allow('').pattern(/^[^\/]+\/[^\/]+\/.+$/).required(),
    assetCategorie: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetQuantity: Joi.number().integer().min(1).required(),
    assetMrah: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetOwner: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetStatus: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetExpandable: Joi.valid('Expandable', 'Non Expandable', '').required(),
    assetDescription: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetService: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetM2Inside: Joi.string().allow('').pattern(/^([0-9]+,[0-9]+)?$/).required(),
    assetIsFixed: Joi.boolean().required(),
    assetDatePurchase: Joi.alternatives().try(
        Joi.string().isoDate(),
        Joi.string().valid('')
    ).required(),
    assetDateWrittenOff: Joi.alternatives().try(
        Joi.string().isoDate(),
        Joi.string().valid('')
    ).required(),
    assetPurchasePrice: Joi.string().allow('').pattern(/^([0-9]+,[0-9]+)?$/).required(),
    assetComments: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetReplacedOff: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetYearOfLifeCycle: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
    assetRestOfLifeCycle: Joi.string().allow('').pattern(/^[0-9]*$/).required(),
    assetReplacedBy: Joi.string().allow('').pattern(safeStringPattern).required(),
    assetRestValue: Joi.string().allow('').pattern(/^[0-9]*$/).required()
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
    description: Joi.string().pattern(safeStringPattern).required(),
    bagId: Joi.string().allow('').alphanum().required(),
    quantity: Joi.number().integer().required()
});

const schemaReturnAdditionalItem = Joi.object({
    id: Joi.string().uuid().required(),
    quantity: Joi.number().integer().required()
});

const schemaAddSoldier = Joi.object({
    soldierId: Joi.alternatives().try(Joi.string().alphanum(), Joi.number()).required(),
    soldierName: Joi.string().pattern(/^[A-Za-z0-9\s\-éÉàÀèÈùÙâÂêÊîÎôÔûÛçÇÖöäÄåÅøØ]+$/).required(),
    soldierCountry: Joi.string().pattern(safeStringPattern).required(),
    upcomingKey: Joi.string().pattern(/^[0-9]+\/[0-9]+\/[0-9]+$|^[a-zA-Z0-9]+$/).allow('').optional(),
    soldierBag: Joi.string().alphanum().allow('').optional(),
    soldierMealCard: Joi.alternatives().try(Joi.string().alphanum(), Joi.number()).allow('').optional(),
    upcomingAccommodationDate: Joi.date().allow('').iso().optional(),
    upcomingReleaseDate: Joi.date().allow('').iso().optional()
});

const schemaEditSoldier = Joi.object({
    soldierId: Joi.string().alphanum().required(),
    soldierNewId: Joi.string().alphanum().required(),
    soldierName: Joi.string().pattern(/^[A-Za-z0-9\s\-éÉàÀèÈùÙâÂêÊîÎôÔûÛçÇÖöäÄåÅøØ]+$/).required(),
    soldierCountry: Joi.string().alphanum().required(),
    soldierUpcomingKey: Joi.string().alphanum().allow('').required(),
    soldierBag: Joi.string().alphanum().allow('').required(),
    soldierMealCard: Joi.alternatives().try(Joi.string().alphanum(), Joi.number()).allow('').required(),
    soldierUpcomeAccom: Joi.date().allow('').iso().required(),
    soldierUpcomeRel: Joi.date().allow('').iso().required()
});

const schemaAddCleanItem = Joi.object({
    itemName: Joi.string().pattern(/^[a-zA-Z0-9\s.,\/\-:;]+$/).required(),
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
    username: Joi.string().alphanum().optional(),
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
    roomNumber: Joi.string().pattern(/^([a-zA-Z0-9]+(\/[a-zA-Z0-9\s\-])?\/[a-zA-Z0-9\s\-]+)*$/).required(),
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...keysListColumnName),
        Joi.array().items(Joi.string().valid(...keysListColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional()
});

const schemaNFCBikeRead = Joi.object({
    nfcData: Joi.string().required(),
    isValidCode: Joi.bool().optional()
});

const shemaClientNfc = Joi.object({
    campId: Joi.string().alphanum().optional(),
    isValidCode: Joi.bool().optional(),
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...helmetColumnName),
        Joi.array().items(Joi.string().valid(...helmetColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional()
});

const shemaHelmetBike = Joi.object({
    bikeId: Joi.string().allow('').alphanum().required(),
    isValidCode: Joi.bool().optional()
});

const schemaGetBagsByStatus = Joi.object({
    status: Joi.string().valid('Drop off', 'Transportation to laundry facility', 'Laundry facility', 'Transportation to pick up', 'Ready to pick up', 'None', '').required(),
    page: Joi.number().optional(),
    limit: Joi.number().optional(),
    searchColumn: Joi.alternatives().try(
        Joi.string().valid(...bagStatusColumnName),
        Joi.array().items(Joi.string().valid(...bagStatusColumnName))
    ).optional(),
    searchValue: Joi.alternatives().try(
        Joi.string().pattern(safeStringPattern),
        Joi.array().items(Joi.string().pattern(safeStringPattern))
    ).optional(),
});

const schemaAssetReport = Joi.object({
    selectedDate1: Joi.date().iso().allow('None'),
    selectedDate2: Joi.date().iso().allow('None'),
    headers: Joi.array().items(
        Joi.string().pattern(/^[a-zA-Z0-9\s!&\)\(._\/:,\-№]*$/)
    ).required(),
    filtersAssets: Joi.array().items(Joi.object({
        column: Joi.string().required(),
        value: Joi.string().required()
    })).required(),
    filtersAssetsData: Joi.array().items(Joi.object({
        column: Joi.string().required(),
        value: Joi.string().required()
    })).required()
});

const schemaLaundryReport = Joi.object({
    selectedDate1: Joi.date().iso().allow('None'),
    selectedDate2: Joi.date().iso().allow('None'),
    filtersBags: Joi.array().items(Joi.object({
        column: Joi.string().required(),
        value: Joi.string().required()
    })).required(),
    filtersNationalBags: Joi.array().items(Joi.object({
        column: Joi.string().required(),
        value: Joi.string().required()
    })).required()
});

const schemaLaundry = Joi.object({
    isFirstTime: Joi.boolean().optional()
});

const schemaFitnessReport = Joi.object({
    selectedDate1: Joi.date().iso().allow(''),
    selectedDate2: Joi.date().iso().allow(''),
    filtersFitness: Joi.array().items(Joi.object({
        column: Joi.string().required(),
        value: Joi.string().required()
    })).required()
});

const schemaAccommodationReport = Joi.object({
    selectedDate1: Joi.date().iso().allow(''),
    selectedDate2: Joi.date().iso().allow(''),
    filtersAccommodation: Joi.array().items(Joi.object({
        column: Joi.string().required(),
        value: Joi.string().required()
    })).required(),
    filtersAccommodationDate: Joi.array().items(Joi.object({
        column: Joi.string().required(),
        value: Joi.string().required()
    })).required()
});

const schemaUpcomingSoldierAction = Joi.object({
    filtersSoldier: Joi.array().items(Joi.object({
        column: Joi.string().required(),
        value: Joi.string().required()
    })).required()
});

const permissionsSchema = Joi.object({
    permissions: Joi.array().items(
        Joi.object({
            userId: Joi.string().alphanum().required(),
            permId: Joi.string().alphanum().required(),
            isCheck: Joi.boolean().required()
        })
    ).required()
});

const horizontalNavItems = [
    { href: '/main_page', name: 'Main Page' },
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
        this.app.use(express.json({ limit: '20mb' }));
        this.app.use(express.urlencoded({ limit: '20mb', extended: true }));

        // Middleware to parse JSON bodies (bodyParser is already included in Express)
        this.app.set("view engine", "ejs");
        this.app.use(express.static(path.join(__dirname, 'public')));

        this.app.use('/bootstrap', express.static(__dirname + '/node_modules/bootstrap/dist/'));

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
        //      console.error('Redis Client Error:', err);
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
                secure: false, // true if use HTTPS
                httpOnly: true,
                sameSite: 'strict',
                maxAge: 8 * 60 * 60 * 1000
            }
        }));

        this.app.use(csurf({ cookie: false }));

        this.app.use((req, res, next) => {
            res.locals.csrfToken = req.csrfToken();
            next();
        });

        this.app.get('/csrf-token', (req, res) => {
            res.json({ csrfToken: req.csrfToken() });
        });

        // Global error handler

        this.app.get('/error', (req, res) => {
            // You need to define statusCode, message, details or pass them via query params
            const statusCode = req.query.statusCode || 500;
            const message = req.query.message || 'An error occurred.';
            const details = req.query.details ? JSON.parse(req.query.details) : [];

            res.render('error', {
                statusCode: parseInt(statusCode, 10),
                message,
                details
            });
        });

        this.app.use((err, req, res, next) => {
            console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
            console.error(err.stack);

            let statusCode = err.status || 500;
            let message = 'An unexpected error occurred.';
            let details = [];

            switch (err.code) {
                case 'EBADCSRFTOKEN':
                    statusCode = 400;
                    message = 'Security check failed. Please go back to sign in again.';
                    break;
                case 'VALIDATION_ERROR':
                    statusCode = 422;
                    message = 'Some data did not pass validation checks.';
                    details = err.details || [];
                    break;
            }

            res.setHeader('X-Global-Error', 'true');
            res.status(statusCode).json({
                statusCode,
                message,
                details
            });

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

    giveSpecificPermissionMain(permissions, indexs, res, navItems, isFirstLogin, campId) {

        res.render('mainPage', {
            title: 'Main Page Layout',
            navItems: navItems,
            horizontalNavItems: indexs.map(index => horizontalNavItems[index]),
            headerTable: null,
            data: null,
            startMessage: "Welcome to Global Support System (GSS)",
            permissions: permissions,
            firstLogin: isFirstLogin,
            campId: campId
        });
    }

    giveSpecificPermissionBicycles(permissions, indexs, res, data, optionHour, optionMinute, totalBike, rentedBike, availableBike, repairBike, lateBike, longTermBike, totalCount) {

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
            permissions: permissions,
            totalCount: totalCount
        });
    }

    giveSpecificPermissionAccommodation(permissions, indexs, res, navBuild, totalFreeBeds, totalOccupiedBeds, type, titlePage, headerTable, nameroomSetCount, totalCount, numBuild) {

        res.render('accommodation', {
            title: "Accommodation and keys",
            navItems: navBuild,
            horizontalNavItems: indexs.map(index => horizontalNavItems[index]),
            headerTable: headerTable,
            totalFreeBeds: totalFreeBeds,
            totalOccupiedBeds: totalOccupiedBeds,
            type: type,
            titlePage: titlePage,
            nameroomSetCount: nameroomSetCount,
            numBuild: numBuild,
            permissions: permissions,
            totalCount: totalCount
        });
    }

    giveSpecificPermissionFitness(permissions, indexs, res, data, dataPerEmj, totalCount) {

        res.render('fitness', {
            title: "Gym",
            horizontalNavItems: indexs.map(index => horizontalNavItems[index]),
            data: data,
            dataPerEmj: dataPerEmj,
            permissions: permissions,
            totalCount: totalCount
        });
    }

    giveSpecificPermissionLaundry(permissions, indexes, res, bagData, totalCounts, avgTimeData, overallAverageFormatted, headerTable, overallTotalMountFormatted) {

        res.render('laundry', {
            title: "Laundry",
            horizontalNavItems: indexes.map(index => horizontalNavItems[index]),
            bagData: bagData,
            totalCounts: totalCounts,
            avgTimeData: avgTimeData,
            overallAverageFormatted: overallAverageFormatted,
            headerTable: headerTable,
            overallTotalMountFormatted: overallTotalMountFormatted,
            permissions: permissions
        });

    }

    giveSpecificPermissionAssets(permissions, indexes, res, inventory, numBuild, numSelectBuild, totalCount) {

        res.render('assets', {
            title: "Assets",
            horizontalNavItems: indexes.map(index => horizontalNavItems[index]),
            inventory: inventory,
            navItems: numBuild,
            numSelectBuild: numSelectBuild,
            permissions: permissions,
            totalCount: totalCount
        });

    }

    // Middleware to check if the user is logged in
    isLoggedIn(req, res, next) {

        if (req.session && req.session.username && req.session.username !== 'PhoneUser')
            return next();

        const isValidCode =
            (req.query && req.query.isValidCode) ||
            (req.body && req.body.isValidCode);

        if (isValidCode)
            return next();

        // Detect Android / API requests (JSON) vs. Web (HTML form/EJS)
        const expectsJSON =
            req.xhr ||
            req.is('application/json') ||
            (req.headers.accept && req.headers.accept.includes('application/json'));

        res.setHeader('X-Global-Error', 'true');

        if (expectsJSON) {
            // API/Android
            return res.status(401).json({
                statusCode: 401,
                message: "Security verification failed. Please restart the app and try again."
            });
        } else {
            // Web browser
            if (req.get('X-Is-Fetch') === 'true') {
                return res.status(400).json({
                    statusCode: 400,
                    message: 'Security verification failed. Please refresh the system and try again.',
                    details: []
                })
            }

            const query = new URLSearchParams({
                statusCode: '400',
                message: 'Security verification failed. Please refresh the system and try again.',
                details: JSON.stringify([])
            }).toString();

            return res.redirect(`/error?${query}`);
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
            console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
            console.error('APK file hash does not match expected value');
            res.status(400).json({ message: 'File integrity check failed' }); // Send JSON response
            return false;
        }

        return true; // File is legal
    }

    // Method to define routes for main page
    defineRoutesMain() {

        this.app.get('/permissions/data', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaPermissions.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { page = 1, limit = 10, searchColumn, searchValue } = req.query;
            const offset = (page - 1) * limit;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                let whereClause = '';
                let values = [];

                let countValues = [];
                let countWhereClause = '';

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += "WHERE ";
                    countWhereClause += "WHERE ";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [countResult, usersRes, permsRes, userPermsRes] = await Promise.all([
                    client.query(`SELECT id, permission_name FROM permission ${countWhereClause};`, countValues),
                    client.query(`SELECT id, username FROM users ORDER BY username;`),
                    client.query(`
                        SELECT id, permission_name FROM permission 
                        ${whereClause} 
                        ORDER BY permission_name
                        LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),
                    client.query("SELECT user_id, perm_id FROM user_permission")
                ]);

                const totalData = parseInt(countResult.rows.length, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                await client.query('COMMIT');
                res.json({
                    users: usersRes.rows,
                    permissions: permsRes.rows,
                    user_permissions: userPermsRes.rows,
                    totalPages
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Get permissions error: ', error);
                res.status(500).json({ message: 'Failed to load permissions data.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/permissions/save', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = permissionsSchema.validate(req.body);

            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const permissions = req.body.permissions;
            const client = await pool.connect();

            try {

                await client.query("BEGIN");

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Add system permission')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add system permission!" });
                }

                // Reinsert submitted ones
                for (const perm of permissions) {
                    const { userId, permId, isCheck } = perm;

                    const checkUserId = await client.query('SELECT * FROM users WHERE id = $1;', [userId]);
                    const checkPermIdId = await client.query('SELECT * FROM permission WHERE id = $1;', [permId]);
                    const checkExist = await client.query(`SELECT * FROM user_permission WHERE user_id = $1 AND perm_id = $2`, [userId, permId]);

                    if (checkUserId.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: `The user does not exist. It has probably been modified.` });
                    }

                    if (checkPermIdId.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: `The permission does not exist. It has probably been modified.` });
                    }

                    if (isCheck && checkExist.rows.length === 0) {
                        await client.query(`
                            INSERT INTO user_permission VALUES ($1, $2)`, [userId, permId]);

                    } else if (!isCheck && checkExist.rows.length > 0) {
                        await client.query(`
                            DELETE FROM user_permission WHERE user_id = $1 AND perm_id = $2`, [userId, permId]);
                    }
                }

                await client.query("COMMIT");
                res.status(200).json({ message: 'Permissions are set successfully' });

            } catch (error) {
                await client.query("ROLLBACK");
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error saving permissions:", error);
                res.status(500).json({ error: "Failed to save permissions" });

            } finally {
                client.release();
            }
        });

        this.app.get('/getUsers', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaGetListSUsers.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { page, limit, searchColumn, searchValue } = req.query;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const offset = (page - 1) * limit;
                let whereClause = `WHERE id <> '1' AND id <> '4'`;
                let values = [];

                let countValues = [];
                let countWhereClause = `WHERE id <> '1' AND id <> '4'`;

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [result_user, countResult] = await Promise.all([

                    client.query(`
                        SELECT *
                        FROM users
                        ${whereClause}
                        LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),

                    client.query(`
                        SELECT COUNT(*) AS count
                        FROM users
                        ${countWhereClause};`, countValues),
                ]);

                const totalData = parseInt(countResult.rows[0].count, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                await client.query('COMMIT');
                res.json({ usersListData: result_user.rows, totalUsersListData: totalPages });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get soldier:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/addUser', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddUser.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid username' });
            }

            const { username } = req.body;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Add system permission')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add user!" });
                }

                const existingUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);

                if (existingUser.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This user already exists' });
                }

                const uniqueId = crypto.randomBytes(16).toString('hex');

                const tempPassword = crypto.randomBytes(8).toString('hex');
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);

                await Promise.all([
                    client.query('INSERT INTO users VALUES ($1, $2, NULL, NULL, $3);', [uniqueId, username, hashedPassword]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `User ${username} added`])
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: `User added successfully with temporary password ${tempPassword}` });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error add user: ', err);
                res.status(500).json({ message: 'An error occurred. Please try again later.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/editUser', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditUser.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid username or password' });
            }

            const { id, username, password } = req.body;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Add system permission')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to edit user!" });
                }

                const existingUser = await client.query('SELECT * FROM users WHERE username = $1 AND id <> $2', [username, id]);
                const userData = await client.query('SELECT * FROM users WHERE id = $1 AND temporary_password IS NOT NULL;', [id]);

                if (existingUser.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This user already exists' });
                }

                if (userData.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This user still has a temporary password and cannot be changed.' });
                }

                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(password, saltRounds);

                await Promise.all([
                    client.query('UPDATE users SET username = $2, password = $3 WHERE id = $1;', [id, username, hashedPassword]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Edit user`])
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'User edit successfully' });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error add user: ', err);
                res.status(500).json({ message: 'An error occurred. Please try again later.' });

            } finally {
                client.release();
            }
        });

        this.app.delete('/deleteUser', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaDeleteUsers.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { code } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Add system permission')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to delete user!" });
                }

                const checkUserId = await client.query('SELECT * FROM users WHERE id = $1;', [code]);
                if (checkUserId.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The user does not exist. It has probably been modified.` });
                }

                await Promise.all([
                    client.query('DELETE FROM user_permission WHERE user_id = $1;', [code]),
                    client.query('DELETE FROM users WHERE id = $1;', [code]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Remove users`])
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'User was removed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Server error: ', error);
                res.status(500).json({ message: 'Failed to remove user.' });

            } finally {
                client.release();
            }
        });

        // GET route for checking server status
        this.app.get('/main_page', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            let navItems = [];
            let userPerm = [];
            let index = [];

            try {
                await client.query('BEGIN');

                const [get_all_camp, get_permission] = await Promise.all([
                    client.query(`SELECT * FROM camps ORDER BY created_at ASC`),
                    client.query(`
                        SELECT permission_name FROM permission p
                        JOIN user_permission up ON up.perm_id = p.id AND up.user_id = $1;`, [req.session.userId])
                ]);

                navItems = get_all_camp.rows;
                userPerm = get_permission.rows;

                const hasFullPermission = userPerm.some(p => p.permission_name === 'Full permission');
                const isAdmin = req.session.username === 'admin';

                if (hasFullPermission && isAdmin) {
                    index = [0, 1, 2, 3, 4, 5, 6];
                } else if (hasFullPermission) {
                    index = [0, 1, 2, 4, 5, 6];
                } else {
                    index = [0, 6];

                    if (userPerm.some(p => p.permission_name === 'Assets')) index.push(1);
                    if (userPerm.some(p => p.permission_name === 'Laundry')) index.push(2);
                    if (userPerm.some(p => p.permission_name === 'Gym')) index.push(3);
                    if (userPerm.some(p => p.permission_name === 'Accommodation and keys')) index.push(4);
                    if (userPerm.some(p => p.permission_name === 'Bicycles')) index.push(5);
                }

                index.sort();

                if (req.session.firstLogin && navItems.length > 0)
                    req.session.camp = navItems[0].id;

                await client.query('COMMIT');

                const isFirst = req.session.firstLogin;
                req.session.firstLogin = false;

                this.giveSpecificPermissionMain(userPerm, index, res, navItems, isFirst, req.session.camp);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Server error: ', error);
                res.status(500).json({ message: 'Failed to load camp data.' });
            } finally {
                client.release();
            }
        });

        this.app.get('/getCamp', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            let navItems = [];
            let userPerm = [];

            try {
                await client.query('BEGIN');

                const [get_all_camp, get_permission] = await Promise.all([
                    client.query(`SELECT * FROM camps ORDER BY created_at ASC`),
                    client.query(`SELECT permission_name FROM permission p
                        JOIN user_permission up ON up.perm_id = p.id AND up.user_id = $1;`, [req.session.userId])
                ]);


                navItems = get_all_camp.rows;
                userPerm = get_permission.rows;

                await client.query('COMMIT');
                return res.status(200).json({
                    navCamp: navItems.map(item => ({
                        id: item.id,
                        name: item.campname
                    })),
                    permissions: userPerm
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Get camp error: ', error);
                res.status(500).json({ message: 'Failed to load camp data.' });
            } finally {
                client.release();
            }
        });

        this.app.post('/setCampValue', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = shemaChangeCamp.validate(req.body);

            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { campId } = req.body;

            if (campId)
                req.session.camp = campId;

            return res.status(200).json({ message: '' });

        });

        this.app.post('/addCamp', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddCamp.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid camp name' });
            }

            const { campName } = req.body;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const [existingCamp, checkPermission] = await Promise.all([
                    client.query('SELECT * FROM camps WHERE campname = $1', [campName]),
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add camp')`, [req.session.userId])
                ]);

                if (existingCamp.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Camp name already exists' });
                }

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add a camp" });
                }

                const uniqueId = crypto.randomBytes(16).toString('hex');

                await Promise.all([
                    client.query('INSERT INTO camps VALUES ($1, $2);', [uniqueId, campName]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Camp ${campName} added`])
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Camp added successfully' });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error add camp: ', err);
                res.status(500).json({ message: 'An error occurred. Please try again later.' });

            } finally {
                client.release();
            }
        });
    }

    defineRoutesLogin() {

        // Section for Login

        this.app.get('/', (req, res) => {
            req.session.username = null;
            res.render('index', { title: "LogIn" });
        });

        this.app.get('/changePassword', (req, res) => {
            res.render('changePassword', { title: "Change Password" });
        });

        async function sendAdminVerificated(username) {
            return new Promise(async (resolve, reject) => {
                const client = await pool.connect();
                try {
                    // Insert a pending verification request
                    const { rows } = await client.query(
                        `UPDATE users SET status = 'pending' WHERE username = $1 RETURNING id`,
                        [username]
                    );
                    const verificationId = rows[0].id;

                    const checkInterval = 2000; // 2 sec
                    const timeout = 5 * 60 * 1000; // 5 min timeout

                    let elapsed = 0;
                    const interval = setInterval(async () => {
                        try {
                            const result = await client.query(
                                `SELECT status FROM users WHERE id = $1`,
                                [verificationId]
                            );
                            const status = result.rows[0]?.status;

                            if (status === 'approved') {
                                clearInterval(interval);
                                client.release();
                                resolve(true);
                            } else if (status === 'denied') {
                                clearInterval(interval);
                                client.release();
                                resolve(false);
                            } else {
                                elapsed += checkInterval;
                                if (elapsed >= timeout) {
                                    await client.query(
                                        `UPDATE users SET status = NULL WHERE id = $1`,
                                        [verificationId]
                                    );
                                    clearInterval(interval);
                                    client.release();
                                    resolve(false); // timeout → treated as deny
                                }
                            }
                        } catch (err) {
                            clearInterval(interval);
                            client.release();
                            reject(err);
                        }
                    }, checkInterval);

                } catch (err) {
                    client.release();
                    reject(err);
                }
            });
        }

        function isBlockedSession(req) {
            const record = req.session.failedLogin || { failedAttempts: 0, blockExpiresAt: null };

            if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                if (record.blockExpiresAt > Date.now()) {
                    return true; // Still blocked
                } else {
                    // Block expired, reset
                    req.session.failedLogin = { failedAttempts: 0, blockExpiresAt: null };
                }
            }

            return false;
        }

        this.app.post('/changePassword', async (req, res) => {
            const { error } = schemaChangePassword.validate(req.body, { allowUnknown: true });
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.message)
                return res.status(400).json({ errorMessage: 'Invalid input' });
            }

            const { username, currentPassword, newPassword } = req.body;
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const result = await client.query("SELECT * FROM users WHERE username = $1", [username]);
                if (result.rows.length === 0) {
                    bcrypt.compareSync(currentPassword, '$2b$10$abcdefghijklmnopqrstuv');
                    bcrypt.compareSync(newPassword, '$2b$10$abcdefghijklmnopqrstuv');
                    await client.query('ROLLBACK');
                    return res.status(400).json({ errorMessage: 'Invalid username or password' });
                }

                const user = result.rows[0];

                if (isBlockedSession(req)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ errorMessage: 'Too many failed attempts. Try again later.' });
                }

                const temporaryPasswordMatches = await bcrypt.compareSync(currentPassword, user.temporary_password || '');
                const passwordMatches = await bcrypt.compareSync(currentPassword, user.password || '');

                if (!temporaryPasswordMatches && !passwordMatches) {
                    let record = req.session.failedLogin || { failedAttempts: 0, blockExpiresAt: null };
                    record.failedAttempts += 1;

                    if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                        record.blockExpiresAt = Date.now() + BLOCK_TIME;
                    }

                    req.session.failedLogin = record;

                    await client.query('ROLLBACK');
                    return res.status(400).json({ errorMessage: 'Invalid username or password' });
                }

                const approved = await sendAdminVerificated(username);
                if (!approved) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ errorMessage: 'Admin denied password change or request timed out.' });
                }

                failedLoginAttempts[username] = { failedAttempts: 0 };

                const saltRounds = 10;
                const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

                await Promise.all([
                    client.query('UPDATE users SET temporary_password = NULL, status = NULL, password = $2 WHERE username = $1', [username, hashedNewPassword]),
                    client.query(
                        `INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`,
                        [username, `This user changed their password!`]
                    )
                ]);

                await client.query('COMMIT');
                return res.status(200).json({ redirectTo: '/' });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error when log in:", err);
                return res.status(500).json({ errorMessage: 'An error occurred.' });
            } finally {
                client.release();
            }
        });

        this.app.post('/admin/verify', async (req, res) => {

            const { error } = schemaAdminVerify.validate(req.body, { allowUnknown: true });
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.message)
                return res.status(400).json({ errorMessage: 'Invalid input' });
            }

            const { id, decision } = req.body; // decision: "approved" or "denied"

            const client = await pool.connect();

            try {

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Add system permission')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to verify change password!" });
                }

                await client.query(
                    `UPDATE users SET status = $2 WHERE id = $1`,
                    [id, decision]
                );

                res.status(200).json({ success: true });

            } catch (err) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error when log in:", err);
                return res.status(500).json({ errorMessage: 'An error occurred.' });
            } finally {
                client.release();
            }
        });

        // POST route for login with brute-force protection
        this.app.post('/login', async (req, res) => {
            const { error } = schemaLogIn.validate(req.body, { allowUnknown: true });
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.message)
                return res.status(400).json({ errorMessage: 'Invalid input' });
            }

            const { username, password } = req.body;
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const result = await client.query("SELECT * FROM users WHERE username = $1", [username]);
                if (result.rows.length === 0) {
                    bcrypt.compareSync(password, '$2b$10$abcdefghijklmnopqrstuv');
                    await client.query('ROLLBACK');
                    return res.status(400).json({ errorMessage: 'Invalid username or password' });
                }

                const user = result.rows[0];

                if (isBlockedSession(req)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ errorMessage: 'Too many failed attempts. Try again later.' });
                }

                const passwordMatches = await bcrypt.compareSync(password, user.password || '');
                if (!passwordMatches) {
                    let record = req.session.failedLogin || { failedAttempts: 0, blockExpiresAt: null };
                    record.failedAttempts += 1;

                    if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                        record.blockExpiresAt = Date.now() + BLOCK_TIME;
                    }

                    req.session.failedLogin = record;

                    await client.query('ROLLBACK');
                    return res.status(400).json({ errorMessage: 'Invalid username or password' });
                }

                failedLoginAttempts[username] = { failedAttempts: 0 };
                req.session.pendingUser = username;
                req.session.pendingUserId = user.id;

                await client.query('COMMIT');
                return res.status(200).json({ redirectTo: '/2fa-verificated' });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error when log in:", err);
                return res.status(500).json({ errorMessage: 'An error occurred.' });
            } finally {
                client.release();
            }
        });

        this.app.get('/2fa-verificated', async (req, res) => {
            const client = await pool.connect();

            if (req.session.username)
                return res.redirect('/'); // Already logged in, redirect to main page

            try {
                const result = await client.query("SELECT totp_secret FROM users WHERE id = $1", [req.session.pendingUserId]);
                let secret;

                if (result.rows.length > 0 && result.rows[0].totp_secret) {
                    // User already has a TOTP secret
                    secret = {
                        base32: result.rows[0].totp_secret,
                        otpauth_url: speakeasy.otpauthURL({
                            secret: result.rows[0].totp_secret,
                            label: process.env.SECRET_NAME,
                            encoding: 'base32'
                        })
                    };
                } else {
                    // Generate and save new secret
                    secret = speakeasy.generateSecret({ name: process.env.SECRET_NAME });

                    await client.query("UPDATE users SET totp_secret = $1 WHERE id = $2", [
                        secret.base32,
                        req.session.pendingUserId
                    ]);
                }

                req.session.secret = secret;
                const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);
                req.session.qrCodeDataURL = qrCodeDataURL;

                res.render('verifyQRCode', {
                    qrCodeDataURL,
                    csrfToken: req.csrfToken()
                });

            } catch (err) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error when get QR code:", err);

            } finally {
                client.release();
            }
        });

        this.app.post('/verify', (req, res) => {

            const { error } = schema2FAVerify.validate(req.body, { allowUnknown: true });
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.message);
                return res.status(400).json({ errorMessage: 'Invalid input' });
            }

            const { code } = req.body;
            const userSecret = req.session.secret;

            if (!userSecret) {
                return res.redirect('/'); // Session expired or tampered
            }

            const verified = speakeasy.totp.verify({
                secret: userSecret.base32,
                encoding: 'base32',
                token: code,
                window: 0
            });

            if (!verified) {
                return res.status(400).json({ errorMessage: 'Invalid code. Try again' });
            }

            req.session.username = req.session.pendingUser;
            req.session.userId = req.session.pendingUserId;
            req.session.firstLogin = true;
            delete req.session.qrCodeDataURL;
            delete req.session.secret;
            delete req.session.pendingUser;
            delete req.session.pendingUserId;
            req.session.failedLogin = { failedAttempts: 0, blockExpiresAt: null };
            res.status(200).json({ redirectTo: '/main_page' });

        });

        // POST route to handle logout
        this.app.get('/logout', (req, res) => {

            req.session.destroy();
            res.redirect('/'); // Redirect to login page after logout
        });
    }

    defineRoutesRFID() {

        function isBlockedSession(req) {
            const record = req.session.failedLogin || { failedAttempts: 0, blockExpiresAt: null };

            if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                if (record.blockExpiresAt > Date.now()) {
                    return true; // Still blocked
                } else {
                    // Block expired, reset
                    req.session.failedLogin = { failedAttempts: 0, blockExpiresAt: null };
                }
            }

            return false;
        }

        this.app.get('/getAllCamp', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`SELECT * FROM camps`);

                await client.query('COMMIT');
                return res.status(200).json(result.rows);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error);
                res.status(500);

            } finally {
                client.release();
            }

        });

        this.app.post('/checkLogInApp', async (req, res) => {

            const { error } = schemaLogIn.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ success: false, message: 'Invalid syntax' });
            }

            const { username, password } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                const result = await client.query("SELECT * FROM users WHERE username = $1", [username]);

                if (result.rows.length === 0) {
                    bcrypt.compareSync(password, '$2b$10$abcdefghijklmnopqrstuv');
                    await client.query('COMMIT');
                    return res.status(200).json({ success: false, validUsername: false });
                }

                const user = result.rows[0];

                // Check if the user is blocked due to failed login attempts
                if (isBlockedSession(req)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: 'Too many failed attempts. Try again later.' });
                }

                const passwordMatches = bcrypt.compareSync(password, user.password || '');
                if (!passwordMatches) {

                    let record = req.session.failedLogin || { failedAttempts: 0, blockExpiresAt: null };
                    record.failedAttempts += 1;

                    if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                        record.blockExpiresAt = Date.now() + BLOCK_TIME;
                    }

                    req.session.failedLogin = record;

                    await client.query('COMMIT');
                    return res.status(200).json({ success: false, validUsername: true });

                }

                req.session.failedLogin = { failedAttempts: 0, blockExpiresAt: null };
                req.session.pendingUserId = user.id;
                req.session.pendingUser = username;

                await client.query('COMMIT');
                return res.status(200).json({ success: true, validUsername: true });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error when log in app:", err);
                return res.status(500).json({ success: false, message: 'Server error occurred.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/2fa-verificated-device', async (req, res) => {

            const client = await pool.connect();

            try {
                const result = await client.query("SELECT totp_secret FROM users WHERE id = $1", [req.session.pendingUserId]);
                let secret;

                if (result.rows.length > 0 && result.rows[0].totp_secret) {
                    secret = {
                        base32: result.rows[0].totp_secret,
                        otpauth_url: speakeasy.otpauthURL({
                            secret: result.rows[0].totp_secret,
                            label: process.env.SECRET_NAME,
                            encoding: 'base32'
                        })
                    };
                } else {
                    secret = speakeasy.generateSecret({ name: process.env.SECRET_NAME });
                    await client.query("UPDATE users SET totp_secret = $1 WHERE id = $2", [
                        secret.base32,
                        req.session.pendingUserId
                    ]);
                }

                req.session.secret = secret;
                const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);

                res.json({ qrCodeDataURL });

            } catch (err) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('2FA Error:', err);
                res.status(500).json({ message: 'An error occurred while processing 2FA' });

            } finally {
                client.release();
            }
        });

        this.app.post('/verify-device', (req, res) => {

            const { error } = schema2FAVerify.validate(req.body, { allowUnknown: true });
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid input' });
            }

            const { code } = req.body;
            const userSecret = req.session.secret;

            if (!userSecret) {
                return res.status(400).json({ message: 'Invalid user credentials' });
            }

            const verified = speakeasy.totp.verify({
                secret: userSecret.base32,
                encoding: 'base32',
                token: code,
                window: 0
            });

            if (verified) {
                delete req.session.secret;
                delete req.session.pendingUser;
                delete req.session.pendingUserId;
                return res.status(200).json({ message: 'Success' });
            } else {
                return res.status(400).json({ message: 'Invalid code. Try again.' });
            }
        });
    }

    defineRoutesNFC() {
        // Section NFC App

        this.app.get('/readBikeNfc', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaNFCBikeRead.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { nfcData } = req.query;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT SPLIT_PART(namebike, '/', 1) AS namebike,
                    namebike AS full_name
                    FROM bicycles
                    WHERE id = $1`, [nfcData]);

                const resultHelmet = await client.query(`
                    SELECT SPLIT_PART(code, '/', 1) AS code,
                    code AS full_name
                    FROM helmets
                    WHERE id = $1;`, [nfcData]);

                const getBikeHelmet = await client.query(`
                    SELECT SPLIT_PART(code, '/', 1) AS code
                    FROM helmets
                    WHERE id = (SELECT helmet_id FROM bikesoldier WHERE bikeid = $1 AND dateto IS NULL);`, [nfcData]);

                // Check if a result was found
                if (result.rows.length === 0 && resultHelmet.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Not found bike or helmet with provided NFC data.' });
                }

                await client.query('COMMIT');
                res.status(200).json({
                    namebike: result.rows.length > 0 ? result.rows[0].namebike : '',
                    fullBikeName: result.rows.length > 0 ? result.rows[0].full_name : '',
                    code: resultHelmet.rows.length > 0 ? resultHelmet.rows[0].code : '',
                    fullHelmetName: resultHelmet.rows.length > 0 ? resultHelmet.rows[0].full_name : '',
                    getBikeHelmet: getBikeHelmet.rows.length > 0 ? getBikeHelmet.rows[0].code : ''
                });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error querying the database', err);
                res.status(500).json({ message: 'Internal Server Error' });
            } finally {
                client.release();
            }
        });

        // Endpoint to get all available bikes
        this.app.get('/getClient', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = shemaClientNfc.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { campId } = req.query;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT s.id, namesoldier, k.namekey, k.id AS keyid, 
                    (SELECT COUNT(*) FROM bikesoldier WHERE soldierid = s.id AND datefrom IS NOT NULL AND dateto IS NULL) AS count_get_bike
                    FROM soldier s
                    LEFT JOIN key k ON k.soldierid = s.id
                    WHERE s.camp_id = $1`, [campId]);

                await client.query('COMMIT');
                res.status(200).json(result.rows);

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error get soldier', err);
                res.status(500).json({ message: 'Internal Server Error' });

            } finally {
                client.release();
            }
        });

        this.app.post('/nfcRent', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaNFCRent.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { nfcData, date, time, selectClient, helmetId } = req.body;

            const dateText = `${date} ${time}`;
            const recDate = new Date(dateText);

            const client = await pool.connect();
            const username = req.session.username ? req.session.username : req.body.username;

            try {

                await client.query('BEGIN');

                const [checkPermission, checkBikeExist, checkSoldierExist, checkHelmetExist] = await Promise.all([
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Save bike status')`, [username]),
                    client.query(`SELECT * FROM bicycles WHERE id = $1`, [nfcData]),
                    client.query(`SELECT * FROM soldier WHERE id = $1`, [selectClient]),
                    client.query(`SELECT * FROM helmets WHERE id = $1`, [helmetId])
                ]);

                if (checkBikeExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This bike does not exist. It has probably been modified." });
                }

                if (helmetId !== '' && checkHelmetExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This helmet does not exist. It has probably been modified." });
                }

                if (checkSoldierExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This soldier does not exist. It has probably been modified." });
                }

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to rent bicycles!" });
                }

                const count_result = await client.query(
                    `SELECT COUNT(*) FROM bikesoldier WHERE bikeid = $1 AND dateto IS NULL`,
                    [nfcData]
                );

                const check_helmet = await client.query(
                    `SELECT COUNT(*) FROM bikesoldier WHERE helmet_id = $1 AND dateto IS NULL`,
                    [helmetId]
                );

                const bikeResult = await client.query(`SELECT namebike FROM bicycles WHERE id = $1;`, [nfcData]);

                if (check_helmet.rows[0].count > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'The helmet is already rented.' });
                }

                if (count_result.rows[0].count > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'The bike is already rented.' });
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

                const uniqueId = crypto.randomBytes(16).toString('hex');

                await Promise.all([
                    client.query(
                        "UPDATE bicycles SET status = $1 WHERE id = $2",
                        [newStatus, nfcData]
                    ),
                    client.query(
                        `INSERT INTO bikesoldier(id, bikeid, soldierid, datefrom, status_bike, helmet_id) VALUES ($1, $2, $3, $4, $5, $6);`,
                        [uniqueId, nfcData, selectClient, recDate, newStatus, helmetId ? helmetId : null]
                    ),
                    client.query(
                        `INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`,
                        [username, `Rented Bike with name ${bikeResult.rows[0].namebike}`]
                    )
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Data rent received successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error executing database query', error);
                res.status(500).json({ message: 'An error occurred. Please try again later.' });
            } finally {
                // Release the client back to the pool
                client.release();
            }
        });

        this.app.post('/nfcReturn', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaNFCReturn.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { nfcData, date, time } = req.body;

            const dateText = `${date} ${time}`;
            const recDate = new Date(dateText);

            const client = await pool.connect();
            const username = req.session.username ? req.session.username : req.body.username;

            try {

                await client.query('BEGIN');

                const [checkPermission, checkBikeExist] = await Promise.all([
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Save bike status')`, [username]),
                    client.query(`SELECT * FROM bicycles WHERE id = $1`, [nfcData])
                ]);

                if (checkBikeExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This bike does not exist. It has probably been modified." });
                }

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to return bicycles!" });
                }

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
                        `INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`,
                        [username, `Return Bike with name ${bikeResult.rows[0].namebike}`]
                    )
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Data return received successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error executing database query', error);
                res.status(500).json({ message: 'An error occurred. Please try again later.' });
            } finally {
                client.release();
            }
        });

        this.app.patch('/editParameturBike', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditParameturBike.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { oldBikeId, newBikeId, bikeName, campId } = req.body;

            const client = await pool.connect();
            const username = req.session.username ? req.session.username : req.body.username;

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Edit bike')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to edit bike!" });
                }

                const oldBikeResult = await client.query(`SELECT * FROM bicycles WHERE id = $1;`, [oldBikeId]);
                const newBikeResult = await client.query(`SELECT * FROM bicycles WHERE id = $1;`, [newBikeId]);
                const nameBikeResult = await client.query(`SELECT * FROM bicycles WHERE namebike = $1 AND camp_id = $2;`, [bikeName, campId]);

                if (oldBikeResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Old bike ID not found. It has probably been modified' });
                }

                if (oldBikeId !== newBikeId && newBikeResult.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'New bike ID is already exist.' });
                }

                if (oldBikeResult.rows[0].namebike !== bikeName && nameBikeResult.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This bike name is already exist.' });
                }

                if (oldBikeId === newBikeId) {
                    await Promise.all([
                        client.query(
                            "UPDATE bicycles SET namebike = $1 WHERE id = $2",
                            [bikeName, oldBikeId]
                        ),
                        client.query(
                            `INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`,
                            [req.body.username, `Edit Bike name with code ${oldBikeId}`]
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
                            `INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`,
                            [username, `Edit Bike with name ${bikeName}, replace old NFC ${oldBikeId} with new NFC ${newBikeId}`]
                        )
                    ]);
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'Bike edit successfully.' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error executing database query', error);
                res.status(500).json({ message: 'An error occurred. Please try again later.' });
            } finally {
                client.release();
            }
        });

        this.app.patch('/editParameturHelmet', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditParameturHelmet.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { oldHelmetId, newHelmetId, helmetName, campId } = req.body;

            const client = await pool.connect();
            const username = req.session.username ? req.session.username : req.body.username;

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'List of helmet')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to edit helmet!" });
                }

                const oldHelmetResult = await client.query(`SELECT * FROM helmets WHERE id = $1;`, [oldHelmetId]);
                const newHelmetResult = await client.query(`SELECT * FROM helmets WHERE id = $1;`, [newHelmetId]);
                const nameHelmetResult = await client.query(`SELECT * FROM helmets WHERE code = $1 AND camp_id = $2;`, [helmetName, campId]);

                if (oldHelmetResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Old helmet ID not found. It has probably been modified' });
                }

                if (oldHelmetId !== newHelmetId && newHelmetResult.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'New helmet ID is already exist.' });
                }

                if (oldHelmetResult.rows[0].code !== helmetName && nameHelmetResult.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This helmet name is already exist.' });
                }

                if (oldHelmetId === newHelmetId) {
                    await Promise.all([
                        client.query(
                            "UPDATE helmets SET code = $1 WHERE id = $2",
                            [helmetName, oldHelmetId]
                        ),
                        client.query(
                            `INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`,
                            [req.body.username, `Edit Helmet name with code ${oldHelmetId}`]
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
                            `INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`,
                            [username, `Edit Bike with name ${helmetName}, replace old NFC ${oldHelmetId} with new NFC ${newHelmetId}`]
                        )
                    ]);
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'Bike edit successfully.' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error executing database query', error);
                res.status(500).json({ message: 'An error occurred. Please try again later.' });
            } finally {
                client.release();
            }
        });
    }

    defineRoutesBicycles() {

        // Serve APK file from local directory
        this.app.get('/download-apk-bike', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();
            const username = req.session.username ? req.session.username : req.body.username;

            try {
                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Download bicycle app')`, [username]);

                if (checkPermission.rows.length === 0)
                    return res.status(400).json({ message: "You don't have permission to download app for bicycle!" });

            } catch (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error downloading the file:', err);
                return res.status(500).json({ message: 'Error downloading the file' });

            } finally {
                client.release();
            }

            const apkFilePath = path.join(__dirname, 'androidApp', 'NFCReader-1.4-release.apk');

            // Check APK file existence and legality
            if (!this.checkApkFileLegality(apkFilePath, res)) {
                return res.status(400).json({ message: 'There is a problem with existence and legality of APK file' });
            }

            // Serve the APK with proper headers
            res.setHeader('Content-Type', 'application/vnd.android.package-archive');
            res.setHeader('Content-Disposition', 'attachment; filename="NFCReader-1.4-release.apk"');
            res.download(apkFilePath, (err) => {
                if (err) {
                    console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                    console.error('Error during APK download:', err);
                    res.status(500).json({ message: 'Error downloading the file' });
                }
            });
        });

        this.app.get('/apk-bike-version', this.isLoggedIn.bind(this), (req, res) => {
            res.json({ version: "1.4", apkUrl: "/download-apk-bike" });
        });

        // Section bicycles

        this.app.get('/bicycles', this.isLoggedIn.bind(this), async (req, res) => {

            var data = [];
            var optionHour = [];
            var optionMinute = [];
            let userPerm = [];
            let index = [];

            var totalBike = 0;
            var rentedBike = 0;
            var availableBike = 0;
            var repairBike = 0;
            var lateBike = 0;
            var longTermBike = 0;

            const { error } = schemaGetBike.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const formateDate = isoString => {
                const date = new Date(isoString);

                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                let hours = date.getHours();
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12; // the hour '0' should be '12'
                const hourStr = String(hours).padStart(2, '0');

                return `${year}-${month}-${day} ${hourStr}:${minutes} ${ampm}`;
            }

            let { isFirstTime = "true",
                limit = 50,
                offset = 0,
                searchColumn,
                searchValue } = req.query;


            // Get a client from the pool
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const baseValues = [req.session.camp];
                const values = [...baseValues];

                let whereClause = `WHERE b.camp_id = $1`;
                let havingClause = '';

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    let regularFilters = [];
                    let havingFilters = [];

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        const paramValue = `%${value}%`;

                        switch (column) {
                            case 'formatted_date':
                                havingFilters.push({ clause: `CASE WHEN b.status <> 'Available' THEN TO_CHAR(lb.datefrom, 'YYYY-MM-DD HH24:MI') ELSE NULL END::TEXT ILIKE $${values.length + 1}`, value: paramValue });
                                break;

                            case 'namesoldier':
                                havingFilters.push({ clause: `CASE WHEN b.status <> 'Available' THEN namesoldier ELSE NULL END::TEXT ILIKE $${values.length + 1}`, value: paramValue });
                                break;

                            case 'h.code':
                                havingFilters.push({ clause: `CASE WHEN b.status <> 'Available' THEN h.code ELSE NULL END::TEXT ILIKE $${values.length + 1}`, value: paramValue });
                                break;

                            default:
                                values.push(paramValue);
                                const paramIndex = values.length;
                                regularFilters.push({ clause: `${column}::TEXT ILIKE $${paramIndex}` });
                                break;
                        }
                    }

                    if (regularFilters.length > 0) {
                        whereClause += " AND (" + regularFilters.map(f => f.clause).join(" AND ") + ")";
                    }

                    if (havingFilters.length > 0) {
                        havingClause = " HAVING " + havingFilters.map(f => f.clause).join(" AND ");
                        havingFilters.forEach(f => values.push(f.value));
                    }
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

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
                        SELECT bikeId, soldierId, datefrom, ROW_NUMBER() OVER (PARTITION BY bikeId ORDER BY datefrom DESC) AS rn 
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
                const [result_bike, result_filter_bike, result_count, get_permission] = await Promise.all([
                    client.query(
                        `SELECT 
                            namebike, 
                            b.status, 
                            namesoldier,
                            h.code,
                            TO_CHAR(lb.datefrom, 'YYYY-MM-DD HH24:MI') AS formatted_date
                        FROM bicycles b 
                        LEFT JOIN (SELECT bikeId, soldierId, datefrom, helmet_id, ROW_NUMBER() OVER (PARTITION BY bikeId ORDER BY datefrom DESC) AS rn FROM bikeSoldier) lb ON b.id = lb.bikeId AND lb.rn = 1 
                        LEFT JOIN soldier s ON lb.soldierId = s.id
                        LEFT JOIN helmets h ON lb.helmet_id = h.id
                        WHERE b.camp_id = $1
                        ORDER BY 
                            CASE 
                                WHEN b.status = 'Late' THEN 0 
                                WHEN b.status = 'Repair' THEN 1 
                                WHEN b.status = 'Rented' THEN 2 
                                WHEN b.status = 'Available' THEN 3 
                                ELSE 4 
                            END, b.status;`, [req.session.camp]),

                    client.query(
                        `SELECT 
                            namebike, 
                            b.status, 
                            namesoldier,
                            h.code,
                            TO_CHAR(lb.datefrom, 'YYYY-MM-DD HH24:MI') AS formatted_date
                        FROM bicycles b 
                        LEFT JOIN (SELECT bikeId, soldierId, datefrom, helmet_id, ROW_NUMBER() OVER (PARTITION BY bikeId ORDER BY datefrom DESC) AS rn FROM bikeSoldier) lb ON b.id = lb.bikeId AND lb.rn = 1 
                        LEFT JOIN soldier s ON lb.soldierId = s.id
                        LEFT JOIN helmets h ON lb.helmet_id = h.id
                        ${whereClause}
                        GROUP BY namebike, b.status, namesoldier, h.code, lb.datefrom
                        ${havingClause}
                        ORDER BY 
                            CASE 
                                WHEN b.status = 'Late' THEN 0 
                                WHEN b.status = 'Repair' THEN 1 
                                WHEN b.status = 'Rented' THEN 2 
                                WHEN b.status = 'Available' THEN 3 
                                ELSE 4 
                            END, b.status
                        LIMIT $${limitIndex} OFFSET $${offsetIndex};`,
                        values
                    ),

                    client.query(
                        `SELECT COUNT(*) AS total
                            FROM (
                                SELECT 1
                                FROM bicycles b 
                                LEFT JOIN (SELECT bikeId, soldierId, datefrom, helmet_id, ROW_NUMBER() OVER (PARTITION BY bikeId ORDER BY datefrom DESC) AS rn FROM bikeSoldier) lb ON b.id = lb.bikeId AND lb.rn = 1 
                                LEFT JOIN soldier s ON lb.soldierId = s.id
                                LEFT JOIN helmets h ON lb.helmet_id = h.id
                                ${whereClause}
                                GROUP BY namebike, b.status, namesoldier, h.code, lb.datefrom
                                ${havingClause}
                            ) sub;`,
                        values.slice(0, values.length - 2)
                    ),

                    client.query(`
                        SELECT permission_name FROM permission p
                        JOIN user_permission up ON up.perm_id = p.id AND up.user_id = $1;`, [req.session.userId])
                ]);

                const totalCount = parseInt(result_count.rows[0].total, 10);

                result_filter_bike.rows.forEach(element => {
                    data.push({
                        name: element.namebike,
                        status: element.status,
                        hiredby: element.status === "Available" ? "None" : element.namesoldier,
                        helmet: element.status === "Available" ? "None" : element?.code || "None",
                        datefrom: element.status === "Available" ? "None" : formateDate(element.formatted_date)
                    });
                });

                result_bike.rows.forEach(element => {

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

                userPerm = get_permission.rows;

                const hasFullPermission = userPerm.some(p => p.permission_name === 'Full permission');
                const isAdmin = req.session.username === 'admin';

                if (hasFullPermission && isAdmin) {
                    index = [0, 1, 2, 3, 4, 5, 6];
                } else if (hasFullPermission) {
                    index = [0, 1, 2, 4, 5, 6];
                } else {
                    index = [0, 6];

                    if (userPerm.some(p => p.permission_name === 'Assets')) index.push(1);
                    if (userPerm.some(p => p.permission_name === 'Laundry')) index.push(2);
                    if (userPerm.some(p => p.permission_name === 'Gym')) index.push(3);
                    if (userPerm.some(p => p.permission_name === 'Accommodation and keys')) index.push(4);
                    if (userPerm.some(p => p.permission_name === 'Bicycles')) index.push(5);
                }

                index.sort();

                await client.query('COMMIT');

                if (isFirstTime === 'true')
                    this.giveSpecificPermissionBicycles(userPerm, index, res, data, optionHour, optionMinute, totalBike, rentedBike, availableBike, repairBike, lateBike, longTermBike, totalCount);
                else
                    res.status(200).json({
                        data, totalBike, rentedBike, availableBike,
                        repairBike, lateBike, longTermBike, totalCount
                    });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error get bike data:', error);
                res.status(500).json({ message: 'An error occurred. Please try again later.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/bicycles/getStatusData', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaGetStatusBike.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { status, page, limit, searchColumn, searchValue } = req.query;

            // Get a client from the pool
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const baseValues = [req.session.camp, status];
                const values = [...baseValues];
                const countValues = [...baseValues];
                const offset = (page - 1) * limit;

                let whereClause = `WHERE b.camp_id = $1 AND b.status = $2`;
                let countWhereClause = `WHERE b.camp_id = $1 AND b.status = $2`;
                let havingClause = '';

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    if (!searchColumn.includes('namesoldier')) {
                        whereClause += " AND (";
                        countWhereClause += " AND (";
                    }

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        if (column !== 'namesoldier') {
                            whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                            countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;
                        } else {
                            havingClause += `HAVING (CASE WHEN b.status <> 'Available' THEN namesoldier ELSE NULL END) ILIKE $${paramIndex}`;
                        }

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    if (!searchColumn.includes('namesoldier')) {
                        whereClause += ")";
                        countWhereClause += ")";
                    }
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [result, countResult] = await Promise.all([

                    client.query(
                        `SELECT 
                            namebike, 
                            CASE WHEN b.status <> 'Available' THEN namesoldier ELSE NULL END AS namesoldier,
                            CASE WHEN b.status <> 'Available' THEN TO_CHAR(lb.datefrom, 'YYYY-MM-DD HH24:MI') ELSE NULL END AS formatted_date
                        FROM bicycles b 
                        LEFT JOIN (SELECT bikeId, soldierId, datefrom, helmet_id, ROW_NUMBER() OVER (PARTITION BY bikeId ORDER BY datefrom DESC) AS rn FROM bikeSoldier) lb ON b.id = lb.bikeId AND lb.rn = 1 
                        LEFT JOIN soldier s ON lb.soldierId = s.id
                        LEFT JOIN helmets h ON lb.helmet_id = h.id
                        ${whereClause}
                        GROUP BY namebike, status, namesoldier, lb.datefrom
                        ${havingClause}
                        LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),

                    client.query(
                        `SELECT 
                            namebike
                        FROM bicycles b 
                        LEFT JOIN (SELECT bikeId, soldierId, datefrom, helmet_id, ROW_NUMBER() OVER (PARTITION BY bikeId ORDER BY datefrom DESC) AS rn FROM bikeSoldier) lb ON b.id = lb.bikeId AND lb.rn = 1 
                        LEFT JOIN soldier s ON lb.soldierId = s.id
                        LEFT JOIN helmets h ON lb.helmet_id = h.id
                        ${countWhereClause}
                        GROUP BY namebike, status, namesoldier, lb.datefrom
                        ${havingClause};`, countValues),
                ]);

                const totalData = parseInt(countResult.rows.length, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                await client.query('COMMIT');
                res.status(200).json({ data: result.rows, totalPages });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error get status date', error);
                res.status(500).json({ message: 'An error occurred. Please try again later.' });

            } finally {
                client.release();
            }

        });

        this.app.post("/bikeAction", this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaBike.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { bikeId, clientId, actionId, dateId, hourSelectId, minuteSelect, ltstatus, helmetId } = req.body;

            // Ensure hour and minute are valid numbers
            const hour = parseInt(hourSelectId, 10);
            const minute = parseInt(minuteSelect, 10);

            if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                return res.status(400).json({ message: 'Invalid time.' });
            }

            // Construct date string and parse it into a Date object
            const dateText = `${dateId} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const recDate = new Date(dateText);

            // Check if the constructed date is valid
            if (isNaN(recDate.getTime())) {
                return res.status(400).json({ message: 'Invalid date format.' });
            }

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Save bike status')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to rent/return bicycles!" });
                }

                const [bikeResult, helmetResult, soldierResult] = await Promise.all([
                    client.query(`SELECT * FROM bicycles WHERE id = $1`, [bikeId]),
                    client.query(`SELECT * FROM helmets WHERE id = $1`, [helmetId]),
                    client.query(`SELECT * FROM soldier WHERE id = $1`, [clientId])
                ]);

                if (bikeResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This bike does not exist. It has probably been modified." });
                }

                if (helmetId !== '' && helmetResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This helmet does not exist. It has probably been modified." });
                }

                if (clientId !== '' && soldierResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This soldier does not exist. It has probably been modified." });
                }

                if (actionId === 'Rent') {

                    if (!clientId) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: 'Invalid client ID.' });
                    }

                    const count_result = await client.query(
                        `SELECT COUNT(*) FROM bikesoldier WHERE bikeid = $1 AND dateto IS NULL`,
                        [bikeId]
                    );

                    if (count_result.rows[0].count > 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: 'The bike is already rented.' });
                    }

                    const check_helmet = await client.query(
                        `SELECT COUNT(*) FROM bikesoldier WHERE helmet_id = $1 AND dateto IS NULL`,
                        [helmetId]
                    );

                    if (check_helmet.rows[0].count > 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: 'The helmet is already rented.' });
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

                    const uniqueId = crypto.randomBytes(16).toString('hex');

                    await Promise.all([
                        client.query(
                            "UPDATE bicycles SET status = $1 WHERE id = $2",
                            [newStatus, bikeId]
                        ),
                        client.query(
                            `INSERT INTO bikesoldier(id, bikeid, soldierid, datefrom, status_bike, helmet_id) VALUES (
                            $1, $2, $3, $4, $5, $6);`,
                            [uniqueId, bikeId, clientId, recDate, newStatus, helmetId ? helmetId : null]
                        ),
                        client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                            [req.session.username,
                            helmetId ? `Rented Bike with name ${bikeResult.rows[0].namebike} and helmet with code ${helmetResult.rows[0].code}`
                                : `Rented Bike with name ${bikeResult.rows[0].namebike}`
                            ])
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
                        client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                            [req.session.username,
                            helmetId ? `Return Bike with name ${bikeResult.rows[0].namebike} and helmet with code ${helmetResult.rows[0].code}`
                                : `Return Bike with name ${bikeResult.rows[0].namebike}`
                            ])
                    ]);

                    await client.query('COMMIT');
                    res.status(200).json({ message: 'The bike has been return successfully' });
                }

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error rent/return bike:', error);
                res.status(500).json({ message: 'An error occurred. Please try again later.' });

            } finally {
                client.release();
            }
        });

        this.app.post("/bicycles/report", this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaReportBike.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { selectedDate1, selectedDate2, filtersBike, filtersBikeDate } = req.body;

            selectedDate1 += " 00:00";
            selectedDate2 += " 23:59";

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                let values = [selectedDate1, selectedDate2, req.session.camp];
                let valuesDate = [selectedDate1, selectedDate2, req.session.camp];

                const whereClause = filtersBike.length > 0
                    ? 'WHERE ' + filtersBike.map((filter, index) => {
                        const column = filter.column;
                        values.push(`%${filter.value}%`);
                        return `${column}::TEXT ILIKE $${index + 4}`;
                    }).join(' AND ')
                    : '';

                const whereClauseDate = filtersBikeDate.length > 0
                    ? 'WHERE ' + filtersBikeDate.map((filter, index) => {
                        const column = filter.column;
                        valuesDate.push(`%${filter.value}%`);
                        return `${column}::TEXT ILIKE $${index + 4}`;
                    }).join(' AND ')
                    : '';

                // Query for bike usage details
                const [result_soldior, result_bike_totals] = await Promise.all([
                    client.query(
                        `SELECT * FROM (
                            SELECT DISTINCT
                            b.namebike, 
                            COALESCE(s.namesoldier, 'N/A') AS namesoldier,
                            COALESCE(s.country, 'N/A') AS country,
                            COALESCE(h.code, 'N/A') AS helmet_code,
                            COALESCE(TO_CHAR(datefrom, 'YYYY-MM-DD HH24:MI'), 'Still in use') AS date_from,
                            COALESCE(TO_CHAR(dateto, 'YYYY-MM-DD HH24:MI'), 'Still in use') AS date_to,
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
                                WHEN dateto IS NULL THEN status_bike
                                ELSE 'On time'
                                END AS status
                            FROM bikesoldier bs 
                            LEFT JOIN soldier s ON bs.soldierid = s.id 
                            LEFT JOIN bicycles b ON bs.bikeid = b.id
                            LEFT JOIN helmets h ON bs.helmet_id = h.id
                            WHERE datefrom BETWEEN $1 AND $2 AND b.camp_id = $3
                        ) sub
                        ${whereClause}
                        ORDER BY date_from;`, values
                    ),
                    client.query(
                        `SELECT * FROM (
                            SELECT 
                                TO_CHAR(datefrom, 'YYYY-MM-DD') AS date, 
                                COUNT(*) AS total_bikes
                            FROM (
                                SELECT DISTINCT ON (bs.bikeid, bs.soldierid, bs.datefrom, bs.dateto) bs.bikeid, bs.datefrom
                                FROM bikesoldier bs
                                LEFT JOIN bicycles b ON b.id = bs.bikeid
                                WHERE bs.datefrom BETWEEN $1 AND $2 AND b.camp_id = $3
                            ) subquery
                            GROUP BY TO_CHAR(datefrom, 'YYYY-MM-DD')
                        ) sub
                        ${whereClauseDate}
                        ORDER BY date;`, valuesDate
                    )
                ]);

                const filteredSoldier = result_soldior.rows;
                const filteredSoldierMove = result_bike_totals.rows;

                // Create a new Excel workbook
                const workbook = new excelJS.Workbook();

                // Sheet 1: Bike Usage Data
                const worksheet1 = workbook.addWorksheet('Bike Usage Data');

                // Add custom column titles for the first sheet
                const headers1 = ['Bike Name', 'Soldier Name', 'Country', 'Helmet Code', 'Date From', 'Date To', 'Duration', 'Status', 'Overdue Status'];
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
                    { width: 20 },
                    { width: 25 },
                    { width: 20 },
                    { width: 20 },
                    { width: 20 },
                    { width: 25 },
                    { width: 30 },
                    { width: 20 },
                    { width: 25 }
                ];

                // Add data rows to the first sheet with alternating row color styling
                filteredSoldier.forEach((row, index) => {
                    const dataRow = worksheet1.addRow(Object.values(row));

                    // Check if the status is "Late" and add a ⚠️ icon
                    if (row.status === 'Late') {
                        dataRow.getCell(9).value = '⚠️';
                    } else {
                        dataRow.getCell(9).value = '';
                    }

                    // Center align the "Status" column (8th column)
                    dataRow.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };

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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to generate bike report:', error);
                res.status(500).json({ message: 'An error occurred' });

            } finally {
                client.release();
            }

        });

        this.app.get('/bikes', this.isLoggedIn.bind(this), async (req, res) => {

            const { error, value } = shemaClientNfc.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message)
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            var optionBike = [];

            const client = await pool.connect();

            const campId = req.session.username ? req.session.camp : value.campId;

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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get bike:', error);
                res.status(500).json({ message: 'An error occurred' });

            } finally {
                client.release();
            }

        });

        this.app.get('/helmets', this.isLoggedIn.bind(this), async (req, res) => {

            const { error, value } = shemaClientNfc.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            var optionsHelmets = [];

            const client = await pool.connect();

            const campId = req.session.username ? req.session.camp : value.campId;

            let { page, limit, searchColumn, searchValue } = req.query;

            try {
                await client.query('BEGIN');

                if (value.isValidCode || Object.keys(req.query).length === 0) {
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
                    return res.status(200).json(optionsHelmets);
                }

                const offset = (page - 1) * limit;
                let whereClause = 'WHERE h.camp_id = $1';
                let values = [campId];

                let countValues = [campId];
                let countWhereClause = 'WHERE h.camp_id = $1';

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [result_bike, countResult] = await Promise.all([
                    client.query(`
                        SELECT h.id, h.code
                        FROM helmets h
                        LEFT JOIN bikesoldier bs ON h.id = bs.helmet_id AND bs.dateto IS NULL
                        ${whereClause}
                        LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),

                    client.query(`
                        SELECT COUNT(*) AS count
                        FROM helmets h
                        LEFT JOIN bikesoldier bs ON h.id = bs.helmet_id AND bs.dateto IS NULL
                        ${countWhereClause};`, countValues),
                ]);

                result_bike.rows.forEach(element => {
                    optionsHelmets.push({ id: element.id, name: element.code, code: element.code_status });
                });

                const totalData = parseInt(countResult.rows[0].count, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                await client.query('COMMIT');
                return res.status(200).json({ helmetListData: optionsHelmets, totalPages });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error get helmet data:', error);
                res.status(500).json({ message: 'An error occurred' });

            } finally {
                client.release();
            }

        });

        this.app.get('/getHelmetByBike', this.isLoggedIn.bind(this), async (req, res) => {

            const { error, value } = shemaHelmetBike.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const bikeId = value.bikeId;
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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get helmet by bike:', error);
                res.status(500).json({ message: 'An error occurred' });

            } finally {
                client.release();
            }

        });

        this.app.get('/bicycles/viewReport', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaReport.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { selectedDate1, selectedDate2, page = 1, pageDate = 1, limit = 10, searchColumn, searchValue, searchColumnDate, searchValueDate } = req.query;
            const offset = (page - 1) * limit;
            const offsetDate = (pageDate - 1) * limit;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                selectedDate1 += " 00:00";
                selectedDate2 += " 23:59";

                let whereClause = ``;
                let values = [selectedDate1, selectedDate2, req.session.camp];

                let countValues = [selectedDate1, selectedDate2, req.session.camp];
                let countWhereClause = ``;

                let whereClauseDate = ``;
                let valuesDate = [selectedDate1, selectedDate2, req.session.camp];

                let countWhereClauseDate = ``;
                let countValuesDate = [selectedDate1, selectedDate2, req.session.camp];

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += "WHERE ";
                    countWhereClause += "WHERE ";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                if (searchColumnDate && searchValueDate) {

                    if (!Array.isArray(searchColumnDate)) searchColumnDate = [searchColumnDate];
                    if (!Array.isArray(searchValueDate)) searchValueDate = [searchValueDate];

                    if (Array.isArray(searchColumnDate[0])) searchColumnDate = searchColumnDate[0];
                    if (Array.isArray(searchValueDate[0])) searchValueDate = searchValueDate[0];

                    whereClauseDate += "WHERE (";
                    countWhereClauseDate += "WHERE (";

                    for (let i = 0; i < searchColumnDate.length; i++) {
                        const column = searchColumnDate[i];
                        const value = searchValueDate[i];

                        valuesDate.push(`%${value}%`);
                        countValuesDate.push(`%${value}%`);

                        const paramIndex = valuesDate.length;
                        const countParamIndex = countValuesDate.length;

                        whereClauseDate += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClauseDate += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumnDate.length - 1) {
                            whereClauseDate += " AND ";
                            countWhereClauseDate += " AND ";
                        }
                    }

                    whereClauseDate += ")";
                    countWhereClauseDate += ")";
                }

                // Add pagination
                valuesDate.push(limit);
                valuesDate.push(offsetDate);
                const limitIndexDate = valuesDate.length - 1;
                const offsetIndexDate = valuesDate.length;

                // Query for bike usage details and total bike usage per day in the date range
                const [result_soldior, countResult, result_bike_totals, countResultTotal] = await Promise.all([
                    client.query(
                        `SELECT * FROM (
                            SELECT DISTINCT
                                b.namebike, 
                                s.namesoldier,
                                s.country,
                                h.code AS helmet_code,
                                COALESCE(TO_CHAR(datefrom, 'YYYY-MM-DD HH24:MI'), 'Still in use') AS date_from,
                                COALESCE(TO_CHAR(dateto, 'YYYY-MM-DD HH24:MI'), 'Still in use') AS date_to, 
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
                            ORDER BY date_from DESC
                        ) sub
                        ${whereClause}
                        LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),

                    client.query(
                        `SELECT * FROM (
                            SELECT DISTINCT
                                b.namebike, 
                                s.namesoldier,
                                s.country,
                                h.code AS helmet_code,
                                COALESCE(TO_CHAR(datefrom, 'YYYY-MM-DD HH24:MI'), 'Still in use') AS date_from,
                                COALESCE(TO_CHAR(dateto, 'YYYY-MM-DD HH24:MI'), 'Still in use') AS date_to, 
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
                            ORDER BY date_from DESC
                        ) sub
                        ${countWhereClause};`, countValues),

                    client.query(
                        `SELECT * FROM (
                            SELECT 
                                TO_CHAR(datefrom, 'YYYY-MM-DD') AS date, 
                                COUNT(*) AS total_bikes
                            FROM (
                                SELECT DISTINCT ON (bs.bikeid, bs.soldierid, bs.datefrom, bs.dateto) bs.bikeid, bs.datefrom
                                FROM bikesoldier bs
                                LEFT JOIN bicycles b ON b.id = bs.bikeid
                                WHERE datefrom BETWEEN $1 AND $2 AND b.camp_id = $3
                            ) subquery
                            GROUP BY TO_CHAR(datefrom, 'YYYY-MM-DD')
                        ) sub
                        ${whereClauseDate}
                        GROUP BY date, total_bikes
                        ORDER BY date
                        LIMIT $${limitIndexDate} OFFSET $${offsetIndexDate};`, valuesDate),

                    client.query(
                        `SELECT * FROM (
                            SELECT 
                                TO_CHAR(datefrom, 'YYYY-MM-DD') AS date, 
                                COUNT(*) AS total_bikes
                            FROM (
                                SELECT DISTINCT ON (bs.bikeid, bs.soldierid, bs.datefrom, bs.dateto) bs.bikeid, bs.datefrom
                                FROM bikesoldier bs
                                LEFT JOIN bicycles b ON b.id = bs.bikeid
                                WHERE datefrom BETWEEN $1 AND $2 AND b.camp_id = $3
                            ) subquery
                            GROUP BY TO_CHAR(datefrom, 'YYYY-MM-DD')
                        ) sub
                        ${countWhereClauseDate}
                        GROUP BY date, total_bikes
                        ORDER BY date;`, countValuesDate)
                ]);

                const data = result_soldior.rows;
                const dateTotals = result_bike_totals.rows;

                const totalData = parseInt(countResult.rows.length, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                const totalDataDate = parseInt(countResultTotal.rows.length, 10);
                const totalPagesTotal = Math.ceil(totalDataDate / limit) || 1;

                await client.query('COMMIT');
                res.json({ data, dateTotals, totalPages, totalPagesTotal });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get report:', error);
                res.status(500).json({ message: 'An error occurred' });

            } finally {
                client.release();
            }
        });

        this.app.post('/bicycles/addBike', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddBike.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { bikeAddId, bikeName } = req.body;

            const campId = req.session.username ? req.session.camp : req.body.campId;
            const username = req.session.username ? req.session.username : req.body.username;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add bike')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add bicycles!" });
                }

                // Check if bikeAddId already exists
                const result = await client.query(`SELECT * FROM bicycles WHERE id = $1`, [bikeAddId]);
                const resultName = await client.query(`SELECT * FROM bicycles WHERE namebike = $1 AND camp_id = $2;`, [bikeName, campId]);

                if (result.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This bike number already exists.' });
                }

                if (resultName.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This bike name already exists.' });
                }

                // Insert new bike if bikeAddId doesn't exist
                await client.query(`INSERT INTO bicycles VALUES ($1, $2, 'Available', $3);`, [bikeAddId, bikeName, campId]);

                // Query the database for the user
                await client.query(
                    `INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`,
                    [username, `Add Bike with name ${bikeName}`]
                );

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Bike added successfully.' });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to add bike:', err);
                res.status(500).json({ message: 'Internal server error.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/bicycles/addHelmet', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddHelmet.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            if (!req.session.camp && !req.body.campId) {
                return res.status(400).json({ message: "You not select camp. First select camp then add lost item?!" });
            }

            let { helmetAddId, helmetName } = req.body;

            const campId = req.session.username ? req.session.camp : req.body.campId;
            const username = req.session.username ? req.session.username : req.body.username;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add helmet')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add helmet!" });
                }

                // Check if bikeAddId already exists
                const result = await client.query(`SELECT * FROM helmets WHERE id = $1;`, [helmetAddId]);
                const resultName = await client.query(`SELECT * FROM helmets WHERE code = $1 AND camp_id = $2;`, [helmetName, campId]);

                if (result.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This helmet number already exists.' });
                }

                if (resultName.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This helmet name already exists.' });
                }

                // Insert new bike if bikeAddId doesn't exist
                await client.query(`INSERT INTO helmets VALUES ($1, $2, $3);`, [helmetAddId, helmetName, campId]);

                // Query the database for the user
                await client.query(
                    `INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`,
                    [username, `Add Helmet with name ${helmetName}`]
                );

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Helmet added successfully.' });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to add helmet:', err);
                res.status(500).json({ message: 'Internal server error.' });

            } finally {
                client.release();
            }
        });

        this.app.delete('/bicycles/removeHelmet', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveHelmet.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: "Invalid syntax. The value must contain only the letter and number character" });
            }

            const { code } = req.body;
            const username = req.session.username ? req.session.username : req.body.username;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WWHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'List of helmet')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to remove helmet!" });
                }

                const checkHelmet = await client.query(`SELECT id FROM helmets WHERE id = $1`, [code]);
                const check_give_helmet = await client.query(`SELECT helmet_id FROM bikesoldier WHERE helmet_id = $1 AND dateto IS NULL`, [code]);

                if (checkHelmet.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Helmet not found.' });
                }

                if (check_give_helmet.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This helmet is currently in use and cannot be removed.' });
                }

                await Promise.all([
                    client.query(`DELETE FROM bikesoldier WHERE helmet_id = $1;`, [code]),
                    client.query(`DELETE FROM helmets WHERE id = $1`, [code])
                ]);

                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [username, `Remove helmet ${code}`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Helmet removed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to remove helmet:', error);
                res.status(500).json({ message: 'An error occurred' });

            } finally {
                client.release();
            }
        });

        this.app.delete('/bicycles/removeBike', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveBike.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { bikeRemoveId } = req.body;
            const username = req.session.username ? req.session.username : req.body.username;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Remove bike')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to remove bicycles!" });
                }

                const bikeResult = await client.query(`SELECT namebike FROM bicycles WHERE id = $1`, [bikeRemoveId]);
                const checkBike = await client.query(`SELECT bikeid FROM bikesoldier WHERE bikeid = $1 AND dateto IS NULL`, [bikeRemoveId]);

                if (bikeResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Bike not found.' });
                }

                if (checkBike.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This bike is currently in use and cannot be removed.' });
                }

                await Promise.all([
                    client.query(
                        `INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`,
                        [username, `Remove Bike with number ${bikeResult.rows[0].namebike}`]
                    ),
                    client.query(`DELETE FROM bicycles WHERE id = $1;`, [bikeRemoveId])
                ]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Bike remove successfully.' });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to remove bike:', err);
                res.status(500).json({ message: 'Internal server error.' });

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

            if (!req.session.camp) {
                return res.status(400).json({ message: "You not select camp. First select camp then add lost item?!" });
            }

            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded.' });
            }

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add bike')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add multiple bicycles!" });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                // Create a Set to track unique bike IDs within the data array
                const uniqueBikeId = new Set();
                const uniqueBikeName = new Set();

                if (sheetName !== 'Bicycles Multipul Bike') {
                    await client.query('ROLLBACK');
                    errors.push({ type: 'CheckExist', message: `Invalid template` });
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

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

                    if (uniqueBikeName.has(row.id)) {
                        errors.push({ type: 'UniqueIdCheck', message: `Duplicate bike name '${row.namebike}' found within the data.` });
                        return;
                    }

                    // Add bike ID to the Set after checking
                    uniqueBikeId.add(row.id);
                    uniqueBikeName.add(row.namebike);

                    // Inside the backend function, when checking for duplicates
                    const [result_id, result_code] = await Promise.all([
                        client.query("SELECT * FROM bicycles WHERE id = $1;", [row.id]),
                        client.query("SELECT * FROM bicycles WHERE namebike = $1 AND camp_id = $2;", [row.namebike, req.session.camp])
                    ])

                    if (result_id.rows.length > 0) {
                        errors.push({ type: 'CheckExist', message: `Bicycles with number '${row.id}' already exists.` });
                        return;
                    }

                    if (result_code.rows.length > 0) {
                        errors.push({ type: 'CheckExist', message: `Bicycles with name '${row.namebike}' already exists.` });
                        return;
                    }

                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');
                    const styleError = errors.find(error => error.type === 'Validation');

                    if (styleError) {
                        console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                        console.error(styleError.details);
                    }

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
                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)", [req.session.username, 'Multi Add Bike']);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/bicycles/uploadMultiHelmet', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {

            const client = await pool.connect();
            const errors = [];

            if (!req.session.camp) {
                return res.status(400).json({ message: "You not select camp. First select camp then add lost item?!" });
            }

            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded.' });
            }

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add helmet')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add multiple helmet!" });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                // Create a Set to track unique bike IDs within the data array
                const uniqueHelmetId = new Set();
                const uniqueHelmetName = new Set();

                if (sheetName !== 'Helmets Multipul Bike') {
                    await client.query('ROLLBACK');
                    errors.push({ type: 'CheckExist', message: `Invalid template` });
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

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

                    if (uniqueHelmetName.has(row.code)) {
                        errors.push({ type: 'UniqueIdCheck', message: `Duplicate helmet code '${row.code}' found within the data.` });
                        return;
                    }

                    // Add bike ID to the Set after checking
                    uniqueHelmetId.add(row.id);
                    uniqueHelmetName.add(row.code);

                    // Inside the backend function, when checking for duplicates
                    const [check_id, check_code] = await Promise.all([
                        client.query("SELECT * FROM helmets WHERE id = $1;", [row.id]),
                        client.query("SELECT * FROM helmets WHERE code = $1 AND camp_id = $2;", [row.code, req.session.camp]),
                    ]);

                    if (check_id.rows.length > 0) {
                        errors.push({ type: 'CheckExist', message: `Helmet with number '${row.id}' already exists.` });
                        return;
                    }

                    if (check_code.rows.length > 0) {
                        errors.push({ type: 'CheckExist', message: `Helmet with code '${row.code}' already exists.` });
                        return;
                    }

                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');

                    const styleError = errors.find(error => error.type === 'Validation');

                    if (styleError) {
                        console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                        console.error(styleError.details);
                    }

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
                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)", [req.session.username, 'Multi Add Helmets']);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/checkBike', this.isLoggedIn.bind(this), async (req, res) => {

            const { error, value } = schemaCheckBike.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const bikeId = value.bikeId;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkBikeId = await client.query('SELECT * FROM bicycles WHERE id = $1;', [bikeId]);

                if (checkBikeId.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This bike does not exist. It has probably been modified." });
                }

                const result_bike = await client.query(`
                        SELECT status, datefrom FROM bicycles b
                        LEFT JOIN bikesoldier bs ON bs.bikeid = b.id
                        WHERE b.id = $1 and b.status <> 'Available' AND dateto IS NULL;`, [bikeId]);

                await client.query('COMMIT');

                if (result_bike.rows.length > 0) {
                    const statusRes = result_bike.rows[0].status ? result_bike.rows[0].status : 'Available';
                    const datefromRes = result_bike.rows[0].datefrom ? result_bike.rows[0].datefrom : 'None';

                    res.status(200).json({ status: statusRes, datefrom: datefromRes });
                } else {
                    res.status(200).json({ status: 'Available', datefrom: 'None' });
                }

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to check bike:', error);
                res.status(500).json({ message: 'An error occurred while processing.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/clients', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaGetListSoldier.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { page, limit, searchColumn, searchValue } = req.query;

            var optionClient = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                if (Object.keys(req.query).length === 0) {

                    const result_client = await client.query(`
                    SELECT s.id, namesoldier, country, upcoming_accommodation, upcoming_release, namekey,
                    l.id as etc, l.code, s.meal_card, s.date_free, s.date_accommodation, k.id AS keyid,
                    (SELECT namekey FROM key WHERE id = s.upcoming_accommodation_key) AS upcoming_key
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
                            date_accommodation: element.date_accommodation ? element.date_accommodation : '',
                            upcoming_key: element.upcoming_key ? element.upcoming_key : ''
                        });
                    });

                    await client.query('COMMIT');
                    return res.json(optionClient);
                }

                const offset = (page - 1) * limit;
                let whereClause = `WHERE s.camp_id = $1 AND s.id <> '4'`;
                let values = [req.session.camp];

                let countValues = [req.session.camp];
                let countWhereClause = `WHERE s.camp_id = $1 AND s.id <> '4'`;

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        if (column === 'upcoming_key') {
                            whereClause += `(SELECT namekey FROM key WHERE id = s.upcoming_accommodation_key)::TEXT ILIKE $${paramIndex}`;
                            countWhereClause += `(SELECT namekey FROM key WHERE id = s.upcoming_accommodation_key)::TEXT ILIKE $${countParamIndex}`;
                        } else {
                            whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                            countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;
                        }

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [result_client, countResult] = await Promise.all([

                    client.query(`
                        SELECT s.id, namesoldier, country, upcoming_accommodation, upcoming_release,
                        l.id as etc, l.code, s.meal_card, s.date_free, s.date_accommodation,
                        (SELECT namekey FROM key WHERE id = s.upcoming_accommodation_key) AS upcoming_key
                        FROM soldier s
                        LEFT JOIN laundrybags l ON l.id = s.laundry_bag_id
                        ${whereClause}
                        LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),

                    client.query(`
                        SELECT COUNT(*) AS count
                        FROM soldier s
                        LEFT JOIN laundrybags l ON l.id = s.laundry_bag_id
                        ${countWhereClause};`, countValues),
                ]);

                result_client.rows.forEach(element => {
                    optionClient.push({
                        id: element.id,
                        name: element.namesoldier,
                        country: element.country,
                        upcoming_accommodation: element.upcoming_accommodation ? element.upcoming_accommodation : '',
                        upcoming_release: element.upcoming_release ? element.upcoming_release : '',
                        keyid: element.keyid ? element.keyid : '',
                        etc: element.etc ? element.etc : '',
                        code: element.code ? element.code : '',
                        meal_card: element.meal_card ? element.meal_card : '',
                        date_free: element.date_free ? element.date_free : '',
                        date_accommodation: element.date_accommodation ? element.date_accommodation : '',
                        upcoming_key: element.upcoming_key ? element.upcoming_key : ''
                    });
                });

                const totalData = parseInt(countResult.rows[0].count, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                await client.query('COMMIT');
                res.json({ soldierListData: optionClient, totalSoldierListData: totalPages });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get soldier:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.patch('/bicycles/editBike', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditBike.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { bikeId, status, soldierId, helmetId, dateFrom } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const [checkPermission, checkBikeExist, checkSoldierExist, checkHelmetExist] = await Promise.all([
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Edit bike')`, [req.session.userId]),
                    client.query(`SELECT * FROM bicycles WHERE id = $1;`, [bikeId]),
                    client.query(`SELECT * FROM soldier WHERE id = $1;`, [soldierId]),
                    client.query(`SELECT * FROM helmets WHERE id = $1;`, [helmetId]),
                ]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to edit bike!" });
                }

                if (checkBikeExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This bike does not exist. It has probably been modified." });
                }

                if (checkSoldierExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This soldier does not exist. It has probably been modified." });
                }

                if (helmetId !== '' && checkHelmetExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This helmet does not exist. It has probably been modified." });
                }

                await Promise.all([
                    client.query(
                        `INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`,
                        [req.session.username, `Edit bike status`]
                    ),
                    client.query(`UPDATE bicycles SET status = $1 WHERE id = $2;`, [status, bikeId]),
                    client.query(`UPDATE bikesoldier SET soldierid = $1, datefrom = $2, status_bike = $4, helmet_id = $5 WHERE bikeid = $3 AND dateto IS NULL;`, [soldierId, dateFrom, bikeId, status, helmetId || null]),
                ]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Bike data edited successfully.' });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to change bike:', err);
                res.status(500).json({ message: 'Internal server error.' });

            } finally {
                client.release();
            }
        });
    }

    // Section Accommodation
    defineRoutesAccommodation() {

        this.app.get('/getUpcomingAction', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaUpcomingAction.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { page, limit, searchColumn, searchValue } = req.query;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const offset = (page - 1) * limit;
                let whereClause = `
                    WHERE s.camp_id = $1 AND (
                        (s.upcoming_accommodation >= CURRENT_DATE AND s.upcoming_release IS NULL) 
                        OR (s.upcoming_release >= CURRENT_DATE AND s.upcoming_accommodation IS NULL) 
                        OR (s.upcoming_accommodation >= CURRENT_DATE AND s.upcoming_release >= CURRENT_DATE))`;
                let values = [req.session.camp];

                let countValues = [req.session.camp];
                let countWhereClause = `
                    WHERE s.camp_id = $1 AND (
                        (s.upcoming_accommodation >= CURRENT_DATE AND s.upcoming_release IS NULL) 
                        OR (s.upcoming_release >= CURRENT_DATE AND s.upcoming_accommodation IS NULL) 
                        OR (s.upcoming_accommodation >= CURRENT_DATE AND s.upcoming_release >= CURRENT_DATE))`;

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [result, countResult] = await Promise.all([
                    client.query(`
                        SELECT 
                            s.namesoldier AS name,
                            l.code,
                            s.meal_card,
                            s.upcoming_accommodation_key,
                            s.upcoming_accommodation,
                            s.upcoming_release
                        FROM soldier s
                        LEFT JOIN laundrybags l ON l.id =  s.laundry_bag_id
                        LEFT JOIN key k ON k.id = s.upcoming_accommodation_key
                        ${whereClause}
                        ORDER BY 
                            CASE 
                                WHEN s.upcoming_accommodation IS NOT NULL AND s.upcoming_release IS NOT NULL THEN 1
                                WHEN s.upcoming_accommodation IS NOT NULL THEN 2
                                WHEN s.upcoming_release IS NOT NULL THEN 3
                                ELSE 4
                            END,
                            CASE 
                                WHEN s.upcoming_accommodation IS NOT NULL AND s.upcoming_release IS NOT NULL THEN s.upcoming_accommodation 
                            END DESC,
                            CASE 
                                WHEN s.upcoming_accommodation IS NOT NULL AND s.upcoming_release IS NOT NULL THEN s.upcoming_release 
                            END ASC,
                            CASE 
                                WHEN s.upcoming_accommodation IS NOT NULL AND s.upcoming_release IS NULL THEN s.upcoming_accommodation 
                            END DESC,
                            CASE 
                                WHEN s.upcoming_release IS NOT NULL AND s.upcoming_accommodation IS NULL THEN s.upcoming_release 
                            END ASC
                            LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),

                    client.query(`
                            SELECT 
                                COUNT(*) AS count
                            FROM soldier s
                            LEFT JOIN laundrybags l ON l.id =  s.laundry_bag_id
                            LEFT JOIN key k ON k.id = s.upcoming_accommodation_key
                            ${countWhereClause};`, countValues)
                ]);

                const totalData = parseInt(countResult.rows[0].count, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                await client.query('COMMIT');
                res.status(200).json({ upcomingActionData: result.rows, totalUpcomingAction: totalPages });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get upcomint action:', error);
                return res.status(500).json({ message: 'An internal error occurred while processing your request.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/checkUpcomingDate', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const query = `
                    SELECT *
                        FROM soldier
                        WHERE camp_id = $1
                        AND NOT (date_accommodation IS NOT NULL AND date_free IS NULL)
                        AND (
                            (upcoming_accommodation IS NOT NULL AND CURRENT_DATE BETWEEN upcoming_accommodation - INTERVAL '1 day' AND upcoming_accommodation)
                            OR
                            (upcoming_release IS NOT NULL AND CURRENT_DATE BETWEEN upcoming_release - INTERVAL '1 day' AND upcoming_release)
                        );
                    `;

                const result = await client.query(query, [req.session.camp]);
                await client.query('COMMIT');

                const convertDate = (date) => {
                    const dateObj = new Date(date);
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                    const day = String(dateObj.getDate()).padStart(2, "0");
                    return `${year}-${month}-${day}`;
                };

                const todayStr = convertDate(new Date());
                const oneDayMs = 86400000;

                const isAccommodation = result.rows.some(row => {
                    const date = new Date(row.upcoming_accommodation);
                    const dateStr = convertDate(date);
                    const yesterdayStr = convertDate(new Date(date.getTime() - oneDayMs));
                    return todayStr === dateStr || todayStr === yesterdayStr;
                });

                const isRelease = result.rows.some(row => {
                    const date = new Date(row.upcoming_release);
                    const dateStr = convertDate(date);
                    const yesterdayStr = convertDate(new Date(date.getTime() - oneDayMs));
                    return todayStr === dateStr || todayStr === yesterdayStr;
                });

                const accommodationList = result.rows
                    .filter(row => {
                        const date = new Date(row.upcoming_accommodation);
                        const dateStr = convertDate(date);
                        const yesterdayStr = convertDate(new Date(date.getTime() - oneDayMs));
                        return todayStr === dateStr || todayStr === yesterdayStr;
                    })
                    .map(row => row.namesoldier);

                const releaseList = result.rows
                    .filter(row => {
                        const date = new Date(row.upcoming_release);
                        const dateStr = convertDate(date);
                        const yesterdayStr = convertDate(new Date(date.getTime() - oneDayMs));
                        return todayStr === dateStr || todayStr === yesterdayStr;
                    })
                    .map(row => row.namesoldier);

                return res.status(200).json({
                    isAccommodation,
                    isRelease,
                    accommodationList,
                    releaseList
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error check upcoming date: ', error);
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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get rooms:', error);
                res.status(500).json({ message: 'An error occurred while processing.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/bags', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = shemaGetBags.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let optionAllBag = [];
            let optionFilterAllBag = [];

            const campId = req.session?.username ? req.session.camp : req.query.campId;
            let { page = 1, limit = 10, searchColumn, searchValue } = req.query;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const offset = (page - 1) * limit;
                let whereClause = 'WHERE camp_id = $1';
                let values = [campId];

                let countValues = [campId];
                let countWhereClause = 'WHERE camp_id = $1';

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [result_all_bags, result_filter_bags, countResult] = await Promise.all([
                    client.query(`SELECT * FROM laundrybags WHERE camp_id = $1;`, [campId]),
                    client.query(`SELECT * 
                        FROM laundrybags 
                        ${whereClause} LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),
                    client.query(`SELECT COUNT(*) FROM laundrybags ${countWhereClause};`, countValues),
                ]);

                result_all_bags.rows.forEach(element => {
                    optionAllBag.push({ id: element.id, name: element.code, status: element.status, maxcountlandry: element.maxcountlandry, type: element.type });
                });

                result_filter_bags.rows.forEach(element => {
                    optionFilterAllBag.push({ id: element.id, name: element.code, status: element.status, maxcountlandry: element.maxcountlandry, type: element.type });
                });

                const totalData = parseInt(countResult.rows[0].count, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                await client.query('COMMIT');
                res.status(200).json({
                    allBags: optionAllBag,
                    filterData: optionFilterAllBag,
                    totalPages: totalPages
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error fetch list bags:', error);
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
                    WHERE l.id NOT IN (SELECT DISTINCT l.id
											FROM laundrybags l
											LEFT JOIN additionalitem ai ON ai.bag_id = l.id
											LEFT JOIN soldier s ON s.laundry_bag_id = l.id OR ai.soldier_id = s.id
											WHERE
											    s.id IS NOT NULL AND (
											        s.date_accommodation IS NULL
											        OR
											        (s.date_accommodation IS NOT NULL AND s.date_free IS NULL)
											    )
					) AND l.camp_id = $1;`, [req.session.camp]);

                result_all_bags.rows.forEach(element => {
                    optionAllBag.push({ id: element.id, name: element.code, status: element.status });
                });

                await client.query('COMMIT');
                res.json({ bags: optionAllBag });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get free beds:', error);
                res.status(500).json({ message: 'An error occurred while processing.' });

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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get build:', error);
                res.status(500).json({ message: 'An error occurred while processing.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/move/getSoldier', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaGetSoldier.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const keyId = req.query.keyId;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const check_key_exist = await client.query(`SELECT * FROM key WHERE id = $1;`, [keyId]);
                if (check_key_exist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'The curent select key is not exist. It has probably been modified.' });
                }

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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get soldier for move:', error);
                res.status(500).json({ message: 'An error occurred while processing.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/searchBikes', this.isLoggedIn.bind(this), async (req, res) => {

            const { error, value } = schemaSearchBike.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const selectBike = value.id;
            var allBikeInfo = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const check_exist_bike = await client.query(`SELECT * FROM bicycles WHERE id = $1;`, [selectBike]);
                if (check_exist_bike.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This bike is not exist. It has probably been modified.' });
                }

                const result_client = await client.query(`
                SELECT DISTINCT
                namesoldier,
                TO_CHAR(datefrom, 'YYYY-MM-DD HH24:MI') AS formatted_date_from,
                datefrom,
                TO_CHAR(dateto, 'YYYY-MM-DD HH24:MI') AS formatted_date_to
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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to search bike:', error);
                res.status(500).json({ message: 'An error occurred while processing.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/searchClient', this.isLoggedIn.bind(this), async (req, res) => {

            const { error, value } = schemaSearchBike.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const selectClient = value.id;
            var allClientInfo = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const check_exist_soldier = await client.query(`SELECT * FROM soldier WHERE id = $1;`, [selectClient]);
                if (check_exist_soldier.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This soldier is not exist. It has probably been modified.' });
                }

                const result_client = await client.query(`
                SELECT DISTINCT
                namebike,
                TO_CHAR(datefrom, 'YYYY-MM-DD HH24:MI') AS formatted_date_from,
                datefrom,
                TO_CHAR(dateto, 'YYYY-MM-DD HH24:MI') AS formatted_date_to
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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to search soldier:', error);
                res.status(500).json({ message: 'An error occurred while processing.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/searchHelmet', this.isLoggedIn.bind(this), async (req, res) => {

            const { error, value } = schemaSearchBike.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const id = value.id;
            var allHelmetInfo = [];

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const check_exist_helmet = await client.query(`SELECT * FROM helmets WHERE id = $1;`, [id]);
                if (check_exist_helmet.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This helmet not exist. It has probably been modified.' });
                }

                const result_helmet = await client.query(`
                SELECT DISTINCT
                namesoldier,
                TO_CHAR(datefrom, 'YYYY-MM-DD HH24:MI') AS formatted_date_from,
                datefrom,
                TO_CHAR(dateto, 'YYYY-MM-DD HH24:MI') AS formatted_date_to
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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error search helmet:', error);
                res.status(500).json({ message: 'An error occurred while processing.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/accommodation', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = schemaAccommodation.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let {
                numBuild,
                isFirstTime = "true",
                limit = 50,
                offset = 0,
                sortedColumn,
                sortedDirection,
                searchColumn,
                searchValue
            } = req.query;

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const filters = [];
                const values = [];
                let valueIndex = 1;

                let buildFilter = "";
                if (numBuild) {
                    buildFilter = `br.buildid = $${valueIndex++}`;
                    values.push(numBuild);
                } else {
                    buildFilter = `b.camp_id = $${valueIndex++} AND b.type = 'Accommodation'`;
                    values.push(req.session.camp);
                }

                let havingClause = '';
                if (Array.isArray(searchColumn) && Array.isArray(searchValue)) {
                    const havingFilters = [];
                    for (let i = 0; i < searchColumn.length; i++) {
                        if (['countFreeBeds', 'countAllBeds'].includes(searchColumn[i])) {
                            havingFilters.push(`COUNT(CASE WHEN ${searchColumn[i] === 'countFreeBeds'
                                ? 's.id IS NULL AND a.location_key IS NOT NULL'
                                : 'a.location_key IS NOT NULL'
                                } THEN k.id END)::text ILIKE $${valueIndex++}`);
                            values.push(`%${searchValue[i]}%`);
                        } else if (searchColumn[i] === 'room_status') {
                            havingFilters.push(`(
                                CASE
                                    WHEN COUNT(CASE WHEN a.location_key IS NOT NULL THEN k.id END) = COUNT(CASE WHEN s.id IS NULL AND a.location_key IS NOT NULL THEN k.id END) THEN 'Completely free'
                                    WHEN COUNT(CASE WHEN s.id IS NULL AND a.location_key IS NOT NULL THEN k.id END) != 0 THEN 'Free'
                                    ELSE 'Occupied'
                                END
                            ) ILIKE $${valueIndex++}`);
                            values.push(`%${searchValue[i]}%`);
                        } else {
                            filters.push(`${searchColumn[i]} ILIKE $${valueIndex++}`);
                            values.push(`%${searchValue[i]}%`);
                        }
                    }
                    if (havingFilters.length > 0) {
                        havingClause = `HAVING ${havingFilters.join(' AND ')}`;
                    }
                } else if (searchColumn && searchValue) {
                    if (['countFreeBeds', 'countAllBeds'].includes(searchColumn)) {
                        havingClause = `HAVING COUNT(CASE WHEN ${searchColumn === 'countFreeBeds'
                            ? 's.id IS NULL AND a.location_key IS NOT NULL'
                            : 'a.location_key IS NOT NULL'
                            } THEN k.id END)::text ILIKE $${valueIndex++}`;
                        values.push(`%${searchValue}%`);
                    } else if (searchColumn === 'room_status') {
                        havingClause = `HAVING (
                            CASE
                                WHEN COUNT(CASE WHEN a.location_key IS NOT NULL THEN k.id END) = COUNT(CASE WHEN s.id IS NULL AND a.location_key IS NOT NULL THEN k.id END) THEN 'Completely free'
                                WHEN COUNT(CASE WHEN s.id IS NULL AND a.location_key IS NOT NULL THEN k.id END) != 0 THEN 'Free'
                                ELSE 'Occupied'
                            END
                        ) ILIKE $${valueIndex++}`;
                        values.push(`%${searchValue}%`);
                    } else {
                        filters.push(`${searchColumn} ILIKE $${valueIndex++}`);
                        values.push(`%${searchValue}%`);
                    }
                }

                const whereClause = `
                    ${buildFilter}
                    ${filters.length > 0 ? ' AND ' + filters.join(' AND ') : ''}`;

                const orderClause = (sortedColumn && sortedDirection)
                    ? `ORDER BY ${sortedColumn} ${sortedDirection.toUpperCase()}`
                    : `ORDER BY nameroom`;

                const queryMain = `
                    WITH room_data AS (
                        SELECT
                            r.nameroom,
                            COUNT(
                                CASE 
                                    WHEN b.type = 'Accommodation' AND s.id IS NULL AND a.location_key IS NOT NULL THEN k.id
                                    WHEN b.type = 'Accommodation' AND s.id IS NULL AND r.nameroom ~ '^(\\d+/\\d+/E\\d*|\\d+/D\\d*)$' THEN k.id
                                    WHEN b.type != 'Accommodation' AND s.id IS NULL THEN k.id
                                END
                            ) AS countFreeBeds,
                            COUNT(
                                CASE 
                                    WHEN b.type = 'Accommodation' AND a.location_key IS NOT NULL THEN k.id
                                    WHEN b.type = 'Accommodation' AND r.nameroom ~ '^(\\d+/\\d+/E\\d*|\\d+/D\\d*)$' THEN k.id
                                    WHEN b.type != 'Accommodation' THEN k.id
                                END
                            ) AS countAllBeds
                        FROM rooms r
                        LEFT JOIN roomskey rk ON r.id = rk.roomid
                        LEFT JOIN key k ON k.id = rk.keyid
                        LEFT JOIN soldier s ON s.id = k.soldierid
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        LEFT JOIN buildings b ON b.id = br.buildid
                        LEFT JOIN assets a ON a.location_key = k.id
                        WHERE ${whereClause}
                        GROUP BY r.nameroom
                        ${havingClause}
                    )
                    SELECT *,
                        CASE
                            WHEN countAllBeds = countFreeBeds THEN 'Completely free'
                            WHEN countFreeBeds != 0 THEN 'Free'
                            ELSE 'Occupied'
                        END AS room_status
                    FROM room_data
                    ${orderClause}
                    LIMIT $${valueIndex++} OFFSET $${valueIndex++};
                `;

                values.push(limit, offset);

                const queryTotals = `
                    WITH room_data AS (
                        SELECT
                            r.nameroom,
                            COUNT(
                                CASE 
                                    WHEN b.type = 'Accommodation' AND s.id IS NULL AND a.location_key IS NOT NULL THEN k.id
                                    WHEN b.type = 'Accommodation' AND s.id IS NULL AND r.nameroom ~ '^(\\d+/\\d+/E\\d*|\\d+/D\\d*)$' THEN k.id
                                    WHEN b.type != 'Accommodation' AND s.id IS NULL THEN k.id
                                END
                            ) AS countFreeBeds,
                            COUNT(
                                CASE 
                                    WHEN b.type = 'Accommodation' AND a.location_key IS NOT NULL THEN k.id
                                    WHEN b.type = 'Accommodation' AND r.nameroom ~ '^(\\d+/\\d+/E\\d*|\\d+/D\\d*)$' THEN k.id
                                    WHEN b.type != 'Accommodation' THEN k.id
                                END
                            ) AS countAllBeds
                        FROM rooms r
                        LEFT JOIN roomskey rk ON r.id = rk.roomid
                        LEFT JOIN key k ON k.id = rk.keyid
                        LEFT JOIN soldier s ON s.id = k.soldierid
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        LEFT JOIN buildings b ON b.id = br.buildid
                        LEFT JOIN assets a ON a.location_key = k.id
                        WHERE ${whereClause}
                        GROUP BY r.nameroom
                        ${havingClause}
                    )
                    SELECT 
                        SUM(CASE WHEN nameroom !~ '^(\\d+/\\d+/E\\d*|\\d+/D\\d*)$' THEN countFreeBeds ELSE 0 END) AS totalFreeBeds,
                        SUM(CASE WHEN nameroom !~ '^(\\d+/\\d+/E\\d*|\\d+/D\\d*)$' THEN (countAllBeds - countFreeBeds) ELSE 0 END) AS totalOccupiedBeds
                    FROM room_data;
                `;

                const totalValues = values.slice(0, values.length - 2);

                const queryCount = `SELECT COUNT(*) AS totalCount FROM (
                    SELECT 1 FROM rooms r
                    LEFT JOIN roomskey rk ON r.id = rk.roomid
                    LEFT JOIN key k ON k.id = rk.keyid
                    LEFT JOIN soldier s ON s.id = k.soldierid
                    LEFT JOIN buildroom br ON br.roomid = r.id
                    LEFT JOIN buildings b ON b.id = br.buildid
                    LEFT JOIN assets a ON a.location_key = k.id
                    WHERE ${whereClause}
                    GROUP BY r.nameroom
                    ${havingClause}
                ) sub;`;

                const countValues = values.slice(0, values.length - 2);

                const queryPermission = `
                    SELECT permission_name FROM permission p
                    JOIN user_permission up ON up.perm_id = p.id AND up.user_id = $1;`;

                const [mainResult, countResult, totalsResult, get_permission, resultBuild] = await Promise.all([
                    client.query(queryMain, values),
                    client.query(queryCount, countValues),
                    client.query(queryTotals, totalValues),
                    client.query(queryPermission, [req.session.userId]),
                    client.query(`
                        SELECT b.id, b.namebuilding, b.type, COUNT(
                                CASE 
                                    WHEN a.location_key IS NOT NULL AND s.id IS NULL THEN k.id
                                END) AS countFreeBeds 
                        FROM buildings b
                        LEFT JOIN buildroom br ON br.buildid = b.id
                        LEFT JOIN roomskey rk ON br.roomid = rk.roomid
                        LEFT JOIN key k ON k.id = rk.keyid
                        LEFT JOIN assets a ON a.location_key = k.id
                        LEFT JOIN soldier s ON s.id = k.soldierid
                        WHERE b.camp_id = $1
                        GROUP BY b.id, b.namebuilding, b.type
                        ORDER BY 
                            CASE WHEN type = 'Accommodation' THEN 0 ELSE 1 END,
                            namebuilding;`, [req.session.camp])
                ]);

                const navBuild = resultBuild.rows.map(row => {
                    const buildingNumberMatch = row.namebuilding.split(" ");
                    const buildingNumber = buildingNumberMatch[1];
                    return row.type === 'Accommodation'
                        ? {
                            name: row.namebuilding,
                            id: row.id,
                            nameBuilding: buildingNumber,
                            nameAdd: row.countfreebeds
                        }
                        : {
                            name: row.namebuilding,
                            id: row.id,
                            nameBuilding: buildingNumber
                        };
                });

                const nameroomSetCount = mainResult.rows.map(row => ({
                    nameroom: row.nameroom,
                    countFreeBeds: row.countfreebeds,
                    countAllBeds: row.countallbeds,
                    roomStatus: row.room_status
                }));

                const totalFreeBeds = parseInt(totalsResult.rows[0]?.totalfreebeds || 0, 10);
                const totalOccupiedBeds = parseInt(totalsResult.rows[0]?.totaloccupiedbeds || 0, 10);

                let type = '';
                if (numBuild) {
                    const result_type_build = await client.query(`SELECT type FROM buildings WHERE id = $1;`, [numBuild]);
                    type = result_type_build.rows[0]?.type || '';
                }

                const userPerm = get_permission.rows;

                // Permission logic unchanged
                const hasFullPermission = userPerm.some(p => p.permission_name === 'Full permission');
                const isAdmin = req.session.username === 'admin';

                let index = [];
                if (hasFullPermission && isAdmin) {
                    index = [0, 1, 2, 3, 4, 5, 6];
                } else if (hasFullPermission) {
                    index = [0, 1, 2, 4, 5, 6];
                } else {
                    index = [0, 6];
                    if (userPerm.some(p => p.permission_name === 'Assets')) index.push(1);
                    if (userPerm.some(p => p.permission_name === 'Laundry')) index.push(2);
                    if (userPerm.some(p => p.permission_name === 'Gym')) index.push(3);
                    if (userPerm.some(p => p.permission_name === 'Accommodation and keys')) index.push(4);
                    if (userPerm.some(p => p.permission_name === 'Bicycles')) index.push(5);
                }
                index.sort();

                await client.query('COMMIT');

                if (isFirstTime === "false") {
                    res.status(200).json({
                        nameroomSetCount,
                        totalCount: countResult.rows[0]?.totalcount || 0,
                        totalFreeBeds,
                        totalOccupiedBeds,
                        buildType: type,
                        navBuild,
                        permissions: userPerm
                    });
                } else {
                    const title = 'Accommodation';
                    const headerTable = type === 'Accommodation' || type === ''
                        ? [{ name: 'Number Key' }, { name: 'Key code' }, { name: 'Soldier' }, { name: 'Nationality' }, { name: 'Meal card' }, { name: 'Laundry bag' }]
                        : [{ name: 'Number Key' }, { name: 'Key code' }, { name: 'Soldier' }, { name: 'Nationality' }];

                    this.giveSpecificPermissionAccommodation(
                        userPerm,
                        index,
                        res,
                        navBuild,
                        totalFreeBeds,
                        totalOccupiedBeds,
                        type,
                        title,
                        headerTable,
                        nameroomSetCount,
                        countResult.rows[0].totalcount,
                        numBuild
                    );
                }
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to open accommodation:', error);
                res.status(500).json({ message: 'An error occurred while processing.' });
            } finally {
                client.release();
            }
        });


        this.app.get('/getKeyBuildigType', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveKey.validate(req.query);

            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { keyId } = req.query;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const check_exist_key = await client.query(`SELECT * FROM key WHERE id = $1;`, [keyId]);
                if (check_exist_key.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This keyId is not exist. It has probably been modified.' });
                }

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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error to get key by build type:", error);
                res.status(500).json({ message: "Server error" });

            } finally {
                client.release();
            }
        });

        this.app.get('/getRoomKeys', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaViewKey.validate(req.query);

            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { roomNumber, page, limit, searchColumn, searchValue } = req.query;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const offset = (page - 1) * limit;
                let whereClause = 'WHERE r.nameroom = $1 AND k.id IS NOT NULL AND b.camp_id = $2';
                let values = [roomNumber, req.session.camp];

                let countValues = [roomNumber, req.session.camp];
                let countWhereClause = 'WHERE r.nameroom = $1 AND k.id IS NOT NULL AND b.camp_id = $2';

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [result, countResult] = await Promise.all([
                    client.query(`
                        SELECT namekey, k.id AS code, namesoldier, country, meal_card AS mealcard, lb.code AS lbcode, a.location_key
                        FROM rooms r
                        LEFT JOIN roomskey rk ON r.id = rk.roomid
                        LEFT JOIN key k ON k.id = rk.keyid
                        LEFT JOIN soldier s ON s.id = k.soldierid
                        LEFT JOIN laundrybags lb ON lb.id = s.laundry_bag_id
                        LEFT JOIN assets a ON a.location_key = k.id
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        LEFT JOIN buildings b ON b.id = br.buildid
                        ${whereClause}
                        ORDER BY namekey
                        LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),

                    client.query(`
                        SELECT COUNT(*) AS count
                        FROM rooms r
                        LEFT JOIN roomskey rk ON r.id = rk.roomid
                        LEFT JOIN key k ON k.id = rk.keyid
                        LEFT JOIN soldier s ON s.id = k.soldierid
                        LEFT JOIN laundrybags lb ON lb.id = s.laundry_bag_id
                        LEFT JOIN assets a ON a.location_key = k.id
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        LEFT JOIN buildings b ON b.id = br.buildid
                        ${countWhereClause};`, countValues)
                ]);

                const totalData = parseInt(countResult.rows[0].count, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                // Send back filtered data for the specified room
                await client.query('COMMIT');
                res.json({ keyListData: result.rows, totalKeyListData: totalPages });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error fetching room keys:", error);
                res.status(500).json({ message: "Server error" });

            } finally {
                client.release();
            }
        });

        this.app.post('/saveKey', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaSaveSoldier.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { keyCodeId, soldierId, bagId, mealCardId } = req.body;

            // Get a client from the pool
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const check_exist_key = await client.query(`SELECT * FROM key WHERE id = $1;`, [keyCodeId]);
                if (check_exist_key.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This key is not exist. It has probably been modified.' });
                }

                const check_exist_soldier = await client.query(`SELECT * FROM soldier WHERE id = $1;`, [soldierId]);
                if (soldierId !== '' && check_exist_soldier.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This soldier is not exist. It has probably been modified.' });
                }

                const check_exist_bag = await client.query(`SELECT * FROM laundrybags WHERE id = $1;`, [bagId]);
                if (bagId !== '' && check_exist_bag.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This bag is not exist. It has probably been modified.' });
                }

                const result_check_bag_soldier = await client.query(`
                    SELECT * FROM soldier s 
                    LEFT JOIN additionalitem ai ON s.id = ai.soldier_id
                    LEFT JOIN laundrybags l ON s.laundry_bag_id = l.id OR l.id = ai.bag_id
                    WHERE l.code = $1 AND (
                        s.id IS NOT NULL 
                        AND (s.date_accommodation IS NULL OR (s.date_accommodation IS NOT NULL AND date_free IS NULL))) AND l.camp_id = $2;`, [bagId, req.session.camp]);

                if (bagId !== '' && result_check_bag_soldier.rows.length > 0 && result_check_bag_soldier.rows[0].id !== soldierId) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `This bag was given to another soldier` });
                }

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Save key')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to release or accommodation soldier!" });
                }

                const key_build_type = await client.query(`
                    SELECT b.type FROM buildings b
                    LEFT JOIN buildroom br ON br.buildid = b.id
                    JOIN roomskey rk ON rk.roomid = br.roomid AND rk.keyid = $1`, [keyCodeId]);

                const buildType = key_build_type.rows[0].type;

                if (soldierId !== '' && buildType !== 'Accommodation') {
                    await client.query(
                        "UPDATE key SET soldierid = $1 where id = $2;",
                        [soldierId, keyCodeId]
                    );

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Give key ${keyCodeId} to ${soldierId}`]);

                } else if (soldierId !== '' && buildType === 'Accommodation') {

                    const get_bag_soldier = await client.query(`
                        SELECT l.status, l.id FROM laundrybags l 
                        LEFT JOIN soldier s ON l.id = s.laundry_bag_id
                        WHERE s.id = $1 AND s.date_accommodation IS NOT NULL AND s.date_free IS NULL;`, [soldierId]);

                    if (get_bag_soldier.rows.length > 0 && get_bag_soldier.rows[0].id !== bagId) {

                        const check_laundry_bag_2 = await client.query(`SELECT status FROM laundrybags WHERE id = $1;`, [bagId]);

                        if (get_bag_soldier.rows[0].status !== 'None' || (check_laundry_bag_2.rows.length > 0 && check_laundry_bag_2.rows[0].status !== 'None')) {
                            await client.query('ROLLBACK');
                            return res.status(400).json({ message: "The soldier has an laundry bag an laundry and cannot change bag code." });
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
                        await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                            [req.session.username, `Accommodated soldier with number ${soldierId} and without meal card and bag`]);

                    } else {
                        // Query the database for the user
                        await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                            [req.session.username, `Accommodated soldier with number ${soldierId} with meal card ${mealCardId} and bag ${bagsRes.rows[0].code}`]);
                    }

                } else if (soldierId === '' && buildType === 'Accommodation') {

                    const res_query = await client.query(
                        "SELECT soldierid FROM key WHERE id = $1;",
                        [keyCodeId]
                    );

                    if(res_query.rows.length === 0 || res_query.rows[0].soldierid === null) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: 'This key is not assigned to any soldier.' });
                    }

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
                            await client.query('ROLLBACK');
                            return res.status(400).json({ message: "The soldier has an active laundry bag and cannot be released." });
                        }
                    }

                    if (check_bike.rows.length > 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: "The soldier has an active bike rental and cannot be released." });
                    }

                    if (check_additional_item.rows.length > 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: "The soldier has a non returned additional items!" });
                    }

                    await Promise.all([
                        client.query("UPDATE key SET soldierid = NULL WHERE id = $1;", [keyCodeId]),
                        client.query("UPDATE soldier SET date_free = CURRENT_DATE, upcoming_release = NULL WHERE id = $1;", [res_query.rows[0].soldierid])
                    ]);

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Release soldier with number ${res_query.rows[0].soldierid}`]);

                } else {

                    const res_query = await client.query(
                        "SELECT soldierid FROM key WHERE id = $1;",
                        [keyCodeId]
                    );

                    if(res_query.rows.length === 0 || res_query.rows[0].soldierid === null) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: 'This key is not assigned to any soldier.' });
                    }

                    await client.query(
                        "UPDATE key SET soldierid = NULL WHERE id = $1;",
                        [keyCodeId]
                    );

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Return key ${keyCodeId}`]);
                }

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Data saved successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error change key status:", error);
                res.status(500).json({ message: "Server error" });

            } finally {
                client.release();
            }
        });

        this.app.get('/accommodation/viewReport', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaReport.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { selectedDate1, selectedDate2, page = 1, pageDate = 1, limit = 10, searchColumn, searchValue, searchColumnDate, searchValueDate } = req.query;
            const offset = (page - 1) * limit;
            const offsetDate = (pageDate - 1) * limit;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                let whereClause = `WHERE country <> 'None' AND s.camp_id = $1`;
                let values = [req.session.camp];

                let countValues = [req.session.camp];
                let countWhereClause = `WHERE country <> 'None' AND s.camp_id = $1`;

                let whereClauseDate = `WHERE datemove BETWEEN TO_DATE($1, 'YYYY-MM-DD') AND TO_DATE($2, 'YYYY-MM-DD') AND soldier_name.camp_id = $3`;
                let valuesDate = [selectedDate1, selectedDate2, req.session.camp];

                let countWhereClauseDate = `WHERE datemove BETWEEN TO_DATE($1, 'YYYY-MM-DD') AND TO_DATE($2, 'YYYY-MM-DD') AND soldier_name.camp_id = $3`;
                let countValuesDate = [selectedDate1, selectedDate2, req.session.camp];

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                if (searchColumnDate && searchValueDate) {

                    if (!Array.isArray(searchColumnDate)) searchColumnDate = [searchColumnDate];
                    if (!Array.isArray(searchValueDate)) searchValueDate = [searchValueDate];

                    if (Array.isArray(searchColumnDate[0])) searchColumnDate = searchColumnDate[0];
                    if (Array.isArray(searchValueDate[0])) searchValueDate = searchValueDate[0];

                    whereClauseDate += " AND (";
                    countWhereClauseDate += " AND (";

                    for (let i = 0; i < searchColumnDate.length; i++) {
                        const column = searchColumnDate[i];
                        const value = searchValueDate[i];

                        valuesDate.push(`%${value}%`);
                        countValuesDate.push(`%${value}%`);

                        const paramIndex = valuesDate.length;
                        const countParamIndex = countValuesDate.length;

                        whereClauseDate += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClauseDate += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumnDate.length - 1) {
                            whereClauseDate += " AND ";
                            countWhereClauseDate += " AND ";
                        }
                    }

                    whereClauseDate += ")";
                    countWhereClauseDate += ")";
                }

                // Add pagination
                valuesDate.push(limit);
                valuesDate.push(offsetDate);
                const limitIndexDate = valuesDate.length - 1;
                const offsetIndexDate = valuesDate.length;

                // Query for bike usage details
                const [result_soldior, countResult, result_move, countResultMove] = await Promise.all([
                    client.query(`
                        SELECT 
                            k.namekey,
                            namesoldier, 
                            country, 
                            TO_CHAR(date_accommodation, 'YYYY-MM-DD') AS date_accommodation, 
                            TO_CHAR(date_free, 'YYYY-MM-DD') AS date_free,
                            meal_card,
                            code
                        FROM 
                            soldier s
                        LEFT JOIN laundrybags lb ON lb.id = s.laundry_bag_id
                        LEFT JOIN key k ON k.id = s.used_room
                        ${whereClause}
                        LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),

                    client.query(`
                        SELECT 
                            COUNT(*) AS count
                        FROM 
                            soldier s
                        LEFT JOIN laundrybags lb ON lb.id = s.laundry_bag_id
                        LEFT JOIN key k ON k.id = s.used_room
                        ${countWhereClause};`, countValues),

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
                        ${whereClauseDate}
                        LIMIT $${limitIndexDate} OFFSET $${offsetIndexDate};`, valuesDate),

                    client.query(`
                        SELECT 
                            COUNT(*) AS count
                        FROM 
                            movesoldier ms
                        JOIN 
                            key k_current ON ms.idnewkey = k_current.id
                        JOIN 
                            key k_previous ON ms.idpreviewkey = k_previous.id
                        JOIN 
                            soldier soldier_name ON soldier_name.id = ms.idsoldier
                        ${countWhereClauseDate};`, countValuesDate)
                ]);

                const data = result_soldior.rows;
                const data_move = result_move.rows;

                const totalData = parseInt(countResult.rows[0].count, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                const totalDataDate = parseInt(countResultMove.rows[0].count, 10);
                const totalPagesMove = Math.ceil(totalDataDate / limit) || 1;

                await client.query('COMMIT');
                res.json({ data, data_move, totalPages, totalPagesMove });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to fetch report:', error);
                res.status(500).json({ message: 'An error occurred' });

            } finally {
                client.release();
            }
        });

        this.app.post("/accommodation/report", this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAccommodationReport.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid input data.' });
            }

            const { selectedDate1, selectedDate2, filtersAccommodation, filtersAccommodationDate } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const workbook = new excelJS.Workbook();
                const worksheet1 = workbook.addWorksheet('Information about soldiers');
                const worksheet2 = workbook.addWorksheet('Movement soldiers information');
                const worksheet3 = workbook.addWorksheet('Rooms information');
                const worksheet4 = workbook.addWorksheet('Additional keys');

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

                const headers3 = ['Room Name', 'Room Status'];
                worksheet3.addRow(headers3).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                const headers4 = ['Key Number', 'Soldier Name'];
                worksheet4.addRow(headers4).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                worksheet1.columns = headers1.map(header => ({ header, width: header.length + 20 }));
                worksheet2.columns = headers2.map(header => ({ header, width: header.length + 20 }));
                worksheet3.columns = headers3.map(header => ({ header, width: header.length + 20 }));
                worksheet4.columns = headers4.map(header => ({ header, width: header.length + 20 }));

                let values = [req.session.camp];
                let valuesMove = [selectedDate1, selectedDate2, req.session.camp];

                const whereClause = filtersAccommodation.length > 0
                    ? `WHERE country <> 'None' AND s.camp_id = $1 AND (` + filtersAccommodation.map((filter, index) => {
                        const column = filter.column;
                        values.push(`%${filter.value}%`);
                        return `${column}::TEXT ILIKE $${index + 2}`;
                    }).join(' AND ') + ')'
                    : `WHERE country <> 'None' AND s.camp_id = $1`;

                const whereClauseMove = filtersAccommodationDate.length > 0
                    ? `WHERE datemove BETWEEN TO_DATE($1, 'YYYY-MM-DD') AND TO_DATE($2, 'YYYY-MM-DD') AND soldier_name.camp_id = $3 AND (` + filtersAccommodationDate.map((filter, index) => {
                        const column = filter.column;
                        valuesMove.push(`%${filter.value}%`);
                        return `${column}::TEXT ILIKE $${index + 4}`;
                    }).join(' AND ') + ')'
                    : `WHERE datemove BETWEEN TO_DATE($1, 'YYYY-MM-DD') AND TO_DATE($2, 'YYYY-MM-DD') AND soldier_name.camp_id = $3`;

                const result = await client.query(`
                        SELECT 
                            k.namekey AS room_number,
                            namesoldier AS soldier_name, 
                            country, 
                            TO_CHAR(date_accommodation, 'YYYY-MM-DD') AS date_in, 
                            TO_CHAR(date_free, 'YYYY-MM-DD') AS date_out,
                            meal_card AS meal_card,
                            code AS laundry_bag
                        FROM 
                            soldier s
                        LEFT JOIN laundrybags lb ON lb.id = s.laundry_bag_id
                        LEFT JOIN key k ON k.id = s.used_room
                        ${whereClause};`, values);

                const filteredSoldier = result.rows;

                await Promise.all(filteredSoldier.map(async ({ room_number, soldier_name, country, date_in, date_out, meal_card, laundry_bag }, index) => {
                    const dataRow = worksheet1.addRow([room_number || '', soldier_name || '', country || '', date_in || '', date_out || '', meal_card || '', laundry_bag || '']);

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

                const result_move = await client.query(`
                        SELECT 
                            k_current.namekey AS old_room,
                            k_previous.namekey AS new_room,
                            soldier_name.namesoldier AS soldier_name,
                            TO_CHAR(ms.datemove, 'YYYY-MM-DD') AS date_relock
                        FROM 
                            movesoldier ms
                        JOIN 
                            key k_current ON ms.idnewkey = k_current.id
                        JOIN 
                            key k_previous ON ms.idpreviewkey = k_previous.id
                        JOIN 
                            soldier soldier_name ON soldier_name.id = ms.idsoldier
                        ${whereClauseMove};`, valuesMove);

                const filteredSoldierMove = result_move.rows;

                await Promise.all(filteredSoldierMove.map(async ({ old_room, new_room, soldier_name, date_relock }, index) => {
                    const dataRow = worksheet2.addRow([old_room || '', new_room || '', soldier_name || '', date_relock || '']);

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

                const resultData = await client.query(`
                    SELECT 
                        nameroom,
                        CASE 
                            WHEN COUNT(CASE WHEN a.location_key IS NOT NULL AND k.soldierid IS NULL THEN k.id END) = COUNT(CASE WHEN a.location_key IS NOT NULL THEN k.id END) 
                                THEN 'Completely free'
                            WHEN COUNT(CASE WHEN a.location_key IS NOT NULL AND k.soldierid IS NULL THEN k.id END) != 0 
                                THEN 'Free'
                            ELSE 'Occupied'
                        END AS status
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
                        nameroom NOT SIMILAR TO '%/(E|D)[0-9]*'
                        AND b.type = 'Accommodation'
                        AND b.camp_id = $1
                    GROUP BY 
                        nameroom
                    ORDER BY 
                        nameroom;`, [req.session.camp]);

                const filteredBuildingsInfo = resultData.rows;

                await Promise.all(filteredBuildingsInfo.map(async (data, index) => {
                    const dataRow = worksheet3.addRow(Object.values(data));

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

                const resultAdditionalKey = await client.query(`
                    SELECT k.namekey, s.namesoldier FROM key k
                    LEFT JOIN soldier s ON s.id = k.soldierid
                    LEFT JOIN roomskey rk ON rk.keyid = k.id
                    LEFT JOIN buildroom br ON br.roomid = rk.roomid
                    LEFT JOIN buildings b ON b.id = br.buildid
                    WHERE b.type <> 'Accommodation' AND k.soldierid IS NOT NULL AND b.camp_id = $1
                    ORDER BY k.namekey`, [req.session.camp]);

                const filteredAdditionalKey = resultAdditionalKey.rows;

                await Promise.all(filteredAdditionalKey.map(async (data, index) => {
                    const dataRow = worksheet4.addRow(Object.values(data));

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

                await client.query('COMMIT');

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="report_accommodation.xlsx"');

                await workbook.xlsx.write(res);
                res.end();

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error to generate accommodation report: ", error);
                res.status(500).json({ message: 'Failed to generate the report.' });

            } finally {
                client.release();
            }

        });

        this.app.post("/accommodation/moveSoldier", this.isLoggedIn.bind(this), async (req, res) => {

            const { moves } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Move soldier')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to move soldier!" });
                }

                let firstSingleMove = true;

                for (const move of moves) {

                    const { error } = schemaMoveSoldier.validate(move);

                    if (error) {
                        await client.query('ROLLBACK');
                        console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                        console.error(error.details[0].message);
                        return res.status(400).json({ message: 'Invalid syntax' });
                    }

                    const { keyId, soldId, keyMoveId, soldMoveId } = move;

                    const check_exist_key = await client.query(`SELECT * FROM key WHERE id = $1;`, [keyId]);
                    if (check_exist_key.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: `The key ${keyId} is not exist. It has probably been modified.` });
                    }

                    const check_exist_soldier = await client.query(`SELECT * FROM soldier WHERE id = $1;`, [soldId]);
                    if (check_exist_soldier.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: `The soldier ${soldId} is not exist. It has probably been modified.` });
                    }

                    const check_exist_move_key = await client.query(`SELECT * FROM key WHERE id = $1;`, [keyMoveId]);
                    if (check_exist_move_key.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: `The key ${keyMoveId} is not exist. It has probably been modified.` });
                    }

                    const check_exist_move_soldier = await client.query(`SELECT * FROM soldier WHERE id = $1;`, [soldMoveId]);
                    if (soldMoveId !== '' && check_exist_move_soldier.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: `This soldier ${soldMoveId} is not exist. It has probably been modified.` });
                    }

                    if (soldMoveId) {
                        await client.query("INSERT INTO movesoldier VALUES ($1, $2, $3, CURRENT_DATE);", [keyMoveId, keyId, soldId]);
                        await client.query("INSERT INTO movesoldier VALUES ($1, $2, $3, CURRENT_DATE);", [keyId, keyMoveId, soldMoveId]);
                        await client.query("UPDATE key SET soldierid = $1 WHERE id = $2;", [soldId, keyMoveId]);
                        await client.query("UPDATE key SET soldierid = $1 WHERE id = $2;", [soldMoveId, keyId]);
                        await client.query(`UPDATE soldier SET used_room = $1 WHERE id = $2;`, [keyMoveId, soldId]);
                        await client.query(`UPDATE soldier SET used_room = $1 WHERE id = $2;`, [keyId, soldMoveId]);
                        await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                            [req.session.username, `Swap soldier ${soldId} and ${soldMoveId}`]);

                    } else {
                        await client.query("INSERT INTO movesoldier VALUES ($1, $2, $3, CURRENT_DATE);", [keyMoveId, keyId, soldId]);
                        await client.query("UPDATE key SET soldierid = $1 WHERE id = $2;", [soldId, keyMoveId]);

                        if (firstSingleMove) {
                            await client.query("UPDATE key SET soldierid = NULL WHERE id = $1;", [keyId]);
                            firstSingleMove = false;
                        }

                        await client.query(`UPDATE soldier SET used_room = $1 WHERE id = $2;`, [keyMoveId, soldId]);
                        await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                            [req.session.username, `Move soldier ${soldId} from room ${keyId} to room ${keyMoveId}`]);
                    }
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'The soldier has been successfully moved' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to move soldier:', error);
                res.status(500).json({ message: 'An error occurred' });

            } finally {
                client.release();
            }

        });

        this.app.post('/accommodation/addSoldier', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddSoldier.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: "Invalid syntax. The value must contain only the letter and number character" });
            }

            if (!req.session.camp) {
                return res.status(400).json({ message: "You not select camp. First select camp then add lost item?!" });
            }

            const { soldierId, soldierName, soldierCountry, upcomingKey, soldierBag, soldierMealCard, upcomingAccommodationDate, upcomingReleaseDate } = req.body;
            const client = await pool.connect();

            if (upcomingAccommodationDate && upcomingReleaseDate && new Date(upcomingAccommodationDate) > new Date(upcomingReleaseDate))
                return res.status(400).json({ message: "The date of accommodation cannot be greater than the date of release" });

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'List of soldier')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add soldier!" });
                }

                // Inside the backend function, when checking for duplicates
                const result = await client.query("SELECT * FROM soldier WHERE id = $1;", [soldierId]);
                const checkSoldierName = await client.query('SELECT * FROM soldier WHERE namesoldier = $1 AND camp_id = $2', [soldierName, req.session.camp]);
                const checkKeyExist = await client.query(`SELECT * FROM key WHERE id = $1`, [upcomingKey]);
                const checkBagExist = await client.query(`SELECT * FROM laundrybags WHERE id = $1`, [soldierBag]);

                if (checkKeyExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The selected key is not exist. It has probably been modified.` });
                }

                if (soldierBag !== '' && checkBagExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The selected bag is not exist. It has probably been modified.` });
                }

                if (result.rows.length > 0) {
                    // Duplicate soldierId found
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Soldier with id '${soldierId}' already exists.` });
                }

                if (checkSoldierName.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The soldier name is already exist.` });
                }

                if (soldierName.endsWith(' ')) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Soldier name '${soldierName}' should not end with a space.` });
                }

                await Promise.all([
                    client.query("INSERT INTO soldier VALUES ($1, $2, $3, NULL, NULL, $4, $5, NULL, $6, $7, $8, $9);", [soldierId, soldierName, soldierCountry, soldierMealCard || null, soldierBag || null, req.session.camp, upcomingAccommodationDate || null, upcomingReleaseDate || null, upcomingKey || null]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)", [req.session.username, `Add soldier ${soldierName}`])
                ]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Data saved successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to add soldier:', error);
                res.status(500).json({ message: 'An error occurred' });

            } finally {
                client.release();
            }
        });

        this.app.delete('/accommodation/removeSoldier', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveSoldier.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: "Invalid syntax. The value must contain only the letter and number character" });
            }

            const { code } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'List of soldier')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to remove soldier!" });
                }

                const checkSoldierExist = await client.query(`SELECT * FROM soldier WHERE id = $1`, [code]);

                if (checkSoldierExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The soldier is not exist. It has probably been modified.` });
                }

                const check_soldier_accommodatation = await client.query(`SELECT id FROM soldier WHERE date_accommodation IS NOT NULL AND date_free IS NULL AND id = $1`, [code]);

                if (check_soldier_accommodatation.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "The soldier is deployed to reduce him from the system first release him" });
                }

                await Promise.all([
                    client.query("DELETE FROM movesoldier WHERE idsoldier = $1;", [code]),
                    client.query("UPDATE laundrybags SET soldier_id = NULL WHERE soldier_id = $1", [code]),
                    client.query("UPDATE key SET soldierid = NULL WHERE soldierid = $1;", [code]),
                    client.query("DELETE FROM laundryreport WHERE soldier_id = $1", [code]),
                    client.query("DELETE FROM fitness WHERE soldierid = $1", [code]),
                    client.query("DELETE FROM bikesoldier WHERE soldierid = $1", [code]),
                    client.query("DELETE FROM soldier WHERE id = $1;", [code])
                ]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Remove soldier ${code}`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Soldier removed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to remove solider:', error);
                res.status(500).json({ message: 'An error occurred' });

            } finally {
                client.release();
            }
        });

        this.app.put('/accommodation/editSoldier', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditSoldier.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: "Invalid syntax. The value must contain only the letter and number character" });
            }

            const { soldierId, soldierNewId, soldierName, soldierCountry, soldierUpcomingKey, soldierBag, soldierMealCard, soldierUpcomeAccom, soldierUpcomeRel } = req.body;
            const client = await pool.connect();

            if (soldierUpcomeAccom && soldierUpcomeRel && new Date(soldierUpcomeAccom) > new Date(soldierUpcomeRel))
                return res.status(400).json({ message: "The date of accommodation cannot be greater than the date of release" });

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'List of soldier')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to edit soldier!" });
                }

                const result = await client.query("SELECT * FROM soldier WHERE id = $1;", [soldierNewId]);
                const resultSoldierName = await client.query("SELECT * FROM soldier WHERE namesoldier = $1 AND camp_id = $2;", [soldierName, req.session.camp]);
                const resultOldSoldier = await client.query("SELECT * FROM soldier WHERE id = $1;", [soldierId]);
                const checkKeyExist = await client.query(`SELECT * FROM key WHERE id = $1`, [soldierUpcomingKey]);
                const checkBagExist = await client.query(`SELECT * FROM laundrybags WHERE id = $1`, [soldierBag]);

                if (resultOldSoldier.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The current soldier is not exist. It has probably been modified.` });
                }

                if (soldierUpcomingKey && checkKeyExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The selected key is not exist. It has probably been modified.` });
                }

                if (soldierBag && checkBagExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The selected bag is not exist. It has probably been modified.` });
                }

                if (soldierId !== soldierNewId && result.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Soldier with id: '${soldierNewId}' already exists.` });
                }

                if (soldierName !== resultOldSoldier.rows[0].namesoldier && resultSoldierName.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Soldier with this name already exists.` });
                }

                if (soldierName.endsWith(' ')) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Soldier name '${soldierName}' should not end with a space.` });
                }

                if (soldierId === soldierNewId) {
                    await client.query("UPDATE soldier SET namesoldier = $1, country = $2, upcoming_accommodation_key = $8, meal_card = $6, laundry_bag_id = $7, upcoming_accommodation = $4, upcoming_release = $5 WHERE id = $3;", [soldierName, soldierCountry, soldierId, soldierUpcomeAccom || null, soldierUpcomeRel || null, soldierMealCard || null, soldierBag || null, soldierUpcomingKey || null]);
                } else {
                    const result = await client.query("SELECT * FROM soldier WHERE id = $1;", [soldierId]);
                    const respons = result.rows[0];

                    await client.query("INSERT INTO soldier VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);",
                        [soldierNewId, soldierName, soldierCountry, respons.date_accommodation || null, respons.date_free || null, soldierMealCard || null, soldierBag || null, respons.used_room || null, respons.camp_id, soldierUpcomeAccom || null, soldierUpcomeRel || null, soldierUpcomingKey || null]);

                    await Promise.all([
                        client.query("UPDATE movesoldier SET idsoldier = $1 WHERE idsoldier = $2;", [soldierNewId, soldierId]),
                        client.query("UPDATE key SET soldierid = $1 WHERE soldierid = $2;", [soldierNewId, soldierId]),
                        client.query("UPDATE fitness SET soldierid = $1 WHERE soldierid = $2;", [soldierNewId, soldierId]),
                        client.query("UPDATE bikesoldier SET soldierid = $1 WHERE soldierid = $2;", [soldierNewId, soldierId]),
                        client.query("UPDATE laundrybags SET soldier_id = $1 WHERE soldier_id = $2;", [soldierNewId, soldierId]),
                        client.query("UPDATE laundryreport SET soldier_id = $1 WHERE soldier_id = $2;", [soldierNewId, soldierId]),
                        client.query("UPDATE additionalItem SET soldier_id = $1 WHERE soldier_id = $2;", [soldierNewId, soldierId]),
                        client.query("DELETE FROM soldier WHERE id = $1;", [soldierId])
                    ]);
                }

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Edit soldier ${soldierId}`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Data saved successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to edit soldier data:', error);
                res.status(500).json({ message: 'An error occurred' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/uploadSoldier', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {
            const client = await pool.connect();
            const errors = [];
            const bagSet = [];
            const keySet = [];

            if (!req.session.camp) {
                return res.status(400).json({ message: "You not select camp. First select camp then add lost item?!" });
            }

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'List of soldier')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add multiple soldier!" });
                }

                if (!req.file) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'No file uploaded.' });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                // Set to track unique soldierIds in the file
                const seenIds = new Set();
                const seenNames = new Set();

                if (sheetName !== 'Add Multipul Soldiers') {
                    await client.query('ROLLBACK');
                    errors.push({ type: 'InvalidDate', message: `Invalid template` });
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

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

                    if (seenNames.has(row.soldierName)) {
                        errors.push({ type: 'DuplicateInFile', row, index, message: `Duplicate soldierName '${row.soldierName}' in the file.` });
                        return;
                    }

                    seenIds.add(row.soldierId);
                    seenNames.add(row.soldierName);

                    // Check for duplicates in the database
                    const result = await client.query("SELECT * FROM soldier WHERE id = $1;", [row.soldierId]);
                    const resultName = await client.query("SELECT * FROM soldier WHERE namesoldier = $1 AND camp_id = $2;", [row.soldierName, req.session.camp]);

                    if (result.rows.length > 0) {
                        errors.push({ type: 'DuplicateInDB', soldierId: row.soldierId, message: `Soldier with number '${row.soldierId}' already exists.` });
                        return;
                    }

                    if (resultName.rows.length > 0) {
                        errors.push({ type: 'DuplicateInDB', soldierId: row.soldierId, message: `Soldier with name '${row.soldierName}' already exists.` });
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

                    if (!row.soldierBag && !row.upcomingKey) {
                        return;
                    }

                    if (row.soldierBag) {

                        const [result_check_bag, result_check_bag_soldier] = await Promise.all([
                            client.query("SELECT * FROM laundrybags WHERE code = $1 AND camp_id = $2;", [row.soldierBag, req.session.camp]),
                            client.query(`
                                SELECT * FROM soldier s 
                                LEFT JOIN additionalitem ai ON s.id = ai.soldier_id
                                LEFT JOIN laundrybags l ON s.laundry_bag_id = l.id OR l.id = ai.bag_id
                                WHERE l.code = $1 AND (
                                    s.id IS NOT NULL 
                                    AND (s.date_accommodation IS NULL OR (s.date_accommodation IS NOT NULL AND date_free IS NULL))) AND l.camp_id = $2;`, [row.soldierBag, req.session.camp])
                        ]);

                        if (result_check_bag.rows.length === 0) {
                            errors.push({ type: 'CheckBag', message: `The bag with number '${row.soldierBag}' is not exists.` });
                            return;

                        } else if (result_check_bag_soldier.rows.length > 0 && result_check_bag_soldier.rows[0].id !== row.soldierId) {
                            errors.push({ type: 'CheckBag', message: `The bag with number '${row.soldierBag}' has already been taken by someone.` });
                            return;
                        } else {
                            bagSet.push({ id: result_check_bag.rows[0].id, code: result_check_bag.rows[0].code });
                        }
                    }

                    if (row.upcomingKey) {
                        const result_check_key = await client.query(`
                            SELECT key.* FROM key 
                            LEFT JOIN roomskey rk ON key.id = rk.keyid
                            LEFT JOIN buildroom br ON br.roomid = rk.roomid
                            LEFT JOIN buildings b ON br.buildid = b.id
                            WHERE namekey = $1 AND b.camp_id = $2;`, [row.upcomingKey, req.session.camp]);

                        if (result_check_key.rows.length === 0) {
                            errors.push({ type: 'CheckKey', message: `The key with name '${row.upcomingKey}' is not exists.` });
                            return;
                        }

                        keySet.push({ id: result_check_key.rows[0].id, name: result_check_key.rows[0].namekey });
                    }
                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');

                    const styleError = errors.find(error => error.type === 'Validation');

                    if (styleError) {
                        console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                        console.error(styleError.details);
                    }

                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row) => {

                    const mealCardValue = row.soldierMealCard ? row.soldierMealCard : null;
                    const laundryBagValue = row.soldierBag
                        ? bagSet.find(code => code.code === row.soldierBag)?.id
                        : null;

                    const keyValue = row.upcomingKey
                        ? keySet.find(key => key.name === row.upcomingKey)?.id
                        : null;

                    await client.query("INSERT INTO soldier VALUES ($1, $2, $3, NULL, NULL, $4, $5, NULL, $6, $7, $8, $9);", [row.soldierId, row.soldierName, row.soldierCountry, mealCardValue, laundryBagValue, req.session.camp, row.upcomingAccommodationDate || null, row.upcomingReleaseDate || null, keyValue]);
                }));

                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Add multi soldier`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });
            } finally {
                client.release();
            }
        });

        this.app.get('/accommodation/uploadSoldier/download', this.isLoggedIn.bind(this), async (req, res) => {

            // Create a new Excel workbook
            const workbook = new excelJS.Workbook();

            // Sheet 1: Soldier Data
            const worksheet = workbook.addWorksheet('Add Multipul Soldiers');

            // Add custom column titles for the first sheet
            const headers = ['soldierId', 'soldierName', 'soldierCountry', 'upcomingKey', 'soldierBag', 'soldierMealCard', 'upcomingAccommodationDate', 'upcomingReleaseDate'];
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
                { width: 20 },
                { width: 20 },
                { width: 20 },
                { width: 30 },
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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/uploadMultiSoldier', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {

            const client = await pool.connect();
            const errors = [];
            const bagSet = [];

            if (!req.session.camp) {
                return res.status(400).json({ message: "You not select camp. First select camp then add lost item?!" });
            }

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Accommodation soldiers')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to accommodation multiple soldiers!" });
                }

                if (!req.file) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'No file uploaded.' });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                // Create a Set to track unique soldier IDs within the data array
                const uniqueSoldierIds = new Set();
                const uniqueKeyIds = new Set();
                const uniqueKeyNames = new Set();

                if (sheetName !== 'Accommodation Multipul Soldiers') {
                    await client.query('ROLLBACK');
                    errors.push({ type: 'CheckExist', message: `Invalid template` });
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

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

                    if (uniqueKeyIds.has(row.keynumber)) {
                        errors.push({ type: 'UniqueIdCheck', message: `Duplicate keyNumber '${row.keynumber}' found within the data.` });
                        return;
                    }

                    if (uniqueKeyNames.has(row.namekey)) {
                        errors.push({ type: 'UniqueIdCheck', message: `Duplicate nameKey '${row.namekey}' found within the data.` });
                        return;
                    }

                    // Add soldier ID to the Set after checking
                    uniqueSoldierIds.add(row.soldierid);
                    uniqueKeyIds.add(row.keynumber);
                    uniqueKeyNames.add(row.namekey);

                    // Inside the backend function, when checking for duplicates
                    const [result, result_exist] = await Promise.all([
                        client.query("SELECT * FROM soldier WHERE id = $1 AND date_accommodation IS NOT NULL AND date_free IS NULL;", [row.soldierid]),
                        client.query("SELECT * FROM soldier WHERE id = $1;", [row.soldierid])
                    ]);

                    if (result_exist.rows.length === 0) {
                        errors.push({ type: 'CheckExist', message: `Soldier with number '${row.soldierid}' is not exists.` });
                        return;
                    }

                    if (result.rows.length > 0) {
                        // Duplicate soldierId found
                        errors.push({ type: 'CheckId', message: `Soldier with number '${row.soldierid}' is already accommodation.` });
                        return;
                    }

                    const result_check_key = await client.query(`
                            SELECT key.* FROM key 
                            LEFT JOIN roomskey rk ON key.id = rk.keyid
                            LEFT JOIN buildroom br ON br.roomid = rk.roomid
                            LEFT JOIN buildings b ON br.buildid = b.id
                            WHERE key.id = $1 AND key.namekey = $2 AND b.camp_id = $3;`, [row.keynumber, row.namekey, req.session.camp]);

                    if (result_check_key.rows.length === 0) {
                        errors.push({ type: 'CheckKey', message: `The key with number '${row.keynumber}' is not exists.` });
                        return;
                    }

                    if (!row.laundrybag) {
                        return;
                    }

                    if (row.laundrybag) {

                        const [result_check_bag, result_check_bag_soldier] = await Promise.all([
                            client.query("SELECT * FROM laundrybags WHERE code = $1 AND camp_id = $2;", [row.laundrybag, req.session.camp]),
                            client.query(`
                            SELECT * FROM soldier s 
                            LEFT JOIN additionalitem ai ON s.id = ai.soldier_id
                            LEFT JOIN laundrybags l ON s.laundry_bag_id = l.id OR l.id = ai.bag_id
                            WHERE l.code = $1 
                            AND l.camp_id = $2
                            AND s.id IS NOT NULL 
                            AND (s.date_accommodation IS NULL OR (s.date_accommodation IS NOT NULL AND s.date_free IS NULL))
                            AND s.id != $3;
                        `, [row.laundrybag, req.session.camp, row.soldierid])
                        ]);

                        if (result_check_bag.rows.length === 0) {
                            errors.push({ type: 'CheckBag', message: `The bag with number '${row.laundrybag}' is not exists.` });
                            return;

                        } else if (result_check_bag_soldier.rows.length > 0 && result_check_bag_soldier.rows[0].id !== row.soldierid) {
                            errors.push({ type: 'CheckBag', message: `The bag with number '${row.laundrybag}' has already been taken by someone.` });
                            return;
                        } else {
                            bagSet.push({ id: result_check_bag.rows[0].id, code: result_check_bag.rows[0].code });
                        }
                    }

                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');

                    const styleError = errors.find(error => error.type === 'Validation');

                    if (styleError) {
                        console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                        console.error(styleError.details);
                    }

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
                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Accommodated multi soldier`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/deleteSoldier', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = schemaReleaseAllRoom.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: "Invalid syntax. Only alphanumeric characters are allowed." });
            }

            const { buildId } = req.body;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Release building')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to release building!" });
                }

                const checkExistBuild = await client.query(`SELECT * FROM buildings WHERE id = $1;`, [buildId]);
                if (checkExistBuild.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This building is not exist. It has probably been modified." });
                }

                const res_query = await client.query(`
                    SELECT k.id AS key_id, s.id AS soldier_id, s.namesoldier AS soldier_name, lb.id AS laundry_bag_id, lb.status AS laundry_status,
                        EXISTS (
                            SELECT 1
                            FROM bikesoldier bs
                            WHERE bs.soldierid = s.id AND bs.datefrom IS NOT NULL AND bs.dateto IS NULL
                        ) AS has_active_bike,
                        EXISTS (
                            SELECT 1
                            FROM additionalitem ai
                            WHERE ai.soldier_id = s.id
                        ) AS has_additional_items
                    FROM key k
                    JOIN soldier s ON s.id = k.soldierid
					LEFT JOIN additionalitem ai ON s.id = ai.soldier_id
                    LEFT JOIN laundrybags lb ON lb.id = s.laundry_bag_id OR ai.bag_id = lb.id
                    LEFT JOIN roomskey rk ON rk.keyid = k.id
                    LEFT JOIN buildroom br ON br.roomid = rk.roomid
                    WHERE s.id IS NOT NULL AND s.country <> 'None' AND br.buildid = $1;`, [buildId]);

                if (res_query.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This building is empty." });
                }

                for (const row of res_query.rows) {
                    if (row.laundry_status !== 'None') {
                        await client.query('ROLLBACK');
                        return res.status(400).json({
                            message: `Soldier ${row.soldier_name} has an active laundry bag and cannot be released.`
                        });
                    }
                    if (row.has_active_bike) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({
                            message: `Soldier ${row.soldier_name} has an active bike rental and cannot be released.`
                        });
                    }

                    if (row.has_additional_items) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({
                            message: `Soldier ${row.soldier_name} has a non returned additional items!`
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
                    INSERT INTO usermonitoring (username, location) VALUES ($1, $2);`,
                    [req.session.username, `Release all soldier in building ${buildId}`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: "All rooms are vacated." });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to delete soldier:', error, error.stack);
                return res.status(500).json({ message: "An error occurred while processing the data." });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/addDestination', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddDestination.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { buildName, buildType } = req.body;

            const client = await pool.connect();

            if (!req.session.camp) {
                return res.status(400).json({ message: "You not select camp. First select camp then add lost item?!" });
            }

            try {

                await client.query('BEGIN');

                const checkPermission = client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add destination')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add destination!" });
                }

                const result_build = await client.query(
                    `SELECT * FROM buildings WHERE namebuilding = $1 AND camp_id = $2;`, [buildName, req.session.camp]
                );

                if (result_build.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This destination already exists!' });
                }

                const randomBuildId = crypto.randomBytes(16).toString('hex');

                await Promise.all([
                    client.query(
                        `INSERT INTO buildings VALUES ($1, $2, $3, $4);`, [randomBuildId, buildName, buildType, req.session.camp]
                    ),
                    client.query(
                        "INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Add destination ${buildName}`]
                    )
                ]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Add destination is successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error add destination:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.delete('/accommodation/removeDestination', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveDestination.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { buildId } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Remove destination')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to remove destination!" });
                }

                const checkExistBuild = await client.query(`SELECT * FROM buildings WHERE id = $1;`, [buildId]);
                if (checkExistBuild.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This building is not exist. It has probably been modified." });
                }

                await Promise.all([
                    client.query("DELETE FROM buildings WHERE id = $1;", [buildId]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Remove destination ${buildId}`])
                ]);

                await client.query('COMMIT');
                return res.status(200).json();

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error to remove destination:", error);
                res.status(500).json({ message: 'Failed to delete destination. Please remove all rooms and try again.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/addRoomToDestination', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRoomToDestination.validate(req.body);

            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            if (!req.session.camp) {
                return res.status(400).json({ message: "You not select camp. First select camp then add lost item?!" });
            }

            const { roomName, clickBuild } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add room')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add room to destination!" });
                }

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

                const checkBuildId = await client.query('SELECT * FROM buildings WHERE id = $1;', [buildingName]);

                if (checkBuildId.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This build is not exist. It has probably been modified.' });
                }

                if (result_build.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This room already exists!' });
                }

                const randomRoomId = crypto.randomBytes(16).toString('hex');

                await Promise.all([
                    client.query("INSERT INTO rooms VALUES ($1, $2)", [randomRoomId, roomName]),
                    client.query("INSERT INTO buildroom VALUES ($1, $2)", [buildingName, randomRoomId]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Add room ${roomName} to ${roomName.split('/')[0]}`])
                ]);

                await client.query('COMMIT');
                return res.status(200).json({ message: `The room ${roomName} was added into building ${roomName.split('/')[0]}.` });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error add room to destination:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/specialRooms', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaSpecialRoom.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { numBuild } = req.query;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                let result;

                if (numBuild) {

                    const checkBuildId = await client.query('SELECT * FROM buildings WHERE id = $1;', [numBuild]);

                    if (checkBuildId.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: 'This build is not exist. It has probably been modified.' });
                    }

                    result = await client.query(`
                    SELECT r.* 
                    FROM rooms r
                    LEFT JOIN buildroom br ON br.roomid = r.id
                    WHERE br.buildid = $1
                    AND nameroom NOT SIMILAR TO '%/(E|D)[0-9]*';`, [numBuild]);
                } else {
                    result = await client.query(`
                        SELECT r.* 
                        FROM rooms r
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        LEFT JOIN buildings b ON br.buildid = b.id
                        WHERE nameroom SIMILAR TO '%/(E|D)[0-9]*' AND b.camp_id = $1;`, [req.session.camp]);
                }

                const result_room_data = result.rows;
                let total_res = [];

                result_room_data.forEach(row => {
                    total_res.push({ id: row.id, name: row.nameroom });
                });

                await client.query('COMMIT');
                return res.status(200).json(total_res);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get special room:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/specialKeys', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaSpecialKey.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { numRoom } = req.query;

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
                return res.status(200).json(total_res);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get special keys:', error);
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
                    WITH key_info AS (
                        SELECT 
                            k.id,
                            k.namekey,
                            s.namesoldier,
                            s.country,
                            s.meal_card,
                            l.code AS laundry_code,
                            r.nameroom,
                            r.id AS roomid,
                            b.type AS building_type,
                            a.id AS asset_id
                        FROM key k
                        LEFT JOIN soldier s ON s.id = k.soldierid
                        LEFT JOIN laundrybags l ON l.id = s.laundry_bag_id
                        LEFT JOIN roomskey rk ON rk.keyid = k.id
                        LEFT JOIN rooms r ON rk.roomid = r.id
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        LEFT JOIN buildings b ON br.buildid = b.id
                        LEFT JOIN assets a ON a.location_key = k.id
                        WHERE b.camp_id = $1
                    )

                    SELECT 
                        id,
                        namekey,
                        namesoldier,
                        country,
                        meal_card,
                        laundry_code,
                        nameroom,
                        roomid,
                        asset_id,
                        building_type
                    FROM key_info;`, [req.session.camp]);

                const result_key_data = result.rows;
                let total_res = [];

                await Promise.all(result_key_data.map(async (row) => {
                    total_res.push({
                        id: row.id,
                        name: row.namekey,
                        soldierName: row.namesoldier ? row.namesoldier : 'Free',
                        country: row.country ? row.country : 'Undefined',
                        maleCard: row.meal_card ? row.meal_card : 'Undefined',
                        laundryBag: row.laundry_code ? row.laundry_code : 'Undefined',
                        roomid: row.roomid,
                        nameroom: row.nameroom,
                        building_type: row.building_type,
                        isLock: !row.asset_id && row.building_type === 'Accommodation' &&
                            !/^(\d+\/\d+\/E\d*\/\d+|\d+\/D\d*\/\d+)$/.test(row.namekey)
                    });
                }));

                await client.query('COMMIT');
                return res.status(200).json(total_res);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get keys:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.delete('/accommodation/removeRoomToDestination', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveRoom.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { roomId } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Remove room')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to remove room from destination!" });
                }

                const checkExistRoom = await client.query('SELECT * FROM rooms WHERE id = $1;', [roomId]);
                if (checkExistRoom.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This room is not exist. It has probably been modified." });
                }

                const check_asset_room = await client.query('SELECT * FROM assets WHERE location_room = $1;', [roomId]);
                if (check_asset_room.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This room is associated with an asset and cannot be removed." });
                }

                await Promise.all([
                    client.query(`UPDATE assets SET location_room = NULL WHERE location_room = $1;`, [roomId]),
                    client.query(`DELETE FROM buildroom WHERE roomid = $1;`, [roomId]),
                    client.query(`DELETE FROM rooms WHERE id = $1;`, [roomId]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Remove room ${roomId}`])
                ]);

                await client.query('COMMIT');
                return res.status(200).json({ message: `The room was removed successfully.` });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error to delete room:", error);
                res.status(500).json({ message: 'Failed to delete room. Please remove all keys and assets in this room and try again.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/addKeyToRoom', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaKeyToRoom.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { keyId, keyName, selectedRoomForKey } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add key')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add key!" });
                }

                const [result_key, result_key_name, checkExistRoom] = await Promise.all([
                    client.query(`SELECT * FROM key WHERE id = $1;`, [keyId]),
                    client.query(`
                        SELECT k.* FROM key k
                        LEFT JOIN roomskey rk ON rk.keyid = k.id
                        LEFT JOIN buildroom br ON br.roomid = rk.roomid
                        LEFT JOIN buildings b ON br.buildid = b.id
                        WHERE namekey = $1 AND b.camp_id = $2;`, [keyName, req.session.camp]),
                    client.query(`SELECT * FROM rooms WHERE nameroom = $1;`, [selectedRoomForKey])
                ]);

                const get_room_id = await client.query(`
                    SELECT r.id FROM rooms r
                    LEFT JOIN buildroom br ON br.roomid = r.id
                    LEFT JOIN buildings b ON br.buildid = b.id
                    WHERE r.nameroom = $1 AND b.camp_id = $2`, [selectedRoomForKey, req.session.camp]);

                if (result_key.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This key number already exists!' });
                }

                if (result_key_name.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This key name already exists!' });
                }

                if (checkExistRoom.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This room not exist. It has probably been modified.' });
                }

                await Promise.all([
                    client.query("INSERT INTO key VALUES ($1, $2)", [keyId, keyName]),
                    client.query("INSERT INTO roomskey VALUES ($1, $2)", [get_room_id.rows[0].id, keyId]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Add key ${keyName} to room ${selectedRoomForKey}`])
                ]);

                await client.query('COMMIT');
                return res.status(200).json({ message: `The key ${keyName} was added into this building.` });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error add key to room:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.delete('/accommodation/deleteKeys', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveSoldier.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: "Invalid syntax. The value must contain only the letter and number character" });
            }

            const { code } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Remove keys')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to remove key!" });
                }

                const check_exist_keys = await client.query(`SELECT * FROM key WHERE id = $1;`, [code]);
                const check_keys = await client.query(`SELECT id FROM key WHERE id = $1 AND soldierId IS NOT NULL;`, [code]);
                const check_asset = await client.query(`SELECT * FROM assets WHERE location_key = $1;`, [code]);

                if (check_exist_keys.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "The key is not exist. It has probably been modified." });
                }

                if (check_keys.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "A soldier is attached to one of the keys." });
                }

                if (check_asset.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "A assets is attached to one of the keys." });
                }

                await Promise.all([
                    client.query('UPDATE soldier SET upcoming_accommodation_key = NULL WHERE upcoming_accommodation_key = $1;', [code]),
                    client.query('UPDATE assets SET location_key = NULL WHERE location_key = $1;', [code]),
                    client.query('DELETE FROM roomskey WHERE keyId = $1;', [code]),
                    client.query('DELETE FROM movesoldier WHERE idnewkey = $1 OR idpreviewkey = $1;', [code]),
                    client.query('DELETE FROM key WHERE id = $1;', [code])
                ]);

                // Query the database for the user
                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Remove key ${code}`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Key removed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to delete keys:', error);
                res.status(500).json({ message: 'An error occurred' });

            } finally {
                client.release();
            }
        });

        this.app.get('/accommodation/uploadKeys/download', this.isLoggedIn.bind(this), async (req, res) => {

            // Create a new Excel workbook
            const workbook = new excelJS.Workbook();

            // Sheet 1: Soldier Data
            const worksheet = workbook.addWorksheet('Add Multipul Keys');

            // Add custom column titles for the first sheet
            const headers = ['keyId', 'keyName'];
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
            res.setHeader('Content-Disposition', 'attachment; filename=templateAddKeys.xlsx');

            // Write the workbook to the response stream
            await workbook.xlsx.write(res);
            res.end(); // End the response

        });

        this.app.post('/accommodation/uploadKeys', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {
            const client = await pool.connect();
            const errors = [];

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add key')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add multiple key!" });
                }

                if (!req.file) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'No file uploaded.' });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                // Set to track unique soldierIds in the file
                const seenIds = new Set();
                const seenNames = new Set();

                if (sheetName !== 'Add Multipul Keys') {
                    await client.query('ROLLBACK');
                    errors.push({ type: 'InvalidFormat', message: `Invalid template` });
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row, index) => {
                    const { error } = schemaKeyToRoom.validate(row);

                    if (error) {
                        errors.push({ type: 'Validation', details: error.details, row, index });
                        return;
                    }

                    // Check for duplicates within the file
                    if (seenIds.has(row.keyId)) {
                        errors.push({ type: 'DuplicateInFile', row, index, message: `Duplicate key number '${row.keyId}' in the file.` });
                        return;
                    }

                    if (seenNames.has(row.keyName)) {
                        errors.push({ type: 'DuplicateInFile', row, index, message: `Duplicate key name '${row.keyName}' in the file.` });
                        return;
                    }

                    seenIds.add(row.keyId);
                    seenNames.add(row.keyName);

                    const result_check_room = await client.query(`
                        SELECT * FROM rooms 
                        LEFT JOIN buildroom br ON br.roomid = rooms.id
                        LEFT JOIN buildings b ON b.id = br.buildid
                        WHERE nameroom = $1 AND b.camp_id = $2;`, [row.keyName.split('/').slice(0, -1).join('/'), req.session.camp]);

                    if (result_check_room.rows.length === 0) {
                        errors.push({ type: 'DuplicateInDB', message: `${row.keyName.split('/').slice(0, -1).join('/')} not exists.` });
                        return;
                    }

                    // Check for duplicates in the database
                    const result = await client.query(`SELECT * FROM key WHERE id = $1;`, [row.keyId]);
                    const resultName = await client.query(`
                        SELECT * FROM key 
                        LEFT JOIN roomskey rk ON rk.keyid = key.id
                        LEFT JOIN buildroom br ON br.roomid = rk.roomid
                        LEFT JOIN buildings b ON b.id = br.buildid
                        WHERE namekey = $1 AND b.camp_id = $2;`, [row.keyName, req.session.camp]);

                    if (resultName.rows.length > 0 || result.rows.length > 0) {
                        errors.push({ type: 'DuplicateInDB', message: `Key '${row.keyName}' already exists.` });
                        return;
                    }

                    if (row.keyName.endsWith(' ')) {
                        errors.push({ type: 'InvalidFormat', message: `Key name '${row.keyName}' should not end with a space.` });
                        return;
                    }
                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');

                    const styleError = errors.find(error => error.type === 'Validation');

                    if (styleError) {
                        console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                        console.error(styleError.details);
                    }

                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row) => {

                    const get_key_id = await client.query(`
                        SELECT rooms.id FROM rooms
                        LEFT JOIN buildroom br ON br.roomid = rooms.id
                        LEFT JOIN buildings b ON b.id = br.buildid
                        WHERE nameroom = $1 AND b.camp_id = $2`,
                        [row.keyName.split('/').slice(0, -1).join('/'), req.session.camp]);

                    client.query("INSERT INTO key VALUES ($1, $2)", [row.keyId, row.keyName]);
                    client.query("INSERT INTO roomskey VALUES ($1, $2)", [get_key_id.rows[0].id, row.keyId]);
                }));

                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Add multi keys`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });
            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/replaceKeyToRoom', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = schemaRenameKey.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { oldKeyId, newKeyId } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Reload keys')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to replace key!" });
                }

                const check_new_key = await client.query(`SELECT * FROM key WHERE id = $1`, [newKeyId]);
                const check_old_key = await client.query(`SELECT * FROM key WHERE id = $1`, [oldKeyId]);

                if (check_old_key.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'The old key is not exist. It has probably been modified.' });
                }

                if (check_new_key.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This key already exists' });
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
                            location_key = CASE WHEN location_key = $2 THEN $1 ELSE location_key END;`, [newKeyId, oldKeyId]),

                    client.query(`
                        UPDATE soldier SET upcoming_accommodation_key = $1 WHERE upcoming_accommodation_key = $2;`, [newKeyId, oldKeyId])
                ]);

                await client.query(`DELETE FROM key WHERE id = $1;`, [oldKeyId]);

                // Log user action
                await client.query(`
                    INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`, [req.session.username, `Replace key ${oldKeyId} with ${newKeyId}`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: `The key was replaced successfully.` });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error during key replacement:', err.message);
                return res.status(500).json({ message: 'Failed to replace key. Try again later.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/addAdditionalItems', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddAdditionalItem.validate(req.body);

            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { soldierId, description, bagId, quantity } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add additional item')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add additional item!" });
                }

                const checkExistSoldier = await client.query('SELECT * FROM soldier WHERE id = $1;', [soldierId]);
                if (checkExistSoldier.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This soldier does not exist. It has probably been modified." });
                }

                const uniqueId = crypto.randomBytes(16).toString('hex');

                if (bagId !== '') {

                    const checkExistBag = await client.query('SELECT * FROM laundrybags WHERE id = $1;', [bagId]);
                    if (checkExistBag.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: "This bag does not exist. It has probably been modified." });
                    }

                    await Promise.all([
                        client.query(`
                            INSERT INTO additionalitem (id, soldier_id, description, bag_id, quantity) VALUES ($5, $1, $2, $3, $4);`, [soldierId, description, bagId, quantity, uniqueId]),
                        client.query(`
                            UPDATE laundrybags SET soldier_id = $1 WHERE id = $2;`, [soldierId, bagId]),
                        client.query(`
                            INSERT INTO usermonitoring (username, location) VALUES ($1, $2);`,
                            [req.session.username, `Add additional bag with number ${bagId} to soldier ${soldierId}`])
                    ]);
                } else {
                    await Promise.all([
                        client.query(`
                            INSERT INTO additionalitem (id, soldier_id, description, bag_id, quantity) VALUES ($4, $1, $2, NULL, $3);`, [soldierId, description, quantity, uniqueId]),
                        client.query(`
                            INSERT INTO usermonitoring (username, location) VALUES ($1, $2);`,
                            [req.session.username, `Add additional item to soldier ${soldierId}`])
                    ]);
                }

                await client.query('COMMIT');
                return res.status(200).json({ message: 'Additional item added successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error add additional item:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/accommodation/getAllAdditionalItem', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaGetAdditionalItem.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { page, limit, searchColumn, searchValue } = req.query;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const offset = (page - 1) * limit;
                let whereClause = 'WHERE s.camp_id = $1';
                let values = [req.session.camp];

                let countValues = [req.session.camp];
                let countWhereClause = 'WHERE s.camp_id = $1';

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [result, countResult] = await Promise.all([
                    client.query(`
                        SELECT ai.id, s.namesoldier, ai.description, ai.quantity, lb.code
                        FROM additionalitem ai
                        LEFT JOIN soldier s ON s.id = ai.soldier_id
                        LEFT JOIN laundrybags lb ON lb.id = ai.bag_id
                        ${whereClause}
                        LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),
                    client.query(`
                        SELECT COUNT(*) AS count
                        FROM additionalitem ai
                        LEFT JOIN soldier s ON s.id = ai.soldier_id
                        LEFT JOIN laundrybags lb ON lb.id = ai.bag_id
                        ${countWhereClause};`, countValues),
                ]);

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

                const totalData = parseInt(countResult.rows[0].count, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                await client.query('COMMIT');
                return res.status(200).json({ allAdditionalItems: total_res, totalAdditionalItems: totalPages });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error fetching data:', error);
                res.status(500).json({ message: 'Error fetching data from the database' });

            } finally {
                client.release();
            }
        });

        this.app.post('/accommodation/returnAddtionalItem', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaReturnAdditionalItem.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { id, quantity } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add additional item')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to return additional item!" });
                }

                const checkExistAdditionalItem = await client.query('SELECT * FROM additionalitem WHERE id = $1;', [id]);
                if (checkExistAdditionalItem.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This item does not exist. It has probably been modified." });
                }

                const check_bag = await client.query(`
                SELECT bag_id FROM additionalitem ai
                LEFT JOIN laundrybags l ON l.id = ai.bag_id
                WHERE ai.id = $1 AND l.status <> 'None';`, [id]);

                if (check_bag.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This bag is an active laundry bag and cannot be returned.' });
                }

                const result_quantity = await client.query(`
                SELECT quantity FROM additionalitem WHERE id = $1;`, [id]);

                if (result_quantity.rows[0].quantity === quantity) {
                    await Promise.all([
                        client.query(`UPDATE laundrybags SET soldier_id = NULL WHERE id = (SELECT bag_id FROM additionalitem WHERE id = $1);`, [id]),
                        client.query(`DELETE FROM additionalitem WHERE id = $1;`, [id]),
                        client.query(`INSERT INTO usermonitoring (username, location) VALUES ($1, $2);`,
                            [req.session.username, `Return additional item`])
                    ]);
                } else {
                    await Promise.all([
                        client.query(`UPDATE additionalitem SET quantity = quantity::NUMERIC - $2 WHERE id = $1;`, [id, quantity]),
                        client.query(`INSERT INTO usermonitoring (username, location) VALUES ($1, $2);`,
                            [req.session.username, `Reduced quantity of item with id ${id}`])
                    ]);
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'Item returned successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error return item:', error);
                res.status(500).json({ message: 'Error returning item!' });

            } finally {
                client.release();
            }
        });

        this.app.get('/accommodation/uploadRooms/download', this.isLoggedIn.bind(this), async (req, res) => {

            // Create a new Excel workbook
            const workbook = new excelJS.Workbook();

            // Sheet 1: Soldier Data
            const worksheet = workbook.addWorksheet('Add Multipul Rooms');

            // Add custom column titles for the first sheet
            const headers = ['roomId', 'roomName'];
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
            res.setHeader('Content-Disposition', 'attachment; filename=templateAddRooms.xlsx');

            // Write the workbook to the response stream
            await workbook.xlsx.write(res);
            res.end(); // End the response

        });

        this.app.post('/accommodation/uploadRooms', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {
            const client = await pool.connect();
            const errors = [];

            try {
                await client.query('BEGIN');

                const checkPermission = client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add room')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add multipule room to destination!" });
                }

                if (!req.file) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'No file uploaded.' });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                // Set to track unique soldierIds in the file
                const seenIds = new Set();
                const seenNames = new Set();

                if (sheetName !== 'Add Multipul Rooms') {
                    await client.query('ROLLBACK');
                    errors.push({ type: 'InvalidFormat', message: `Invalid template` });
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row, index) => {
                    const { error } = schemaRoomToDestination.validate(row);

                    if (error) {
                        errors.push({ type: 'Validation', details: error.details, row, index });
                        return;
                    }

                    // Check for duplicates within the file
                    if (seenIds.has(row.roomId)) {
                        errors.push({ type: 'DuplicateInFile', row, index, message: `Duplicate room number '${row.roomId}' in the file.` });
                        return;
                    }

                    if (seenNames.has(row.roomName)) {
                        errors.push({ type: 'DuplicateInFile', row, index, message: `Duplicate room name '${row.roomName}' in the file.` });
                        return;
                    }
                    seenIds.add(row.roomId);
                    seenNames.add(row.roomName);

                    const result_check_build = await client.query("SELECT * FROM buildings WHERE namebuilding = $1 AND camp_id = $2;", ['Building ' + row.roomName.split('/')[0], req.session.camp]);
                    if (result_check_build.rows.length === 0) {
                        errors.push({ type: 'DuplicateInDB', message: `Building ${row.roomName.split('/')[0]} not exists.` });
                        return;
                    }

                    if (!row.roomName.endsWith(`/${row.roomId}`)) {
                        errors.push({ type: 'InvalidFormat', message: `Room name '${row.roomName}' has invalid format.` });
                        return;
                    }

                    // Check for duplicates in the database
                    const result = await client.query(`SELECT * FROM rooms WHERE id = $1;`, [row.roomId]);
                    const resultName = await client.query(`
                        SELECT * FROM rooms 
                        LEFT JOIN buildroom br ON br.roomid = rooms.id
                        LEFT JOIN buildings b ON b.id = br.buildid
                        WHERE nameroom = $1 AND b.camp_id = $2;`, [row.roomName, req.session.camp]);

                    if (result.rows.length > 0 || resultName.rows.length > 0) {
                        errors.push({ type: 'DuplicateInDB', message: `Room '${row.roomName}' already exists.` });
                        return;
                    }

                    if (row.roomName.endsWith(' ')) {
                        errors.push({ type: 'InvalidFormat', message: `Room name '${row.roomName}' should not end with a space.` });
                        return;
                    }
                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');

                    const styleError = errors.find(error => error.type === 'Validation');

                    if (styleError) {
                        console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                        console.error(styleError.details);
                    }

                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row) => {

                    const build_id = await client.query(`SELECT id FROM buildings WHERE namebuilding = $1 AND camp_id = $2`,
                        [`Building ${row.roomName.split('/')[0]}`, req.session.camp]);

                    let buildingName = build_id.rows[0].id;

                    const uniqueId = crypto.randomBytes(16).toString('hex');
                    client.query("INSERT INTO rooms VALUES ($1, $2)", [uniqueId, row.roomName]);
                    client.query("INSERT INTO buildroom VALUES ($1, $2)", [buildingName, uniqueId]);
                }));

                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Add multi room`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });
            } finally {
                client.release();
            }
        });

        this.app.get('/accommodation/multiReleaseRooms/download', this.isLoggedIn.bind(this), async (req, res) => {

            // Create a new Excel workbook
            const workbook = new excelJS.Workbook();

            // Sheet 1: Soldier Data
            const worksheet = workbook.addWorksheet('Release Multipul Rooms');

            // Add custom column titles for the first sheet
            const headers = ['keyName'];
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
                { width: 20 }
            ];

            // Set the response headers for file download
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=templateReleaseRooms.xlsx');

            // Write the workbook to the response stream
            await workbook.xlsx.write(res);
            res.end(); // End the response

        });

        this.app.post('/accommodation/uploadReleaseRooms', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {
            const client = await pool.connect();
            const errors = [];

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Release rooms')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to release rooms!" });
                }

                if (!req.file) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'No file uploaded.' });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                // Set to track unique soldierIds in the file
                const seenIds = new Set();

                if (sheetName !== 'Release Multipul Rooms') {
                    await client.query('ROLLBACK');
                    errors.push({ type: 'InvalidFormat', message: `Invalid template` });
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row, index) => {
                    const { error } = schemaReleaseMultiRoom.validate(row);

                    if (error) {
                        errors.push({ type: 'Validation', details: error.details, row, index });
                        return;
                    }

                    // Check for duplicates within the file
                    if (seenIds.has(row.keyName)) {
                        errors.push({ type: 'DuplicateInFile', row, index, message: `Duplicate key name '${row.keyName}' in the file.` });
                        return;
                    }
                    seenIds.add(row.keyName);

                    const result_check_key = await client.query(`
                        SELECT key.* FROM key
                        LEFT JOIN roomskey rk ON rk.keyid = key.id
                        LEFT JOIN buildroom br ON br.roomid = rk.roomid
                        LEFT JOIN buildings b ON b.id = br.buildid
                        WHERE namekey = $1 AND b.camp_id = $2;`, [row.keyName, req.session.camp]);

                    if (result_check_key.rows.length === 0) {
                        errors.push({ type: 'DuplicateInDB', message: `Key ${row.keyName} not exists.` });
                        return;
                    }

                    if (row.keyName.endsWith(' ')) {
                        errors.push({ type: 'InvalidFormat', message: `Key name '${row.keyName}' should not end with a space.` });
                        return;
                    }

                    const res_query = await client.query(
                        `SELECT soldierid FROM key 
                        LEFT JOIN roomskey rk ON rk.keyid = key.id
                        LEFT JOIN buildroom br ON br.roomid = rk.roomid
                        LEFT JOIN buildings b ON b.id = br.buildid
                        WHERE namekey = $1 AND b.camp_id = $2;`, [row.keyName, req.session.camp]
                    );

                    const check_laundry_bag = await client.query(`
                        SELECT l.status FROM laundrybags l
                        LEFT JOIN soldier s ON s.laundry_bag_id = l.id
                        LEFT JOIN additionalitem ai ON ai.bag_id = l.id
                        WHERE s.id = $1 OR ai.soldier_id = $1;`, [res_query.rows[0].soldierid]);

                    const check_bike = await client.query(`
                        SELECT * FROM soldier s
                        LEFT JOIN bikesoldier bs ON s.id = bs.soldierid
                        WHERE s.id = $1 AND datefrom IS NOT NULL AND dateto IS NULL;`, [res_query.rows[0].soldierid]);

                    const check_additional_item = await client.query(`SELECT * FROM additionalitem WHERE soldier_id = $1;`, [res_query.rows[0].soldierid]);

                    const check_build_type = await client.query(`
                        SELECT type FROM buildings b
                        LEFT JOIN buildroom br ON b.id = br.buildid
                        LEFT JOIN rooms r ON r.id = br.roomid
                        LEFT JOIN roomskey rk ON rk.roomid = r.id
                        LEFT JOIN key k ON k.id = rk.keyid
                        WHERE b.camp_id = $1 AND k.namekey = $2`, [req.session.camp, row.keyName]);

                    if (check_build_type.rows[0].type !== 'Accommodation')
                        return;

                    if (check_laundry_bag.rows.length > 0) {
                        const activeBags = check_laundry_bag.rows.filter(bag => bag.status !== 'None');
                        if (activeBags.length > 0) {
                            errors.push({ type: 'CheckBag', message: `"The soldier with key ${row.keyName} has an active laundry bag and cannot be released."` });
                            return;
                        }
                    }

                    if (check_bike.rows.length > 0) {
                        errors.push({ type: 'CheckBike', message: `"The soldier with key ${row.keyName} has an active bike rental and cannot be released."` });
                        return;
                    }

                    if (check_additional_item.rows.length > 0) {
                        errors.push({ type: 'CheckBike', message: `"The soldier with key ${row.keyName} has a non returned additional items!"` });
                        return;
                    }
                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');

                    const styleError = errors.find(error => error.type === 'Validation');

                    if (styleError) {
                        console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                        console.error(styleError.details);
                    }

                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row) => {

                    const check_build_type = await client.query(`
                        SELECT type FROM buildings b
                        LEFT JOIN buildroom br ON b.id = br.buildid
                        LEFT JOIN rooms r ON r.id = br.roomid
                        LEFT JOIN roomskey rk ON rk.roomid = r.id
                        LEFT JOIN key k ON k.id = rk.keyid
                        WHERE b.camp_id = $1 AND k.namekey = $2`, [req.session.camp, row.keyName]);

                    const res_query = await client.query(`
                        SELECT key.id, key.soldierid FROM key
                        LEFT JOIN roomskey rk ON rk.keyid = key.id
                        LEFT JOIN buildroom br ON br.roomid = rk.roomid
                        LEFT JOIN buildings b ON b.id = br.buildid
                        WHERE namekey = $1 AND b.camp_id = $2;`, [row.keyName, req.session.camp]);

                    if (check_build_type.rows[0].type === 'Accommodation')
                        client.query("UPDATE soldier SET date_free = CURRENT_DATE, upcoming_release = NULL WHERE id = $1;", [res_query.rows[0].soldierid])

                    client.query("UPDATE key SET soldierid = NULL WHERE id = $1;", [res_query.rows[0].id]);

                }));

                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Release multi rooms`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });
            } finally {
                client.release();
            }
        });

        this.app.post("/accommodation/downloadUpcomingSoldier", this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaUpcomingSoldierAction.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid input data.' });
            }

            const { filtersSoldier } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const workbook = new excelJS.Workbook();
                const worksheet = workbook.addWorksheet('Upcoming Actions for Soldiers');

                const headers = ['Soldier Name', 'Bag Code', 'Meal Card', 'Upcoming Key', 'Upcoming Accommodation Date', 'Upcoming Release Date'];
                worksheet.addRow(headers).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                worksheet.columns = headers.map(header => ({ header, width: header.length + 10 }));

                let values = [req.session.camp];

                let whereClause = `
                    WHERE s.camp_id = $1 AND (
                        (s.upcoming_accommodation >= CURRENT_DATE AND s.upcoming_release IS NULL)
                        OR (s.upcoming_release >= CURRENT_DATE AND s.upcoming_accommodation IS NULL)
                        OR (s.upcoming_accommodation >= CURRENT_DATE AND s.upcoming_release >= CURRENT_DATE)
                    )`;

                if (filtersSoldier.length > 0) {
                    const baseIndex = values.length + 1;
                    const filterConditions = filtersSoldier.map((filter, index) => {
                        values.push(`%${filter.value}%`);
                        return `${filter.column}::TEXT ILIKE $${baseIndex + index}`;
                    }).join(' AND ');

                    whereClause += ` AND (${filterConditions})`;
                }

                const result = await client.query(`
                        SELECT 
                            s.namesoldier AS name,
                            l.code,
                            s.meal_card,
                            s.upcoming_accommodation_key,
                            TO_CHAR(s.upcoming_accommodation, 'YYYY-MM-DD') AS upcoming_accommodation,
                            TO_CHAR(s.upcoming_release, 'YYYY-MM-DD') AS upcoming_release
                        FROM soldier s
                        LEFT JOIN laundrybags l ON l.id =  s.laundry_bag_id
                        LEFT JOIN key k ON k.id = s.upcoming_accommodation_key
                        ${whereClause}
                        ORDER BY 
                            CASE 
                                WHEN s.upcoming_accommodation IS NOT NULL AND s.upcoming_release IS NOT NULL THEN 1
                                WHEN s.upcoming_accommodation IS NOT NULL THEN 2
                                WHEN s.upcoming_release IS NOT NULL THEN 3
                                ELSE 4
                            END,
                            CASE 
                                WHEN s.upcoming_accommodation IS NOT NULL AND s.upcoming_release IS NOT NULL THEN s.upcoming_accommodation 
                            END DESC,
                            CASE 
                                WHEN s.upcoming_accommodation IS NOT NULL AND s.upcoming_release IS NOT NULL THEN s.upcoming_release 
                            END ASC,
                            CASE 
                                WHEN s.upcoming_accommodation IS NOT NULL AND s.upcoming_release IS NULL THEN s.upcoming_accommodation 
                            END DESC,
                            CASE 
                                WHEN s.upcoming_release IS NOT NULL AND s.upcoming_accommodation IS NULL THEN s.upcoming_release 
                            END ASC;`, values);

                const filteredSoldier = result.rows.map(row => ({
                    soldierName: row.name || '',
                    bagCode: row.code || '',
                    mealCard: row.meal_card || '',
                    upcomingKey: row.upcoming_accommodation_key || '',
                    upcomingAccommodationDate: row.upcoming_accommodation || '',
                    upcomingReleaseDate: row.upcoming_release || ''
                }));

                await Promise.all(filteredSoldier.map(async ({ soldierName, bagCode, mealCard, upcomingKey, upcomingAccommodationDate, upcomingReleaseDate }, index) => {
                    const dataRow = worksheet.addRow([soldierName, bagCode, mealCard, upcomingKey, upcomingAccommodationDate, upcomingReleaseDate]);

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
                res.setHeader('Content-Disposition', 'attachment; filename="upcoming_actions_soldiers.xlsx"');

                await client.query('COMMIT');

                await workbook.xlsx.write(res);
                res.end();

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error to generate accommodation report:", error);
                res.status(500).json({ message: 'Failed to generate the file.' });

            } finally {
                client.release();
            }

        });
    }

    defineRoutesFitnes() {

        // Serve APK file from local directory
        this.app.get('/download-apk-gym', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();
            const username = req.session.username ? req.session.username : req.body.username;

            try {
                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Download fitness app')`, [username]);

                if (checkPermission.rows.length === 0)
                    return res.status(400).json({ message: "You don't have permission to download app for gym!" });

            } catch (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error downloading the file:', err);
                return res.status(500).json({ message: 'Error downloading the file' });

            } finally {
                client.release();
            }

            // Path to your APK file
            const apkFilePath = path.join(__dirname, 'androidApp', 'RateFitnesCleaning-1.0-release.apk');

            // Check legality and existence of the APK file
            if (!this.checkApkFileLegality(apkFilePath, res)) {
                return res.status(400).json({ message: 'There is a problem with existence and legality of APK file' });
            }

            // Set proper headers for an APK file
            res.setHeader('Content-Type', 'application/vnd.android.package-archive'); // Correct MIME type for APK
            res.setHeader('Content-Disposition', 'attachment; filename="RateFitnesCleaning-1.0-release.apk"'); // Force download with custom filename

            // Use res.download() to send the file to the client
            res.download(apkFilePath, (err) => {
                if (err) {
                    console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                    console.error('Error downloading the file:', err);
                    res.status(500).json({ message: 'Error downloading the file' });
                }
            });
        });

        this.app.get('/apk-fitness-version', this.isLoggedIn.bind(this), (req, res) => {
            res.json({ version: "1.0", apkUrl: "/download-apk-gym" });
        });

        this.app.post('/sendClientData', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = clientDataSchema.validate(req.body);

            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { userId } = req.body;

            if (!userId) {
                return res.status(400).json({ message: 'User ID is required.' });
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkSoldierId = await client.query('SELECT * FROM soldier WHERE id = $1;', [userId]);
                if (checkSoldierId.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This user does not exist. It has probably been modified." });
                }

                const uniqueId = crypto.randomBytes(16).toString('hex');

                const query = 'INSERT INTO fitness (id, soldierid) VALUES ($1, $2);';
                const values = [uniqueId, userId];
                await client.query(query, values);

                await client.query('COMMIT');
                res.status(200).json({ rowId: uniqueId, message: 'Client saved successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error inserting data:', error);
                res.status(500).json({ message: 'Error saving soldier data to the database' });

            } finally {
                client.release();
            }
        });

        this.app.post('/sendEmojiData', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = emojiDataSchema.validate(req.body);

            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { emoji, userId } = req.body;

            if (!emoji) {
                return res.status(400).json({ message: 'Emoji is required.' });
            }

            if (!userId) {
                return res.status(400).json({ message: 'Soldier ID not found in session.' });
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkSoldierId = await client.query('SELECT * FROM soldier WHERE id = $1;', [userId]);
                if (checkSoldierId.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This user does not exist. It has probably been modified." });
                }

                const query = 'UPDATE fitness SET emoji = $2 WHERE id = $1';
                const values = [userId, emoji];
                await client.query(query, values);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Emoji saved successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error updating data:', error);
                res.status(500).json({ message: 'Error saving emoji data to the database' });

            } finally {
                client.release();
            }
        });

        this.app.get('/fitness', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaFitness.validate(req.query);

            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { formattedDate1, formattedDate2, isFirstTime = "true", limit = 50, offset = 0, searchColumn, searchValue } = req.query;

            let totalCount;
            let regularFilters = [];
            let index = [];
            let userPerm = [];

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const baseValues = formattedDate1 && formattedDate2 ?
                    [req.session.camp, formattedDate1, formattedDate2] :
                    formattedDate1 ? [req.session.camp, formattedDate1] :
                        formattedDate2 ? [req.session.camp, formattedDate2] :
                            [req.session.camp];

                const values = [...baseValues];
                const totalValues = [...baseValues];
                const countValues = [...baseValues];

                if (formattedDate1 && formattedDate2) {
                    regularFilters.push({
                        clause: `created_date::date BETWEEN $2 AND $3`,
                        countClause: `created_date::date BETWEEN $2 AND $3`
                    });
                } else if (formattedDate1) {
                    regularFilters.push({
                        clause: `created_date::date >= $2`,
                        countClause: `created_date::date >= $2`
                    });
                } else if (formattedDate2) {
                    regularFilters.push({
                        clause: `created_date::date <= $2`,
                        countClause: `created_date::date <= $2`
                    });
                }

                let whereClause = '';
                let countWhereClause = '';
                let totalWhereClause = '';

                totalWhereClause += formattedDate1 && formattedDate2
                    ? "WHERE s.camp_id = $1 AND created_at::date BETWEEN $2 AND $3"
                    : formattedDate1
                        ? "WHERE s.camp_id = $1 AND created_at::date >= $2"
                        : formattedDate2
                            ? "WHERE s.camp_id = $1 AND created_at::date <= $2"
                            : "WHERE s.camp_id = $1";

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        const paramValue = `%${value}%`;

                        values.push(paramValue);
                        countValues.push(paramValue);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        regularFilters.push({ clause: `${column}::TEXT ILIKE $${paramIndex}`, countClause: `${column}::TEXT ILIKE $${countParamIndex}` });
                    }
                }

                // Append regular filters to WHERE
                if (regularFilters.length > 0) {
                    whereClause += "WHERE " + regularFilters.map(f => f.clause).join(" AND ");
                    countWhereClause += "WHERE " + regularFilters.map(f => f.countClause).join(" AND ");
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [data_emoji, countResult, result_percent_emoji, get_permission] = await Promise.all([
                    client.query(`
                        SELECT *
                        FROM (
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
                            GROUP BY created_date
                            ORDER BY created_date
                        ) sub
                        ${whereClause}
                        LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),

                    client.query(`
                        SELECT COUNT(*) AS count
                        FROM (
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
                            GROUP BY created_date
                            ORDER BY created_date
                        ) sub
                        ${countWhereClause};`, countValues),

                    client.query(`
                        SELECT 
                            COUNT(CASE WHEN f.emoji = '😞' THEN 1 END) AS percent_sad,
                            COUNT(CASE WHEN f.emoji = '😐' THEN 1 END) AS percent_neutral,
                            COUNT(CASE WHEN f.emoji = '😁' THEN 1 END) AS percent_very_happy
                        FROM fitness f
                        LEFT JOIN soldier s ON f.soldierid = s.id
                        ${totalWhereClause}`, totalValues),

                    client.query(`
                        SELECT permission_name FROM permission p
                        JOIN user_permission up ON up.perm_id = p.id AND up.user_id = $1;`, [req.session.userId])
                ]);

                totalCount = countResult.rows[0].count;

                let data = data_emoji.rows;
                let total_data = result_percent_emoji.rows[0];

                userPerm = get_permission.rows;

                const hasFullPermission = userPerm.some(p => p.permission_name === 'Full permission');
                const isAdmin = req.session.username === 'admin';

                if (hasFullPermission && isAdmin) {
                    index = [0, 1, 2, 3, 4, 5, 6];
                } else if (hasFullPermission) {
                    index = [0, 1, 2, 4, 5, 6];
                } else {
                    index = [0, 6];

                    if (userPerm.some(p => p.permission_name === 'Assets')) index.push(1);
                    if (userPerm.some(p => p.permission_name === 'Laundry')) index.push(2);
                    if (userPerm.some(p => p.permission_name === 'Gym')) index.push(3);
                    if (userPerm.some(p => p.permission_name === 'Accommodation and keys')) index.push(4);
                    if (userPerm.some(p => p.permission_name === 'Bicycles')) index.push(5);
                }

                index.sort();

                await client.query('COMMIT');

                if (isFirstTime === "true")
                    this.giveSpecificPermissionFitness(userPerm, index, res, data, total_data, totalCount);
                else
                    res.status(200).json({ data, total_data, totalCount });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error fetching fitness data:', error);
                res.status(500).json({ message: 'Error fetching data from the database' });

            } finally {
                client.release();
            }
        });

        this.app.post('/fitness/report', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaFitnessReport.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid input data.' });
            }

            const { selectedDate1, selectedDate2, filtersFitness } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const workbook = new excelJS.Workbook();
                const worksheet = workbook.addWorksheet('Gym Usage Data');

                const tableHeaders = ['Date', 'Average Emoji Rating', 'Number of Visits'];
                worksheet.addRow(tableHeaders).eachCell((cell) => {
                    cell.font = { bold: true, size: 12 };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                worksheet.columns = tableHeaders.map(header => ({ header, width: header.length + 10 }));

                let values = selectedDate1 && selectedDate2 ?
                    [req.session.camp, selectedDate1, selectedDate2] :
                    selectedDate1 ? [req.session.camp, selectedDate1] :
                        selectedDate2 ? [req.session.camp, selectedDate2] :
                            [req.session.camp];

                let regularFilters = [];

                if (selectedDate1 && selectedDate2) {
                    regularFilters.push({
                        clause: `created_date::date BETWEEN $2 AND $3`,
                        countClause: `created_date::date BETWEEN $2 AND $3`
                    });
                } else if (selectedDate1) {
                    regularFilters.push({
                        clause: `created_date::date >= $2`,
                        countClause: `created_date::date >= $2`
                    });
                } else if (selectedDate2) {
                    regularFilters.push({
                        clause: `created_date::date <= $2`,
                        countClause: `created_date::date <= $2`
                    });
                }

                let whereClauses = [];
                let paramIndex = values.length + 1;

                if (regularFilters.length > 0) {
                    whereClauses.push(...regularFilters.map(f => f.clause));
                }

                if (filtersFitness.length > 0) {
                    whereClauses.push(...filtersFitness.map((filter) => {
                        const column = filter.column;
                        values.push(`%${filter.value}%`);
                        return `${column}::TEXT ILIKE $${paramIndex++}`;
                    }));
                }

                const whereClause = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

                const result_fitness = await client.query(`
                    SELECT *
                        FROM (
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
                            GROUP BY created_date
                            ORDER BY created_date
                        ) sub
                        ${whereClause};`, values);

                const filteredFitness = result_fitness.rows.map(date => {
                    const formattedDate = { ...date };
                    // Format the created_date
                    if (formattedDate.created_date) {
                        formattedDate.created_date = new Date(formattedDate.created_date).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    }
                    return formattedDate;
                });

                await Promise.all(filteredFitness.map(async (data, index) => {
                    const row = worksheet.addRow(Object.values(data)); // Convert object values to array
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

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="report_gym.xlsx"');

                await client.query('COMMIT');

                await workbook.xlsx.write(res);
                res.end();

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error generating Excel report:', error);
                res.status(500).json({ message: 'Failed to generate report.' });
            }
        });
    }

    defineRoutesLaundry() {

        const statusMapping = {
            'drop off': 'avg_drop_off_duration',
            'transportation to laundry facility': 'avg_transportation_duration',
            'laundry facility': 'avg_laundry_duration',
            'transportation to pick up': 'avg_transportation_drop_off_duration',
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
        this.app.get('/download-apk-laundry', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();
            const username = req.session.username ? req.session.username : req.body.username;

            try {

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Download laundry app')`, [username])

                if (checkPermission.rows.length === 0)
                    return res.status(400).json({ message: "You don't have permission to download app for laundry!" });

            } catch (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error downloading the file:', err);
                res.status(500).json({ message: 'Error downloading the file' });
            } finally {
                client.release();
            }

            // Path to your APK file
            const apkFilePath = path.join(__dirname, 'androidApp', 'RFIDLaundryReader-1.4-release.apk');

            // Check legality and existence of the APK file
            if (!this.checkApkFileLegality(apkFilePath, res)) {
                return res.status(400).json({ message: 'There is a problem with existence and legality of APK file' });
            }

            // Set proper headers for an APK file
            res.setHeader('Content-Type', 'application/vnd.android.package-archive'); // Correct MIME type for APK
            res.setHeader('Content-Disposition', 'attachment; filename="RFIDLaundryReader-1.4-release.apk"'); // Force download with custom filename

            // Use res.download() to send the file to the client
            res.download(apkFilePath, (err) => {
                if (err) {
                    console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                    console.error('Error downloading the file:', err);
                    res.status(500).json({ message: 'Error downloading the file' });
                }
            });
        });

        this.app.get('/apk-laundry-version', this.isLoggedIn.bind(this), (req, res) => {
            res.json({ version: "1.4", apkUrl: "/download-apk-laundry" });
        });

        this.app.get('/laundry', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaLaundry.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid input data.' });
            }

            let { isFirstTime = "true" } = req.query;

            const client = await pool.connect();
            let overallTotalMountFormatted = 0;

            try {

                await client.query('BEGIN');

                // Query to get the count of bags grouped by status and type
                const [result, get_permission] = await Promise.all([
                    client.query(`
                    SELECT
                        status,
                        type,
                        COUNT(*) AS count,
                        SUM(laundrycount) AS sum
                    FROM laundrybags
                    WHERE camp_id = $1
                    GROUP BY status, type;`, [req.session.camp]),

                    client.query(`
                        SELECT permission_name FROM permission p
                        JOIN user_permission up ON up.perm_id = p.id AND up.user_id = $1;`, [req.session.userId])
                ]);

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
                let index = [];
                let userPerm = [];

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
                    overallTotalMountFormatted += parseInt(sum);
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
                        console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                        console.error(`Error executing query for status "${status}":`, error);
                    }
                }));

                const overallAverageTimeInSeconds = count > 0 ? Math.floor(totalAvgTimeInSeconds / count) : 0;
                const overallAverageFormatted = formatTime(overallAverageTimeInSeconds);

                userPerm = get_permission.rows;

                const hasFullPermission = userPerm.some(p => p.permission_name === 'Full permission');
                const isAdmin = req.session.username === 'admin';

                if (hasFullPermission && isAdmin) {
                    index = [0, 1, 2, 3, 4, 5, 6];
                } else if (hasFullPermission) {
                    index = [0, 1, 2, 4, 5, 6];
                } else {
                    index = [0, 6];

                    if (userPerm.some(p => p.permission_name === 'Assets')) index.push(1);
                    if (userPerm.some(p => p.permission_name === 'Laundry')) index.push(2);
                    if (userPerm.some(p => p.permission_name === 'Gym')) index.push(3);
                    if (userPerm.some(p => p.permission_name === 'Accommodation and keys')) index.push(4);
                    if (userPerm.some(p => p.permission_name === 'Bicycles')) index.push(5);
                }

                index.sort();

                await client.query('COMMIT');

                if (isFirstTime === "true")
                    this.giveSpecificPermissionLaundry(userPerm, index, res, bagData, totalCounts, avgTimeData, overallAverageFormatted, headerTable, overallTotalMountFormatted);
                else
                    res.status(200).json({ totalCounts, bagData });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error fetching bag types or average times:', error);
                res.status(500).json({ message: 'Server error' });

            } finally {
                client.release();
            }
        });

        this.app.post('/changeStatusBulk', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = updateBagsScanerSchema.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            if (!req.body.isValidCode)
                return res.status(400).json({ message: "Invalid code" });

            const { codes, destination, prev_destination, campId } = req.body;

            if (!Array.isArray(codes)) {
                return res.status(400).json({ message: "Invalid codes array" });
            }

            if (codes.length === 0) {
                return res.status(400).json({ message: "An empty list of scanned bags cannot be processed" });
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                if (prev_destination === 'None') {
                    const codesPlaceholder = codes.map((_, i) => `$${i + 1}`).join(', ');

                    const insertPromises = codes.map(async (code) => {

                        const result = await client.query(`
                            SELECT id FROM soldier WHERE laundry_bag_id = $1 AND (date_accommodation IS NULL OR (date_accommodation IS NOT NULL AND date_free IS NULL));`, [code]);
                        const result_additional_bag = await client.query(`SELECT soldier_id FROM laundrybags WHERE id = $1;`, [code]);

                        return client.query(
                            `INSERT INTO laundryreport (bag_id, date_drop_off, date_ready_to_pick_up, soldier_id) 
                                VALUES ($1, CURRENT_TIMESTAMP, NULL, $2) ON CONFLICT DO NOTHING;`,
                            [code, result_additional_bag.rows[0].soldier_id || result.rows[0].id || null]
                        )
                    });

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
                            WHERE (bag_id, date_drop_off) IN (
                                SELECT bag_id, MAX(date_drop_off)
                                FROM laundryreport
                                WHERE bag_id IN (${codesPlaceholders}) AND date_ready_to_pick_up IS NULL
                                GROUP BY bag_id);`, codes
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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(err); // Log the error
                res.status(500).json({ message: "Internal server error" });
            } finally {
                client.release();
            }
        });

        this.app.post('/changeEndToEndStatus', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = updateBagsScanerSchema.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { codes } = req.body;

            if (!Array.isArray(codes)) {
                return res.status(400).json({ message: "Invalid codes array" });
            }

            if (codes.length === 0) {
                return res.status(400).json({ message: "An empty list of scanned bags cannot be processed" });
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const insertPromises = codes.map(async (code) => {
                    const result = await client.query(`SELECT id FROM soldier WHERE laundry_bag_id = $1 AND (date_accommodation IS NULL OR (date_accommodation IS NOT NULL AND date_free IS NULL));`, [code]);
                    const result_additional_bag = await client.query(`SELECT soldier_id FROM laundrybags WHERE id = $1;`, [code]);
                    client.query(
                        `INSERT INTO laundryreport (bag_id, date_drop_off, date_ready_to_pick_up, soldier_id) 
                            VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $2) ON CONFLICT DO NOTHING;`,
                        [code, result_additional_bag.rows[0].soldier_id || result.rows[0].id || null]
                    )
                });
                await Promise.all(insertPromises);

                await client.query('COMMIT');
                res.status(200).json({ message: "Bulk status change successful" });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error);
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }
        });

        this.app.post('/changeEndToEndStatusConsole', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = exchangeServiceSchema.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { code } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Linen exchange')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to make linen exchange service action!" });
                }

                const checkCode = await client.query(`SELECT * FROM laundrybags WHERE id = $1;`, [code]);
                if (checkCode.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This code does not exist. It has probably been modified." });
                }

                const result = await client.query(`SELECT id FROM soldier WHERE laundry_bag_id = $1 AND (date_accommodation IS NULL OR (date_accommodation IS NOT NULL AND date_free IS NULL));`, [code]);
                const result_additional_bag = await client.query(`SELECT soldier_id FROM laundrybags WHERE id = $1;`, [code]);

                await Promise.all([
                    client.query(
                        `INSERT INTO laundryreport (bag_id, date_drop_off, date_ready_to_pick_up, soldier_id) 
                            VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $2) ON CONFLICT DO NOTHING;`,
                        [code, result_additional_bag.rows[0].soldier_id || result.rows[0].id || null]
                    )
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: "Bulk status change successful" });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error to set linen exchange:", error);
                res.status(500).json({ message: "Error to set linen exchange" });

            } finally {
                client.release();
            }
        });

        this.app.post('/checkScaningCode', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = checkScaningCodeSchema.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { code, prev_destination, destination, permCount } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const [result, resultCount, resultCheckExist] = await Promise.all([
                    client.query(`
                        SELECT l.code, s.namesoldier, l.status, l.laundrycount
                            FROM laundrybags l
                            LEFT JOIN additionalitem ai ON ai.bag_id = l.id
                            LEFT JOIN soldier s ON s.laundry_bag_id = l.id OR ai.soldier_id = s.id
                            WHERE l.id = $1 AND
                            s.id IS NOT NULL
                            AND (
                                s.date_accommodation IS NULL 
                                OR (s.date_accommodation IS NOT NULL AND s.date_free IS NULL));`, [code]),
                    client.query(`
                        SELECT COUNT(*) AS count
                        FROM laundryreport
                        WHERE bag_id = $1 AND date_drop_off > NOW() - INTERVAL '30 minutes';`, [code]),
                    client.query('SELECT * FROM laundrybags WHERE id = $1', [code])
                ]);

                if (resultCheckExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `This laundry bag is not exit!` });
                }

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This laundry bag was not given to the soldier." });
                }

                const bag = result.rows[0];

                // if (bag.laundrycount >= permCount) {
                //     await client.query('ROLLBACK');
                //     return res.status(400).json({ message: `Bag number ${bag.code} has already been laundered. The maximum laundry limit per month for one bag is ${permCount}` });
                // }

                const status = bag.status !== 'None' ? bag.status : 'Picked up';
                const prev_stat = prev_destination !== 'None' ? prev_destination : 'Picked up';

                if (bag.status !== prev_destination) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `Status mismatch. Bag ${bag.code} is currently at ${status}, not ${prev_stat}.` });
                }

                if (destination === 'Linen Exchange service' && parseInt(resultCount.rows[0].count) > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The bag with number ${code} is already scanned with use Linen Exchange service` });
                }

                await client.query('COMMIT');
                res.status(200).json({ code: bag.code, soldierId: bag.namesoldier });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(err);
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }
        });

        this.app.post('/changeStatusConsole', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = updateBagsSchema.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { code, destination, prev_destination } = req.body;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const [checkPermissionAddStatusBag, checkPermissionMoveStatusBag, checkPermissionRemoveStatusBag] = await Promise.all([
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add status bag')`, [req.session.userId]),
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Move status bag')`, [req.session.userId]),
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Remove status bag')`, [req.session.userId])
                ]);

                if (checkPermissionAddStatusBag.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add bag in circle!" });
                }

                if (checkPermissionMoveStatusBag.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to move bag in next state!" });
                }

                if (checkPermissionRemoveStatusBag.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to remove bag form circle!" });
                }

                const result = await client.query(`
                    SELECT l.code, s.id, l.status, l.laundrycount, l.maxcountlandry
                    FROM laundrybags l
					LEFT JOIN additionalitem ai ON ai.bag_id = l.id
                    LEFT JOIN soldier s ON s.laundry_bag_id = l.id OR ai.soldier_id = s.id
                    WHERE s.id IS NOT NULL AND (s.date_accommodation IS NULL OR (s.date_accommodation IS NOT NULL AND s.date_free IS NULL)) AND l.id = $1;`, [code]);

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "Laundry bag is in storage" });
                }

                // if (result.rows[0].laundrycount > result.rows[0].maxcountlandry) {
                //     await client.query('ROLLBACK');
                //     return res.status(400).json({ message: `This bag has exceeded the ${result.rows[0].maxcountlandry} wash per month limit` });
                // }

                const bag = result.rows[0];

                const queries = [];

                if (destination === 'Ready to pick up') {
                    queries.push(client.query(`
                        UPDATE laundryreport SET date_ready_to_pick_up = CURRENT_TIMESTAMP 
                        WHERE bag_id = $1 AND date_drop_off = (
                            SELECT date_drop_off 
                            FROM laundryreport 
                            WHERE bag_id = $1 AND date_ready_to_pick_up IS NULL 
                            ORDER BY date_drop_off DESC
                            LIMIT 1)`, [code]));
                }

                if (prev_destination === 'None') {

                    const result = await client.query(`SELECT id FROM soldier WHERE laundry_bag_id = $1 AND (date_accommodation IS NULL OR (date_accommodation IS NOT NULL AND date_free IS NULL));`, [code]);
                    const result_additional_bag = await client.query(`SELECT soldier_id FROM laundrybags WHERE id = $1;`, [code]);

                    queries.push(client.query(`
                        INSERT INTO laundryreport VALUES ($1, CURRENT_TIMESTAMP, NULL, $2);`,
                        [code, result_additional_bag.rows[0].soldier_id || result.rows[0].id || null]));

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
                    INSERT INTO usermonitoring (username, location) VALUES ($1, $2)`,
                    [req.session.username, `Change bag ${code} status from ${prev_destination} to ${destination}`]));

                await Promise.all(queries);

                await client.query('COMMIT');
                res.status(200).json({ code: bag.code, soldierId: bag.id, message: "The status of the bag has been changed" });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error to change bag status: ", err); // Log detailed error for debugging
                res.status(500).json({ message: "Error to change bag status" });

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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error check late bags: ', error);
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }
        });

        this.app.get('/getBagsByStatus', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaGetBagsByStatus.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { status, page = 1, limit = 10, searchColumn, searchValue } = req.query;
            const offset = (page - 1) * limit;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                let whereClause = `WHERE 
                            l.status = $1 AND
                            l.camp_id = $2 AND
                            (
                                s.namesoldier IS NOT NULL AND s.date_accommodation IS NULL
                                OR 
                                (s.namesoldier IS NOT NULL AND s.date_accommodation IS NOT NULL AND s.date_free IS NULL)
                            )`;
                let values = [status, req.session.camp];

                let countValues = [status, req.session.camp];
                let countWhereClause = `WHERE 
                            l.status = $1 AND
                            l.camp_id = $2 AND
                            (
                                s.namesoldier IS NOT NULL AND s.date_accommodation IS NULL
                                OR 
                                (s.namesoldier IS NOT NULL AND s.date_accommodation IS NOT NULL AND s.date_free IS NULL)
                            )`;

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];


                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                if (status !== '' && req.get('X-Is-Search') === 'true') {
                    const all_asset_result = await client.query(`
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
                                additionalitem ai ON ai.bag_id = l.id
                            LEFT JOIN 
                                soldier s ON s.laundry_bag_id = l.id OR ai.soldier_id = s.id
                            WHERE 
                                l.status = $1 AND
                                l.camp_id = $2 AND
                                (
                                    s.namesoldier IS NOT NULL AND s.date_accommodation IS NULL
                                    OR 
                                    (s.namesoldier IS NOT NULL AND s.date_accommodation IS NOT NULL AND s.date_free IS NULL)
                                )
                            ORDER BY 
                                islate ASC;`, [status, req.session.camp]);

                    await client.query('COMMIT');
                    return res.status(200).json({ fullData: all_asset_result.rows });
                }

                if (status !== '') {
                    const [result, countResult] = await Promise.all([

                        client.query(`     
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
                                additionalitem ai ON ai.bag_id = l.id
                            LEFT JOIN 
                                soldier s ON s.laundry_bag_id = l.id OR ai.soldier_id = s.id
                            ${whereClause}
                            ORDER BY islate ASC
                            LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),
                        client.query(`
                            SELECT 
                                COUNT(*)
                            FROM 
                                laundrybags l
                            LEFT JOIN 
                                additionalitem ai ON ai.bag_id = l.id
                            LEFT JOIN 
                                soldier s ON s.laundry_bag_id = l.id OR ai.soldier_id = s.id
                            ${countWhereClause};`, countValues)
                    ]);

                    const totalData = parseInt(countResult.rows[0].count, 10);
                    const totalPages = Math.ceil(totalData / limit) || 1;

                    await client.query('COMMIT');
                    return res.status(200).json({ data: result.rows, totalPages: totalPages });

                }

                const result = await client.query(`
                        SELECT DISTINCT l.id, l.code
                            FROM laundrybags l
                            LEFT JOIN additionalitem ai ON ai.bag_id = l.id
                            LEFT JOIN soldier s1 ON l.id = s1.laundry_bag_id
                            LEFT JOIN soldier s2 ON ai.soldier_id = s2.id
                            WHERE l.camp_id = $1
                            AND (
                                (s1.id IS NOT NULL AND (s1.date_accommodation IS NULL OR s1.date_free IS NULL))
                                OR
                                (s2.id IS NOT NULL AND (s2.date_accommodation IS NULL OR s2.date_free IS NULL))
                            );`, [req.session.camp]);

                await client.query('COMMIT');
                res.status(200).json({ fullData: result.rows });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error to get bags by status: ", error);
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }
        });

        this.app.get('/laundry/viewReport', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaReport.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { selectedDate1, selectedDate2, page = 1, pageDate = 1, limit = 10, searchColumn, searchValue, searchColumnDate, searchValueDate } = req.query;
            const offset = (page - 1) * limit;
            const offsetDate = (pageDate - 1) * limit;

            selectedDate1 += " 00:00";
            selectedDate2 += " 23:59";

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                let whereClause = '';
                let values = [selectedDate1, selectedDate2, req.session.camp];

                let countValues = [selectedDate1, selectedDate2, req.session.camp];
                let countWhereClause = '';

                let whereClauseDate = '';
                let valuesDate = [selectedDate1, selectedDate2, req.session.camp];

                let countWhereClauseDate = '';
                let countValuesDate = [selectedDate1, selectedDate2, req.session.camp];

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " WHERE ";
                    countWhereClause += " WHERE ";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                if (searchColumnDate && searchValueDate) {

                    if (!Array.isArray(searchColumnDate)) searchColumnDate = [searchColumnDate];
                    if (!Array.isArray(searchValueDate)) searchValueDate = [searchValueDate];

                    if (Array.isArray(searchColumnDate[0])) searchColumnDate = searchColumnDate[0];
                    if (Array.isArray(searchValueDate[0])) searchValueDate = searchValueDate[0];

                    whereClauseDate += " WHERE ";
                    countWhereClauseDate += " WHERE ";

                    for (let i = 0; i < searchColumnDate.length; i++) {
                        const column = searchColumnDate[i];
                        const value = searchValueDate[i];

                        valuesDate.push(`%${value}%`);
                        countValuesDate.push(`%${value}%`);

                        const paramIndex = valuesDate.length;
                        const countParamIndex = countValuesDate.length;

                        whereClauseDate += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClauseDate += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumnDate.length - 1) {
                            whereClauseDate += " AND ";
                            countWhereClauseDate += " AND ";
                        }
                    }
                }

                // Add pagination
                valuesDate.push(limit);
                valuesDate.push(offsetDate);
                const limitIndexDate = valuesDate.length - 1;
                const offsetIndexDate = valuesDate.length;

                const [result, result_nationality, countResult, countResultNational] = await Promise.all([
                    client.query(`
                        SELECT *
                        FROM (
                            SELECT 
                            l.code,
                            l.type,
                            CASE

                                WHEN lr.date_ready_to_pick_up IS NOT NULL 
                                    AND lr.date_drop_off = lr.date_ready_to_pick_up 
                                THEN 'Picked up'
                            
                                WHEN EXISTS (
                                    SELECT 1
                                    FROM laundryreport lr2
                                    JOIN laundrybags l2 ON l2.id = lr2.bag_id
                                    WHERE l2.code = l.code
                                        AND lr2.date_drop_off > lr.date_drop_off
                                        AND (l2.status = 'Picked up' OR l2.status = 'None')
                                    ) THEN 'Picked up'

                                WHEN l.status = 'None' THEN 'Picked up'
                                ELSE l.status
                            END AS status,

                            s.namesoldier,
                            s.country,
                            TO_CHAR(lr.date_drop_off, 'YYYY-MM-DD HH24:MI') AS date_drop_off,

                            CASE
                                WHEN l.status = 'None' AND lr.date_ready_to_pick_up IS NULL THEN 'Remove by user'
                                ELSE TO_CHAR(lr.date_ready_to_pick_up, 'YYYY-MM-DD HH24:MI')
                            END AS date_ready_to_pick_up

                            FROM laundrybags l
                            JOIN laundryreport lr ON lr.bag_id = l.id
                            JOIN soldier s ON lr.soldier_id = s.id
                            WHERE lr.date_drop_off BETWEEN $1 AND $2 AND l.camp_id = $3
                            ORDER BY l.code, lr.date_drop_off
                        ) sub
                        ${whereClause}
                        LIMIT $${limitIndex} OFFSET $${offsetIndex};
                        `, values),

                    client.query(`
                        SELECT *
                        FROM (
                            SELECT 
                                COUNT(*) AS total_count_bags,
                                s.country
                            FROM laundrybags l
                            JOIN laundryreport lr ON lr.bag_id = l.id
                            JOIN soldier s ON lr.soldier_id = s.id
                            WHERE lr.date_drop_off BETWEEN $1 AND $2 AND l.camp_id = $3
                            GROUP BY s.country
                        ) sub
                        ${whereClauseDate}
                        LIMIT $${limitIndexDate} OFFSET $${offsetIndexDate};`, valuesDate),

                    client.query(`
                        SELECT COUNT(*) AS count
                        FROM (
                            SELECT 
                            l.code,
                            l.type,
                            CASE

                                WHEN lr.date_ready_to_pick_up IS NOT NULL 
                                    AND lr.date_drop_off = lr.date_ready_to_pick_up 
                                THEN 'Picked up'

                                WHEN EXISTS (
                                    SELECT 1
                                    FROM laundryreport lr2
                                    JOIN laundrybags l2 ON l2.id = lr2.bag_id
                                    WHERE l2.code = l.code
                                        AND lr2.date_drop_off > lr.date_drop_off
                                        AND (l2.status = 'Picked up' OR l2.status = 'None')
                                    ) THEN 'Picked up'
                                WHEN l.status = 'None' THEN 'Picked up'
                                ELSE l.status
                            END AS status,

                            s.namesoldier,
                            s.country,
                            TO_CHAR(lr.date_drop_off, 'YYYY-MM-DD HH24:MI') AS date_drop_off,
                            CASE
                                WHEN l.status = 'None' AND lr.date_ready_to_pick_up IS NULL THEN 'Remove by user'
                                ELSE TO_CHAR(lr.date_ready_to_pick_up, 'YYYY-MM-DD HH24:MI')
                            END AS date_ready_to_pick_up

                            FROM laundrybags l
                            JOIN laundryreport lr ON lr.bag_id = l.id
                            JOIN soldier s ON lr.soldier_id = s.id
                            WHERE lr.date_drop_off BETWEEN $1 AND $2 AND l.camp_id = $3
                            ORDER BY l.code, lr.date_drop_off
                        ) sub
                        ${countWhereClause};`, countValues),

                    client.query(`
                        SELECT COUNT(*) AS count
                        FROM (
                            SELECT 
                                COUNT(*) AS total_count_bags,
                                s.country
                            FROM laundrybags l
                            JOIN laundryreport lr ON lr.bag_id = l.id
                            JOIN soldier s ON lr.soldier_id = s.id
                            WHERE lr.date_drop_off BETWEEN $1 AND $2 AND l.camp_id = $3
                            GROUP BY s.country
                        ) sub
                        ${countWhereClauseDate};`, countValuesDate),

                ]);

                const totalData = parseInt(countResult.rows[0].count, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                const totalDataDate = parseInt(countResultNational.rows[0].count, 10);
                const totalPagesDate = Math.ceil(totalDataDate / limit) || 1;

                await client.query('COMMIT');
                res.status(200).json({
                    data: result.rows,
                    data_nationality: result_nationality.rows,
                    totalPages: totalPages,
                    totalPagesNational: totalPagesDate
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error to fetch report: ", error);
                res.status(500).json({ message: "Error to fetch report" });

            } finally {
                client.release();
            }
        });

        this.app.post('/laundry/report', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaLaundryReport.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid input data.' });
            }

            let { selectedDate1, selectedDate2, filtersBags, filtersNationalBags } = req.body;

            selectedDate1 += " 00:00";
            selectedDate2 += " 23:59";

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

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

                let values = [selectedDate1, selectedDate2, req.session.camp];
                let valuesNational = [selectedDate1, selectedDate2, req.session.camp];

                const whereClause = filtersBags.length > 0
                    ? 'WHERE ' + filtersBags.map((filter, index) => {
                        const column = filter.column;
                        values.push(`%${filter.value}%`);
                        return `${column}::TEXT ILIKE $${index + 4}`;
                    }).join(' AND ')
                    : '';

                const whereClauseNational = filtersNationalBags.length > 0
                    ? 'WHERE ' + filtersNationalBags.map((filter, index) => {
                        const column = filter.column;
                        valuesNational.push(`%${filter.value}%`);
                        return `${column}::TEXT ILIKE $${index + 4}`;
                    }).join(' AND ')
                    : '';

                const [result, result_national] = await Promise.all([

                    client.query(`
                        SELECT *
                        FROM (
                            SELECT 
                            l.code,
                            l.type,
                            CASE

                                WHEN lr.date_ready_to_pick_up IS NOT NULL 
                                    AND lr.date_drop_off = lr.date_ready_to_pick_up 
                                THEN 'Picked up'

                                WHEN EXISTS (
                                SELECT 1
                                FROM laundryreport lr2
                                JOIN laundrybags l2 ON l2.id = lr2.bag_id
                                WHERE l2.code = l.code
                                    AND lr2.date_drop_off > lr.date_drop_off
                                    AND (l2.status = 'Picked up' OR l2.status = 'None')
                                ) THEN 'Picked up'

                                WHEN l.status = 'None' THEN 'Picked up'
                                ELSE l.status
                            END AS status,

                            s.namesoldier,
                            s.country,
                            TO_CHAR(lr.date_drop_off, 'YYYY-MM-DD HH24:MI') AS date_drop_off,

                            CASE
                                WHEN l.status = 'None' AND lr.date_ready_to_pick_up IS NULL THEN 'Remove by user'
                                ELSE TO_CHAR(lr.date_ready_to_pick_up, 'YYYY-MM-DD HH24:MI')
                            END AS date_ready_to_pick_up

                            FROM laundrybags l
                            JOIN laundryreport lr ON lr.bag_id = l.id
                            JOIN soldier s ON lr.soldier_id = s.id
                            WHERE lr.date_drop_off BETWEEN $1 AND $2 AND l.camp_id = $3
                            ORDER BY l.code, lr.date_drop_off
                        ) sub
                        ${whereClause};`, values),

                    client.query(`
                        SELECT *
                        FROM (
                            SELECT 
                                COUNT(*) AS total_count_bags,
                                s.country
                            FROM laundrybags l
                            JOIN laundryreport lr ON lr.bag_id = l.id
                            JOIN soldier s ON lr.soldier_id = s.id
                            WHERE lr.date_drop_off BETWEEN $1 AND $2 AND l.camp_id = $3
                            GROUP BY s.country
                        ) sub
                        ${whereClauseNational};`, valuesNational)
                ]);

                const filteredLaundry = result.rows;
                const filteredLaundryNational = result_national.rows;

                await Promise.all(filteredLaundry.map(async ({ code, namesoldier, country, type, status, date_drop_off, date_ready_to_pick_up }, index) => {
                    const row = worksheet1.addRow([code, namesoldier, country, type, status, date_drop_off, date_ready_to_pick_up || 'No departure date']);
                    row.eachCell((cell) => {
                        cell.alignment = { horizontal: 'center' };
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

                    if (date_drop_off === date_ready_to_pick_up) {
                        row.eachCell((cell) => {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFFFF00' } // Yellow color
                            };
                        });
                    }
                }));

                await Promise.all(filteredLaundryNational.map(async ({ total_count_bags, country }, index) => {
                    const row = worksheet2.addRow([total_count_bags, country]);
                    row.eachCell((cell) => {
                        cell.alignment = { horizontal: 'center' };
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

                await client.query('COMMIT');

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="report_laundry.xlsx"');

                await workbook.xlsx.write(res);
                res.end();

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error to generate report:", error);
                res.status(500).json({ message: 'Failed to generate the report.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/laundry/addBag', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddBag.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            if (!req.session.camp && !req.body.campId)
                return res.status(400).json({ message: "You not select camp. First select camp then add clean item?!" });

            const { epc, code, type, maxcount } = req.body;
            const campId = !req.body.isValidCode && req.session.username ? req.session.camp : req.body.campId;
            const username = req.session.username ? req.session.username : req.body.username;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'List of bags')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to operated with bags data!" });
                }

                const check_exist_epc = await client.query(`SELECT * FROM laundrybags WHERE id = $1;`, [epc]);
                const check_exist_code = await client.query(`SELECT * FROM laundrybags WHERE code = $1 AND camp_id = $2;`, [code, campId]);

                if (check_exist_epc.rows.length > 0 || check_exist_code.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This bag already exists!' });
                }

                await client.query(`INSERT INTO laundrybags(id, code, type, status, timein, timeout, maxcountlandry, soldier_id, camp_id) VALUES ($1, $2, $3, 'None', NULL, NULL, $4, NULL, $5);`,
                    [epc, code, type, maxcount, campId]
                );

                // Query the database for the user
                await Promise.all([
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [username, `Add bag with code ${code}`])
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Bag added successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error add bag', error);
                res.status(500).json({ message: 'Failed to add bag.' });

            } finally {
                client.release();
            }
        });

        this.app.delete('/laundry/deleteBag', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveBag.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { code } = req.body;

            const client = await pool.connect();
            const username = req.session.username ? req.session.username : req.body.username;

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'List of bags')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to operated with bags data!" });
                }

                const result = await client.query(`SELECT code FROM laundrybags WHERE id = $1;`, [code]);
                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This bag does not exist. It has probably been modified." });
                }

                const bagCode = result.rows[0].code;

                const check_exist = await client.query(`
                    SELECT s.* FROM soldier s
					LEFT JOIN additionalitem ai ON ai.soldier_id = s.id
                    LEFT JOIN laundrybags l ON l.id = s.laundry_bag_id OR ai.bag_id = l.id
                    WHERE (s.date_accommodation IS NULL OR (s.date_accommodation IS NOT NULL AND date_free IS NULL)) AND l.id = $1`, [code]);

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This bag is set to the soldier!' });
                }

                await Promise.all([
                    client.query(`UPDATE soldier SET laundry_bag_id = NULL WHERE laundry_bag_id = $1;`, [code]),
                    client.query(`DELETE FROM laundryreport WHERE bag_id = $1`, [code]),
                    client.query(`DELETE FROM laundrybags WHERE id = $1`, [code]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [username, `Remove bag with code ${bagCode}`])
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The bag was successfully removed' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error delete bag', error);
                res.status(500).json({ message: 'Failed to delete bag' });

            } finally {
                client.release();
            }
        });

        this.app.put('/laundry/editBag', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditBag.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { bagId, bagType, maxWash } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'List of bags')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to operated with bags data!" });
                }

                const result = await client.query(`SELECT code FROM laundrybags WHERE id = $1;`, [bagId]);
                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This bag does not exist. It has probably been modified." });
                }

                const bagCode = result.rows[0].code;

                await Promise.all([
                    client.query(`UPDATE laundrybags SET type = $1, maxcountlandry = $2 WHERE id = $3;`, [bagType, maxWash, bagId]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Edit bag with code ${bagCode} set type ${bagType} and max washed ${maxWash}`])
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The bag was successfully updated' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error updating bag:', error);
                res.status(500).json({ message: 'Failed to update bag.' });

            } finally {
                client.release();
            }
        });

        this.app.put('/laundry/editPhoneBag', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditPhoneBag.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { oldCode, newCode, code, type, maxcount, campId } = req.body;

            const client = await pool.connect();
            const username = req.session.username ? req.session.username : req.body.username;

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'List of bags')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to operated with bags data!" });
                }

                const check_exist_new_epc = await client.query(`SELECT * FROM laundrybags WHERE id = $1;`, [newCode]);
                const check_exist_code = await client.query(`SELECT * FROM laundrybags WHERE code = $1 AND camp_id = $2;`, [code, campId]);
                const check_exist_old_epc = await client.query(`SELECT * FROM laundrybags WHERE id = $1;`, [oldCode]);

                if (check_exist_old_epc.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "The old bag does not exist. It has probably been modified." });
                }

                if ((oldCode !== newCode && check_exist_new_epc.rows.length > 0)
                    || (check_exist_old_epc.rows[0].code !== code && check_exist_code.rows.length > 0)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This bag already exists and you cannot edit old bag with him!' });
                }

                if (oldCode === newCode) {
                    await client.query(`UPDATE laundrybags SET code = $1, type = $2, maxcountlandry = $3 WHERE id = $4;`, [code, type, maxcount, oldCode]);

                    // Query the database for the user
                    await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [username, `Edit bag with code ${oldCode} set code ${code}, type ${type} and max washed ${maxcount}`]);
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
                    await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [username, `Replace bag with code ${oldCode} to new code ${newCode}, type=${type}, max washed=${maxcount}`]);
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'The bag was successfully edit' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error edit bag', error);
                res.status(500).json({ message: 'Failed to edit bag.' });

            } finally {
                client.release();
            }
        });
    }

    defineRoutesAssets() {

        // Serve APK file from local directory
        this.app.get('/download-apk-asset', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();
            const username = req.session.username ? req.session.username : req.body.username;

            try {
                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Download asset app')`, [username]);

                if (checkPermission.rows.length === 0)
                    return res.status(400).json({ message: "You don't have permission to download app for assets!" });

            } catch (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error downloading the file:', err);
                return res.status(500).json({ message: 'Error downloading the file' });

            } finally {
                client.release();
            }

            // Path to your APK file
            const apkFilePath = path.join(__dirname, 'androidApp', 'RFIDLaundryAsset-1.4-release.apk');

            // Check legality and existence of the APK file
            if (!this.checkApkFileLegality(apkFilePath, res)) {
                return res.status(400).json({ message: 'There is a problem with existence and legality of APK file' });
            }

            // Set proper headers for an APK file
            res.setHeader('Content-Type', 'application/vnd.android.package-archive'); // Correct MIME type for APK
            res.setHeader('Content-Disposition', 'attachment; filename="RFIDLaundryAsset-1.4-release.apk"'); // Force download with custom filename

            // Use res.download() to send the file to the client
            res.download(apkFilePath, (err) => {
                if (err) {
                    console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                    console.error('Error downloading the file:', err);
                    res.status(500).json({ message: 'Error downloading the file' });
                }
            });
        });

        this.app.get('/apk-asset-version', this.isLoggedIn.bind(this), (req, res) => {
            res.json({ version: "1.4", apkUrl: "/download-apk-asset" });
        });

        this.app.get('/allAssets', this.isLoggedIn.bind(this), async (req, res) => {
            const { error, value } = shemaGetLostItem.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const client = await pool.connect();

            const camp_id = req.session?.username ? req.session.camp : value.campId;

            let { page, limit, searchColumn, searchValue } = value;

            try {

                await client.query('BEGIN');

                if (value.isValidCode) {

                    const resultAllAssets = await client.query('SELECT * FROM assets WHERE camp_id = $1', [camp_id]);

                    const allAssets = resultAllAssets.rows.map(row => ({
                        id: row.id, code: row.code, name_assets: row.name_assets, type_id: row.type_id,
                        location_id: row.location_room, sub_location_id: row.location_key, categorie: row.categorie, quantity: row.quantity,
                        mrah: row.mrah, owner: row.asset_owner, status: row.status, expandable: row.expandable,
                        description: row.description, service: row.service, m2_inside: row.m2_inside, is_fixed: row.is_fixed,
                        date_purchase: row.date_purchase, date_written_off: row.date_written_off, purchase_price: row.purchase_price, comments: row.comments,
                        replaced_off: row.replaced_off, year_of_life_cycle: row.year_of_life_cycle, rest_of_life_cycle: row.rest_of_life_cycle, replaced_by: row.replaced_by,
                        rest_value: row.rest_value
                    }));

                    await client.query('COMMIT');

                    return res.status(200).json({
                        allAssets
                    });
                }

                const offset = (page - 1) * limit;
                let whereClause = 'WHERE l.camp_id = $1';
                let values = [camp_id];

                let countValues = [camp_id];
                let countWhereClause = 'WHERE l.camp_id = $1';

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [resultKeys, resultAllLostItem, countResult] = await Promise.all([
                    client.query(`
                        SELECT id AS id, code AS name, quantity FROM assets WHERE camp_id = $1;`, [camp_id]),
                    client.query(`
                        SELECT nameitem, description, lost_quantity 
                        FROM lostitem l
                        ${whereClause} LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),
                    client.query(`
                        SELECT COUNT(*) AS count FROM lostitem l
                        ${whereClause};`, countValues),
                ]);

                // Process data
                const assets = resultKeys.rows.map(row => ({
                    id: row.id,
                    code: row.name,
                    quantity: row.quantity
                }));

                const allLostItems = resultAllLostItem.rows.map(row => ({
                    nameItem: row.nameitem,
                    description: row.description,
                    lostQuantity: row.lost_quantity
                }));

                const totalData = parseInt(countResult.rows[0].count, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                // Commit transaction (optional here)
                await client.query('COMMIT');

                // Send response
                res.status(200).json({
                    assets,
                    allLostItems,
                    totalLostItems: totalPages
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error fetching assets:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/getAllAssets', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            try {
                const result = await client.query(`
                    SELECT * FROM assets WHERE camp_id = $1`, [req.session.camp]);

                res.status(200).json(result.rows);

            } catch (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error fetching all assets:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/asset/keys', this.isLoggedIn.bind(this), async (req, res) => {

            const { error, value } = shemaGetBags.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const client = await pool.connect();

            try {

                await client.query('BEGIN');
                const camp_id = req.session.username ? req.session.camp : value.campId;

                const result = await client.query(`
                        SELECT k.id, k.namekey, r.nameroom, r.id AS roomid, camp_id
                        FROM rooms r
                        LEFT JOIN roomskey rk ON rk.roomid = r.id
                        LEFT JOIN key k ON rk.keyid = k.id
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
                return res.status(200).json(total_res);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error get asset key:', error);
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
                return res.status(200).json(total_res);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error get all keys:', error);
                res.status(500).json({ message: 'An error occurred while processing the data.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/assets', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAssets.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { numBuild, isFirstTime = "true", limit = 50, offset = 0, sortedColumn, sortedDirection, searchColumn, searchValue } = req.query;

            const client = await pool.connect();

            let navBuild = [];
            let inventory = [];
            let totalCount;
            let index = [];
            let userPerm = [];

            try {

                await client.query('BEGIN');

                const baseValues = numBuild ? [numBuild, req.session.camp] : [req.session.camp];
                const values = [...baseValues];
                const countValues = [...baseValues];

                let whereClause = numBuild ? 'WHERE br.buildid = $1 AND b.camp_id = $2' : 'WHERE b.camp_id = $1';
                let countWhereClause = numBuild ? 'WHERE br.buildid = $1 AND b.camp_id = $2' : 'WHERE b.camp_id = $1';
                let orderData = sortedDirection && sortedColumn ? `ORDER BY ${sortedColumn} ${sortedDirection}` : 'ORDER BY nameroom';
                let havingClause = '';

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    let regularFilters = [];
                    let havingFilters = [];

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        const paramValue = `%${value}%`;

                        if (column === "count_assets") {
                            havingFilters.push({ clause: `COALESCE(SUM(a.quantity::NUMERIC), 0)::TEXT ILIKE $${values.length + 1}`, value: paramValue });
                        } else {
                            values.push(paramValue);
                            countValues.push(paramValue);

                            const paramIndex = values.length;
                            const countParamIndex = countValues.length;

                            regularFilters.push({ clause: `${column}::TEXT ILIKE $${paramIndex}`, countClause: `${column}::TEXT ILIKE $${countParamIndex}` });
                        }
                    }

                    // Append regular filters to WHERE
                    if (regularFilters.length > 0) {
                        whereClause += " AND (" + regularFilters.map(f => f.clause).join(" AND ") + ")";
                        countWhereClause += " AND (" + regularFilters.map(f => f.countClause).join(" AND ") + ")";
                    }

                    // Append having filters
                    if (havingFilters.length > 0) {
                        havingClause = " HAVING " + havingFilters.map(f => f.clause).join(" AND ");
                        havingFilters.forEach(f => values.push(f.value));
                        havingFilters.forEach(f => countValues.push(f.value));
                    }
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [result_get_room, countResult, get_permission] = await Promise.all([
                    client.query(`
                            SELECT r.id, nameroom, COALESCE(SUM(a.quantity::NUMERIC), 0) AS count_assets
                            FROM rooms r
                            LEFT JOIN assets a ON r.id = a.location_room
                            LEFT JOIN buildroom br ON br.roomid = r.id 
                            LEFT JOIN buildings b ON b.id = br.buildid
                            ${whereClause}
                            GROUP BY nameroom, r.id
                            ${havingClause}
                            ${orderData}
                            LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),

                    client.query(`
                            SELECT COUNT(*) AS count
                            FROM rooms r
                            LEFT JOIN assets a ON r.id = a.location_room
                            LEFT JOIN buildroom br ON br.roomid = r.id 
                            LEFT JOIN buildings b ON b.id = br.buildid
                            ${countWhereClause}
                            GROUP BY nameroom, r.id
                            ${havingClause};`, countValues),

                    client.query(`
                        SELECT permission_name FROM permission p
                        JOIN user_permission up ON up.perm_id = p.id AND up.user_id = $1;`, [req.session.userId])

                ]);

                totalCount = countResult.rows.length;

                inventory = result_get_room.rows.map(row => ({
                    id: row.id,
                    name: row.nameroom,
                    quantity: row.count_assets
                }));

                userPerm = get_permission.rows;

                const hasFullPermission = userPerm.some(p => p.permission_name === 'Full permission');
                const isAdmin = req.session.username === 'admin';

                if (hasFullPermission && isAdmin) {
                    index = [0, 1, 2, 3, 4, 5, 6];
                } else if (hasFullPermission) {
                    index = [0, 1, 2, 4, 5, 6];
                } else {
                    index = [0, 6];

                    if (userPerm.some(p => p.permission_name === 'Assets')) index.push(1);
                    if (userPerm.some(p => p.permission_name === 'Laundry')) index.push(2);
                    if (userPerm.some(p => p.permission_name === 'Gym')) index.push(3);
                    if (userPerm.some(p => p.permission_name === 'Accommodation and keys')) index.push(4);
                    if (userPerm.some(p => p.permission_name === 'Bicycles')) index.push(5);
                }

                index.sort();

                const resultBuild = await client.query(`SELECT id, namebuilding FROM buildings WHERE camp_id = $1 ORDER BY namebuilding;`, [req.session.camp]);

                navBuild = resultBuild.rows.map(row => ({
                    name: row.namebuilding,
                    id: row.id
                }));

                await client.query('COMMIT');

                if (isFirstTime === "true") {
                    this.giveSpecificPermissionAssets(userPerm, index, res, inventory, navBuild, numBuild, totalCount);

                } else
                    res.status(200).json({ inventory, totalCount });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error when start asset: ', error);
                res.status(500).json({ message: 'Failed to open asset.' });
            } finally {
                client.release();
            }

        });

        this.app.get('/assets/getSortedAssets', this.isLoggedIn.bind(this), async (req, res) => {

            const { error, value } = schemaSpecialAssets.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { numRoom, page = 1, limit = 10, sortedDirection, sortedColumn, searchColumn, searchValue } = req.query;

            const client = await pool.connect();
            const campId = req.session?.username ? req.session.camp : value.campId;

            let nameAssetSetCount = [];

            try {

                await client.query('BEGIN');

                const offset = (page - 1) * limit;
                let whereClause = 'WHERE location_room = $1';
                let values = [numRoom];

                let countValues = [numRoom];
                let countWhereClause = 'WHERE location_room = $1';

                let orderData = sortedDirection && sortedColumn ? `ORDER BY ${sortedColumn} ${sortedDirection}` : '';

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                if (numRoom) {
                    const filterData = [];
                    const [result_data, result_get_filter_room, countResult] = await Promise.all([
                        client.query(`
                            SELECT a.id, code, name_assets, t.type_name, 
                                r.nameroom, k.id AS keyid, k.namekey, categorie, 
                                quantity, mrah, asset_owner, status, 
                                expandable, description, a.inventory_status, a.service, 
                                a.m2_inside, a.is_fixed, a.date_purchase, a.date_written_off, 
                                a.purchase_price, a.comments, a.replaced_off, a.year_of_life_cycle,
                                a.rest_of_life_cycle, a.replaced_by, a.rest_value
                            FROM assets a
                            LEFT JOIN assetstype t ON t.id = a.type_id
                            LEFT JOIN rooms r ON r.id = a.location_room
                            LEFT JOIN key k ON k.id = a.location_key
                            WHERE location_room = $1;`, [numRoom]),
                        client.query(`
                            SELECT a.id, code, name_assets, t.type_name, 
                                r.nameroom, k.id AS keyid, k.namekey, categorie, 
                                quantity, mrah, asset_owner, status, 
                                expandable, description, a.inventory_status, a.service, 
                                a.m2_inside, a.is_fixed, a.date_purchase, a.date_written_off, 
                                a.purchase_price, a.comments, a.replaced_off, a.year_of_life_cycle,
                                a.rest_of_life_cycle, a.replaced_by, a.rest_value
                            FROM assets a
                            LEFT JOIN assetstype t ON t.id = a.type_id
                            LEFT JOIN rooms r ON r.id = a.location_room
                            LEFT JOIN key k ON k.id = a.location_key
                            ${whereClause} 
                            ${orderData}
                            LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),

                        client.query(`
                            SELECT COUNT(*)
                            FROM assets a
                            LEFT JOIN assetstype t ON t.id = a.type_id
                            LEFT JOIN rooms r ON r.id = a.location_room
                            LEFT JOIN key k ON k.id = a.location_key
                            ${countWhereClause};`, countValues)
                    ]);

                    result_data.rows.forEach(row => {
                        nameAssetSetCount.push({
                            id: row.id, code: row.code, name_assets: row.name_assets, type_name: row.type_name,
                            nameroom: row.nameroom, keyid: row.keyid, namekey: row.namekey ? row.namekey : 'There is no associated key', categorie: row.categorie,
                            quantity: row.quantity, mrah: row.mrah, owner: row.asset_owner, service: row.service,
                            status: row.status, expandable: row.expandable, description: row.description, inventory_status: row.inventory_status,
                            m2_inside: row.m2_inside, is_fixed: row.is_fixed, date_purchase: row.date_purchase, date_written_off: row.date_written_off,
                            purchase_price: row.purchase_price, comments: row.comments, replaced_off: row.replaced_off, year_of_life_cycle: row.year_of_life_cycle,
                            rest_of_life_cycle: row.rest_of_life_cycle, replaced_by: row.replaced_by, rest_value: row.rest_value
                        });
                    });

                    result_get_filter_room.rows.forEach(row => {
                        filterData.push({
                            id: row.id, code: row.code, name: row.name_assets, type: row.type_name,
                            location: row.nameroom, keyid: row.keyid, namekey: row.namekey ? row.namekey : 'There is no associated key', categorie: row.categorie,
                            quantity: row.quantity, mrah: row.mrah, owner: row.asset_owner, service: row.service,
                            status: row.status, expandable: row.expandable, description: row.description, inventory_status: row.inventory_status,
                            m2_inside: row.m2_inside, is_fixed: row.is_fixed, date_purchase: row.date_purchase, date_written_off: row.date_written_off,
                            purchase_price: row.purchase_price, comments: row.comments, replaced_off: row.replaced_off, year_of_life_cycle: row.year_of_life_cycle,
                            rest_of_life_cycle: row.rest_of_life_cycle, replaced_by: row.replaced_by, rest_value: row.rest_value
                        });
                    });

                    const totalData = parseInt(countResult.rows[0].count, 10);
                    const totalPages = Math.ceil(totalData / limit) || 1;

                    await client.query('COMMIT');
                    value.isValidCode ?
                        res.status(200).json(nameAssetSetCount) :
                        res.status(200).json({ data: nameAssetSetCount, filterData, totalPages });
                } else {
                    const result_get_room = await client.query(`
                        SELECT a.id, code, name_assets, t.type_name, 
                            r.nameroom, k.id AS keyid, k.namekey, categorie, 
                            quantity, mrah, asset_owner, status, 
                            expandable, description, a.inventory_status, a.service, 
                            a.m2_inside, a.is_fixed, a.date_purchase, a.date_written_off, 
                            a.purchase_price, a.comments, a.replaced_off, a.year_of_life_cycle,
                            a.rest_of_life_cycle, a.replaced_by, a.rest_value
                        FROM assets a
                        LEFT JOIN assetstype t ON t.id = a.type_id
                        LEFT JOIN rooms r ON r.id = a.location_room
                        LEFT JOIN key k ON k.id = a.location_key
                        WHERE a.camp_id = $1;`, [campId]);

                    result_get_room.rows.forEach(row => {
                        nameAssetSetCount.push({
                            id: row.id, code: row.code, name_assets: row.name_assets, type_name: row.type_name,
                            nameroom: row.nameroom, keyid: row.keyid, namekey: row.namekey ? row.namekey : 'There is no associated key', categorie: row.categorie,
                            quantity: row.quantity, mrah: row.mrah, owner: row.asset_owner, service: row.service,
                            status: row.status, expandable: row.expandable, description: row.description, inventory_status: row.inventory_status,
                            m2_inside: row.m2_inside, is_fixed: row.is_fixed, date_purchase: row.date_purchase, date_written_off: row.date_written_off,
                            purchase_price: row.purchase_price, comments: row.comments, replaced_off: row.replaced_off, year_of_life_cycle: row.year_of_life_cycle,
                            rest_of_life_cycle: row.rest_of_life_cycle, replaced_by: row.replaced_by, rest_value: row.rest_value
                        });
                    });

                    await client.query('COMMIT');
                    res.status(200).json(nameAssetSetCount);
                }

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get sorted asset:', error);
                res.status(500).json({ message: 'Failed to get sorted asset.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/getInventoryLocation', this.isLoggedIn.bind(this), async (req, res) => {
            const { error, value } = shemaGetBags.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                   SELECT r.id, nameroom FROM rooms r
                    LEFT JOIN buildroom br ON br.roomid = r.id
                    LEFT JOIN buildings b ON b.id = br.buildid
                    WHERE b.camp_id = $1
                    ORDER BY r.nameroom;`, [value.campId]);

                const result_sublocation = await client.query(`
                    SELECT k.id, namekey, rk.roomid FROM key k
                    LEFT JOIN roomskey rk ON rk.keyid = k.id
                    LEFT JOIN buildroom br ON br.roomid = rk.roomid
                    LEFT JOIN buildings b ON b.id = br.buildid
					WHERE b.camp_id = $1 
                    AND k.id NOT IN (SELECT location_key FROM assets WHERE location_key IS NOT NULL)
                    ORDER BY k.namekey;`, [value.campId]);

                const locations = result.rows.map(row => ({
                    id: row.id,
                    nameroom: row.nameroom
                }));

                const sublocations = result_sublocation.rows.map(row => ({
                    id: row.id,
                    namekey: row.namekey,
                    roomid: row.roomid
                }));

                await client.query('COMMIT');
                res.status(200).json({
                    locations,
                    sublocations
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to get location.' });
            } finally {
                client.release();
            }
        });

        this.app.get('/assets/getAllType', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = shemaGetBags.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to get all asset type:', error);
                res.status(500).json({ message: 'Failed to get types.' });

            } finally {
                client.release();
            }
        });

        this.app.patch('/assets/editAsset', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditAsset.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const {
                assetId, assetName, assetType, assetLocation,
                assetSubLocation, assetCategory, assetQuantity, assetMrah,
                assetOwner, assetService, assetStatus, assetExpandable,
                assetDescription, assetM2Inside, assetIsFixed, assetDatePurchase,
                assetDateWrittenOff, assetPurchasePrice, assetComments, assetReplacedOff,
                assetYearOfLifeCycle, assetRestOfLifeCycle, assetReplacedBy, assetRestValue
            } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const [check_exist_asset, check_exist_location, checkPermission] = await Promise.all([
                    client.query(`SELECT * FROM assets WHERE id = $1`, [assetId]),
                    client.query(`SELECT * FROM rooms WHERE id = $1`, [assetLocation]),
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Edit singel asset')`, [req.session.userId])
                ]);

                if (check_exist_asset.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This asset does not exist. It has probably been modified." });
                }

                if (check_exist_location.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This room does not exist. It has probably been modified." });
                }

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to edit asset!" });
                }

                const result_asset_quantity = await client.query(`SELECT quantity FROM assets WHERE id = $1;`, [assetId]);
                const asset_quantity = Number(result_asset_quantity.rows[0].quantity);

                if (assetSubLocation !== '') {

                    const check_exist_sub_location = await client.query(`SELECT * FROM key WHERE id = $1`, [assetSubLocation]);
                    if (check_exist_sub_location.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: "This key does not exist. It has probably been modified." });
                    }

                    await client.query(`UPDATE assets SET 
                        name_assets = $2, type_id = $3, location_room = $4, location_key = $5, 
                        categorie = $6, quantity = $7, mrah = $8, asset_owner = $9,
                        status = $10,expandable = $11,description = $12,service = $13,
                        m2_inside = $14, is_fixed = $15, date_purchase = $16, date_written_off = $17,
                        purchase_price = $18, comments = $19, replaced_off = $20, year_of_life_cycle = $21,
                        rest_of_life_cycle = $22, replaced_by = $23, rest_value = $24
                        WHERE id = $1`,
                        [
                            assetId, assetName, assetType, assetLocation,
                            assetSubLocation, assetCategory || null, assetQuantity || null, assetMrah || null,
                            assetOwner || null, assetStatus || null, assetExpandable || null, assetDescription || null,
                            assetService || null, assetM2Inside || null, assetIsFixed, assetDatePurchase || null,
                            assetDateWrittenOff || null, assetPurchasePrice || null, assetComments || null, assetReplacedOff || null,
                            assetYearOfLifeCycle || null, assetRestOfLifeCycle || null, assetReplacedBy || null, assetRestValue || null
                        ]
                    );
                } else {
                    await client.query(`UPDATE assets SET 
                        name_assets = $2, type_id = $3, location_room = $4, location_key = NULL,
                        categorie = $5, quantity = $6, mrah = $7, asset_owner = $8,
                        status = $9, expandable = $10, description = $11, service = $12,
                        m2_inside = $13, is_fixed = $14, date_purchase = $15, date_written_off = $16,
                        purchase_price = $17, comments = $18, replaced_off = $19, year_of_life_cycle = $20,
                        rest_of_life_cycle = $21, replaced_by = $22, rest_value = $23
                        WHERE id = $1`,
                        [
                            assetId, assetName, assetType, assetLocation,
                            assetCategory || null, assetQuantity || null, assetMrah || null, assetOwner || null,
                            assetStatus || null, assetExpandable || null, assetDescription || null, assetService || null,
                            assetM2Inside || null, assetIsFixed, assetDatePurchase || null, assetDateWrittenOff || null,
                            assetPurchasePrice || null, assetComments || null, assetReplacedOff || null, assetYearOfLifeCycle || null,
                            assetRestOfLifeCycle || null, assetReplacedBy || null, assetRestValue || null
                        ]
                    );
                }

                const result_into = await client.query(`SELECT * FROM assets WHERE id = $1;`, [assetId]);
                const new_quantity = Number(assetQuantity);
                const item_into = result_into.rows[0];

                const result_exist_date = await client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [req.session.camp]);

                const get_exist_lost_item = await client.query(`SELECT * FROM lostitem WHERE item_id = $1;`, [item_into.id]);

                const queries = [];

                if (result_exist_date.rows.length > 0) {
                    if (asset_quantity === new_quantity)
                        queries.push(client.query(`UPDATE asset_actions SET change_modificate_asset_quantity = change_modificate_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [new_quantity, req.session.camp]));

                    else if (asset_quantity > new_quantity) {
                        const lostQuantity = asset_quantity - new_quantity;
                        queries.push(client.query(`UPDATE asset_actions SET change_lost_asset_quantity = change_lost_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [lostQuantity, req.session.camp]));

                        if (get_exist_lost_item.rows.length > 0) {
                            queries.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC + $1 WHERE item_id = $2;`, [lostQuantity, item_into.id]));
                        } else {
                            queries.push(client.query(`INSERT INTO lostitem VALUES (
                            (SELECT COALESCE(MAX(id)::integer, 0) + 1 FROM lostitem), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29);`,
                                [
                                    item_into.code, 'Remove by editing', lostQuantity, item_into.id,
                                    item_into.name_assets, item_into.type_id, item_into.location_room, item_into.location_key,
                                    item_into.categorie, item_into.mrah, item_into.asset_owner, item_into.status,
                                    item_into.expandable, item_into.description, item_into.camp_id, item_into.create_date,
                                    item_into.last_inventory_date, item_into.service, item_into.m2_inside, item_into.is_fixed,
                                    item_into.date_purchase, item_into.date_written_off, item_into.purchase_price, item_into.comments,
                                    item_into.replaced_off, item_into.year_of_life_cycle, item_into.rest_of_life_cycle, item_into.replaced_by,
                                    item_into.rest_value
                                ]));
                        }
                    } else {
                        queries.push(client.query(`UPDATE asset_actions SET change_asset_quantity = change_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [new_quantity - asset_quantity, req.session.camp]));
                        if (get_exist_lost_item.rows.length > 0) {
                            queries.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC - $1 WHERE item_id = $2;`, [new_quantity - asset_quantity, item_into.id]));
                            queries.push(client.query(`DELETE FROM lostitem WHERE lost_quantity::NUMERIC = 0;`));
                        }
                    }

                } else {
                    if (asset_quantity === new_quantity)
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, 0, $1, $2);`, [new_quantity, req.session.camp]));

                    else if (asset_quantity > new_quantity) {
                        const lostQuantity = asset_quantity - new_quantity;
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, $1, 0, $2);`, [lostQuantity, req.session.camp]));

                        if (get_exist_lost_item.rows.length > 0) {
                            queries.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC + $1 WHERE item_id = $2;`, [lostQuantity, item_into.id]));
                        } else {
                            queries.push(client.query(`INSERT INTO lostitem VALUES (
                            (SELECT COALESCE(MAX(id)::integer, 0) + 1 FROM lostitem), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29);`,
                                [
                                    item_into.code, 'Remove by editing', lostQuantity, item_into.id,
                                    item_into.name_assets, item_into.type_id, item_into.location_room, item_into.location_key,
                                    item_into.categorie, item_into.mrah, item_into.asset_owner, item_into.status,
                                    item_into.expandable, item_into.description, item_into.camp_id, item_into.create_date,
                                    item_into.last_inventory_date, item_into.service, item_into.m2_inside, item_into.is_fixed,
                                    item_into.date_purchase, item_into.date_written_off, item_into.purchase_price, item_into.comments,
                                    item_into.replaced_off, item_into.year_of_life_cycle, item_into.rest_of_life_cycle, item_into.replaced_by,
                                    item_into.rest_value
                                ]));
                        }
                    }

                    else {
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, $1, 0, 0, 0, $2);`, [new_quantity - asset_quantity, req.session.camp]));
                        if (get_exist_lost_item.rows.length > 0) {
                            queries.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC - $1 WHERE item_id = $2;`, [new_quantity - asset_quantity, item_into.id]));
                            queries.push(client.query(`DELETE FROM lostitem WHERE lost_quantity::NUMERIC = 0;`));
                        }
                    }
                }

                queries.push(client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Edit asset with code ${assetId} set name ${assetName}, type ${assetType}, location ${assetLocation}, sublocation ${assetSubLocation}, category ${assetCategory}, quantity ${assetQuantity}, mrah ${assetMrah}, owner ${assetOwner}, status ${assetStatus}, expandable ${assetExpandable}, description ${assetDescription}, service ${assetService}, m2_inside ${assetM2Inside}`]));

                await Promise.all(queries);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset was successfully update' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to edit asset: ', error);
                res.status(500).json({ message: 'Failed to edit asset.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/editAssetDevice', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaEditAssetDevice.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const {
                oldCode, newCode, code, name,
                type, location, subLocation, category,
                quantity, mrah, owner, status,
                expandable, service, description, m2Inside,
                isFixed, datePurchase, dateWrittenOff, purchasePrice,
                comments, replacedOff, yearOfLifeCycle, restOfLifeCycle,
                replacedBy, restValue, campId } = req.body;

            const client = await pool.connect();
            const username = req.session.username ? req.session.username : req.body.username;

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Edit singel asset')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to edit asset!" });
                }

                const result_asset_quantity = await client.query(`SELECT * FROM assets WHERE id = $1;`, [oldCode]);
                const result_asset_new_code = await client.query(`SELECT * FROM assets WHERE id = $1;`, [newCode]);
                const result_asset_code = await client.query(`SELECT * FROM assets WHERE code = $1 AND camp_id = $2;`, [code, campId]);
                const check_exist_location = await client.query(`SELECT * FROM rooms WHERE id = $1`, [location]);

                if (result_asset_quantity.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "The old asset epc does not exist. It has probably been modified." });
                }

                if (oldCode !== newCode && result_asset_new_code.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "The new asset epc already exist and cannot be used." });
                }

                if (result_asset_quantity.rows[0].code !== code && result_asset_code.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "The asset code already exist and cannot be used." });
                }

                if (check_exist_location.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "This room does not exist. It has probably been modified." });
                }

                const asset_quantity = Number(result_asset_quantity.rows[0].quantity);
                const new_quantity = Number(quantity);
                const oldCampId = result_asset_quantity.rows[0].camp_id;
                const inventory_status = result_asset_quantity.rows[0].inventory_status;
                const create_date = result_asset_quantity.rows[0].create_date;
                const last_inventory_date = result_asset_quantity.rows[0].last_inventory_date;

                if (oldCode === newCode) {
                    if (subLocation !== '') {

                        const check_exist_sub_location = await client.query(`SELECT * FROM key WHERE id = $1`, [subLocation]);
                        if (check_exist_sub_location.rows.length === 0) {
                            await client.query('ROLLBACK');
                            return res.status(400).json({ message: "This key does not exist. It has probably been modified." });
                        }
                        await client.query(`UPDATE assets SET 
                            code = $2, name_assets = $3, type_id = $4, location_room = $5, 
                            location_key = $6, categorie = $7, quantity = $8,mrah = $9, 
                            asset_owner = $10, status = $11,expandable = $12,description = $13,
                            service = $14, m2_inside = $15, is_fixed = $16, date_purchase = $17,
                            date_written_off = $18, purchase_price = $19, comments = $20, replaced_off = $21,
                            year_of_life_cycle = $22, rest_of_life_cycle = $23, replaced_by = $24, rest_value = $25
                            WHERE id = $1`,
                            [
                                newCode, code, name, type,
                                location, subLocation, category || null, quantity || null,
                                mrah || null, owner || null, status || null, expandable || null,
                                description || null, service || null, m2Inside || null, isFixed,
                                datePurchase || null, dateWrittenOff || null, purchasePrice || null, comments || null,
                                replacedOff || null, yearOfLifeCycle || null, restOfLifeCycle || null, replacedBy || null,
                                restValue || null
                            ]
                        );
                    } else {
                        await client.query(`UPDATE assets SET 
                            code = $2, name_assets = $3, type_id = $4, location_room = $5, 
                            location_key = NULL, categorie = $6,  quantity = $7, mrah = $8, 
                            asset_owner = $9, status = $10,expandable = $11,description = $12,
                            service = $13, m2_inside = $14, is_fixed = $15, date_purchase = $16,
                            date_written_off = $17, purchase_price = $18, comments = $19, replaced_off = $20,
                            year_of_life_cycle = $21, rest_of_life_cycle = $22, replaced_by = $23, rest_value = $24
                            WHERE id = $1`,
                            [
                                newCode, code, name, type,
                                location, category || null, quantity || null, mrah || null,
                                owner || null, status || null, expandable || null, description || null,
                                service || null, m2Inside || null, isFixed, datePurchase || null,
                                dateWrittenOff || null, purchasePrice || null, comments || null, replacedOff || null,
                                yearOfLifeCycle || null, restOfLifeCycle || null, replacedBy || null, restValue || null
                            ]
                        );
                    }

                } else {

                    if (subLocation !== '') {

                        const check_exist_sub_location = await client.query(`SELECT * FROM key WHERE id = $1`, [subLocation]);
                        if (check_exist_sub_location.rows.length === 0) {
                            await client.query('ROLLBACK');
                            return res.status(400).json({ message: "This key does not exist. It has probably been modified." });
                        }

                        await client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29);`,
                            [
                                newCode, code, name, type,
                                location, subLocation, category || null, quantity || null,
                                mrah || null, owner || null, status || null, expandable || null,
                                description || null, oldCampId, inventory_status, create_date,
                                last_inventory_date, service || null, m2Inside || null, isFixed,
                                datePurchase || null, dateWrittenOff || null, purchasePrice || null, comments || null,
                                replacedOff || null, yearOfLifeCycle || null, restOfLifeCycle || null, replacedBy || null,
                                restValue || null
                            ]
                        );

                    } else {
                        await client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28);`,
                            [
                                newCode, code, name, type,
                                location, category || null, quantity || null, mrah || null,
                                owner || null, status || null, expandable || null, description || null,
                                oldCampId, inventory_status, create_date, last_inventory_date,
                                service || null, m2Inside || null, isFixed, datePurchase || null,
                                dateWrittenOff || null, purchasePrice || null, comments || null, replacedOff || null,
                                yearOfLifeCycle || null, restOfLifeCycle || null, replacedBy || null, restValue || null
                            ]
                        );
                    }

                    await client.query(`UPDATE lostitem SET item_id = $1 WHERE item_id = $2`, [newCode, oldCode])

                    await client.query(`DELETE FROM assets WHERE id = $1`,
                        [oldCode]
                    );
                }

                const result_exist_date = await client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [campId]);

                const result_asset = await client.query(`SELECT * FROM assets WHERE id = $1;`, [newCode]);
                const item_into = result_asset

                const get_exist_lost_item = await client.query(`SELECT * FROM lostitem WHERE item_id = $1;`, [item_into.id]);

                const queries = [];

                if (result_exist_date.rows.length > 0) {
                    if (asset_quantity === new_quantity)
                        queries.push(client.query(`UPDATE asset_actions SET change_modificate_asset_quantity = change_modificate_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [new_quantity, campId]));

                    else if (asset_quantity > new_quantity) {
                        const lostQuantity = asset_quantity - new_quantity;
                        queries.push(client.query(`UPDATE asset_actions SET change_lost_asset_quantity = change_lost_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [lostQuantity, campId]));

                        if (get_exist_lost_item.rows.length > 0) {
                            queries.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC + $1 WHERE item_id = $2;`, [lostQuantity, item_into.id]));
                        } else {
                            queries.push(client.query(`INSERT INTO lostitem VALUES (
                            (SELECT COALESCE(MAX(id)::integer, 0) + 1 FROM lostitem), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29);`,
                                [
                                    item_into.code, 'Remove by editing', lostQuantity, item_into.id,
                                    item_into.name_assets, item_into.type_id, item_into.location_room, item_into.location_key,
                                    item_into.categorie, item_into.mrah, item_into.asset_owner, item_into.status,
                                    item_into.expandable, item_into.description, item_into.camp_id, item_into.create_date,
                                    item_into.last_inventory_date, item_into.service, item_into.m2_inside, item_into.is_fixed,
                                    item_into.date_purchase, item_into.date_written_off, item_into.purchase_price, item_into.comments,
                                    item_into.replaced_off, item_into.year_of_life_cycle, item_into.rest_of_life_cycle, item_into.replaced_by,
                                    item_into.rest_value
                                ]));
                        }
                    }

                    else {
                        queries.push(client.query(`UPDATE asset_actions SET change_asset_quantity = change_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [new_quantity - asset_quantity, campId]));
                        if (get_exist_lost_item.rows.length > 0) {
                            queries.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC - $1 WHERE item_id = $2;`, [new_quantity - asset_quantity, item_into.id]));
                            queries.push(client.query(`DELETE FROM lostitem WHERE lost_quantity::NUMERIC = 0;`));
                        }
                    }

                } else {
                    if (asset_quantity === new_quantity)
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, 0, $1, $2);`, [new_quantity, campId]));

                    else if (asset_quantity > new_quantity)
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, $1, 0, $2);`, [asset_quantity - new_quantity, campId]));

                    else {
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, $1, 0, 0, 0, $2);`, [new_quantity - asset_quantity, campId]));
                        if (get_exist_lost_item.rows.length > 0) {
                            queries.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC - $1 WHERE item_id = $2;`, [new_quantity - asset_quantity, item_into.id]));
                            queries.push(client.query(`DELETE FROM lostitem WHERE lost_quantity::NUMERIC = 0;`));
                        }
                    }
                }

                queries.push(client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [username, `Edit asset with code ${oldCode} set code ${newCode}, type=${type}, location=${location}, sublocation=${subLocation}, category=${category}, quantity=${quantity}, mrah=${mrah}, owner=${owner}, status=${status}, expandable=${expandable}, description=${description}, service=${service}, m2_inside=${m2Inside}`]));

                await Promise.all(queries);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset was successfully update' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to edit asset.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/addAsset', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddAsset.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const {
                assetEps, assetCodeSearch, assetAddName, selectedAddTypeId,
                selectedAddLocationId, selectedAddSubLocationId, assetAddCategorie, assetQuantity,
                assetAddMrah, assetAddOwner, assetStatus, assetAddExpandable,
                assetAddService, assetAddDescription, assetAddM2Inside, assetAddIsFixed,
                assetAddDatePurchase, assetAddDateWrittenOff, assetAddPurchasePrice, assetAddComments,
                assetAddReplacedOff, assetAddYearOfLifeCycle, assetAddRestOfLifeCycle, assetAddReplacedBy,
                assetAddRestValue
            } = req.body;

            const client = await pool.connect();
            const campId = !req.body.isValidCode && req.session.username ? req.session.camp : req.body.campId;
            const username = req.session.username ? req.session.username : req.body.username;

            try {
                await client.query('BEGIN');

                const [check_exist_epc, check_exist_code, check_exist_room, checkPermission] = await Promise.all([
                    client.query(`SELECT * FROM assets WHERE id = $1;`, [assetEps]),
                    client.query(`SELECT * FROM assets WHERE code = $1 AND camp_id = $2;`, [assetCodeSearch, campId]),
                    client.query(`SELECT * FROM rooms WHERE id = $1;`, [selectedAddLocationId]),
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add asset')`, [username])
                ]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add asset!" });
                }

                if (check_exist_epc.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This asset already exists with this epc code!' });
                }

                if (check_exist_code.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This asset already exists with this code!' });
                }

                if (check_exist_room.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The room does not exist. It has probably been modified.` });
                }

                const queries = [];

                if (selectedAddSubLocationId !== '') {

                    const check_exist_key = await client.query(`SELECT * FROM key WHERE id = $1;`, [selectedAddSubLocationId])
                    if (check_exist_key.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: `The key does not exist. It has probably been modified.` });
                    }

                    queries.push(client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'undiscovered', CURRENT_TIMESTAMP, NULL, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26);`,
                        [
                            assetEps, assetCodeSearch, assetAddName, selectedAddTypeId,
                            selectedAddLocationId, selectedAddSubLocationId, assetAddCategorie || null, assetQuantity || null,
                            assetAddMrah || null, assetAddOwner || null, assetStatus || null, assetAddExpandable || null,
                            assetAddDescription || null, campId, assetAddService || null, assetAddM2Inside || null,
                            assetAddIsFixed, assetAddDatePurchase || null, assetAddDateWrittenOff || null, assetAddPurchasePrice || null,
                            assetAddComments || null, assetAddReplacedOff || null, assetAddYearOfLifeCycle || null, assetAddRestOfLifeCycle || null,
                            assetAddReplacedBy || null, assetAddRestValue || null
                        ]
                    ));

                } else {
                    queries.push(client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9, $10, $11, $12, $13, 'undiscovered', CURRENT_TIMESTAMP, NULL, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25);`,
                        [
                            assetEps, assetCodeSearch, assetAddName, selectedAddTypeId,
                            selectedAddLocationId, assetAddCategorie || null, assetQuantity || null, assetAddMrah || null,
                            assetAddOwner || null, assetStatus || null, assetAddExpandable || null, assetAddDescription || null,
                            campId, assetAddService || null, assetAddM2Inside || null, assetAddIsFixed,
                            assetAddDatePurchase || null, assetAddDateWrittenOff || null, assetAddPurchasePrice || null, assetAddComments || null,
                            assetAddReplacedOff || null, assetAddYearOfLifeCycle || null, assetAddRestOfLifeCycle || null, assetAddReplacedBy || null,
                            assetAddRestValue || null
                        ]
                    ));
                }

                const result_exist_date = await client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [campId]);
                if (result_exist_date.rows.length > 0) {
                    queries.push(client.query(`UPDATE asset_actions SET change_asset_quantity = change_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [assetQuantity, campId]));

                } else {
                    queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, $1, 0, 0, 0, $2);`, [assetQuantity, campId]));
                }

                queries.push(client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [username, `Add asset with code ${assetEps} and name ${assetAddName}`]));

                await Promise.all(queries);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset was successfully added' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to add asset: ', error);
                res.status(500).json({ message: 'Failed to add asset.' });

            } finally {
                client.release();
            }
        });

        this.app.delete('/assets/deleteAsset', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaDeleteAsets.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { code } = req.body;

            const client = await pool.connect();
            const campId = !req.body.isValidCode && req.session.username ? req.session.camp : req.body.campId;
            const username = req.session.username ? req.session.username : req.body.username;

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Remove asset')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to delete assets!" });
                }

                const checkCodeExist = await client.query(`SELECT * FROM assets WHERE id = $1`, [code]);
                if (checkCodeExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The asset does not exist. It has probably been modified.` });
                }

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

                queries.push(client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [username, `Remove asset with code ${code}`]));

                await Promise.all(queries);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset was successfully removed' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to remove asset: ', error);
                res.status(500).json({ message: 'Failed to remove asset.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/checkDeleteAsset', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaDeleteAsets.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
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
                    return res.status(400).json({ message: `The asset ${result.rows[0].code} is associated with a key that is in use and cannot be deleted.` });
                }

                await client.query('COMMIT');
                res.status(200).json();

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to check asset: ', error);
                res.status(500).json({ message: 'Failed to check asset.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/addTypeAsset', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddAsetsType.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { assetType } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const [check_exist, checkPermission] = await Promise.all([
                    client.query(`SELECT * FROM assetstype WHERE type_name = $1;`, [assetType]),
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Asset type')`, [req.session.userId])
                ]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add asset type!" });
                }

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This type already exists!' });
                }

                const uniqueId = crypto.randomBytes(16).toString('hex');

                await Promise.all([
                    client.query(`INSERT INTO assetstype VALUES ($1, $2);`, [uniqueId, assetType]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Add asset type with name ${assetType}`])
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset type was successfully added' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to add asset type: ', error);
                res.status(500).json({ message: 'Failed to add asset type.' });

            } finally {
                client.release();
            }
        });

        this.app.delete('/assets/removeTypeAsset', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveAsetsType.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { assetTypeId } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const [check_exist, typeData, checkPermission] = await Promise.all([
                    client.query(`SELECT * FROM assets WHERE type_id = $1;`, [assetTypeId]),
                    client.query(`SELECT * FROM assetstype WHERE id = $1;`, [assetTypeId]),
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Asset type')`, [req.session.userId])
                ]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to remove asset type!" });
                }

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This type is associated with an asset and cannot be deleted!' });
                }

                await Promise.all([
                    client.query(`DELETE FROM assetstype WHERE id = $1`, [assetTypeId]),
                    client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Remove asset type with name ${typeData.rows[0].type_name}`])
                ]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset type was successfully removed' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to remove asset type: ', error);
                res.status(500).json({ message: 'Failed to remove asset type.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/lostItem', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaLostItems.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            if (!req.session.camp) {
                return res.status(400).json({ message: "You not select camp. First select camp then add lost item?!" });
            }

            const { itemName, description, lostQuantity } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const [result, get_exist_lost_item, checkPermission] = await Promise.all([
                    client.query(`SELECT * FROM assets WHERE code = $1 AND camp_id = $2;`, [itemName, req.session.camp]),
                    client.query(`SELECT * FROM lostitem WHERE item_id = $1;`, [item_into.id]),
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Lost asset')`, [req.session.userId])
                ]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to set lost asset!" });
                }

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The item does not exist. It has probably been modified.` });
                }

                const item_into = result.rows[0];

                const queries = [];

                if (get_exist_lost_item.rows.length > 0) {
                    queries.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC + $1 WHERE item_id = $2;`, [lostQuantity, item_into.id]));
                } else {
                    queries.push(client.query(`INSERT INTO lostitem VALUES (
                        (SELECT COALESCE(MAX(id)::integer, 0) + 1 FROM lostitem), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29);`,
                        [
                            itemName, description !== '' ? description : null, lostQuantity, item_into.id,
                            item_into.name_assets, item_into.type_id, item_into.location_room, item_into.location_key,
                            item_into.categorie, item_into.mrah, item_into.asset_owner, item_into.status,
                            item_into.expandable, item_into.description, item_into.camp_id, item_into.create_date,
                            item_into.last_inventory_date, item_into.service, item_into.m2_inside, item_into.is_fixed,
                            item_into.date_purchase, item_into.date_written_off, item_into.purchase_price, item_into.comments,
                            item_into.replaced_off, item_into.year_of_life_cycle, item_into.rest_of_life_cycle, item_into.replaced_by,
                            item_into.rest_value
                        ]));
                }

                const asset_quantity = Number(result.rows[0].quantity);
                const lost_quantity = Number(lostQuantity);
                const asset_id = result.rows[0].id;

                const result_exist_date = await client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [req.session.camp]);

                if (result.rows.length > 0) {
                    if (result_exist_date.rows.length > 0) {
                        queries.push(client.query(`UPDATE asset_actions SET change_lost_asset_quantity = change_lost_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [lost_quantity, req.session.camp]));
                    } else {
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, $1, 0, $2);`, [lost_quantity, req.session.camp]));
                    }

                    if (asset_quantity - lost_quantity > 0) {
                        queries.push(client.query(`UPDATE assets SET quantity = quantity::NUMERIC - $1 WHERE id = $2`, [lost_quantity, asset_id]));
                    } else {
                        queries.push(client.query(`DELETE FROM assets WHERE id = $1`, [asset_id]));
                    }

                    queries.push(client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.session.username, `Lost asset with code ${itemName}`]));
                }

                await Promise.all(queries);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Lost item added successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to add lost item: ', error);
                res.status(500).json({ message: 'Failed to add lost item' });

            } finally {
                client.release();
            }

        });

        this.app.post('/assets/restorLostAsset', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = schemaRestorItems.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { code, lost_quantity } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const [check_exist, result_exist_date, result_restor_data, checkPermission] = await Promise.all([
                    client.query(`SELECT * FROM assets WHERE code = $1 AND camp_id = $2;`, [code, req.session.camp]),
                    client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [req.session.camp]),
                    client.query(`SELECT * FROM lostitem WHERE nameitem = $1 AND camp_id = $2;`, [code, req.session.camp]),
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Lost asset')`, [req.session.userId])
                ]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to restor lost asset!" });
                }

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
                        client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'undiscovered', $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)`, [
                            restor_data.item_id, restor_data.nameitem, restor_data.item_name, restor_data.item_type_id,
                            restor_data.item_location_room, restor_data.item_location_key, restor_data.item_category, lost_quantity,
                            restor_data.item_mrah, restor_data.item_owner, restor_data.item_status, restor_data.item_expandable,
                            restor_data.item_description, restor_data.camp_id, restor_data.item_create_date, restor_data.item_last_inventory_date,
                            restor_data.item_service, restor_data.item_m2_inside, restor_data.item_is_fixed, restor_data.item_date_purchase,
                            restor_data.item_date_written_off, restor_data.item_purchase_price, restor_data.item_comments, restor_data.item_replaced_off,
                            restor_data.item_year_of_life_cycle, restor_data.item_rest_of_life_cycle, restor_data.item_replaced_by, restor_data.item_rest_value
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
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error when restor lost asset: ', error);
                res.status(500).json({ message: 'Failed to restore lost item' });

            } finally {
                client.release();
            }
        });

        this.app.get('/assets/viewReport', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = schemaReport.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { selectedDate1, selectedDate2, page = 1, pageDate = 1, limit = 10, searchColumn, searchValue, searchColumnDate, searchValueDate } = req.query;
            const offset = (page - 1) * limit;
            const offsetDate = (pageDate - 1) * limit;

            // Ensure the dates are formatted correctly
            selectedDate1 = moment(selectedDate1).startOf('day').format('YYYY-MM-DD HH:mm:ss');
            selectedDate2 = moment(selectedDate2).endOf('day').format('YYYY-MM-DD HH:mm:ss');

            const client = await pool.connect();

            try {
                await client.query('BEGIN');
                let whereClause = 'WHERE a.camp_id = $1';
                let values = [req.session.camp];

                let countValues = [req.session.camp];
                let countWhereClause = 'WHERE a.camp_id = $1';

                let whereClauseDate = 'WHERE total_assets IS NOT NULL';
                let valuesDate = [selectedDate1, selectedDate2, req.session.camp];

                let countWhereClauseDate = 'WHERE total_assets IS NOT NULL';
                let countValuesDate = [selectedDate1, selectedDate2, req.session.camp];

                // Handle search
                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                if (searchColumnDate && searchValueDate) {

                    if (!Array.isArray(searchColumnDate)) searchColumnDate = [searchColumnDate];
                    if (!Array.isArray(searchValueDate)) searchValueDate = [searchValueDate];

                    if (Array.isArray(searchColumnDate[0])) searchColumnDate = searchColumnDate[0];
                    if (Array.isArray(searchValueDate[0])) searchValueDate = searchValueDate[0];

                    whereClauseDate += " AND (";
                    countWhereClauseDate += " AND (";

                    for (let i = 0; i < searchColumnDate.length; i++) {
                        const column = searchColumnDate[i];
                        const value = searchValueDate[i];

                        valuesDate.push(`%${value}%`);
                        countValuesDate.push(`%${value}%`);

                        const paramIndex = valuesDate.length;
                        const countParamIndex = countValuesDate.length;

                        whereClauseDate += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClauseDate += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumnDate.length - 1) {
                            whereClauseDate += " AND ";
                            countWhereClauseDate += " AND ";
                        }
                    }

                    whereClauseDate += ")";
                    countWhereClauseDate += ")";
                }

                // Add pagination
                valuesDate.push(limit);
                valuesDate.push(offsetDate);
                const limitIndexDate = valuesDate.length - 1;
                const offsetIndexDate = valuesDate.length;

                // Query for asset details
                const [result, result_count_asset, countResult, countResultDate] = await Promise.all([
                    client.query(
                        `SELECT 
                            a.id, code, name_assets, type_name AS type, 
                            b.namebuilding AS location_building, r.nameroom AS location_room, categorie, quantity,
                            mrah, asset_owner, status, expandable,
                            description, create_date, last_inventory_date, service,
                            m2_inside, is_fixed, date_purchase, date_written_off,
                            purchase_price, comments, replaced_off, year_of_life_cycle,
                            rest_of_life_cycle, replaced_by, rest_value
                        FROM assets a
                        LEFT JOIN assetstype at ON a.type_id = at.id
                        LEFT JOIN rooms r ON r.id = a.location_room
                        LEFT JOIN buildroom br ON br.roomid = a.location_room
                        LEFT JOIN buildings b ON b.id = br.buildid
                        ${whereClause} LIMIT $${limitIndex} OFFSET $${offsetIndex}`, values
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
                        ${whereClauseDate}
                        ORDER BY event_date
                        LIMIT $${limitIndexDate} OFFSET $${offsetIndexDate};`, valuesDate
                    ),
                    client.query(`
                        SELECT COUNT(*) AS count 
                        FROM assets a
                        LEFT JOIN assetstype at ON a.type_id = at.id
                        LEFT JOIN rooms r ON r.id = a.location_room
                        LEFT JOIN buildroom br ON br.roomid = a.location_room
                        LEFT JOIN buildings b ON b.id = br.buildid
                        ${countWhereClause}`, countValues
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
                            SELECT COUNT(*) AS count
							FROM (
							    SELECT 
							        event_date
							    FROM cumulative_assets
							    ${countWhereClauseDate}
							    GROUP BY event_date, total_assets, total_updated_assets, total_new_assets, total_removed_assets, total_missing_assets
							) sub;`, countValuesDate)
                ]);

                const totalData = parseInt(countResult.rows[0].count, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                const totalDataDate = parseInt(countResultDate.rows[0].count, 10);
                const totalPagesDate = Math.ceil(totalDataDate / limit) || 1;

                await client.query('COMMIT');
                res.status(200).json({ data: result.rows, data_asset_count: result_count_asset.rows, totalPages, totalPagesDate });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error("Error to fetch report:", error);
                res.status(500).json({ message: "Internal server error when fetch report" });

            } finally {
                client.release();
            }
        });

        this.app.post('/assets/report', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAssetReport.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid input data.' });
            }

            const { selectedDate1, selectedDate2, headers, filtersAssets, filtersAssetsData } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const workbook = new excelJS.Workbook();
                const worksheet1 = workbook.addWorksheet('Assets Data');
                const worksheet2 = workbook.addWorksheet('Assets Traceability');
                const worksheet3 = workbook.addWorksheet('Lost Assets Data');
                const worksheet4 = workbook.addWorksheet('Traceability of cleaning agents');
                const worksheet5 = workbook.addWorksheet('Inventory Sections');

                // Dynamically create headers for worksheet1 (Assets Data) based on the first item of result
                const headers1 = headers.map(header => header.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()));
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

                const headers2 = ['Date', 'Total Assets', 'Total New Assets', 'Total Updated Assets', 'Total Removed Assets', 'Total Missing Assets'];
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

                const headers3 = ['Item Code', 'Item Description', 'Lost Quantity'];
                worksheet3.addRow(headers3).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });
                worksheet3.columns = headers3.map(header => ({ header, width: header.length + 10 }));

                const headers4 = ['Item Name', 'Item Amount', 'Date Change', 'Description'];
                worksheet4.addRow(headers3).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });
                worksheet4.columns = headers4.map(header => ({ header, width: header.length + 25 }));

                let values = [req.session.camp];
                let valuesDate = [selectedDate1, selectedDate2, req.session.camp];

                const headerColumnMap = {
                    'RFID': 'a.id',
                    'Code': 'code',
                    'Name': 'name_assets',
                    'Asset Type': 'type_name',
                    'Building': 'namebuilding',
                    'Room': 'nameroom',
                    'Asset Category': 'categorie',
                    '№ of Items': 'quantity',
                    'MRAH': 'mrah',
                    'Owner': 'asset_owner',
                    'Status': 'status',
                    'Expandable/Non Expandable': 'expandable',
                    'Description': 'description',
                    'Create Date': 'create_date',
                    'Last Inventory Date': 'last_inventory_date',
                    'Service': 'service',
                    'M2 Inside': 'm2_inside',
                    'Fixed': 'is_fixed',
                    'Date Purchase': 'date_purchase',
                    'Date Written Off': 'date_written_off',
                    'Purchase Price': 'purchase_price',
                    'Comments': 'comments',
                    'Replaced Off': 'replaced_off',
                    'Year of Life Cycle': 'year_of_life_cycle',
                    'Rest of Life Cycle': 'rest_of_life_cycle',
                    'Replaced by': 'replaced_by',
                    'Rest Value': 'rest_value'
                };

                const selectedColumns = headers
                    .map(header => headerColumnMap[header])
                    .filter(Boolean)
                    .map(col => `${col}`)
                    .join(', ');

                const whereClause = filtersAssets.length > 0
                    ? 'WHERE a.camp_id = $1 AND ' + filtersAssets.map((filter, index) => {
                        const column = filter.column;
                        values.push(`%${filter.value}%`);
                        return `${column}::TEXT ILIKE $${index + 2}`;
                    }).join(' AND ')
                    : 'WHERE a.camp_id = $1';

                const result_assets = await client.query(
                    `SELECT ${selectedColumns}
                        FROM assets a
                        LEFT JOIN assetstype at ON a.type_id = at.id
                        LEFT JOIN rooms r ON r.id = a.location_room
                        LEFT JOIN buildroom br ON br.roomid = a.location_room
                        LEFT JOIN buildings b ON b.id = br.buildid
                        ${whereClause}`, values
                );

                const filteredAssets = result_assets.rows.map(asset => {
                    const formattedAsset = { ...asset };
                    // Format date fields
                    if (formattedAsset.create_date) {
                        formattedAsset.create_date = new Date(formattedAsset.create_date).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        });
                    }
                    if (formattedAsset.last_inventory_date) {
                        formattedAsset.last_inventory_date = new Date(formattedAsset.last_inventory_date).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        });
                    }
                    if (formattedAsset.date_purchase) {
                        formattedAsset.date_purchase = new Date(formattedAsset.date_purchase).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        });
                    }
                    if (formattedAsset.date_written_off) {
                        formattedAsset.date_written_off = new Date(formattedAsset.date_written_off).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        });
                    }
                    return formattedAsset;
                });

                await Promise.all(filteredAssets.map(async (data, index) => {

                    const rowData = headers.map(header => {
                        if (header === 'Mobile') {
                            return data.is_fixed ? 'No' : 'Yes';
                        }
                        if (header === 'Fixed') {
                            return data.is_fixed ? 'Yes' : 'No';
                        }

                        const dbCol = header !== 'RFID' ? headerColumnMap[header] : 'id';
                        return data[dbCol] === null ? '' : data[dbCol];
                    });

                    const row = worksheet1.addRow(rowData);
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

                const whereClauseDate = filtersAssetsData.length > 0
                    ? 'WHERE ' + filtersAssetsData.map((filter, index) => {
                        const column = filter.column;
                        valuesDate.push(`%${filter.value}%`);
                        return `${column}::TEXT ILIKE $${index + 4}`; // <== FIXED: start from $4
                    }).join(' AND ')
                    : '';

                const result_asset_dates = await client.query(
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
                        ${whereClauseDate}
                        ORDER BY event_date;`, valuesDate
                );

                const filteredAssetDates = result_asset_dates.rows.map(date => {
                    const formattedDate = { ...date };
                    // Format the event_date
                    if (formattedDate.event_date) {
                        formattedDate.event_date = new Date(formattedDate.event_date).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    }
                    return formattedDate;
                });

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

                const result_lost_item = await client.query(`
                    SELECT nameitem, 
                        COALESCE(description, '') AS description, 
                        lost_quantity 
                    FROM lostitem 
                    WHERE camp_id = $1`, [req.session.camp]);

                const filteredLostAssets = result_lost_item.rows;

                await Promise.all(filteredLostAssets.map(async (data, index) => {
                    const row = worksheet3.addRow(Object.values(data)); // Convert object values to array
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

                const result_clean_item = await client.query(`
                    SELECT item_name, amount, date_change, description FROM cleanitemtraceability WHERE camp_id = $1;`
                    , [req.session.camp]);

                const filteredCleanItems = result_clean_item.rows;

                await Promise.all(filteredCleanItems.map(async (item, index) => {
                    // Format the date_change column
                    let rowData = Object.values(item);
                    if (item.date_change) {
                        const date = new Date(item.date_change);
                        const formattedDate = date.toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        });
                        // Assuming date_change is the 3rd column (index 3)
                        rowData[2] = formattedDate;
                    }
                    const row = worksheet4.addRow(rowData);
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

                const result_inventory_data = await client.query(`
                    SELECT a.inventory_status, code, name_assets, nameroom
                    FROM assets a
                    LEFT JOIN rooms r ON r.id = a.location_room
                    LEFT JOIN buildroom br ON br.roomid = a.location_room
                    JOIN buildings b ON b.id = br.buildid AND b.camp_id = $1
                    ORDER BY nameroom;
                `, [req.session.camp]);

                const filteredInventory = result_inventory_data.rows;

                // Mapping inventory_status strings to icons
                const statusMap = {
                    undiscovered: '❌',
                    edited: '⏳',
                    discovered: '✅'
                };

                // Add legend at the top
                worksheet5.addRow(['Legend: ❌ - Undiscovered, ⏳ - Edited, ✅ - Discovered']);
                worksheet5.mergeCells('A1:D1');
                const legendRow = worksheet5.getRow(1);
                legendRow.eachCell(cell => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFF2CC' }, // light yellow
                    };
                });

                // Add header row
                const headerRow = worksheet5.addRow(['Inventory Status', 'Code', 'Asset Name', 'Room Name']);
                headerRow.eachCell(cell => {
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFCCE5FF' }, // light blue
                    };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });

                await Promise.all(filteredInventory.map(async (data, index) => {
                    const iconStatus = statusMap[data.inventory_status.trim()] || '';
                    const rowData = [
                        iconStatus,
                        data.code,
                        data.name_assets,
                        data.nameroom
                    ];

                    const row = worksheet5.addRow(rowData);
                    row.eachCell((cell) => {
                        cell.alignment = { horizontal: 'center' };
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' },
                        };
                    });

                    if ((index + 1) % 2 === 0) { // +1 to skip header row
                        row.eachCell((cell) => {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFDDDDDD' }, // Light grey for alternating rows
                            };
                        });
                    }
                }));

                worksheet5.getColumn(1).width = 20;
                worksheet5.getColumn(2).width = 20;
                worksheet5.getColumn(3).width = 30;
                worksheet5.getColumn(4).width = 25;

                await client.query('COMMIT');

                // Set headers for download and send the file
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="report_laundry.xlsx"');

                // Write the workbook to the response
                await workbook.xlsx.write(res);
                res.end();

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error generating the report:', error);
                res.status(500).json({ message: 'Failed to generate the report.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/cleanItem', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaCleanItems.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { pageLarge = 1, pageSmall = 1, limit = 7, searchColumnLarge, searchValueLarge, searchColumnSmall, searchValueSmall } = req.query;
            const offsetLarge = (pageLarge - 1) * limit;
            const offsetSmall = (pageSmall - 1) * limit;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                let whereClauseLarge = 'WHERE camp_id = $1';
                let valuesLarge = [req.session.camp];

                let countValuesLarge = [req.session.camp];
                let countWhereClauseLarge = 'WHERE camp_id = $1';

                let whereClauseSmall = 'WHERE camp_id = $1';
                let valuesSmall = [req.session.camp];

                let countValuesSmall = [req.session.camp];
                let countWhereClauseSmall = 'WHERE camp_id = $1';

                // Handle search
                if (searchColumnLarge && searchValueLarge) {

                    if (!Array.isArray(searchColumnLarge)) searchColumnLarge = [searchColumnLarge];
                    if (!Array.isArray(searchValueLarge)) searchValueLarge = [searchValueLarge];

                    if (Array.isArray(searchColumnLarge[0])) searchColumnLarge = searchColumnLarge[0];
                    if (Array.isArray(searchValueLarge[0])) searchValueLarge = searchValueLarge[0];

                    whereClauseLarge += " AND (";
                    countWhereClauseLarge += " AND (";

                    for (let i = 0; i < searchColumnLarge.length; i++) {
                        const column = searchColumnLarge[i];
                        const value = searchValueLarge[i];

                        valuesLarge.push(`%${value}%`);
                        countValuesLarge.push(`%${value}%`);

                        const paramIndex = valuesLarge.length;
                        const countParamIndex = countValuesLarge.length;

                        whereClauseLarge += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClauseLarge += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumnLarge.length - 1) {
                            whereClauseLarge += " AND ";
                            countWhereClauseLarge += " AND ";
                        }
                    }

                    whereClauseLarge += ")";
                    countWhereClauseLarge += ")";
                }

                // Add pagination
                valuesLarge.push(limit);
                valuesLarge.push(offsetLarge);
                const largeLimitIndex = valuesLarge.length - 1;
                const largeOffsetIndex = valuesLarge.length;

                if (searchColumnSmall && searchValueSmall) {

                    if (!Array.isArray(searchColumnSmall)) searchColumnSmall = [searchColumnSmall];
                    if (!Array.isArray(searchValueSmall)) searchValueSmall = [searchValueSmall];

                    if (Array.isArray(searchColumnSmall[0])) searchColumnSmall = searchColumnSmall[0];
                    if (Array.isArray(searchValueSmall[0])) searchValueSmall = searchValueSmall[0];

                    whereClauseSmall += " AND (";
                    countWhereClauseSmall += " AND (";

                    for (let i = 0; i < searchColumnSmall.length; i++) {
                        const column = searchColumnSmall[i];
                        const value = searchValueSmall[i];

                        valuesSmall.push(`%${value}%`);
                        countValuesSmall.push(`%${value}%`);

                        const paramIndex = valuesSmall.length;
                        const countParamIndex = countValuesSmall.length;

                        whereClauseSmall += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClauseSmall += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumnSmall.length - 1) {
                            whereClauseSmall += " AND ";
                            countWhereClauseSmall += " AND ";
                        }
                    }

                    whereClauseSmall += ")";
                    countWhereClauseSmall += ")";
                }

                // Add pagination
                valuesSmall.push(limit);
                valuesSmall.push(offsetSmall);
                const smallLimitIndex = valuesSmall.length - 1;
                const smallOffsetIndex = valuesSmall.length;

                const [result_data, result_filter_large, result_filter_small, largeCountResult, smallCountResult] = await Promise.all([
                    client.query(`
                    SELECT id, itemname AS name, total_amount, count_get_item 
                    FROM clearitem WHERE camp_id = $1;`, [req.session.camp]),
                    client.query(`
                    SELECT id, itemname AS name, total_amount, count_get_item 
                    FROM clearitem ${whereClauseLarge} LIMIT $${largeLimitIndex} OFFSET $${largeOffsetIndex};`, valuesLarge),
                    client.query(`
                    SELECT id, itemname AS name, total_amount, count_get_item 
                    FROM clearitem ${whereClauseSmall} LIMIT $${smallLimitIndex} OFFSET $${smallOffsetIndex};`, valuesSmall),
                    client.query(`
                    SELECT COUNT(*) AS count
                    FROM clearitem ${countWhereClauseLarge};`, countValuesLarge),
                    client.query(`
                    SELECT COUNT(*) AS count
                    FROM clearitem ${countWhereClauseSmall};`, countValuesSmall),
                ]);

                const largeTotal = parseInt(largeCountResult.rows[0].count, 10);
                const largeTotalPages = Math.ceil(largeTotal / limit) || 1;

                const smallTotal = parseInt(smallCountResult.rows[0].count, 10);
                const smallTotalPages = Math.ceil(smallTotal / limit) || 1;

                await client.query('COMMIT');
                res.status(200).json({
                    data: result_data.rows,
                    filterDataLarge: result_filter_large.rows,
                    filterDataSmall: result_filter_small.rows,
                    totalPagesLarge: largeTotalPages,
                    totalPagesSmall: smallTotalPages
                });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error get clean items: ', error);
                res.status(500).json({ message: 'Failed to get clean items' });

            } finally {
                client.release();
            }
        });

        this.app.post('/addCleanItem', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaAddCleanItem.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            if (!req.session.camp)
                return res.status(400).json({ message: "You not select camp. First select camp then add clean item?!" });

            const { itemName, totalAmount } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const [check_exist, checkPermission] = await Promise.all([
                    client.query(`SELECT * FROM clearitem WHERE itemname = $1 AND camp_id = $2;`, [itemName, req.session.camp]),
                    client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Cleaning items')`, [req.session.userId])
                ]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add clean item!" });
                }

                if (check_exist.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'This item already exists!' });
                }

                const uniqueId = crypto.randomBytes(16).toString('hex');
                const uniqueId1 = crypto.randomBytes(16).toString('hex');
                await client.query(`INSERT INTO clearitem VALUES ($1, $2, $3, 0, $4);`, [uniqueId, itemName, totalAmount, req.session.camp]);
                await client.query(`INSERT INTO cleanitemtraceability VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5);`, [uniqueId1, itemName, totalAmount, 'Added item amount in large warehouse', req.session.camp]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The item was successfully added' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to add clean item: ', error);
                res.status(500).json({ message: 'Failed to add item.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/uploadCleanItem/download', this.isLoggedIn.bind(this), async (req, res) => {

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

            if (!req.session.camp)
                return res.status(400).json({ message: "You not select camp. First select camp then add clean item?!" });

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Cleaning items')`, [req.session.userId]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add multipul clean item!" });
                }

                if (!req.file) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'No file uploaded.' });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet);

                // Set to track unique soldierIds in the file
                const seenIds = new Set();

                if (sheetName !== 'Add Multipul Clean Items') {
                    await client.query('ROLLBACK');
                    errors.push({ type: 'InvalidFormat', message: `Invalid template` });
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

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
                    const result = await client.query("SELECT * FROM clearitem WHERE itemname = $1 AND camp_id = $2;", [row.itemName, req.session.camp]);
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

                    const styleError = errors.find(error => error.type === 'Validation');

                    if (styleError) {
                        console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                        console.error(styleError.details);
                    }

                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row) => {
                    const uniqueId = crypto.randomBytes(16).toString('hex');
                    const uniqueId1 = crypto.randomBytes(16).toString('hex');
                    await client.query("INSERT INTO clearitem VALUES ($1, $2, $3, 0, $4);", [uniqueId, row.itemName, row.totalAmount, req.session.camp]);
                    await client.query(`INSERT INTO cleanitemtraceability VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5);`, [uniqueId1, row.itemName, row.totalAmount, 'Added item amount in large warehouse', req.session.camp]);
                }));

                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Add multi clean items`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });
            } finally {
                client.release();
            }
        });

        this.app.delete('/removeCleanItem', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaRemoveCleanItem.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { itemId } = req.body;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Cleaning items')`, [req.session.userId]);

                const checkExistItem = await client.query("SELECT * FROM clearitem WHERE id = $1;", [itemId]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to remove clean item!" });
                }

                if (checkExistItem.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The item does not exist. It has probably been modified.` });
                }

                await client.query(`DELETE FROM clearitem WHERE id = $1;`, [itemId]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The item was successfully removed' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to remove clean item: ', error);
                res.status(500).json({ message: 'Failed to remove item.' });

            } finally {
                client.release();
            }

        });

        this.app.post('/changeAmountLargeToSmall', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = changeAmountSchema.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { checkList, moveAmount } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Cleaning items')`, [req.session.userId]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to change amount!" });
                }

                for (const item of checkList) {

                    const itemId = item.code;
                    const itemAmount = item.amount;

                    const checkExistItem = await client.query("SELECT * FROM clearitem WHERE id = $1;", [itemId]);

                    if (checkExistItem.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: `One or more items does not exist. It has probably been modificated.` });
                    }

                    await client.query(`UPDATE clearitem SET total_amount = $1, count_get_item = count_get_item + $2 WHERE id = $3;`,
                        [itemAmount - moveAmount, moveAmount, itemId]);
                }

                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Move item from large to small workhouse`]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Item amount move succesful' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to move item: ', error);
                res.status(500).json({ message: 'Failed to move item.' });

            } finally {
                client.release();
            }
        });

        this.app.post('/changeAmountSmallToLarge', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = changeAmountSchema.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { checkList, moveAmount } = req.body;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Cleaning items')`, [req.session.userId]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to change amount!" });
                }

                for (const item of checkList) {

                    const itemId = item.code;
                    const itemAmount = item.amount;

                    const checkExistItem = await client.query("SELECT * FROM clearitem WHERE id = $1;", [itemId]);

                    if (checkExistItem.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: `One or more items does not exist. It has probably been modificated.` });
                    }

                    await client.query(`UPDATE clearitem SET total_amount = total_amount + $1, count_get_item = $2 WHERE id = $3;`,
                        [moveAmount, itemAmount - moveAmount, itemId]);
                }

                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Move item from small to large workhouse`]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Item amount move succesful' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to move item: ', error);
                res.status(500).json({ message: 'Failed to move item.' });

            } finally {
                client.release();
            }
        });

        this.app.patch('/editCleanItem', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = editCleanItemSchema.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { itemId, editAmount, isTotalAmound } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Cleaning items')`, [req.session.userId]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to edit clean item!" });
                }

                const uniqueId = crypto.randomBytes(16).toString('hex');

                if (isTotalAmound) {
                    await client.query(`UPDATE clearitem SET total_amount = total_amount + $2 WHERE id = $1;`, [itemId, editAmount]);
                    await client.query(`INSERT INTO cleanitemtraceability VALUES ($1, (SELECT itemname FROM clearitem WHERE id = $2), $3, CURRENT_TIMESTAMP, $4, $5);`, [uniqueId, itemId, editAmount, 'Added item amount in large warehouse', req.session.camp]);
                } else {
                    await client.query(`UPDATE clearitem SET count_get_item = count_get_item - $2 WHERE id = $1;`, [itemId, editAmount]);
                    await client.query(`INSERT INTO cleanitemtraceability VALUES ($1, (SELECT itemname FROM clearitem WHERE id = $2), $3, CURRENT_TIMESTAMP, $4, $5);`, [uniqueId, itemId, editAmount, 'Taken item amount from small warehouse', req.session.camp]);
                }

                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Change item amount with code ${itemId}`]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Item is change succesful' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to change clean item: ', error);
                res.status(500).json({ message: 'Failed to change item.' });

            } finally {
                client.release();
            }
        });

        this.app.get('/getItemTraceability', this.isLoggedIn.bind(this), async (req, res) => {

            const { error } = schemaTraceability.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            let { page = 1, limit = 10, searchColumn, searchValue } = req.query;
            const offset = (page - 1) * limit;

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                let whereClause = 'WHERE camp_id = $1';
                let values = [req.session.camp];

                let countValues = [req.session.camp];
                let countWhereClause = 'WHERE camp_id = $1';

                if (searchColumn && searchValue) {

                    if (!Array.isArray(searchColumn)) searchColumn = [searchColumn];
                    if (!Array.isArray(searchValue)) searchValue = [searchValue];

                    if (Array.isArray(searchColumn[0])) searchColumn = searchColumn[0];
                    if (Array.isArray(searchValue[0])) searchValue = searchValue[0];

                    whereClause += " AND (";
                    countWhereClause += " AND (";

                    for (let i = 0; i < searchColumn.length; i++) {
                        const column = searchColumn[i];
                        const value = searchValue[i];

                        values.push(`%${value}%`);
                        countValues.push(`%${value}%`);

                        const paramIndex = values.length;
                        const countParamIndex = countValues.length;

                        whereClause += `${column}::TEXT ILIKE $${paramIndex}`;
                        countWhereClause += `${column}::TEXT ILIKE $${countParamIndex}`;

                        if (i < searchColumn.length - 1) {
                            whereClause += " AND ";
                            countWhereClause += " AND ";
                        }
                    }

                    whereClause += ")";
                    countWhereClause += ")";
                }

                // Add pagination
                values.push(limit);
                values.push(offset);
                const limitIndex = values.length - 1;
                const offsetIndex = values.length;

                const [result, countResult] = await Promise.all([
                    client.query(`SELECT * FROM cleanitemtraceability ${whereClause} LIMIT $${limitIndex} OFFSET $${offsetIndex};`, values),
                    client.query(`SELECT COUNT(*) FROM cleanitemtraceability ${whereClause};`, countValues),
                ]);

                const totalData = parseInt(countResult.rows[0].count, 10);
                const totalPages = Math.ceil(totalData / limit) || 1;

                await client.query('COMMIT');
                res.status(200).json({ data: result.rows, totalPages });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error get item traceability:', error);
                res.status(500).json({ message: 'Failed to get item traceability' });

            } finally {
                client.release();
            }
        });

        this.app.get('/getInventoryData', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = shemaInventory.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const page = parseInt(req.query.page || 1, 10);
            const limit = parseInt(req.query.limit || 7, 10);
            const offset = (page - 1) * limit;

            const client = await pool.connect();

            try {
                const campId = req.session.camp;

                const [buildingRes, buildingCountRes] = await Promise.all([
                    client.query(`
                        SELECT b.id, b.namebuilding,
                            CASE
                                WHEN NOT EXISTS (
                                    SELECT 1 FROM rooms r
                                    JOIN buildroom br ON br.roomid = r.id
                                    WHERE br.buildid = b.id AND (
                                        CASE
                                            WHEN NOT EXISTS (
                                                SELECT 1 FROM assets a WHERE a.location_room = r.id AND a.inventory_status NOT IN ('discovered','edited')
                                            ) THEN 'finished'
                                            WHEN EXISTS (
                                                SELECT 1 FROM assets a WHERE a.location_room = r.id AND a.inventory_status != 'undiscovered'
                                            ) THEN 'actions'
                                            ELSE 'unfinished'
                                        END
                                    ) != 'finished'
                                ) THEN 'finished'
                                WHEN EXISTS (
                                    SELECT 1 FROM rooms r
                                    JOIN buildroom br ON br.roomid = r.id
                                    WHERE br.buildid = b.id AND (
                                        CASE
                                            WHEN NOT EXISTS (
                                                SELECT 1 FROM assets a WHERE a.location_room = r.id AND a.inventory_status NOT IN ('discovered','edited')
                                            ) THEN 'finished'
                                            WHEN EXISTS (
                                                SELECT 1 FROM assets a WHERE a.location_room = r.id AND a.inventory_status != 'undiscovered'
                                            ) THEN 'actions'
                                            ELSE 'unfinished'
                                        END
                                    ) != 'unfinished'
                                ) THEN 'actions'
                                ELSE 'unfinished'
                            END AS inventory_status
                        FROM buildings b
                        WHERE b.camp_id = $1
                        ORDER BY b.namebuilding
                        LIMIT $2 OFFSET $3
                    `, [campId, limit, offset]),
                    client.query('SELECT COUNT(*) AS count FROM buildings WHERE camp_id = $1', [campId])
                ]);

                const buildings = buildingRes.rows;
                const totalBuildings = parseInt(buildingCountRes.rows[0].count, 10);
                const totalPages = Math.ceil(totalBuildings / limit) || 1;

                if (buildings.length === 0) {
                    return res.status(200).json({
                        allBuilding: [],
                        allRooms: [],
                        allAssets: [],
                        totalPages
                    });
                }

                const buildingIds = buildings.map(b => b.id);
                const roomRes = await client.query(`
                    SELECT r.id, r.nameroom, br.buildid,
                        CASE
                            WHEN NOT EXISTS (
                                SELECT 1 FROM assets a WHERE a.location_room = r.id AND a.inventory_status NOT IN ('discovered','edited')
                            ) THEN 'finished'
                            WHEN EXISTS (
                                SELECT 1 FROM assets a WHERE a.location_room = r.id AND a.inventory_status != 'undiscovered'
                            ) THEN 'actions'
                            ELSE 'unfinished'
                        END AS inventory_status
                    FROM rooms r
                    JOIN buildroom br ON br.roomid = r.id
                    WHERE br.buildid = ANY($1::text[])
                    ORDER BY r.nameroom
                `, [buildingIds]);

                const rooms = roomRes.rows;

                const roomIds = rooms.map(r => r.id);
                let assets = [];
                if (roomIds.length > 0) {
                    const assetRes = await client.query(`
                        SELECT a.id, a.code, a.name_assets, a.location_room, a.inventory_status
                        FROM assets a
                        WHERE a.location_room = ANY($1::text[]) AND a.camp_id = $2
                        ORDER BY a.code
                    `, [roomIds, campId]);
                    assets = assetRes.rows;
                }

                res.status(200).json({
                    allBuilding: buildings,
                    allRooms: rooms,
                    allAssets: assets,
                    totalPages
                });

            } catch (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error get inventory data:', error);
                res.status(500).json({ message: 'Failed to get inventory data' });
            } finally {
                client.release();
            }
        });

        this.app.post('/restorInventory', this.isLoggedIn.bind(this), async (req, res) => {

            const client = await pool.connect();

            if (!req.session.camp)
                return res.status(400).json({ message: "You not select camp. First select camp then add clean item?!" });

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Restart inventory')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to restart inventory!" });
                }

                await client.query(`UPDATE assets SET inventory_status = 'undiscovered' WHERE camp_id = $1;`, [req.session.camp]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The inventory restor sucesful' })

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error to restart inventory: ', error);
                res.status(500).json({ message: 'Failed to restart inventory' });

            } finally {
                client.release();
            }
        });

        this.app.post('/updateAssetQuantity', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = shemaUpdateQuantityAsset.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const id = req.body.id;
            const campId = req.body.campId;
            const username = req.body.username;
            const newQuantity = Number(req.body.newQuantity);

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Edit singel asset')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to edit asset!" });
                }

                const result_exist_date = await client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [campId]);
                const queries = [];

                const assetQuantity = await client.query(`SELECT quantity FROM assets WHERE id = $1`, [id]);
                const asset_quantity = Number(assetQuantity.rows[0].quantity);

                if (newQuantity === asset_quantity) {
                    await client.query(`UPDATE assets SET inventory_status = 'discovered', last_inventory_date = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
                    await client.query('COMMIT');
                    return res.status(200).json({ message: 'The asset quantity was successfully update' });
                }

                const result = await client.query(`SELECT * FROM assets WHERE id = $1;`, [id]);
                const item_into = result.rows[0];

                const get_exist_lost_item = await client.query(`SELECT * FROM lostitem WHERE item_id = $1;`, [item_into.id]);

                if (newQuantity === 0) {

                    if (get_exist_lost_item.rows.length > 0) {
                        queries.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC + $1 WHERE item_id = $2;`, [asset_quantity, item_into.id]));
                    } else {
                        queries.push(client.query(`INSERT INTO lostitem VALUES (
                        (SELECT COALESCE(MAX(id)::integer, 0) + 1 FROM lostitem), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29);`,
                            [
                                item_into.code, "Removed during inventory", asset_quantity, item_into.id,
                                item_into.name_assets, item_into.type_id, item_into.location_room, item_into.location_key,
                                item_into.categorie, item_into.mrah, item_into.asset_owner, item_into.status,
                                item_into.expandable, item_into.description, item_into.camp_id, item_into.create_date,
                                item_into.last_inventory_date, item_into.service, item_into.m2_inside, item_into.is_fixed,
                                item_into.date_purchase, item_into.date_written_off, item_into.purchase_price, item_into.comments,
                                item_into.replaced_off, item_into.year_of_life_cycle, item_into.rest_of_life_cycle, item_into.replaced_by,
                                item_into.rest_value
                            ]));
                    }

                    if (result_exist_date.rows.length > 0) {
                        queries.push(client.query(`UPDATE asset_actions SET change_lost_asset_quantity = change_lost_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [asset_quantity, campId]));
                    } else {
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, $1, 0, $2);`, [asset_quantity, campId]));
                    }

                    queries.push(client.query(`DELETE FROM assets WHERE id = $1`, [id]));

                } else if (newQuantity < asset_quantity) {

                    const quantityRemoved = asset_quantity - newQuantity;

                    if (get_exist_lost_item.rows.length > 0) {
                        queries.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC + $1 WHERE item_id = $2;`, [quantityRemoved, item_into.id]));
                    } else {
                        queries.push(client.query(`INSERT INTO lostitem VALUES (
                        (SELECT COALESCE(MAX(id)::integer, 0) + 1 FROM lostitem), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29);`,
                            [
                                item_into.code, "Removed during inventory", quantityRemoved, item_into.id,
                                item_into.name_assets, item_into.type_id, item_into.location_room, item_into.location_key,
                                item_into.categorie, item_into.mrah, item_into.asset_owner, item_into.status,
                                item_into.expandable, item_into.description, item_into.camp_id, item_into.create_date,
                                item_into.last_inventory_date, item_into.service, item_into.m2_inside, item_into.is_fixed,
                                item_into.date_purchase, item_into.date_written_off, item_into.purchase_price, item_into.comments,
                                item_into.replaced_off, item_into.year_of_life_cycle, item_into.rest_of_life_cycle, item_into.replaced_by,
                                item_into.rest_value
                            ]));
                    }

                    if (result_exist_date.rows.length > 0) {
                        queries.push(client.query(`UPDATE asset_actions SET change_lost_asset_quantity = change_lost_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [quantityRemoved, campId]));
                    } else {
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, $1, 0, $2);`, [quantityRemoved, campId]));
                    }

                    queries.push(client.query(`UPDATE assets SET quantity = $1, inventory_status = 'edited' WHERE id = $2`, [newQuantity, id]));

                } else {
                    const quantityAdded = newQuantity - asset_quantity;
                    if (result_exist_date.rows.length > 0) {
                        queries.push(client.query(`UPDATE asset_actions SET change_asset_quantity = change_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [quantityAdded, campId]));
                    } else {
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, $1, 0, 0, $2);`, [quantityAdded, campId]));
                    }

                    const get_exist_lost_item = await client.query(`SELECT * FROM lostitem WHERE item_id = $1;`, [item_into.id]);
                    if (get_exist_lost_item.rows.length > 0) {
                        queries.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC - $1 WHERE item_id = $2;`, [quantityAdded, item_into.id]));
                        queries.push(client.query(`DELETE FROM lostitem WHERE lost_quantity::NUMERIC = 0;`));
                    }

                    queries.push(client.query(`UPDATE assets SET quantity = $1, inventory_status = 'edited' WHERE id = $2`, [newQuantity, id]));
                }

                queries.push(client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [username, `Change asset quantity with epc: ${id} in inventory`]));

                await Promise.all(queries);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset quantity was successfully update' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to edit quantity of asset' });
            } finally {
                client.release();
            }
        });

        this.app.post('/checkAndChangeScanningAsset', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = checkAndChangeAssetSchema.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { code, location } = req.body;
            let isOtherLocation = false;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const [result, check_asset, check_location] = await Promise.all([
                    client.query(`SELECT * FROM assets WHERE id = $1 AND location_room = $2`, [code, location]),
                    client.query(`
                    SELECT id FROM assets WHERE id = $1
                    UNION ALL
                    SELECT id FROM lostitem WHERE item_id = $1;`, [code]),
                    client.query(`SELECT * FROM rooms WHERE id = $1`, [location])
                ]);

                if (check_location.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The location room not exist in the system. It has probably been modified.` })
                }

                if (check_asset.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `RFID with code: ${code} not exist in the system or it has probably been modified.` })
                }

                if (result.rows.length > 0) {
                    await client.query(`UPDATE assets SET inventory_status = 'discovered', last_inventory_date = CURRENT_TIMESTAMP WHERE id = $1`, [code]);
                } else {
                    isOtherLocation = true;
                }

                await client.query('COMMIT');
                res.status(200).json({ isAdditionalAsset: isOtherLocation });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(err);
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }

        });

        this.app.get('/getDataForAdditionalAsset', this.isLoggedIn.bind(this), async (req, res) => {

            const { error, value } = checkAssetSchema.validate(req.query);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const id = value.assetId;
            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT a.id, code, name_assets, r.nameroom AS location_name, type_id::TEXT
                    FROM assets a
                    LEFT JOIN rooms r ON a.location_room = r.id
                    WHERE a.id = $1
                    UNION ALL
                    SELECT item_id, nameitem, item_name, 'Lost Items' AS location_name, item_type_id
                    FROM lostitem
                    WHERE item_id = $1;`, [id]);

                await client.query('COMMIT');
                res.status(200).json(result.rows[0]);

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(err);
                res.status(500).json({ message: "Internal server error" });

            } finally {
                client.release();
            }

        });

        this.app.post('/updateAssetLocation', this.isLoggedIn.bind(this), async (req, res) => {
            const { error } = shemaUpdateLocationAsset.validate(req.body);
            if (error) {
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error(error.details[0].message);
                return res.status(400).json({ message: 'Invalid syntax' });
            }

            const { id, locationId, sublocationId, campId } = req.body;

            const client = await pool.connect();

            try {

                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = (SELECT id FROM users WHERE username = $1)
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Edit singel asset')`, [username])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to edit asset!" });
                }

                const checkRoomExist = await client.query(`SELECT * FROM rooms WHERE id = $1`, [locationId]);
                if (checkRoomExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The room does not exist. It has probably been modified.` });
                }

                const checkKeyExist = await client.query(`SELECT * FROM key WHERE id = $1`, [sublocationId]);
                if (checkKeyExist.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: `The key does not exist. It has probably been modified.` });
                }

                const queries = [];

                const result_restor_data = await client.query(`SELECT * FROM lostitem WHERE item_id = $1`, [id]);
                const result_exist_date = await client.query(`SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`, [campId]);

                if (result_restor_data.rows.length > 0) {

                    const restor_data = result_restor_data.rows[0];
                    const lost_quantity = Number(restor_data.lost_quantity);

                    queries.push(client.query(`INSERT INTO assets VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'discovered', $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)`, [
                        restor_data.item_id, restor_data.nameitem, restor_data.item_name, restor_data.item_type_id,
                        locationId, sublocationId || null, restor_data.item_category, lost_quantity,
                        restor_data.item_mrah, restor_data.item_owner, restor_data.item_status, restor_data.item_expandable,
                        restor_data.item_description, restor_data.camp_id, restor_data.item_create_date, restor_data.item_last_inventory_date,
                        restor_data.item_service, restor_data.item_m2_inside, restor_data.item_is_fixed, restor_data.item_date_purchase,
                        restor_data.item_date_written_off, restor_data.item_purchase_price, restor_data.item_comments, restor_data.item_replaced_off,
                        restor_data.item_year_of_life_cycle, restor_data.item_rest_of_life_cycle, restor_data.item_replaced_by, restor_data.item_rest_value
                    ]));
                    queries.push(client.query(`DELETE FROM lostitem WHERE item_id = $1;`, [restor_data.item_id]));
                    result_exist_date.rows.length > 0
                        ? queries.push(client.query(`UPDATE asset_actions SET change_asset_quantity = change_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [lost_quantity, campId]))
                        : queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, $1, 0, 0, 0, $2);`, [lost_quantity, campId]))

                    queries.push(client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.body.username, `Restor lost asset with epc: ${id} in new location with id: ${locationId} in inventory`]));
                } else {

                    if (result_exist_date.rows.length > 0) {
                        queries.push(client.query(`UPDATE asset_actions SET change_modificate_asset_quantity = change_modificate_asset_quantity::NUMERIC + 1 WHERE date_change = CURRENT_DATE AND camp_id = $1;`, [campId]));
                    } else {
                        queries.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, 0, 1, $2);`, [campId]));
                    }

                    queries.push(client.query(`UPDATE assets SET location_room = $1, location_key = $3 inventory_status = 'edited' WHERE id = $2`, [locationId, id, sublocationId || null]));

                    queries.push(client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                        [req.body.username, `Change asset location with epc: ${id} and new location with id: ${locationId} in inventory`]));
                }

                await Promise.all(queries);

                await client.query('COMMIT');
                res.status(200).json({ message: 'The asset location was successfully update' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Server error:', error);
                res.status(500).json({ message: 'Failed to edit location of asset' });
            } finally {
                client.release();
            }
        });

        this.app.get('/assets/editMultiAsset/download', this.isLoggedIn.bind(this), async (req, res) => {

            // Create a new Excel workbook
            const workbook = new excelJS.Workbook();

            // Sheet 1: Soldier Data
            const worksheet = workbook.addWorksheet('Edit Multipul Assets');

            // Add custom column titles for the first sheet
            const headers = [
                'id', 'code', 'name_assets', 'asset_type',
                'location_room', 'location_key', 'categorie', 'quantity',
                'mrah', 'asset_owner', 'status', 'expandable',
                'description', 'service', 'm2_inside', 'is_fixed',
                'date_purchase', 'date_written_off', 'purchase_price', 'comments',
                'replaced_off', 'year_of_life_cycle', 'rest_of_life_cycle', 'replaced_by',
                'rest_value'
            ];
            const headerRow = worksheet.addRow(headers);

            // Apply styling to the headers
            headerRow.eachCell((cell, colNumber) => {
                cell.font = { bold: true, size: 12 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };

                const redHeaders = [
                    'id',
                    'code',
                    'name_assets',
                    'asset_type',
                    'location_room',
                    'quantity',
                    'is_fixed'
                ];
                if (redHeaders.includes(headers[colNumber - 1])) {
                    cell.font = { ...cell.font, color: { argb: 'FFFF0000' } }; // Red
                }
            });

            // Set column widths for sheet 1
            worksheet.columns = [
                { width: 35 }, { width: 20 }, { width: 20 }, { width: 20 },
                { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 },
                { width: 20 }, { width: 20 }, { width: 20 }, { width: 25 },
                { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 },
                { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 },
                { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 },
                { width: 20 }
            ];

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                const result = await client.query(`
                    SELECT 
                        a.id, code, name_assets, type_name, 
                        nameroom, namekey, categorie, quantity, 
                        mrah, asset_owner, status, expandable, 
                        description, service, m2_inside, is_fixed, 
                        date_purchase, date_written_off, purchase_price, comments,
                        replaced_off, year_of_life_cycle, rest_of_life_cycle, replaced_by,
                        rest_value
                    FROM assets a
                    LEFT JOIN assetstype atype ON atype.id = a.type_id
                    LEFT JOIN rooms r ON r.id = a.location_room
                    LEFT JOIN key k ON k.id = a.location_key 
                    WHERE camp_id = $1;`, [req.session.camp]);

                const data = result.rows;

                const formatDate = (date) => {
                    const dateObj = new Date(date);
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
                    const day = String(dateObj.getDate()).padStart(2, '0');

                    return date ? `${year}-${month}-${day}` : '';
                }

                data.forEach((row) => {
                    const rowData = [
                        row.id, row.code, row.name_assets, row.type_name,
                        row.nameroom, row.namekey, row.categorie, row.quantity,
                        row.mrah, row.asset_owner, row.status, row.expandable,
                        row.description, row.service, row.m2_inside, row.is_fixed,
                        formatDate(row.date_purchase), formatDate(row.date_written_off), row.purchase_price, row.comments,
                        row.replaced_off, row.year_of_life_cycle, row.rest_of_life_cycle, row.replaced_by,
                        row.rest_value
                    ];
                    worksheet.addRow(rowData);
                });
                await client.query('COMMIT');

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error fetching data:', error);
                return res.status(500).json({ message: 'An error occurred while fetching data.' });

            } finally {
                client.release();
            }

            // Set the response headers for file download
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=templateEditMultiAssets.xlsx');

            // Write the workbook to the response stream
            await workbook.xlsx.write(res);
            res.end(); // End the response

        });

        this.app.post('/assets/editMultiAsset', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {
            const client = await pool.connect();
            const errors = [];

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Edit multi assets')`, [req.session.userId])

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to edit multipul assets!" });
                }

                if (!req.file) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'No file uploaded.' });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                // Set to track unique soldierIds in the file
                const seenIds = new Set();
                const seenCodes = new Set();

                if (sheetName !== 'Edit Multipul Assets') {
                    await client.query('ROLLBACK');
                    errors.push({ type: 'InvalidFormat', message: `Invalid template` });
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row, index) => {
                    const { error } = schemaEditMultiAsset.validate(row);

                    if (error) {
                        errors.push({ type: 'Validation', details: error.details, row, index });
                        return;
                    }

                    // Check for duplicates within the file
                    if (seenIds.has(row.id)) {
                        errors.push({ type: 'DuplicateInFile', row, index, message: `Duplicate epc code (id) in row with asset code: '${row.code}' in the file.` });
                        return;
                    }

                    if (seenCodes.has(row.code)) {
                        errors.push({ type: 'DuplicateInFile', row, index, message: `Duplicate epc code in row with asset code: '${row.code}' in the file.` });
                        return;
                    }

                    seenIds.add(row.id);
                    seenCodes.add(row.code);

                    // Check if the asset exists in the database
                    const result = await client.query(`SELECT * FROM assets WHERE id = $1`, [row.id]);
                    if (result.rows.length === 0) {
                        errors.push({ type: 'NotFound', row, index, message: `Asset with code '${row.code}' not found in the database.` });
                        return;
                    }

                    const result_code = await client.query(`SELECT * FROM assets WHERE code = $1 AND camp_id = $2;`, [row.code, req.session.camp]);
                    if (result_code.rows.length > 0) {
                        errors.push({ type: 'NotFound', row, index, message: `Asset with code '${row.code}' is already in the database.` });
                        return;
                    }

                    const result_type = await client.query(`SELECT * FROM assetstype WHERE type_name = $1;`, [row.asset_type]);
                    if (result_type.rows.length === 0) {
                        errors.push({ type: 'NotFound', row, index, message: `Asset type '${row.asset_type}' not found in the database.` });
                        return;
                    }

                    const result_room = await client.query(`
                        SELECT r.* FROM rooms r
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        LEFT JOIN buildings b ON b.id = br.buildid
                        WHERE nameroom = $1 AND camp_id = $2;`, [row.location_room, req.session.camp]);
                    if (result_room.rows.length === 0) {
                        errors.push({ type: 'NotFound', row, index, message: `Room '${row.location_room}' not found in the database.` });
                        return;
                    }

                    if (row.asset_type === 'BED stackable' && row.location_key === '') {
                        errors.push({ type: 'NotFound', row, index, message: `The asset with code '${row.code}' is a stackable bed and must have a location key.` });
                        return;
                    }

                    if (row.asset_type !== 'BED stackable' && row.location_key !== '') {
                        errors.push({ type: 'NotFound', row, index, message: `The asset with code '${row.code}' is not a stackable bed and should not have a location key.` });
                        return;
                    }

                    const result_key = await client.query(`
                        SELECT k.* FROM key k
                        LEFT JOIN roomskey rk ON rk.keyid = k.id
                        LEFT JOIN buildroom br ON br.roomid = rk.roomid
                        LEFT JOIN buildings b ON b.id = br.buildid
                        WHERE namekey = $1 AND camp_id = $2;`, [row.location_key || null, req.session.camp]);
                    if (row.location_key && result_key.rows.length === 0) {
                        errors.push({ type: 'NotFound', row, index, message: `Key '${row.location_key}' not found in the database.` });
                        return;
                    }

                    const result_room_key = await client.query(`SELECT * FROM roomskey WHERE roomid = (SELECT id FROM rooms WHERE nameroom = $1) AND keyid = (SELECT id FROM key WHERE namekey = $2);`, [row.location_room, row.location_key || null]);
                    if (row.location_key && result_room_key.rows.length === 0) {
                        errors.push({ type: 'NotFound', row, index, message: `The associated key must be from a room ${row.location_room}. The key ${row.location_key} is not from room ${row.location_room}` });
                        return;
                    }

                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');

                    const styleError = errors.find(error => error.type === 'Validation');

                    if (styleError) {
                        console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                        console.error(styleError.details);
                    }

                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                let result_exist_date = await client.query(
                    `SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`,
                    [req.session.camp]
                );

                let hasActionRow = result_exist_date.rows.length > 0;

                const query = [];

                data.map(async (row) => {
                    const {
                        id, code, name_assets, asset_type,
                        location_room, location_key, categorie, quantity,
                        mrah, asset_owner, status, expandable,
                        description, service, m2_inside, is_fixed,
                        date_purchase, date_written_off, purchase_price, comments,
                        replaced_off, year_of_life_cycle, rest_of_life_cycle, replaced_by,
                        rest_value
                    } = row;

                    const existingAsset = await client.query(`
                        SELECT 
                            a.code, a.name_assets, at.type_name AS asset_type, 
                            r.nameroom AS location_room, k.namekey AS location_key,
                            a.categorie, a.quantity, a.mrah, a.asset_owner, a.status, 
                            a.expandable, a.description, a.service, a.m2_inside, a.is_fixed,
                            a.date_purchase, a.date_written_off, a.purchase_price, a.comments,
                            a.replaced_off, a.year_of_life_cycle, a.rest_of_life_cycle, a.replaced_by,
                            a.rest_value
                        FROM assets a
                        LEFT JOIN assetstype at ON a.type_id = at.id
                        LEFT JOIN rooms r ON a.location_room = r.id
                        LEFT JOIN key k ON a.location_key = k.id
                        WHERE a.id = $1`, [id]);

                    const old = existingAsset.rows[0];

                    function formatDatePreserveLocal(date) {
                        const d = new Date(date);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    }

                    function normalize(value) {
                        if (value === null || value === undefined) return '';
                        if (typeof value === 'boolean') return value ? 'true' : 'false';
                        if (Object.prototype.toString.call(value) === '[object Date]' || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                            return formatDatePreserveLocal(value);
                        }
                        return value.toString().trim();
                    }

                    // Check if any value changed
                    const hasChanged = (
                        normalize(code) !== normalize(old.code) ||
                        normalize(name_assets) !== normalize(old.name_assets) ||
                        normalize(asset_type) !== normalize(old.asset_type) ||
                        normalize(location_room) !== normalize(old.location_room) ||
                        normalize(location_key) !== normalize(old.location_key) ||
                        normalize(categorie) !== normalize(old.categorie) ||
                        normalize(quantity) !== normalize(old.quantity) ||
                        normalize(mrah) !== normalize(old.mrah) ||
                        normalize(asset_owner) !== normalize(old.asset_owner) ||
                        normalize(status) !== normalize(old.status) ||
                        normalize(expandable) !== normalize(old.expandable) ||
                        normalize(description) !== normalize(old.description) ||
                        normalize(service) !== normalize(old.service) ||
                        normalize(m2_inside) !== normalize(old.m2_inside) ||
                        normalize(is_fixed) !== normalize(old.is_fixed) ||
                        normalize(date_purchase) !== normalize(old.date_purchase) ||
                        normalize(date_written_off) !== normalize(old.date_written_off) ||
                        normalize(purchase_price) !== normalize(old.purchase_price) ||
                        normalize(comments) !== normalize(old.comments) ||
                        normalize(replaced_off) !== normalize(old.replaced_off) ||
                        normalize(year_of_life_cycle) !== normalize(old.year_of_life_cycle) ||
                        normalize(rest_of_life_cycle) !== normalize(old.rest_of_life_cycle) ||
                        normalize(replaced_by) !== normalize(old.replaced_by) ||
                        normalize(rest_value) !== normalize(old.rest_value)
                    );

                    if (!hasChanged) return; // Skip update if nothing changed

                    if (location_key !== '') {
                        query.push(client.query(`UPDATE assets SET
                            code = $2, name_assets = $3,  type_id = (SELECT id FROM assetstype WHERE type_name = $4),  location_room = (SELECT id FROM rooms WHERE nameroom = $5 AND camp_id = $14), 
                            location_key = (SELECT id FROM key WHERE namekey = $6 AND camp_id = $14), categorie = $7, quantity = $8, mrah = $9,
                            asset_owner = $10, status = $11, expandable = $12, description = $13,
                            service = $15, m2_inside = $16, is_fixed = $17, date_purchase = $18,
                            date_written_off = $19, purchase_price = $20, comments = $21, replaced_off = $22,
                            year_of_life_cycle = $23, rest_of_life_cycle = $24, replaced_by = $25, rest_value = $26
                            WHERE id = $1`,
                            [
                                id, code, name_assets, asset_type,
                                location_room, location_key, categorie || null, quantity || null,
                                mrah || 'Global RTS', asset_owner || 'Global RTS', status || 'New', expandable || 'Non Expandable',
                                description || null, req.session.camp, service || 'Billeting', m2_inside || null,
                                is_fixed, date_purchase || null, date_written_off || null, purchase_price || null,
                                comments || null, replaced_off || null, year_of_life_cycle || null, rest_of_life_cycle || null,
                                replaced_by || null, rest_value || null
                            ]
                        ));
                    } else {
                        query.push(client.query(`UPDATE assets SET 
                            code = $2, name_assets = $3,  type_id = (SELECT id FROM assetstype WHERE type_name = $4),  location_room = (SELECT id FROM rooms WHERE nameroom = $5 AND camp_id = $13), 
                            location_key = NULL, categorie = $6, quantity = $7, mrah = $8,
                            asset_owner = $9, status = $10, expandable = $11, description = $12,
                            service = $14, m2_inside = $15, is_fixed = $16, date_purchase = $17,
                            date_written_off = $18, purchase_price = $19, comments = $20, replaced_off = $21,
                            year_of_life_cycle = $22, rest_of_life_cycle = $23, replaced_by = $24, rest_value = $25
                            WHERE id = $1`,
                            [
                                id, code, name_assets, asset_type,
                                location_room, categorie || null, quantity || null, mrah || 'Global RTS',
                                asset_owner || 'Global RTS', status || 'New', expandable || 'Non Expandable', description || null,
                                req.session.camp, service || 'Billeting', m2_inside || null, is_fixed,
                                date_purchase || null, date_written_off || null, purchase_price || null, comments || null,
                                replaced_off || null, year_of_life_cycle || null, rest_of_life_cycle || null, replaced_by || null,
                                rest_value || null
                            ]
                        ));
                    }

                    const asset_quantity = Number(old.quantity);
                    const current_quantity = Number(quantity);

                    const result = await client.query(`SELECT * FROM assets WHERE id = $1;`, [id]);
                    const item_into = result.rows[0];

                    const result_exist_lost_date = await client.query(`SELECT * FROM lostitem WHERE item_id = $1;`, [id]);
                    const hasActionLostRow = result_exist_lost_date.rows.length > 0;

                    if (hasActionRow) {
                        if (asset_quantity === current_quantity) {
                            query.push(client.query(
                                `UPDATE asset_actions SET change_modificate_asset_quantity = change_modificate_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`,
                                [current_quantity, req.session.camp]
                            ));
                        } else if (asset_quantity > current_quantity) {
                            const lostQuantity = asset_quantity - current_quantity;

                            query.push(client.query(
                                `UPDATE asset_actions SET change_lost_asset_quantity = change_lost_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`,
                                [lostQuantity, req.session.camp]
                            ));

                            if (hasActionLostRow > 0) {
                                query.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC + $1 WHERE item_id = $2;`, [lostQuantity, id]));
                            } else {
                                query.push(client.query(`INSERT INTO lostitem VALUES (
                                (SELECT COALESCE(MAX(id)::integer, 0) + 1 FROM lostitem), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29);`,
                                    [
                                        item_into.code, 'Remove by editing', lostQuantity, item_into.id,
                                        item_into.name_assets, item_into.type_id, item_into.location_room, item_into.location_key,
                                        item_into.categorie, item_into.mrah, item_into.asset_owner, item_into.status,
                                        item_into.expandable, item_into.description, item_into.camp_id, item_into.create_date,
                                        item_into.last_inventory_date, item_into.service, item_into.m2_inside, item_into.is_fixed,
                                        item_into.date_purchase, item_into.date_written_off, item_into.purchase_price, item_into.comments,
                                        item_into.replaced_off, item_into.year_of_life_cycle, item_into.rest_of_life_cycle, item_into.replaced_by,
                                        item_into.rest_value
                                    ]));
                            }
                        } else {
                            query.push(client.query(
                                `UPDATE asset_actions SET change_asset_quantity = change_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`,
                                [current_quantity - asset_quantity, req.session.camp]
                            ));
                        }
                    } else {
                        if (asset_quantity === current_quantity) {
                            query.push(client.query(
                                `INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, 0, $1, $2);`,
                                [current_quantity, req.session.camp]
                            ));
                        } else if (asset_quantity > current_quantity) {
                            const lostQuantity = asset_quantity - current_quantity;

                            query.push(client.query(
                                `INSERT INTO asset_actions VALUES (CURRENT_DATE, 0, 0, $1, 0, $2);`,
                                [lostQuantity, req.session.camp]
                            ));

                            if (hasActionLostRow > 0) {
                                query.push(client.query(`UPDATE lostitem SET lost_quantity = lost_quantity::NUMERIC + $1 WHERE item_id = $2;`, [lostQuantity, id]));
                            } else {
                                query.push(client.query(`INSERT INTO lostitem VALUES (
                                (SELECT COALESCE(MAX(id)::integer, 0) + 1 FROM lostitem), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29);`,
                                    [
                                        item_into.code, 'Remove by editing', lostQuantity, item_into.id,
                                        item_into.name_assets, item_into.type_id, item_into.location_room, item_into.location_key,
                                        item_into.categorie, item_into.mrah, item_into.asset_owner, item_into.status,
                                        item_into.expandable, item_into.description, item_into.camp_id, item_into.create_date,
                                        item_into.last_inventory_date, item_into.service, item_into.m2_inside, item_into.is_fixed,
                                        item_into.date_purchase, item_into.date_written_off, item_into.purchase_price, item_into.comments,
                                        item_into.replaced_off, item_into.year_of_life_cycle, item_into.rest_of_life_cycle, item_into.replaced_by,
                                        item_into.rest_value
                                    ]));
                            }
                        } else {
                            query.push(client.query(
                                `INSERT INTO asset_actions VALUES (CURRENT_DATE, $1, 0, 0, 0, $2);`,
                                [current_quantity - asset_quantity, req.session.camp]
                            ));
                        }

                        // Update local flag so next row behaves correctly
                        hasActionRow = true;
                    }

                });

                await Promise.all(query);

                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Edit multi assets`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });
            } finally {
                client.release();
            }
        });

        this.app.get('/assets/addMultiAsset/download', this.isLoggedIn.bind(this), async (req, res) => {

            // Create a new Excel workbook
            const workbook = new excelJS.Workbook();

            // Sheet 1: Soldier Data
            const worksheet = workbook.addWorksheet('Add Multipul Assets');

            // Add custom column titles for the first sheet
            const headers = [
                'assetEpc', 'assetCode', 'assetName', 'assetTypeName',
                'assetLocation', 'assetSubLocation', 'assetCategorie', 'assetQuantity',
                'assetMrah', 'assetOwner', 'assetStatus', 'assetExpandable',
                'assetDescription', 'assetService', 'assetM2Inside', 'assetIsFixed',
                'assetDatePurchase', 'assetDateWrittenOff', 'assetPurchasePrice', 'assetComments',
                'assetReplacedOff', 'assetYearOfLifeCycle', 'assetRestOfLifeCycle', 'assetReplacedBy',
                'assetRestValue',
            ];

            const headerRow = worksheet.addRow(headers);

            // Apply styling to the headers
            headerRow.eachCell((cell, colNumber) => {
                cell.font = { bold: true, size: 12 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
                // Set red color for specific headers
                const redHeaders = [
                    'assetEpc',
                    'assetCode',
                    'assetName',
                    'assetTypeName',
                    'assetLocation',
                    'assetQuantity',
                    'assetIsFixed'
                ];
                if (redHeaders.includes(headers[colNumber - 1])) {
                    cell.font = { ...cell.font, color: { argb: 'FFFF0000' } }; // Red
                }
            });

            // Set column widths for sheet 1
            worksheet.columns = [
                { width: 35 }, { width: 20 }, { width: 20 }, { width: 20 },
                { width: 25 }, { width: 25 }, { width: 20 }, { width: 20 },
                { width: 20 }, { width: 20 }, { width: 20 }, { width: 25 },
                { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 },
                { width: 25 }, { width: 25 }, { width: 25 }, { width: 25 },
                { width: 25 }, { width: 25 }, { width: 25 }, { width: 25 },
                { width: 20 }
            ];

            // Set the response headers for file download
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=templateAddMultiAssets.xlsx');

            // Write the workbook to the response stream
            await workbook.xlsx.write(res);
            res.end(); // End the response

        });

        this.app.post('/assets/addMultiAsset', this.isLoggedIn.bind(this), upload.single('file'), async (req, res) => {
            const client = await pool.connect();
            const errors = [];

            try {
                await client.query('BEGIN');

                const checkPermission = await client.query(`
                        SELECT * FROM user_permission 
                        WHERE user_id = $1
                        AND perm_id IN (SELECT id FROM permission 
                            WHERE permission_name = 'Full permission' OR permission_name = 'Add asset')`, [req.session.userId]);

                if (checkPermission.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: "You don't have permission to add multipul assets!" });
                }

                if (!req.file) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'No file uploaded.' });
                }

                const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                // Set to track unique soldierIds in the file
                const seenIds = new Set();
                const seenCodes = new Set();

                if (sheetName !== 'Add Multipul Assets') {
                    await client.query('ROLLBACK');
                    errors.push({ type: 'InvalidFormat', message: `Invalid template` });
                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                await Promise.all(data.map(async (row, index) => {

                    if (!row.assetEpc || String(row.assetEpc).trim() === '') {
                        row.assetEpc = crypto.randomBytes(16).toString('hex');
                    }

                    const { error } = schemaAddMultiAsset.validate(row);

                    if (error) {
                        errors.push({ type: 'Validation', details: error.details, row, index });
                        return;
                    }

                    // Check for duplicates within the file
                    if (seenIds.has(row.assetEpc)) {
                        errors.push({ type: 'DuplicateInFile', row, index, message: `Duplicate epc code in row with asset code: '${row.assetCode}' in the file.` });
                        return;
                    }

                    if (seenCodes.has(row.assetCode)) {
                        errors.push({ type: 'DuplicateInFile', row, index, message: `Duplicate asset code '${row.assetCode}' in the file.` });
                        return;
                    }

                    seenIds.add(row.assetEpc);
                    seenCodes.add(row.assetCode);

                    // Check if the asset exists in the database
                    const result = await client.query(`SELECT * FROM assets WHERE id = $1;`, [row.assetEpc]);
                    const resultCode = await client.query(`SELECT * FROM assets WHERE code = $1 AND camp_id = $2`, [row.assetCode, req.session.camp]);

                    if (result.rows.length > 0 || resultCode.rows.length > 0) {
                        errors.push({ type: 'IsExistAsset', row, index, message: `Asset with code '${row.assetCode}' exists in the database.` });
                        return;
                    }

                    const result_type = await client.query(`SELECT * FROM assetstype WHERE type_name = $1;`, [row.assetTypeName]);
                    if (result_type.rows.length === 0) {
                        errors.push({ type: 'NotFound', row, index, message: `Asset type '${row.assetTypeName}' not found in the database.` });
                        return;
                    }

                    const result_room = await client.query(`
                        SELECT r.* FROM rooms r
                        LEFT JOIN buildroom br ON br.roomid = r.id
                        LEFT JOIN buildings b ON b.id = br.buildid
                        WHERE nameroom = $1 AND camp_id = $2;`, [row.assetLocation, req.session.camp]);

                    if (result_room.rows.length === 0) {
                        errors.push({ type: 'NotFound', row, index, message: `Room '${row.assetLocation}' not found in the database.` });
                        return;
                    }

                    if (row.assetTypeName === 'BED stackable' && row.assetSubLocation === '') {
                        errors.push({ type: 'NotFound', row, index, message: `The asset with code '${row.assetCode}' is a stackable bed and must have a location key.` });
                        return;
                    }

                    if (row.assetTypeName !== 'BED stackable' && row.assetSubLocation !== '') {
                        errors.push({ type: 'NotFound', row, index, message: `The asset with code '${row.assetCode}' is not a stackable bed and should not have a location key.` });
                        return;
                    }

                    const result_key = await client.query(`
                        SELECT k.* FROM key k
                        LEFT JOIN roomskey rk ON rk.keyid = k.id
                        LEFT JOIN buildroom br ON br.roomid = rk.roomid
                        LEFT JOIN buildings b ON b.id = br.buildid
                        WHERE namekey = $1 AND camp_id = $2;`, [row.assetSubLocation || null, req.session.camp]);

                    if (row.assetSubLocation && result_key.rows.length === 0) {
                        errors.push({ type: 'NotFound', row, index, message: `Key '${row.assetSubLocation}' not found in the database.` });
                        return;
                    }

                    const result_room_key = await client.query(`SELECT * FROM roomskey WHERE roomid = (SELECT id FROM rooms WHERE nameroom = $1) AND keyid = (SELECT id FROM key WHERE namekey = $2);`, [row.assetLocation, row.assetSubLocation || null]);
                    if (row.assetSubLocation && result_room_key.rows.length === 0) {
                        errors.push({ type: 'NotFound', row, index, message: `The associated key must be from a room ${row.assetLocation}. The key ${row.assetSubLocation} is not from room ${row.assetLocation}` });
                        return;
                    }

                }));

                if (errors.length > 0) {
                    await client.query('ROLLBACK');

                    const styleError = errors.find(error => error.type === 'Validation');

                    if (styleError) {
                        console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                        console.error(styleError.details);
                    }

                    return res.status(400).json({ message: 'Some rows could not be processed', errors });
                }

                let result_exist_date = await client.query(
                    `SELECT * FROM asset_actions WHERE date_change = CURRENT_DATE AND camp_id = $1`,
                    [req.session.camp]
                );

                let hasActionRow = result_exist_date.rows.length > 0;
                const query = [];

                data.map(async (row) => {

                    const {
                        assetEpc, assetCode, assetName, assetTypeName,
                        assetLocation, assetSubLocation, assetCategorie, assetQuantity,
                        assetMrah, assetOwner, assetStatus, assetExpandable,
                        assetService, assetDescription, assetM2Inside, assetIsFixed,
                        assetDatePurchase, assetDateWrittenOff, assetPurchasePrice, assetComments,
                        assetReplacedOff, assetYearOfLifeCycle, assetRestOfLifeCycle, assetReplacedBy,
                        assetRestValue
                    } = row;

                    if (assetSubLocation !== '') {
                        query.push(client.query(`
                            INSERT INTO assets VALUES (
                                $1, $2, $3, (SELECT id FROM assetstype WHERE type_name = $4), 
                                (SELECT id FROM rooms WHERE nameroom = $5), (SELECT id FROM key WHERE namekey = $6), $7, $8, 
                                $9, $10, $11, $12, 
                                $13, $14, 'undiscovered', CURRENT_TIMESTAMP, 
                                NULL, $15, $16, $17, 
                                $18, $19, $20, $21, 
                                $22, $23, $24, $25, $26);`,
                            [
                                assetEpc, assetCode, assetName, assetTypeName,
                                assetLocation, assetSubLocation, assetCategorie || null, assetQuantity || null,
                                assetMrah || 'Global RTS', assetOwner || 'Global RTS', assetStatus || 'New', assetExpandable || 'Non Expandable',
                                assetDescription || null, req.session.camp, assetService || 'Billeting', assetM2Inside || null,
                                assetIsFixed, assetDatePurchase || null, assetDateWrittenOff || null, assetPurchasePrice || null,
                                assetComments || null, assetReplacedOff || null, assetYearOfLifeCycle || '1', assetRestOfLifeCycle || '1',
                                assetReplacedBy || null, assetRestValue || '1'
                            ]
                        ));

                    } else {
                        query.push(client.query(`
                            INSERT INTO assets VALUES (
                                $1, $2, $3, (SELECT id FROM assetstype WHERE type_name = $4), 
                                (SELECT id FROM rooms WHERE nameroom = $5), NULL, 
                                $6, $7, $8, $9, 
                                $10, $11, $12, $13, 
                                'undiscovered', CURRENT_TIMESTAMP, NULL, $14, 
                                $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25);`,
                            [
                                assetEpc, assetCode, assetName, assetTypeName,
                                assetLocation, assetCategorie || null, assetQuantity || null, assetMrah || 'Global RTS',
                                assetOwner || 'Global RTS', assetStatus || 'New', assetExpandable || 'Non Expandable', assetDescription || null,
                                req.session.camp, assetService || 'Billeting', assetM2Inside || null, assetIsFixed,
                                assetDatePurchase || null, assetDateWrittenOff || null, assetPurchasePrice || null, assetComments || null,
                                assetReplacedOff || null, assetYearOfLifeCycle || '1', assetRestOfLifeCycle || '1', assetReplacedBy || null,
                                assetRestValue || '1'
                            ]
                        ));
                    }

                    const current_quantity = Number(assetQuantity);

                    if (hasActionRow) {
                        query.push(client.query(`UPDATE asset_actions SET change_asset_quantity = change_asset_quantity::NUMERIC + $1 WHERE date_change = CURRENT_DATE AND camp_id = $2;`, [current_quantity, req.session.camp]));

                    } else {
                        query.push(client.query(`INSERT INTO asset_actions VALUES (CURRENT_DATE, $1, 0, 0, 0, $2);`, [current_quantity, req.session.camp]));
                        hasActionRow = true;
                    }

                });

                await Promise.all(query);

                await client.query("INSERT INTO usermonitoring (username, location) VALUES ($1, $2)",
                    [req.session.username, `Add multi assets`]);

                await client.query('COMMIT');
                return res.status(200).json({ message: 'File processed successfully' });

            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`[${new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ')}] ${req.method} ${req.originalUrl}`);
                console.error('Error processing file:', error);
                res.status(500).json({ message: 'An error occurred while processing the file.' });
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
