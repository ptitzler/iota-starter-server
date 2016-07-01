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
 * This files for defining REST services for cars status information on the monitoring
 * console. Depending on the latency from the types of the information, this router offers two types
 * of services, a REST service and a WebSocket service.
 * 
 * The REST service provides car information which involves ones from back-end databases.
 * The /cars/query services is the implementation and provides device reservation status, which
 * is storeed in the application DB, as well as car status.
 * 
 * The WebSocket service only offers real-time information from the backend IoT Platform.
 * The endpoint can be obtained from the response of /cars/query REST service. 
 *
 * REST servies:
 *  /cars/qeury
 *  /cars/query?countby=status
 *
 * Debug: DEBUG=monitoring:cars
 */
var router = module.exports = require('express').Router();
var Q = require('q');
var _ = require('underscore');
var WebSocketServer = require('ws').Server;
var appEnv = require("cfenv").getAppEnv();

var cloudantHelper = require('../../cloudantHelper.js');
var IOTF = require('../../watsonIoT');
var connectedDevices = require('../../workbenchLib').connectedDevicesCache;

var debug = require('debug')('monitoring:cars');
debug.log = console.log.bind(console);

var devicesDB = cloudantHelper.db; // promise

/**
 * Get all the devices list in a region
 * 
 * GET /monitoring/cars/query?max_lat=[float]&max_lng=[float]&min_lat=[]&min_lng=[][&countby=status]
 * Result: 200 OK
 * { devices: [
 *   {"deviceID": "1234567890ab", 
 *    "lat": 12.345, 
 *    "lng": 34.567, 
 *    "status": "[status]",
 *    "t": 1234567890 },
 *   ...
 * ]}
 * where [status] in {'in_use', 'available', 'unavailable'}
 * 
	// search cars and the status in the area as follow
	// 1. get cars from DB (devices)
	// 2. for each cars from DB, test if it's in the devicsCache
	//   -> false to set the car state: `unavailable`
	//   -> true to look at the car's lock status
	//     -> "Locked" cars are categorized as status `in_use`
	//     -> "Unlocked" cars are categorized as `available` 
 * 
 * When the [&countby=status] parameter is set,
 * Result: 200 OK
 * {
 *   "all": 20,
 *   "in_use": 10,
 *   "available": 5,
 *   "unavailable": 5
 * }
 * 
 * Examples:
 *  List all the cars
 *   http://localhost:6003/monitoring/cars/query?min_lat=-90&max_lat=90&min_lng=-180&max_lng=180
 */
router.get('/cars/query', function(req, res){
	var max_lat = parseFloat(req.query.max_lat),
		max_lng = parseFloat(req.query.max_lng),
		min_lat = parseFloat(req.query.min_lat),
		min_lng = parseFloat(req.query.min_lng);
	// normalize
	var whole_lng = ((max_lng - min_lng) > 360);
	min_lng = ((min_lng + 180) % 360) - 180;
	max_lng = ((max_lng + 180) % 360) - 180;
	// test the query values
	if ([max_lat, max_lng, min_lat, min_lng].some(function(v){ return isNaN(v); })){
		return res.status(400).send('One or more of the parameters are undefined or not a number'); // FIXME response code
	}
	var extent = {min_lng: min_lng, min_lat: min_lat, max_lng: max_lng, max_lat: max_lat, whole_lng: whole_lng};
	
	// countby query sring
	var countby = req.query.countby;
	if (countby && countby !== 'status'){
		return res.status(400).send('Unsupported countby parameter is specified. Only "status" is allowed.');
	}
	
	//
	// query cars
	//
	getLatestCarStatus(extent).then(function(cars){
		// handle options first
		if (countby === 'status'){
			var msg = _.countBy(cars, _.property('status'));
			msg.all = cars.length;
			msg.in_use = msg.in_use || 0;
			msg.available = msg.available || 0;
			msg.unavailable = msg.unavailable || 0;
			debug('Returning countby status: ', msg);
			return res.send(msg);
		}
		
		// handle main stuffs
		var wssUrl = req.baseUrl + req.route.path;
		initWebSocketServer(req.app.server, wssUrl);
		// send normal response
		var ts = _.max(_.map(cars, function(d){ return d.lastEventTime || d.t || d.ts; })) || Date.now();
		res.send({ 
			count: cars.length, 
			devices: cars, 
			serverTime: ts,
			wssPath: wssUrl + '?' + "region=" + encodeURI(JSON.stringify(extent))
		});
	})['catch'](function(err){
		console.error(err);
		res.status(500).send(err);
	}).done();
});

