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
 * REST apis for car reservation
 */
var router = module.exports = require('express').Router();
var Q = require('q');
var _ = require('underscore');
var debug = require('debug')('reservation');
debug.log = console.log.bind(console);

var IOTF = require('../../watsonIoT');
var connectedDevices = require('../../workbenchLib').connectedDevicesCache;
var contextMapping = require('../../driverInsights/contextMapping.js');

var dbClient = require('../../cloudantHelper.js');
var authenticate = require('./auth.js').authenticate;

//get CD client
var DB = null;
dbClient.getDBClient().then(function(db){
	DB = db;
});

var validator = new Validator();

/*
 * Find cars nearby the specific location.
 * For the demonstration, if there is no cars,
 * create several cars automotically around the location.
 */
router.get('/carsnearby/:lat/:lng', function(req, res) {
	getCarsNearBy(req.params.lat, req.params.lng).then(function(devices){
		return res.send(devices);
	})['catch'](function(err){
		console.error('error: ' + JSON.stringify(err))
		if(err.status)
			return res.status(err.status).send(err.message);
		else{
			return res.status(500).send(err);
		}
	}).done();
});

/*
 * get all active reservations for a login user
 */
router.get('/activeReservations', authenticate, function(req, res) {
	getReservations(req.user.id, true).then(function(reservations){
		debug(JSON.stringify(reservations));
		return res.send(reservations);
	})["catch"](function(err){
		if(err.status)
			return res.status(err.status).send(err.message);
		else
			return res.status(500).send(err);
	});
});

/*
 * get all reservations for a login user
 */
router.get('/reservation', authenticate, function(req, res) {
	getReservations(req.user.id, false).then(function(reservations){
		debug(JSON.stringify(reservations));
		return res.send(reservations);
	})["catch"](function(err){
		if(err.status)
			return res.status(err.status).send(err.message);
		else
			return res.status(500).send(err);
	}).done();
});

/*
 * get a reservation - response the reservation
 */
router.get('/reservation/:reservationId', authenticate, function(req, res) {
	getActiveUserReservation(req.params.reservationId, req.user.id).then(
		function(reservation){
			debug(JSON.stringify(reservation));
			return res.send(reservation);
		}
	)["catch"](function(err){
		if(err.status)
			return res.status(err.status).send(err.message);
		else
			return res.status(500).send(err);
	}).done();
});

/*
 * create reservation - response the reservation ID
 */
router.post('/reservation', authenticate, function(req, res) {
	if(!req.body.carId || !validator.isNumeric(req.body.pickupTime) || !validator.isNumeric(req.body.dropOffTime))
		return res.status(400).send("missing request params");
	dbClient.searchView('activeReservations', {key: req.body.carId}).then(function(result){
		if(result.rows.length > 0)
			return res.status(409).send("car already taken");
		//create reservation
		var reservation = {
				type: "reservation",
				carId: validator.escapeId(req.body.carId),
				pickupTime: req.body.pickupTime,
				dropOffTime: req.body.dropOffTime,
				userId: validator.escapeId(req.user.id),
				status: "active"
		};
		DB.insert(reservation ,null, function(err, doc){
			if(err){
				console.error(err);
				return res.status(500).end();
			}
			return res.send({reservationId : doc.id});
		});
	}).done();
});

/*
 * update a reservation - response the update reservation
 */
router.put('/reservation/:reservationId', authenticate, function(req, res) {
	if(!req.body.pickupTime && !req.body.dropOffTime && !req.body.status)
		return res.status(204).end();
	getActiveUserReservation(req.params.reservationId, req.user.id).then(
		function(reservation){
			if(reservation.actualPickupTime && req.body.pickupTime){
				console.error("Failed to update a reservation: car already pickedup");
				return res.status(400).send("car already pickedup");
			}

			var promise = Q(reservation);
			if(req.body.status && req.body.status.toUpperCase() == "CLOSE"){
				IOTF.sendCommand("ConnectedCarDevice", reservation.carId, "lock");
				reservation.status = "closed";
				reservation.actualDropoffTime = Date.now();
				debug('Testing if call onReservationClosed or not');
				if (router.onReservationClosed){
					debug(' -- calling onReservationClosed...');
					promise = router.onReservationClosed(reservation);
				}
			}

			reservation.pickupTime = validator.isNumeric(req.body.pickupTime) ? req.body.pickupTime : reservation.pickupTime;
			reservation.dropOffTime = validator.isNumeric(req.body.dropOffTime) ? req.body.dropOffTime : reservation.dropOffTime;

			promise.then(function(reservation){
				DB.insert(reservation ,null, function(err, result){
					if(err){
						console.error(err);
						return res.status(500).end();
					}
					reservation._rev = res.rev;
					var device = connectedDevices.getConnectedDevice(reservation.carId);
					if(device)
						reservation.carDetails = device;
					return res.send(reservation);
				});
			}).done();
		}
	)["catch"](function(err){
		console.error(err);
		if(err.status)
			return res.status(err.status).send(err.message);
		else
			return res.status(500).send();
	}).done();
});

