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

var Q = require('q');
var request = require('request');
var _ = require('underscore');
var fs = require('fs-extra');
var chance = require('chance')();
var debug = require('debug')('_app');
debug.log = console.log.bind(console);

var simulationClientCtor = require('./devicesSimulation/simulationClient');
var simulationImporterCtor = require('./devicesSimulation/simulationImporter.js');
var driverInsightsAnalyze = require('./driverInsights/analyze.js');
var driverInsightsProbe = require('./driverInsights/probe.js');
var contextMapping = require('./driverInsights/contextMapping.js');

var dbClient = require('./cloudantHelper.js');

//User environment variable for disabling car simulation
var DISABLE_DEMO_CAR_DEVICES = (process.env.DISABLE_DEMO_CAR_DEVICES || 'false') == 'true';

/*
 * *************** demo implementation of looking up device details ********************
 * For demo, generate a dummy info at random. The info can be the following JSON:
 * - name: "<who> car" as name of the car
 * - license: "<DDD-DD-DDDD>"
 * - model: a JSON object, one in _deviceModelInfoSamples.json or similar
 */
// this will be set to dbClient.onGettingNewDeviceDetails
var deviceModelSamples; // caches the template file in memory
var onGettingNewDeviceDetails = function(device){
	console.log('Generating device details info for ' + device.deviceID + '...');
	// support functions
	function getDeviceModelInfo(){
		var samples = deviceModelSamples;
		if (!Array.isArray(samples)){
			samples = fs.readJsonSync('_deviceModelInfoSamples.json').templates;
			if (!samples){
				console.error('Failed to load ./_deviceModelInfoSamples.json');
				samples = [];
			}
			deviceModelSamples = samples;
		}
		// randomly pick one
		if (!samples)
			return {}
		return samples[Math.floor(Math.random() * samples.length)];
	}
	
	// prepare a new document property
	var doc = {
		name: chance.name() + ' car',
		license: chance.ssn(),
		model: getDeviceModelInfo()
	};
	return doc;
}

/*
 * *************** Simulated cars implementation ********************
 * 
 * This example uses simulated cars when no cars are available
 * for reservation. The simulated cars are implemented as follow:
 * 
 * - Pre request, create simulated devices
 *   - Using simulation client, create devices and start the simulation (devicesCache.reserveDevices)
 *     - the created devices are managed in devicesCache
 *     - they are also persist in the registeredDevices document in the mobilitystarterappdb DB
 *       * the devices simulation is resumed using the document
 *     - the devices properties (e.g. lat, lng) are updated per the request
 * - The devices are simulated in the simulation engine
 *   - They connect to IoT Foundation and send/recv MQTT messages
 */

// a function to be injected to 'reservation.js' to create simulated cars when cars are not available...
var onGetCarsNearbyAsync = function(lat, lng, devicesNearBy){
	if (devicesNearBy && devicesNearBy.length > 0)
		return Q(devicesNearBy);
	
	else//create 5 simulated cars for demo
		return createSimulationAround(lat, lng , 5, 600).then(function(simDevices){
			return simDevices.map(_.clone);
		});
};

//a function to be injected to 'reservation.js' to add trip_id from simulated trips when reservation is completed
var onReservationClosed = function(reservation){
	var tripIdList = simulationImporter.getTripIdList();
	if(!reservation.pickupLocation){
		reservation.trip_id = tripIdList[Math.floor(Math.random() * tripIdList.length)];
		return Q(reservation);
	}
	var funcs = [];
	for(var i=0;i<5;i++){
		var tid = tripIdList[Math.floor(Math.random() * tripIdList.length)];
		funcs.push(simulationImporter.getTripLocation(tid));
	}
	var deferred = Q.defer();
	Q.all(funcs).then(function(results){
		var trip = null;
		var distance = Number.MAX_VALUE;
		results.forEach(function(loc){
			var d = getDistance({latitude: reservation.pickupLocation.lat, longitude: reservation.pickupLocation.lng}, 
							{latitude: loc.lat, longitude: loc.lng});
			if(d < distance){
				trip = loc.trip_id;
				distance = d;
			}
		});	
		reservation.trip_id = trip;
		deferred.resolve(reservation);
	})['catch'](function(err){ 
		deferred.reject(err);
	});
	return deferred.promise;
};

function getDistance(p0, p1) {
	// Convert to Rad
	function to_rad(v) {
		return v * Math.PI / 180;
	}
	var latrad0 = to_rad(p0.latitude);
	var lngrad0 = to_rad(p0.longitude);
	var latrad1 = to_rad(p1.latitude);
	var lngrad1 = to_rad(p1.longitude);
	var norm_dist = Math.acos(Math.sin(latrad0) * Math.sin(latrad1) + Math.cos(latrad0) * Math.cos(latrad1) * Math.cos(lngrad1 - lngrad0));
	
	// Earths radius in meters via WGS 84 model.
	var earth = 6378137;
	return earth * norm_dist;
}