var getLatestCarStatus = function(extent){
	
	// serach devices
	var searchDevices = Q(devicesDB).then(function(db){
		//
		// Get cars within a region using Cloudant geospatial query.
		// - The geo query index is created by the design doc. 
		//    See `carLocationGeoIndex` in the cloudantHelper.js
		// - This uses "bounding box query". 
		//    @see https://docs.cloudant.com/geo.html#querying-a-cloudant-geo-index
		// 
		// var bbox = [min_lng, min_lat, max_lng, max_lat].join();
		// var cloudantHelper.geo(db, 'designDocName', { bbox: bbox }).then...
		//
		// WORKAROUND: 
		// As of 1.1 development time, geo query feature in `npm cloudant` is under implementation. So, use query instead.
		//   @see https://github.com/cloudant/nodejs-cloudant/issues/101
		//
		
		// query car list from DB
		if(extent.whole_lng){
			var qs = ('lat:[' + extent.min_lat + ' TO ' + extent.max_lat + ']'); 
		}else if(extent.min_lng <= extent.max_lng){
			var qs = ('lat:[' + extent.min_lat + ' TO ' + extent.max_lat + '] AND ' +
					'lng:[' + extent.min_lng + ' TO ' + extent.max_lng + ']'); 
		}else{
			var qs = ('lat:[' + extent.min_lat + ' TO ' + extent.max_lat + '] AND ' +
					'(lng:[' + extent.min_lng + ' TO 180] OR lng:[-180 TO ' + extent.max_lng + ']'); 
		}
		return cloudantHelper.searchIndex(db, null, 'location', {q:qs})
			.then(function(result){
				return result.rows; // row.id, row.fields.lat, row.fields.lng 
			});
	});
	
	// get device IDs from searched devices
	var getDeviceIDs = function(rows){
		return (rows || []).map(function(row){ return row.id; });
	};
	
	// get reservations on the cars
	var getDeviceReservationInfoMap = function(deviceIDs){
		return cloudantHelper.searchView('activeReservations', {keys: deviceIDs})
			.then(function(result){
				var infoByDeviceId = {};
				(result.rows || []).forEach(function(r){ infoByDeviceId[r.key] = r.value; });
				return infoByDeviceId;
			});
	};
	
	// get car docs
	var getCarDocs = function(devices, reservationInfoMap){
		var cars = (devices || []).map(function(r){
			// create a car doc
			var car = {'lat': r.fields.lat, 'lng': r.fields.lng, info: {name: r.fields.name} };
			var res = reservationInfoMap[r.id];
			if(res){
				car.info.reservation = _.pick(res, 'pickupTime', 'dropOffTime', 'user', 'status');
			}
			var res_stat = (res && res.status) || 'no_active';
			return getCarDoc(r.id, car, res_stat);
		});
		return cars;
	};
	
	//
	// Combine all together
	//   (searchDevices, serarchDevices -> getDeviceIDs -> getDeviceReservationInfoMap) => getCarDocs
	//
	return Q.spread([searchDevices, Q(searchDevices).then(getDeviceIDs).then(getDeviceReservationInfoMap)], getCarDocs)
	.then(function(cars){
		return cars;
	});
};

/*
 * Get a car device document sent to Map console.
 * - This method has two mode: "only device" and "with db info"
 *   - When reservationStatus is empty, this methods works for "only device" mode.
 *     It is used for real-time tracking and returns only informations from the devicesCache.
 *     So, the mode is called to create WSS message
 *   - When reservationStatus is given, "with db info" is used.
 *     This mode is used to fulill the response of /cars/query.
 *     /cars/query first retrieves devie resavation status, and then call this method
 *     with the reservationStatus.
 */
var getCarDoc = function(deviceID, baseDoc, reservationStatus) {
	var result = baseDoc || {};
	result.deviceID = deviceID;
	var device = connectedDevices.getConnectedDevice(deviceID);
	// status
	var status = undefined;
	if (reservationStatus === 'driving') {
		status = 'in_use';
	} else if(reservationStatus === 'active'){
		status = 'unavailable';
	} else if (reservationStatus){
		status = 'available';
	}
	if(status)
		result.status = status;
	// location
	if(device){
		result.t = device.lastEventTime;
		result.lat = parseFloat(device.lat);
		result.lng = parseFloat(device.lng);
		result.speed = device.speed && parseFloat(device.speed);
		result.matched_heading = device.matched_heading && parseFloat(device.matched_heading);
		result.device_status = device.status;
		result.device_connection = true;
	} else {
		result.t = new Date().getTime();
		result.device_connection = false;
	}
	return result;
}

