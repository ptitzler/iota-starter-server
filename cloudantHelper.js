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

var _ = require('underscore');
var Q = require("q");
var connectedDevicesCache = require('./workbenchLib').connectedDevicesCache;

var cloudantHelper = exports;


var CLOUDANT_DB_NAME = 'mobilitystarterappdb';


var DB_UPDATE_INTERVAL = 6000; // period to update the DB from the memory image (mSec)

var cloudantCreds = VCAP_SERVICES.cloudantNoSQLDB[0].credentials;

//init cloudant DB connection
var Cloudant = require('cloudant');
var cloudant = Cloudant(cloudantCreds.url);
var db = null;

cloudantHelper.getDBClient = function(){
	var deferred = Q.defer();
	Cloudant(cloudantCreds.url, function(err,cloudant) {
		if(!err)
			deferred.resolve(cloudant.db.use(CLOUDANT_DB_NAME));
		else
			deferred.reject(err);
	});
	return deferred.promise;
};

//called periodically - scan devices and store data in DB
//a document per device
cloudantHelper.storeDeviceData = function(){
	var connectedDevices = connectedDevicesCache.getConnectedDevices();
	connectedDevices.forEach(function(device){
		cloudantHelper.createOrUpdateDevice(device);
	});
};

//update device in a DB document - if the device exists update data,
//if not, create a new document
cloudantHelper.createOrUpdateDevice = function(device){
	if (!device) return; // no device....
	var devID = device.deviceID;

	var updateTime = device.lastUpdateTime;
	if (updateTime > 0){
		var db = cloudant.db.use(CLOUDANT_DB_NAME);
		db.get(devID,null,function(err,body) {
			if (!err){
				if(!_.isEqual(body[updateTime], device)){
					body[updateTime] = device;
					db.insert(body,null,function(err, body){
						if (err){
							console.error("!!!!!!!!error inserting " + devID + " err = " + err + " body = " + body);
						}
					});
				}
			}else if (err.error == 'not_found'){
				var deviceDetails = cloudantHelper.onGettingNewDeviceDetails(device);
				if (deviceDetails){
					cloudantHelper.createDevice(device, deviceDetails);
				} else {
					console.error('unregistered device: ' + devID);
				}
			}else{
				console.error('error on get document ' + devID + " "+ err + ' body ' + body);
			}
		});
	}
};

//insert a device into a DB document
cloudantHelper.createDevice = function(device, deviceDetails){
	var devID = device.deviceID;
	var updateTime = device.lastUpdateTime;
	console.log('A new device ' + devID + ' is detected. Creating a device document...');
	
	var doc = {};
	doc.deviceDetails = deviceDetails;
	if (updateTime > 0) doc[updateTime] = device;
	var db = cloudant.db.use(CLOUDANT_DB_NAME);
	db.insert(doc,devID,function(err, body) {
		if (err)
			console.error("error inserting" + devID + " err = " + err + " body = " + body);
	});
};

//user call back to get the device details for an unknown device 
//- when this return non-false object, the device will be registered
//- otherwise, the device won't be handled
//- this is overridden in _app.js for demo
cloudantHelper.onGettingNewDeviceDetails = function(device) { 
	return null;
};

// Get device additional info stored in the cloudant DB
cloudantHelper.getDeviceDetails = function(device){
	// handle array
	if (Array.isArray(device)){
		return Q.all(device.map(cloudantHelper.getDeviceDetails));
	}
	
	// handle single device
	if (!device) return Q(); // no device....
	var devID = device.deviceID;
	
	function cloneAndExtendDevice(body){
		var r = _.clone(device);
		_.extend(r, _.pick(body, function(value, key, object) {
								return !key.startsWith('_');
							}));
		return r;
	}
	
	var deferred = Q.defer();
	var db = cloudant.db.use(CLOUDANT_DB_NAME);
	db.find({selector:{_id:devID}, fields:["deviceDetails"]}, function(er, result) {
		if (er)
			return deferred.reject(er);
		if(!er && result.docs.length > 0 && !_.isEmpty(result.docs[0].deviceDetails)){
			// found a deviceDetails document
			deferred.resolve(cloneAndExtendDevice(result.docs[0].deviceDetails));
			return;
		}
		// FALLBACK
		// try to find a deviceDetails for the given device
		var deviceDetails = cloudantHelper.onGettingNewDeviceDetails(device);
		if (!deviceDetails){
			console.log('  can\'t get device details for ' + devID + '. skipping...');
			return deferred.reject();
		}
		// in case the device is missing, create the document
		if (result.docs.length == 0){
			cloudantHelper.createDevice(device, deviceDetails);
			return deferred.resolve(cloneAndExtendDevice(deviceDetails));
		}
		// add new device details to existing document
		console.log('Device details for ' + devID + ' is not in the device document. Migrating by adding it...');
		db.get(devID,null,function(err,body){
			if(!err){
				body.deviceDetails = deviceDetails;
				db.insert(body,null,function(err,body){
					if(err){
						console.error("!!!!!!!!error inserting" + devID + " err = " + err + " body = " + body);
						deferred.reject();
					}
					else
						deferred.resolve(cloneAndExtendDevice(deviceDetails));
				});
			}
			else{
				console.error('!!!!!!!device document ' + devID + 'is missing.');
				deferred.reject();
			}
		});
	});
	return deferred.promise;
};