/*
 * Simulated cars session
 */
var simulationClient;
var simulationImporter;
var DB = null;

/**
 * Async create simulated cars around (lat, lng)
 * - Create simulated devices using the simulation client (devicesCache.reserveDevices)
 * - Move cars to (lat, lng) as well as setting car properties
 */
function createSimulationAround(lat, lng, numOfCars, radius){
	// handle default arg values
	numOfCars = (numOfCars)? numOfCars : 5;
	radius = (radius)? radius : 500;
	
	// prepare deferred functions for creating simulation
	var functions = [devicesCache.reserveDevices("ConnectedCarDevice", numOfCars)];
	function randCarAttributes(){
		var rndLocation = getRandomLocation(lat,lng, radius);
		return contextMapping.matchMap(rndLocation.lat, rndLocation.lng);
	}
	for(var i = 0; i < numOfCars; i++)
		functions.push(randCarAttributes());
	
	return Q.all(functions)
		.then(function(results){
			var devices = results[0];
			results.shift();
			var respDevices = devices.map(function(device, index){
				var respDevice = {deviceID: device.deviceID};
				Object.keys(results[index]).forEach(function(key){
					var value = results[index][key];
					simulationClient.setAttributeValue(device.deviceID, key, value.toString());
					respDevice[key] = value;
				});
				simulationClient.connectDevice(device.deviceID);
				return respDevice;
			});
			return respDevices;
		});
};

function startSimulation(){
	//
	// Start or resume simulation engine w/ cars which were in the previous session
	//
	var schemafileName = "./devicesSimulation/schemas.json";
	simulationClient = new simulationClientCtor({simulationConfigFile: schemafileName});
	simulationClient.on("error", function (err){
		console.error(err);
	});
	
	// start engine
	dbClient.getDBClient()
	.then(function(db){
		DB = db; // set value to DB in this module
	})
	.then(function(){
		return devicesCache.loadDevices();
	})
	.then(function(){
		// terminate simulation engine
		console.log('Restarting the simulation engine...');
		return simulationClient.terminateSimulation()['catch'](function(err){ /*ignore*/ });
	})
	.then(function(){
		// start simulation engine
		_.delay(function(){
			simulationClient.startSimulation();
		}, 2000);
	})
	.done();
}

function startImportingDrivingHistories(){
	//
	// Import driving histories
	//
	simulationImporter = new simulationImporterCtor();
	_isProbeExist().then(function(isProbeExist){
		if(isProbeExist) return;

		simulationImporter.on("error", function(err){
			console.error(err);
		});
		var simulationDir = "./devicesSimulation/data/";
		fs.readdir(simulationDir, function(err, files){
			files.forEach(function(file){
				if(file.endsWith(".fcd.xml")){
					simulationImporter.loadFcdSimulation(simulationDir + file);
				}else if(file.endsWith(".probe.json")){
					simulationImporter.loadJsonSimulation(simulationDir + file);
				}
			});
			// Send job request to show "something" for trial user
			setTimeout((driverInsightsAnalyze.sendJobRequest).bind(driverInsightsAnalyze), simulationImporter.FIRST_JOB_REQUEST_TIME);
		});
	});
	
	// support func
	function _isProbeExist(){
		var deferred = Q.defer();
		driverInsightsProbe.getCarProbeDataListAsDate(function(probe){
			try{
				var probe = JSON.parse(probe);
				deferred.resolve(probe && probe.date && probe.date.length > 0);
			}catch(ex){
				deferred.resolve(false);
			}
		});
		return deferred.promise;
	}
}

/**
 * Simulated devices tracking object
 */
var devicesCache = {};
devicesCache.freeDevices = {};
devicesCache.reservedDevices = {};
devicesCache.allDevices = [];
devicesCache.registeredDevicesDoc = {_id: "registeredDevices", devices: []};

/**
 * Recreate simulated devices from the database
 * - Load simulated devices from the `this.registeredDevicesDoc` document, and add them to the simulation engine
 */
devicesCache.loadDevices = function(filepath){
	var deferred = Q.defer();
	var _this = this;
	DB.get("registeredDevices",null,function(err,doc){
		if(!err){
			_this.registeredDevicesDoc = doc;
			_this.freeDevices = _.groupBy(_this.registeredDevicesDoc.devices, 'archDeviceGuid');
			_this.registeredDevicesDoc.devices.forEach(function(device){
				debug('Resuming device simulation... deviceID: ' + device.deviceID);
				simulationClient.addDevice(device);
			});
			deferred.resolve();
		}
		else if(err.error == 'not_found')
			deferred.resolve(); //no such doc yet
		else
			deferred.reject();
	});
	return deferred.promise;
}