/*
 * Shared WebSocket server instance
 */
router.wsServer = null;

/*
 * Create WebSocket server
 */
var initWebSocketServer = function(server, path){
	if (router.wsServer !== null){
		return; // already created
	}
	
	//
	// Register event listener for sending update to clients
	// on every IoT Platform events
	//
	connectedDevices.on('event', function(event){
		if(!router.wsServer || !router.wsServer.clients)
			return;
		
		event.updated = (event.updated || []).map(function(device){
			var res_stat = null;// reservationStatusMap[deviceID];
			return getCarDoc(device.deviceID, {}, res_stat);
		})
		event.deleted = (event.deleted || []).map(function(device){
			var res_stat = null;// reservationStatusMap[deviceID];
			return getCarDoc(device.deviceID, {}, res_stat);
		})
		
		var allDevices = _.flatten(_.values(_.pick(event, 'updated', 'touched', 'deleted')));
		var ts = _.max(allDevices, function(d){ return d.lastEventTime; }) || Date.now();
		
		var devices = (event.updated || []).concat((event.touched || []).map(function(d){
			return {deviceID: d.deviceID, deviceType: d.deviceType, t: d.lastEventTime};
		}));
		var deleted = (event.deleted || []);
		var msg = {
				count: (devices.length + deleted.length),
				devices: (devices.length ? devices : undefined),
				deleted: (deleted.length ? deleted : undefined)
		};
		var msgs = JSON.stringify(msg);
		router.wsServer.clients.forEach(function(client){
			try {
				client.send(msgs);
				//console.log('Sent WSS message. ' + JSON.stringify(msg));
			} catch (e) {
				console.error(e);
			}
		});
	});
	
	//
	// Implement a notification mechanism of the latest car reservation
	// status based on interval timer
	//
	var UPDATE_STATUS_TIMEOUT = 5000;
	var updateCarStatus = function(){
		if(!router.wsServer) return;
		// retrieve car statuses
		var clients = router.wsServer.clients;
		if(clients.length > 0)
			debug('Sending interval car status via wss...');
		Q.allSettled(clients.map(function(client){
			if(!client.extent) return Q(false);
			return getLatestCarStatus(client.extent).then(function(cars){
				if(!cars || cars.length == 0) return Q(false);
				var msg = {
						count: cars.length,
						devices: cars
				};
				var msgs = JSON.stringify(msg);
				client.send(msgs);
				debug('  sent interval car status via wss. # of cars: ', msg.count);
				return Q(true);
			});
		})).then(function(results){
			// check the result
			results.forEach(function(result){
				if(result.state !== 'fulfilled'){
					debug('Failed to send interval car status via wss: ', result.reason);
				}
			});
			// schedule next
			setTimeout(updateCarStatus, UPDATE_STATUS_TIMEOUT);
		}).done();
	};
	setTimeout(updateCarStatus, UPDATE_STATUS_TIMEOUT);
	
	//
	// Create WebSocket server
	//
	var wss = router.wsServer = new WebSocketServer({
		server: server,
		path: path,
		verifyClient : function (info, callback) { //only allow internal clients from the server origin
			var localhost = 'localhost';
			var isLocal = appEnv.url.toLowerCase().indexOf(localhost, appEnv.url.length - localhost.length) !== -1;
			var allow = isLocal || (info.origin.toLowerCase() === appEnv.url.toLowerCase());
			if(!allow){
				console.error("rejected web socket connection form external origin " + info.origin + " only connection form internal origin " + appEnv.url + " are accepted");
			}
			if(!callback){
				return allow;
			}
			var statusCode = (allow) ? 200 : 403;
			callback (allow, statusCode);
		}
	});
	
	//
	// Assign "extent" to the client for each connection
	//
	wss.on('connection', function(client){
		debug('got wss connectoin at: ' + client.upgradeReq.url);
		// assign extent obtained from the web sock request URL, to this client
		var url = client.upgradeReq.url;
		var qsIndex = url.lastIndexOf('?region=');
		if(qsIndex >= 0){
			try{
				var j = decodeURI(url.substr(qsIndex + 8)); // 8 is length of "?region="
				var extent = JSON.parse(j);
				client.extent = extent;
			}catch(e){
				console.error('Error on parsing extent in wss URL', e);
			}
		}
	});
}