//cleanup stale reservations
//- one still in 'active' whose dropOffTime is past
//- one still in 'driving' whose dropOffTime is more then 5 minutes before
cloudantHelper.cleanupStaleReservations = function(){
	return cloudantHelper.searchView('activeReservations', {})
	.then(function(result){
		var now = new Date().getTime() / 1000.; // in seconds
		function isStale(res){
			var dropOffTime = parseFloat(res.dropOffTime);
			return (res.status == 'active' && now > dropOffTime) || // passed reservation
					(res.status == 'driving' && now + 5*60 > dropOffTime); // passed reservation
		}
		var db = cloudant.db.use(CLOUDANT_DB_NAME);
		var cancelActions = _.pluck(result.rows, 'value')
			.filter(function(v){ return v.type == 'reservation';})
			.filter(isStale)
			.map(function(res){
				var deferred = Q.defer();
				console.log('Canceling stale reservation...: ' + JSON.stringify({
							status: res.status, 
							dropOffTime: new Date(parseFloat(res.dropOffTime)*1000).toISOString(),
						}));
				res.status = 'canceled'; // update the reservation status to canceled
				db.insert(res,null,function(err, body){
					if (err)
						console.error("!!!!!!!!error canceling reservation " + res._id + " err = " + err + " body = " + body);
					deferred.resolve(); // resolve anyway. will be retried again on failure
				});
				return deferred.promise;
			});
		if(cancelActions.length > 0){
			return Q.all(cancelActions);
		}
		return Q(); // return resolved promise
	})['catch'](function(err){
		console.error('Got error on canceling stale reservations');
		console.error(err);
	});
}

//search Cloudant view async
cloudantHelper.searchView = function(viewName, opts){
	var deferred = Q.defer();
	var db = cloudant.db.use(CLOUDANT_DB_NAME);
	db.view(CLOUDANT_DB_NAME, viewName, opts, function(err, body){
		if(!err)
			deferred.resolve(body);
		else
			deferred.reject(err);
	});
	return deferred.promise;

}

//search Cloudant index async
cloudantHelper.searchIndex = function(db, ddocName, indexName, opts){
	var deferred = Q.defer();
	db.search(ddocName, indexName, opts, function(err, result){
		if (!err)
			return deferred.resolve(result);
		else
			deferred.resolve(err);
	})
	return deferred.promise;
}

//create a new Cloudant connection and returns a deferred DB
cloudantHelper.getDB = function(dbName, designDoc){
	//connect to the database or create it if needed
	function ensureDB(){
		var deferred = Q.defer();
		Cloudant(cloudantCreds.url, function(err, cloudant){
			console.log('Connected to Cloudant');
			
			cloudant.db.list(function(err, all_dbs){
				if(err)
					return deferred.reject(err);
				if(all_dbs.indexOf(dbName) < 0){
					console.log('Missing Cloudant DB ' + dbName + '. Creating...');
					cloudant.db.create(dbName, function(err, body){
						if(err)
							return deferred.reject(err);
						console.log('  created ' + dbName + '.');
						return deferred.resolve(cloudant.use(dbName));
					});
				}else{
					console.log('Found existing DB ' + dbName + '.');
					return deferred.resolve(cloudant.use(dbName));
				}
			});
		});
		return deferred.promise;
	}
	
	function updateDesignDoc(db){
		if(!designDoc) return Q(db);
		if(!designDoc._id)
			throw new Error('Missing _id property in the design doc');
		
		var deferred = Q.defer();
		db.get(designDoc._id, null, function(err, body){
			if(!err){
				designDoc._rev = body._rev;
				db.insert(designDoc, null, function(err, body){
					if (err){
						console.error("!!!!!!!!error updating design doc: " + designDoc._id + " err = " + err + " body = " + body);
						deferred.reject(err);
					}else
						deferred.resolve(db);
				});
			}else if(err.error == 'not_found'){
				db.insert(designDoc, designDoc._id, function(err, body){
					if (err){
						console.error("!!!!!!!!error updating design doc: " + designDoc._id + " err = " + err + " body = " + body);
						deferred.reject(err);
					}else
						deferred.resolve(db);
				});
			}else{
				console.error('error on get design doc ' + err);
				deferred.resolve(err);
			}
		});
		return deferred.promise;
	}
	
	return ensureDB().then(function(db){
		return updateDesignDoc(db);
	});
}
var locationMap = function (doc) {
	var lastUpdate = doc[Object.keys(doc)[Object.keys(doc).length - 1]];
	if(lastUpdate && lastUpdate.deviceID){
		var key = [lastUpdate.lat, lastUpdate.lng];
		emit(key, lastUpdate);
	}
};

var activeReservationMap = function(doc) {
	if(doc.type == "reservation" && (doc.status == "active" || doc.status == "driving")){
		emit(doc.carId, doc.userId);
		emit(doc.userId, doc);
	}
};

var closedReservationMap = function(doc) {
	if(doc.type == "reservation" && doc.status == "closed"){
		emit(doc.carId, doc.userId);
		emit(doc.userId, doc);
	}
};

var allReservationMap = function(doc) {
	if(doc.type == "reservation"){
		emit(doc.carId, doc.userId);
		emit(doc.userId, doc);
	}
};

var designDoc = {
		_id: '_design/' + CLOUDANT_DB_NAME,
		views: {
			location: {
				map: locationMap.toString()
			},
			activeReservations: {
				map: activeReservationMap.toString()
			},
			closedReservations: {
				map: closedReservationMap.toString()
			},
			allReservations: {
				map: allReservationMap.toString()
			}
		}
};

//init DB and start timer session
(function(){
	db = cloudantHelper.getDB(CLOUDANT_DB_NAME, designDoc);
	setInterval(cloudantHelper.storeDeviceData, DB_UPDATE_INTERVAL);
}());
