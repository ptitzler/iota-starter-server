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
 * REST APIs using Driver Behavior service as backend
 */
var Q = require('q');
var router = module.exports = require('express').Router();
var authenticate = require('./auth.js').authenticate;
var driverInsightsProbe = require('../../driverInsights/probe');
var driverInsightsAnalyze = require('../../driverInsights/analyze');
var driverInsightsTripRoutes = require('../../driverInsights/tripRoutes.js');
var dbClient = require('../../cloudantHelper.js');

router.get('/probeData',  authenticate, function(req, res) {
	driverInsightsProbe.getCarProbeDataListAsDate().then(function(msg){
		res.send(msg);
	})["catch"](function(error){
		res.send(error);
	});
});

router.get('/driverInsights', authenticate, function(req, res) {
	getUserTrips(req).then(function(tripIdList){
		driverInsightsAnalyze.getList(tripIdList).then(function(msg){
			res.send(msg);
		});	
	})["catch"](function(error){
		res.send(error);
	});
});

router.get('/driverInsights/statistics', authenticate, function(req, res) {
	getUserTrips(req).then(function(tripIdList){
		driverInsightsAnalyze.getStatistics(tripIdList).then(function(msg){
			res.send(msg);
		});	
	})["catch"](function(error){
		res.send(error);
	});
});

router.get('/driverInsights/behaviors', authenticate, function(req, res) {
	getUserTrips(req).then(function(tripIdList){
		driverInsightsAnalyze.getTripList(tripIdList).then(function(msg){
			res.send(msg);
		});
	})["catch"](function(error){
		res.send(error);
	});
});

router.get('/driverInsights/:trip_uuid', authenticate, function(req, res) {
	driverInsightsAnalyze.getDetail(req.params.trip_uuid).then(function(msg){
		res.send(msg);
	})["catch"](function(error){
		res.send(error);
	});
});

router.get('/driverInsights/behaviors/latest', authenticate, function(req, res) {
	driverInsightsAnalyze.getLatestBehavior().then(function(msg){
		res.send(msg);
	})["catch"](function(error){
		res.send(error);
	});
});

router.get('/driverInsights/behaviors/:trip_uuid', authenticate, function(req, res) {
	driverInsightsAnalyze.getBehavior(req.params.trip_uuid).then(function(msg){
		res.send(msg);
	})["catch"](function(error){
		res.send(error);
	});
});

router.get("/driverInsights/triproutes/:trip_uuid", function(req, res){
	driverInsightsTripRoutes.getTripRoute(req.params.trip_uuid, function(msg){
		res.send(msg);
	});
});

function getUserTrips(req){
	var userid = req.user && req.user.id;
	if(!userid){
		return Q([]);
	}
	var deferred = Q.defer();
	dbClient.searchView("closedReservations", {key: userid}).then(
		function(result){
			var trip_ids = result.rows.map(function(item) {
				var reservation = item.value;
				return reservation.trip_id;
			}).filter(function(trip_id){
				return trip_id;
			});
			deferred.resolve(trip_ids);
		}
	)["catch"](function(error){
		deferred.reject(error);
	});
	return deferred.promise;
}