/*
 * cancel reservation - response 'canceled;
 */
router['delete']('/reservation/:reservationId', authenticate, function(req, res) {
	DB.get(req.params.reservationId ,null,function(err,reservation) {
		if(err){
			if(err.error == 'not_found')
				return res.status(404).send("no such reservation " + req.params.reservationId);
			else{
				console.error(err);
				return res.status(500).end();
			}
		}
		if( (reservation.userId !== req.user.id) || (reservation.status !== "active") ){
			console.error("this reservation is not active or was not made by this user.");
			return res.status(404).send("no such reservation " + req.params.reservationId);
		}
		reservation.status = "canceled";
		DB.insert(reservation ,null, function(err, result){
			if(err){
				console.error(err);
				return res.status(500).end();
			}
			return res.send('canceled');
		});
	});
});

/*
 * Control a car:
 * Support only lock and unlock commands.
 */
router.post('/carControl', authenticate, function(req, res) {
	if(!req.body.reservationId && !req.body.command) // req.body.location
		return res.status(404).end("missing body");
	return getActiveUserReservation(req.body.reservationId, req.user.id).then(
		function(reservation){
			var device = connectedDevices.getConnectedDevice(reservation.carId);
			if(!device)
				return res.status(500).send("Device is offline");

			if(req.body.command.toUpperCase()  == "LOCK"){
				IOTF.sendCommand("ConnectedCarDevice", device.deviceID, "lock");
				device.status = "Locked";
				reservation.carDetails = device;
				return res.send(reservation);
			}
			else if(req.body.command.toUpperCase()  == "UNLOCK"){
				IOTF.sendCommand("ConnectedCarDevice", device.deviceID, "unlock");
				if(!reservation.pickupLocation || !reservation.actualPickupTime){//if this is first unlock update reservation
					reservation.pickupLocation = {lat: device.lat, lng: device.lng};
					reservation.actualPickupTime = Date.now();
					reservation.status = "driving";
					DB.insert(reservation ,null, function(err, result){});
				}
				device.status = "Unlocked";
				reservation.carDetails = device;
				return res.send(reservation);
			}

		}
	)["catch"](function(err){
		console.error(err);
		if(err.status)
			return res.status(err.status).send(err.message);
		else
			return res.status(500).send();
	});
});

/*
 * get connectedDevices - response the connectedDevices
 */
router.get('/connectedDevices', authenticate, function(req,res){
	res.send(connectedDevices.getConnectedDevices());
});

router.get('/ui/reservation', authenticate, function(req, res) {
	res.render("reservation", {});
});
/*
 * ****************** Get Cars Near By Functions ***********************
 */
/*
 * Get cars nearby
 */
