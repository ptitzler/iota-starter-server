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

var Q = new require('q');
var request = require("request");
var debug = require('debug')('contextMapping');
debug.log = console.log.bind(console);

var contextMapping = {

	contextMappingConfig: function(){
		var userVcapSvc = JSON.parse(process.env.USER_PROVIDED_VCAP_SERVICES || '{}');
		var vcapSvc = VCAP_SERVICES.mapinsights || userVcapSvc.mapinsights;
		if (vcapSvc) {
			var mapCreds = vcapSvc[0].credentials;
			return {
				baseURL: mapCreds.api + "/mapservice",
				tenant_id : mapCreds.tenant_id,
				username : mapCreds.username,
				password : mapCreds.password
			};
		}
		throw new Error("!!! no provided credentials for MapInsights. using shared one !!!");
	}(),

	/**
	 * Async get distance from (orig_lat, orig_lon) to (dest lat, dest_lon).
	 */
	routeDistance: function(orig_lat, orig_lon, dest_lat, dest_lon){
		var deferred = Q.defer();

		var options = {
				url: this.contextMappingConfig.baseURL + '/routesearch?tenant_id=' + this.contextMappingConfig.tenant_id + '&orig_heading=0&dest_heading=0&orig_latitude=' + orig_lat.toString() +
					'&orig_longitude=' + orig_lon.toString() +
					'&dest_latitude=' + dest_lat.toString() +
					'&dest_longitude=' + dest_lon.toString(),
				rejectUnauthorized: false,
				'auth': {
					'user': this.contextMappingConfig.username,
					'pass': this.contextMappingConfig.password,
					'sendImmediately': true
				}
		};
		debug("calling routesearch URL: " + options.url);
		request(options, function (error, response, body) {
			if (!error) {
				var distance = undefined;
				try{
					distance = JSON.parse(body).route_length;
					debug('routesearch success\n: url: ' + options.url + '\n body: ' + body);
				}
				catch(e){
					console.error("error on route search\n url: " +  options.url + "\n body: " + body);
				}
				distance = (distance) ? distance :-1;
				deferred.resolve(distance);
			}
			else
				deferred.reject(error);
		});
		return deferred.promise;
	},

	/**
	 * Async map match - raw
	 * - the result promise will be resolved to a response JSON
	 *   * note that it may not have matched results.
	 */
	matchMapRaw: function(lat, lon){
		var deferred = Q.defer();
		
		var options = {
				url: this.contextMappingConfig.baseURL + '/map/matching' +
						'?tenant_id=' + this.contextMappingConfig.tenant_id + 
						'&latitude=' + lat.toString() + 
						'&longitude=' + lon.toString(),
				rejectUnauthorized: false,
				'auth': {
					'user': this.contextMappingConfig.username,
					'pass': this.contextMappingConfig.password,
					'sendImmediately': true
				},
				pool: contextMapping._matchMapPool,
				agentOptions: contextMapping._matchMapAgentOptions,
		};
		debug("calling map matching URL: " + options.url);
		request(options, function (error, response, body) {
			if (!error) {
				try{
					var responseJson = JSON.parse(body);
					if (responseJson.length == 0){
						console.error("no match found\n url: " +  options.url + "\n body: " + body);
					} else {
						debug('matching done\n: url: ' + options.url + '\n body: ' + body);
					}
					deferred.resolve(responseJson);
				}
				catch(e){
					console.error("error on map matching\n url: " +  options.url + "\n body: " + body);
					deferred.resolve([]);
				};
			}
			else
				return deferred.reject(error);
		});
		return deferred.promise;
	},
	/**
	 * Async map match
	 * - returns the first match, returns the given (lat,lon) in case no match
	 */
	matchMap: function(lat, lon){
		return contextMapping.matchMapRaw(lat, lon)
			.then(function(results){ // results is parsed JSON of array of matches
				if (results.length == 0)
					return {lat: lat, lng: lon}; // fallback for not-matched
				var latlng = results[0];
				return  {
					lat: latlng["matched_latitude"],
					lng: latlng["matched_longitude"]
				};
			});
	}

}

module.exports = contextMapping;
