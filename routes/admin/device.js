/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * REST apis for car devices
 */
var router = module.exports = require('express').Router();
var authenticate = require('./auth.js').authenticate;
var devices = require('../../devices/devices.js');
var debug = require('debug')('device');
debug.log = console.log.bind(console);

/**
 * get all devices
 */
router.get('/device', authenticate, function(req,res) {
	devices.getAllDevices().then(function(results) {
		res.send(results);
	})['catch'](function(err){
		res.status((err&&(err.status||err.statusCode))||500).send(err);
	});
});

/**
 * get specific device's credentials. 
 * if the device has not been registered, register new device.
 */
router.get('/device/credentials/:typeId/:deviceId', authenticate, function(req,res) {
	devices.getCredentials(getDevice(req)).then(function(results) {
		res.send(results);
	})['catch'](function(err){
		res.status((err&&(err.status||err.statusCode))||500).send(err);
	});
});

/**
 * get specific device's details
 */
router.get('/device/:typeId/:deviceId', authenticate, function(req,res) {
	devices.getDeviceDetails(getDevice(req)).then(function(results) {
		res.send(results);
	})['catch'](function(err){
		res.status((err&&(err.status||err.statusCode))||500).send(err);
	});
});

/**
 * create new device
 */
router.post('/device', authenticate, function(req,res) {
	devices.createDevice(null, req.body).then(function(results) {
		res.status(201).send(results);
	})['catch'](function(err){
		res.status((err&&(err.status||err.statusCode))||500).send(err);
	});
});

/**
 * create new device
 */
router.post('/device/:typeId', authenticate, function(req,res) {
	devices.createDevice(getDevice(req), req.body).then(function(results) {
		res.status(201).send(results);
	})['catch'](function(err){
		res.status((err&&(err.status||err.statusCode))||500).send(err);
	});
});

/**
 * create new device
 */
router.post('/device/:typeId/:deviceId', authenticate, function(req,res) {
	devices.createDevice(getDevice(req), req.body).then(function(results) {
		res.status(201).send(results);
	})['catch'](function(err){
		res.status((err&&(err.status||err.statusCode))||500).send(err);
	});
});

/**
 * update specific device's details
 */
router.put('/device/:typeId/:deviceId', authenticate, function(req,res) {
	devices.updateDevice(getDevice(req), req.body).then(function(results) {
		res.status(200).end();
	})['catch'](function(err){
		res.status((err&&(err.status||err.statusCode))||500).send(err);
	});
});

/**
 * delete specific devices
 */
router['delete']('/device', authenticate, function(req,res) {
	devices.removeDevice(req.body.devices, true).then(function(results) {
		res.status(200).send(results);
	})['catch'](function(err){
		res.status((err&&(err.status||err.statusCode))||500).send(err);
	});
});

/**
 * delete specific device
 */
router['delete']('/device/:typeId/:deviceId', authenticate, function(req,res) {
	devices.removeDevice(getDevice(req), true).then(function(results) {
		res.status(200).end();
	})['catch'](function(err){
		res.status((err&&(err.status||err.statusCode))||500).send(err);
	});
});

function getDevice(req) {
	var deviceID = req.params.deviceId;
	var typeID = req.params.typeId;

	var device = {};
	if (deviceID && deviceID != '_') device.deviceID = deviceID;
	if (typeID && typeID != '_') device.typeID = typeID;
	return device;
}

/**
 * Show car details form
 */
router.get('/ui/device', function(req, res) {
	res.render('devicelist', {});
});

/**
 * Show car details form
 */
router.get('/ui/device/form', function(req, res) {
	res.render('deviceform', {});
});