/**
 * Save the `this.registeredDevicesDoc` to store the current list of devices
 */
devicesCache.saveDevices = function(){
	var deferred = Q.defer();
	var _this = this;
	DB.insert(this.registeredDevicesDoc ,null, function(err, doc){
		if(!err){
			_this.registeredDevicesDoc._rev = doc._rev;
			deferred.resolve();
		}
		else
			deferred.reject();
	});
	return deferred.promise;
}

// release devices
devicesCache.releaseDevice = function(device){
	simulationClient.disconnectDevice(device.deviceID);
	device.lastRunAttributesValues = [];
	this.freeDevices[deviceType] = (this.freeDevices[deviceType])? this.freeDevices[deviceType] : [];
	this.freeDevices[deviceType].push(device);
	delete this.reservedDevices[device.deviceID];
};

/**
 * Reserve devices for this simulation
 */
devicesCache.reserveDevices = function(deviceType, numOfDevices){
	var reservation = [];
	var nameIndex = _.indexBy(simulationClient.simulationConfig.devicesSchemas, "name");
	var typeGuid = nameIndex[deviceType].guid;
	this.freeDevices[typeGuid] = (this.freeDevices[typeGuid])? this.freeDevices[typeGuid] : [];
	var freeDevices = this.freeDevices[typeGuid];
	while(freeDevices.length > 0 && reservation.length < numOfDevices) {
		var device = freeDevices.pop();
		this.reservedDevices[device.deviceID] = device;
		reservation.push(device);
	}

	if(reservation.length < numOfDevices){
		var deferred = Q.defer();
		var _this = this;
		var howMuch2Create = (numOfDevices <= 30) ? numOfDevices : 30;
		console.log('Creating ' + howMuch2Create + ' devices in the simulation engine...');
		simulationClient.createDevices(deviceType, howMuch2Create).then(
				function(devices){
					debug(' ' + devices.length + ' devices are newly created');
					devices.forEach(function(device){
						_this.registeredDevicesDoc.devices.push(device);
						if(reservation.length < numOfDevices){
							_this.reservedDevices[device.deviceID] = device;
							reservation.push(device);
						}
						else{
							_this.freeDevices[typeGuid].push(device);
						}
					}, _this);
					_this.saveDevices();
					deferred.resolve(reservation);
				})['catch'](function(err){
					console.error(err);
					deferred.reject({
						status: 500, 
						message: 'Failed to create new demo car devices: ' + (err.message || (err.data && err.data.message) || 'see console log for the details')
					});
				});
		return deferred.promise;
	}
	return Q(reservation);
};

/*
 * ****************** Generic Utility Functions ***********************
 */

/**
 * Get randomely placed position `{lat: x, lng: y}` within a circle.
 */
function getRandomLocation(latitude, longitude, radiusInMeters) {

	var getRandomCoordinates = function (radius, uniform) {
		// Generate two random numbers
		var a = Math.random(), b = Math.random();
		// Flip for more uniformity.
		if (uniform) {
			if (b < a) {
				var c = b;
				b = a;
				a = c;
			}
		}

		// It's all triangles.
		return [
			b * radius * Math.cos(2 * Math.PI * a / b),
			b * radius * Math.sin(2 * Math.PI * a / b)
		];
	};

	var randomCoordinates = getRandomCoordinates(radiusInMeters, true);

	// Earths radius in meters via WGS 84 model.
	var earth = 6378137;

	// Offsets in meters.
	var northOffset = randomCoordinates[0],
	eastOffset = randomCoordinates[1];

	// Offset coordinates in radians.
	var offsetLatitude = northOffset / earth,
	offsetLongitude = eastOffset / (earth * Math.cos(Math.PI * (latitude / 180)));

	// Offset position in decimal degrees.
	return {
		lat: latitude + (offsetLatitude * (180 / Math.PI)),
		lng: longitude + (offsetLongitude * (180 / Math.PI))
	};
};


/**
 * Initialize the car simulation session for the demo.
 */
(function(){
	// enable car simulation
	if (!DISABLE_DEMO_CAR_DEVICES){
		startSimulation()
		// set simulated cars for the reservation router
		var reservationRouter = require('./routes/user/reservation.js');
		reservationRouter.onGetCarsNearbyAsync = onGetCarsNearbyAsync;
		reservationRouter.onReservationClosed = onReservationClosed;
	}
	
	// enable driving history
	startImportingDrivingHistories();
	
	// enable dummy car details info
	dbClient.onGettingNewDeviceDetails = onGettingNewDeviceDetails;
	
})();
