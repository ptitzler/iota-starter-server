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
var tripRoutes = module.exports;

var _ = require("underscore");
var Q = require("q");
var debug = require('debug')('tripRoutes');
debug.log = console.log.bind(console);
var dbClient = require('./../cloudantHelper.js');
var driverInsightsAnalyze = require('../driverInsights/analyze');

var TRIPROUTES_DB_NAME = "trip_routes";

_.extend(tripRoutes, {
	db: null,

	_init: function(){
		/*
		 * Database "trip_routes" stores route array for each trip_id
		 * document = {routes: {lat: "-90 ~ 90", lng: "-180 ~ 180", ts: "timestamp in mill", id: "device id", trip_id: "uuid", ...}
		 */
		this.db = dbClient.getDB(TRIPROUTES_DB_NAME, this._getDesignDoc());
	},

	getTripLocation: function(trip_id){
		var deferred = Q.defer();
		Q.when(this.db, function(db){
			db.get(trip_id, function(err, body){
				if(err){
					deferred.reject(err);
				}else{
					if(body.routes && body.routes.length > 0){
						deferred.resolve({trip_id: trip_id, lat: body.routes[0].lat, lng: body.routes[0].lng});
					}else{
						deferred.reject("no routes");
					}
				}
			})["catch"](function(error){
				deffered.reject(error);
			});
		});
		return deferred.promise;
	},
	insertTripRoutes: function(tripRoutes){
		debug("insert trip routes");
		var self = this;
		Q.when(this.db, function(db){
			var tripIds = Object.keys(tripRoutes);
			db.fetch({keys: tripIds}, function(err, body){
				var existingRoutes = (body && body.rows) || [];
				var tripDocs = tripIds.map(function(trip_id, index){
					var tripRoute = tripRoutes[trip_id];
					var appendingRoutes = tripRoute.routes;
					// The rows must be returned in the same order as the supplied "keys" array.
					var doc = (!existingRoutes[index] || existingRoutes[index].key !== trip_id || existingRoutes[index].error === "not_found")
								? {_id: trip_id, routes: []}
								: existingRoutes[index].doc;
					doc.routes = doc.routes.concat(appendingRoutes).sort(function(a, b){
						return a.ts - b.ts;
					});
					// update the device info if necessary
					if(tripRoute.deviceID) doc.deviceID = tripRoute.deviceID;
					if(tripRoute.deviceType) doc.deviceType = tripRoute.deviceType;
					return doc;
				});
				db.bulk({docs: tripDocs}, "insert", function(err, body){
					if(err){
						console.error("inserting trip routes failed");
					}else{
						debug("inserting trip routes succeeded");
					}
				});
			})["catch"](function(error){
				console.error(error);
			});
		});
	},
	getTripRoute: function(trip_uuid, callback){
		var self = this;
		Q.when(driverInsightsAnalyze.getDetail(trip_uuid), function(response){
			var trip_id = response.trip_id;
			Q.when(self.db, function(db){
				db.get(trip_id, function(err, body){
					if(err){
						console.error(err);
						callback(err);
						return;
					}
					var coordinates = body.routes.map(function(payload){
						return [payload.lng, payload.lat];
					});
					var geoJson = {
							type: "FeatureCollection",
							features: [{type: "Feature", geometry: {type: "LineString", coordinates: coordinates}}]
					};
					callback(geoJson);
				});
			});
		});
	},
	getTripsByDevice: function(deviceID, limit){
		return this._searchTripsIndex({q:'deviceID:'+deviceID, sort: '-org_ts', limit:(limit||5)})
			.then(function(result){
				return result.rows.map(function(row){ return row.fields; });
			});
	},
	_searchTripsIndex: function(opts){
		return Q(this.db).then(function(db){
			var deferred = Q.defer();
			db.search(TRIPROUTES_DB_NAME, 'trips', opts, function(err, result){
				if (err)
					return deferred.reject(err);
				return deferred.resolve(result);
			});
			return deferred.promise;
		});
	},
	_getDesignDoc: function(){
		var deviceTripIndexer = function(doc){
			if(doc.routes && Array.isArray(doc.routes) && doc.routes.length > 0){
				var route0 = doc.routes[0];
				if(route0.trip_id){
					// this looks like a trip
					index('deviceID', doc.deviceID || route0.id, {store:true});
					index('trip_id', route0.trip_id, {store:true});
					// origin info
					index('org_lat', parseFloat(route0.lat), {store:true});
					index('org_lng', parseFloat(route0.lng), {store:true});
					index('org_ts', parseFloat(route0.ts), {store:true}); // timestamp in millis
					index('last_ts', parseFloat(doc.routes[doc.routes.length-1].ts), {store:true});
				}
			}
		};
		var designDoc = {
				_id: '_design/' + TRIPROUTES_DB_NAME,
				indexes: { 
					trips: { 
						analyzer: {name: 'keyword'},
						index: deviceTripIndexer.toString()
					}
				}
		};
		return designDoc;
	},
});
tripRoutes._init();