function getCarsNearBy(lat, lng){
	
	// lat and lng variables in this call object are shared among all closures
	lat = (_.isString(lat)) ? parseFloat(lat) : lat;
	lng = (_.isString(lng)) ? parseFloat(lng) : lng;
	
	// do mapMatch and update the (lat,lng) to matched ones
	function matchMapOrigin(){
		// do matchMap with error-fallback option
		return Q.allSettled([contextMapping.matchMap(lat, lng), 'default'])
				.spread(function(matchResult, defaultResult){
					if (matchResult.state == 'fulfilled'){
						lat = matchResult.value.lat;
						lng = matchResult.value.lng;
					}
				});
	}
	
	function findExistingCarsNearBy(){
		var devices = connectedDevices.getConnectedDevices();
		var devicesNearBy = devices.filter(function(device){
			if(!device.lat || !device.lng)
				return false;
			var distance = getDistance(
					{latitude: device.lat, longitude: device.lng},
					{latitude: lat, longitude: lng}
			);
			return distance < 1000;//first filter out those who are in radius of 1000
		}).map(_.clone);
		return devicesNearBy;
	}
	
	function filterOutUnreservedCars(devices){
		var devicesIds = _.pluck(devices, 'deviceID');
		return dbClient.searchView('activeReservations', {keys: devicesIds}).then(function(result){
			var activeDeviceIds = _.pluck(result.rows, 'key');
			var result = devices.filter(function(device){
				return activeDeviceIds.indexOf(device.deviceID) < 0; // retain if missing
			});
			return result;
		});
	}
	
	function reviewAndUpdateList(devicesNearBy){
		// expand car list if necessary
		if (router.onGetCarsNearbyAsync){
			// user exit to allow demo-cars around
			return router.onGetCarsNearbyAsync(lat, lng, devicesNearBy)
				.then(filterOutUnreservedCars);
		}else{
			return Q(devicesNearBy);
		}
	}
	
	function appendDistance(devices){
		// add route distance to all devices
		return Q.all(devices.map(function(device){
			return contextMapping.routeDistance(lat, lng, device.lat, device.lng)
					.then(function(dist){ 
						device.distance = dist; 
						return device; 
					});
				}));
	}
	
	return matchMapOrigin()
		.then(dbClient.cleanupStaleReservations)
		.then(findExistingCarsNearBy)
		.then(filterOutUnreservedCars)
		.then(reviewAndUpdateList)
		.then(appendDistance)
		.then(dbClient.getDeviceDetails);
}

//Callback onGetCarsNearby: override & respond with - function(lat,lng,carsNearBy)
//- carsNearBy is an array containing cars
router.onGetCarsNearbyAsync = null;
router.onReservationClosed = null;

/*
 * ****************** Reservation Functions ***********************
 */
/*
 * Get reservations for a user
 */
function getReservations(userid, activeOnly){
	var viewName = activeOnly ? 'activeReservations' : 'allReservations';
	return dbClient.searchView(viewName, {key: userid})
		.then(function(result){
			// get reservations
			var reservations = result.rows.map(function(item){
				var reservation = item.value;
				reservation.carDetails = connectedDevices.getConnectedDevice(reservation.carId);
				if(!reservation.carDetails){
					//in case that the device is inactive, the carDetails can be null.
					//for the workaround, create a dummy device object to feed deviceID
					reservation.carDetails = {deviceID: reservation.carId};
				}
				return dbClient.getDeviceDetails(reservation.carDetails).then(function(device){
					reservation.carDetails = device;
					return reservation;
				})['catch'](function(err){
					return reservation; // resolve as `reservation` in case of error as well
				});
			});
			return Q.all(reservations);
		});
}

/*
 * Get an active reservation
 */
function getActiveUserReservation(reservationId, userid){
	var deferred = Q.defer();
	DB.get(reservationId ,null,function(err,reservation) {
		if(err){
			if(err.error == 'not_found')
				deferred.reject( {status: 404, message: "no such reservation " + reservationId} );
			else{//db error
				console.error(err);
				deferred.reject( {status: 500, message: err.message} );
			}
		}
		else if(reservation.userId !== userid)//reservation does not belong to current user
			deferred.reject( {status: 404, message: "no such reservation " + reservationId + " for current user"} );
		else if(reservation.status !== "active" && reservation.status !== "driving") //reservation not active
			deferred.reject( {status: 404, message: "no such active reservation " + reservationId} );
		else
			deferred.resolve(reservation);
	});
	return deferred.promise;
};

/*
 * ****************** Generic Utility Functions ***********************
 */

/**
 * Calculate distance in meters between two points on the globe
 * - p0, p1: points in {latitude: [lat in degree], longitude: [lng in degree]}
 */
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
};

function Validator(){
	this.isNumeric = function(str){return !isNaN(str)};

	this.escapeName = function(str){return str && str.replace(/[^0-9a-zA-Z\s_-]/g, "_");};
	this.escapeId = function(str){return str && str.replace(/^[^0-9a-zA-Z]+/, "").replace(/[^0-9a-zA-Z_-]/g, "_");};
}