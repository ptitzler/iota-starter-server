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
var Q = require("q");
var Cloudant = require('cloudant');
var debug = require('debug')('tripRoutes');
debug.log = console.log.bind(console);
var driverInsightsAnalyze = require('../driverInsights/analyze');

var tripRoutes = {
	db: null,
	tripIdCache: [],

	_init: function(){
		var deferred = Q.defer();
		this.db = deferred.promise;
		/*
		 * Database "trip_routes" stores route array for each trip_id
		 * document = {routes: {lat: "-90 ~ 90", lng: "-180 ~ 180", ts: "timestamp in mill", id: "device id", trip_id: "uuid", ...}
		 */
		var cloudantCreds = VCAP_SERVICES.cloudantNoSQLDB[0].credentials;
		var self = this;
		Cloudant(cloudantCreds.url, function(err, cloudant) {
			debug('Connected to Cloudant')

			cloudant.db.list(function(err, all_dbs) {
				if (all_dbs.indexOf("trip_routes") < 0) {
					// first time -- need to create the iotzone-devices database
					console.log("creating DB trip_routes");
					cloudant.db.create("trip_routes", function() {
						deferred.resolve(cloudant.use("trip_routes"));
						console.log("created DB trip_routes");
					});
				} else {
					console.log("found DB trip_routes");
					var targetDb = cloudant.use('trip_routes');
					deferred.resolve(targetDb);
					// cache trip_id
					targetDb.list(function(err, body) {
						if (!err) {
							self.tripIdCache = self.tripIdCache.concat(body.rows.map(function(doc){
								return doc.id;
							}));
							console.log("tripIdCache:" + JSON.stringify(self.tripIdCache));
						}
					});	
				}
			})
		});
	},

	getTripIdList: function(){
		return this.tripIdCache;
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
		console.log("insert trip routes");
		var self = this;
		Q.when(this.db, function(db){
			var tripDocs = Object.keys(tripRoutes).map(function(trip_id){
				var routes = tripRoutes[trip_id].routes;
				return {_id:trip_id, routes: routes.sort(function(a, b){
					return a.ts - b.ts;
				})};
				self.tripIdCache.push(trip_id)
			});
			db.bulk({docs: tripDocs}, "insert", function(err, body){
				if(err){
					console.error("inserting trip routes failed");
				}else{
					console.log("inserting trip routes succeeded");
				}
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
};
module.exports = tripRoutes;
tripRoutes._init();
