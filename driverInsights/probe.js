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
var cfenv = require("cfenv");
var fs = require("fs-extra");
var moment = require("moment");
var IOTF = require('../watsonIoT');
var contextMapping = require('./contextMapping.js');
var debug = require('debug')('probe');
debug.log = console.log.bind(console);

IOTF.on("+", function(payload, deviceType, deviceId){
	// check mandatory field
	if(isNaN(payload.lng) || isNaN(payload.lat) || !payload.trip_id || isNaN(payload.speed)){
		return;
	}
	driverInsightsProbe.mapMatch(deviceType, deviceId, payload).then(function(prob){
		driverInsightsProbe.sendProbeData([prob]);
	});
});


var driverInsightsProbe = {
	last_prob_ts: moment().valueOf(),

	driverInsightsConfig: function(){
		var userVcapSvc = JSON.parse(process.env.USER_PROVIDED_VCAP_SERVICES || '{}');
		var vcapSvc = VCAP_SERVICES.driverinsights || userVcapSvc.driverinsights;
		if (vcapSvc) {
			var dirverInsightsCreds = vcapSvc[0].credentials;
			return {
				baseURL: dirverInsightsCreds.api,
				tenant_id : dirverInsightsCreds.tenant_id,
				username : dirverInsightsCreds.username,
				password : dirverInsightsCreds.password
			};
		}
		throw new Exception("!!! no provided credentials for DriverInsights. using shared one !!!");
	}(),
	
	mapMatch: function(deviceType, deviceId, payload){
		var self = this;
		return contextMapping.matchMapRaw(payload.lat, payload.lng)
			.then(function(results){
				if (results.length == 0)
					return Q.reject(new Error('rejecting as no matched location.'));
				
				var matched = results[0];
				var m = moment(payload.ts);
				var prob = {
						"timestamp": m.format(), // ISO8601
						"matched_longitude": matched.matched_longitude,
						"matched_latitude": matched.matched_latitude,
						"matched_heading": matched.matched_heading,
						"matched_link_id": matched.matched_link_id || matched.link_id,
						"speed": payload.speed,
						"mo_id": deviceId,
						"trip_id": payload.trip_id
					};
				self.last_prob_ts = moment().valueOf(); //TODO Need to care in the case that payload.ts is older than last_prob_ts
				return prob;
			});
	},
	
	/*
	 * @param carProbeData a JSON object like
	 * [
	 *   {"matched_heading":108.57187,"speed":0.0,"mo_id":"DBA-6RCBZ","timestamp":"2014-08-16T08:42:51.000Z","trip_id":"86d50022-45d5-490b-88aa-30b6d286938b","distance":74.62322105574874,"matched_longitude":139.72316636456333,"matched_link_id":3.9501022001E10,"matched_latitude":35.684916086373,"longitude":139.72317575,"latitude":35.68494402,"road_type":"5","heading":90.0},
	 *   {"matched_heading":108.57187,"speed":0.0,"mo_id":"DBA-6RCBZ","timestamp":"2014-08-16T08:42:52.000Z","trip_id":"86d50022-45d5-490b-88aa-30b6d286938b","distance":74.5273839512979,"matched_longitude":139.72316538560304,"matched_link_id":3.9501022001E10,"matched_latitude":35.68491641529447,"longitude":139.72317628,"latitude":35.68494884,"road_type":"5","heading":360.0}
	 *  ]
	 */
	sendProbeData: function(carProbeData, callback) {
		var node = this.driverInsightsConfig;
		var api = "/datastore/carProbe";
		
		var options = {
				method: 'POST',
				url: node.baseURL+api+'?tenant_id='+node.tenant_id,
				headers: {
					'Content-Type':'application/json; charset: UTF-8'
				},
				rejectUnauthorized: false,
				auth: {
					user: node.username,
					pass: node.password,
					sendImmediately: true
				},
		};
		for (var index = 0, len = carProbeData.length; index < len; index++) {
			options.body = JSON.stringify(carProbeData[index]);
			options.headers["Content-Length"] = Buffer.byteLength(options.body);
			debug("sendProbeData:" + options.body);
			request(options, function(error, response, body){
				if (!error && response.statusCode === 200) {
					debug('sendProbData response: '+ body);
					if(callback) callback(body);
				} else {
					console.error("sendProbeData:" + options.body);
					console.error('sendProbeData error(' + (response ? response.statusCode : 'no response') + '): '+ error + ': ' + body);
					if(callback) callback("{ \"error(sendProbe)\": \"" + body + "\" }");
				}
			});
		}
	},
	
	getCarProbeDataListAsDate: function(callback) {
		var node = this.driverInsightsConfig;
		var api = "/datastore/carProbe/dateList";
		var options = {
				method: 'GET',
				url: node.baseURL+api+'?tenant_id='+node.tenant_id,
				headers: {
//					'Content-Type':'application/json; charset: UTF-8',
				},
				rejectUnauthorized: false,
				auth: {
					user: node.username,
					pass: node.password,
					sendImmediately: true
				},
		};
		request(options, function(error, response, body){
			if (!error && response.statusCode === 200) {
				callback(body);
			} else {
				console.error('error: '+ body );
				callback("{ \"error(getCarProbeDataListAsDate)\": \"" + body + "\" }");
			}
		});
	}
}

module.exports = driverInsightsProbe;

// Update last_prob_ts
driverInsightsProbe.getCarProbeDataListAsDate(function(body){
	try{
		var parsed = JSON.parse(body);
		var probeDateList = parsed && parsed.return_code === 0 && parsed.date;
		if(Array.isArray(probeDateList) && probeDateList.length > 0){
			driverInsightsProbe.last_prob_ts = probeDateList.map(function(probeDate){return moment(probeDate).valueOf();}).sort(function(a, b){return b - a;})[0];
		}
	}catch(ex){
		debug(ex);
		// Don't update last_prob_ts
	}
});
