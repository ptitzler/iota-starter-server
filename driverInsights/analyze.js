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
var _ = require("underscore");
var Q = require("q");
var request = require("request");
var cfenv = require("cfenv");
var fs = require("fs-extra");
var moment = require("moment");
var driverInsightsProbe = require("./probe.js");
var debug = require('debug')('analyze');
debug.log = console.log.bind(console);

var behaviorNames = [
		"Harsh acceleration",
		"Harsh braking",
		"Speeding",
		"Frequent stops",
		"Frequent acceleration",
		"Frequent braking",
		"Sharp turn",
		"Acceleration before turn",
		"Over-braking before exiting turn",
		"Fatigued driving"];

var WATCH_JOB_STATUS_INTERVAL = new Number(process.env.WATCH_JOB_STATUS_INTERVAL || 60000);

/*
 * driverInsightsAnalyze is an exported module
 */
var driverInsightsAnalyze = {
	// Configurations for Driver Behavior service is specified in ./probe.js
	driverInsightsConfig: driverInsightsProbe.driverInsightsConfig,
	
	last_job_ts: 0, // Set an old date to analyze all probe data if no analysis has requested before

	watchingJobs: [], // List of watching jobs to delete duplicated analyze results
	timeoutId: null,
	requestQueue: [],
	
	authOptions: { 
		rejectUnauthorized: false,
		auth: {
			user: driverInsightsProbe.driverInsightsConfig.username,
			pass: driverInsightsProbe.driverInsightsConfig.password,
			sendImmediately: true
		}
	},

	/*
	 * Send an analysis job to Driver Behavior service.
	 */
	sendJobRequest: function(from/*YYYY-MM-DD*/, to/*YYYY-MM-DD*/){
		this.getJobInfoList((function(jobList){
			jobList = jobList.filter(function(job){return job.job_status === "SUCCEEDED";});
			if(this.last_job_ts === 0 && jobList.length > 0){
				this.last_job_ts = jobList.map(function(job){return moment(job.to).valueOf()})
										  .sort(function(a, b){return b - a;})[0];
			};
			if(this.last_job_ts >= driverInsightsProbe.last_prob_ts){
			// don't send a job if there are no update in probe data
			// since last submit of a job.
				console.log("Don't send a job: last_job_ts=" + this.last_job_ts + ", last_prob_ts=" + driverInsightsProbe.last_prob_ts);
				return;
			}
			var config = this.driverInsightsConfig;
			var api = "/jobcontrol/job";
			var body = JSON.stringify({
				from: from || moment(this.last_job_ts).format("YYYY-MM-DD"),
				to: to || moment().format("YYYY-MM-DD")
			});
			var options = {
				method: 'POST',
				url: config.baseURL+api+'?tenant_id='+config.tenant_id,
				headers: {
					'Content-Type':'application/json; charset: UTF-8',
					"Content-Length": Buffer.byteLength(body)
				},
				body: body
			};
			_.extend(options, this.authOptions);
			console.log("Call SendJobRequest: " + JSON.stringify(options));
			var self = this;
			request(options, function(error, response, body){
				if (!error && response.statusCode === 200) {
					console.log('SendJobRequest successfully done: '+ body);
					var body = JSON.parse(body);
					if(body.job_id){
						self.watchingJobs.push(body.job_id);
						self._setWatchingTask();
					}
					self.last_job_ts = moment().valueOf();
				} else {
					console.error('SendJobRequest error: '+ body + 
							'\n response: ' + JSON.stringify(response) + 
							'\n error: ' + JSON.stringify(error));
				}
			});
		}).bind(this));
	},
	
	/*
	 * Get summary of a trip.
	 * The response is as is of response from Driver Behavior service.
	 */
	getSummary: function(trip_id){
		var deferred = Q.defer();
		
		var config = this.driverInsightsConfig;
		var url = config.baseURL+'/drbresult/tripSummaryList?tenant_id='+config.tenant_id;
		if(trip_id){
			url = url + '&trip_id=' + trip_id;
		}
		var options = {
			method: 'GET',
			url: url
		};
		_.extend(options, this.authOptions);
		request(options, function(error, response, body){
			if (!error && response.statusCode === 200) {
				deferred.resolve(JSON.parse(body));
			} else {
				console.error('analyze: error(getSummary): '+ body );
				deferred.reject("{ \"error(getSummary)\": \"" + body + "\" }");
			}
		});
		
		return deferred.promise;
	},
	 
	/*
	 * Get list of analysis result.
	 * The response is as is of response from Driver Behavior service.
	 * tripIdList: list of trip_id if summary is true, list of trip_uuid if summary is false
	 * summary: true to get summary of each trip, false to get detail of each trip
	 */
	_getListOfTrips: function(tripIdList, summary){
		var maxNumOfConcurrentCall = 8;
		var deferred = Q.defer();
		var retrieveMethod = this[summary ? "getSummary" : "getDetail"].bind(this);
		var numTrip = tripIdList.length;
		var numResponse = 0;
		var results = [];
		
		var f = function(){
			if (++numResponse==numTrip) {
				deferred.resolve(results);
			}else if(tripIdList.length > 0){
				retrieveMethod(tripIdList.shift()).then(successf, f);
			}
		}.bind(this);
		var successf = function(body){
			if(summary){
				results = results.concat(body);
			}else{
				results.push(body);
			}
			f();
		};
		for(var i=0; i<Math.min(maxNumOfConcurrentCall, numTrip); i++){
			retrieveMethod(tripIdList.shift()).then(successf, f);
		}
		
		return deferred.promise;
	},
	
	getList: function(tripIdList){
		this.sendJobRequest();
		
		if(tripIdList && tripIdList.length > 0){
			return this._getListOfTrips(tripIdList, true);
		}
		return this.getSummary();
	},
	
	/*
	 * Get an analysis result.
	 * The response is as is of response from Driver Behavior service.
	 */
	getDetail: function(tripuuid) {
		var deferred = Q.defer();
		
		var config = this.driverInsightsConfig;
		var api = "/drbresult/trip";
		var options = {
			method: 'GET',
			url: config.baseURL+api+'?tenant_id='+config.tenant_id+'&trip_uuid='+tripuuid
		};
		_.extend(options, this.authOptions);
		request(options, function(error, response, body){
			if (!error && response.statusCode === 200) {
				deferred.resolve(JSON.parse(body));
			} else {
				deferred.reject("{ \"error(getDetail)\": \"" + body + "\" }");
			}
		});
		
		return deferred.promise;
	},

	/*
	 * Get the latest driver behavior.
	 */
	getLatestBehavior: function() {
		var deferred = Q.defer();
		
		var self = this;
		this.getList().then(function(response){
			if(response && response.length > 0){
				self.getBehavior(response[response.length-1].id.trip_uuid).then(function(body){
					deferred.resolve(body);
				}, function(error){
					deferred.reject(error);
				});
			}else{
				deferred.resolve({});
			}
		}, function(error){
			deferred.reject(error);
		});
		
		return deferred.promise;
	},

	/*
	 * Get an driver behavior specified by trip uuid.
	 */
	getBehavior: function(tripuuid) {
		var deferred = Q.defer();
		
		var self = this;
		this.getDetail(tripuuid).then(function(response){
			var subtripsarray = response.ctx_sub_trips;
			if(!subtripsarray){
				console.error('analyze: error(getBehavior): no subtrip');
				deferred.reject("{ \"error(getBehavior)\": \"no subtrip\" }");
				return;
			}
			subtripsarray.sort(function(a,b){
				return a.start_time > b.start_time ? 1 : -1;
			});
			var body = {
				trip_uuid: tripuuid,
				start_time: response.start_time,
				end_time: response.end_time,
				start_latitude: response.start_latitude,
				start_longitude: response.start_longitude,
				end_latitude: response.end_latitude,
				end_longitude: response.end_longitude
			};
			// behaviors
			var behaviors = {};
			behaviorNames.forEach(function(name){ behaviors[name] = []; });
			
			subtripsarray.forEach(function(subtrip){
				var driving_behavior_details = subtrip.driving_behavior_details;
				driving_behavior_details.forEach(function(bhr){
					var name = bhr.behavior_name;
					if(!behaviors[name]) {
						behaviors[name] = [];
					}
					behaviors[name].push({start_time: bhr.start_time, end_time: bhr.end_time});
				});
			});
			body.behaviors = behaviors;
			// locations
			var locations = [];
			subtripsarray.forEach(function(subtrip){
				var loc = {
					start_latitude: subtrip.start_latitude,
					start_longitude: subtrip.start_longitude,
					end_latitude: subtrip.end_latitude,
					end_longitude: subtrip.end_longitude
				};
				var driving_behavior_details = subtrip.driving_behavior_details;
				if(driving_behavior_details && driving_behavior_details.length > 0){
					loc.behaviors = driving_behavior_details.map(function(bhr){
						return {
							start_latitude: bhr.start_latitude,
							start_longitude: bhr.start_longitude,
							end_latitude: bhr.end_latitude,
							end_longitude: bhr.end_longitude,
							behavior_name: bhr.behavior_name
						};
					});
				}
				locations.push(loc);
			});
			body.locations = locations;
			// scoring
			body.scoring = self._calculateBehaviorScores(response);
			
			deferred.resolve(body);
			
		}, function(error){
			deferred.reject(error);
		});
		
		return deferred.promise;
	},
	
	/*
	 * Get list of driver behaviors.
	 * The response is as is of response from Driver Behavior service.
	 */
	_getListOfDetail:function(tripuuids) {
		return this._getListOfTrips(tripuuids, false);
	},
	
	/*
	 * Calculate driving score for a trip.
	 */
	_calculateBehaviorScores: function(trip, scoring){
		var scoring = scoring || {
			totalTime: 0
		};
		scoring.totalTime += (trip.end_time - trip.start_time);
		
		behaviorNames.forEach(function(name){
			if(!scoring[name]){
				scoring[name] = {
					totalTime:0,
					count:0
				};
			}
		});
		// calculate time for each behavior in each sub trip
		if (trip.ctx_sub_trips && trip.ctx_sub_trips.length > 0) {
			var subtripsarray = trip.ctx_sub_trips;
			// each sub trip
			subtripsarray.forEach(function(subtrip, subtripindex){
				var driving_behavior_details = subtrip.driving_behavior_details;
				if (driving_behavior_details && driving_behavior_details.length > 0) {
					// each behavior
					driving_behavior_details.forEach(function(bhr){
						var name = bhr.behavior_name;
						var behavior = scoring[name];
						behavior.totalTime += (bhr.end_time - bhr.start_time);
						behavior.count++;
					})
				}
			});
		}
		// calculate score for each behavior
		var totalScore = 0;
		var numOfBehaviors = 0;
		for (var pname in scoring) {
			if (pname !== "totalTime" && pname !== "score") {
				scoring[pname].score = Math.min((1.0 - (scoring[pname].totalTime / scoring.totalTime)) * 100.0, 100.0);
				numOfBehaviors++;
				totalScore += scoring[pname].score;
			}
		}
		// calculate score for this trip
		totalScore += (behaviorNames.length - numOfBehaviors) * 100; // add behaviors with full score
		scoring.score = numOfBehaviors === 0 ? 100 : totalScore / behaviorNames.length;
		return scoring;
	},
	
	/*
	 * Get list of driving behavior.
	 */
	getTripList: function(tripIdList) {
		var deferred = Q.defer();
		
		var self = this;
		this.getList(tripIdList).then(function(response){
			if(response && response.length > 0){
				var tripuuids = response.map(function(summary){
					return summary.id.trip_uuid;
				});
				self._getListOfDetail(tripuuids).then(function(results){
					var tripList = results.map(function(trip){
						var scoring = self._calculateBehaviorScores(trip);
						return {
							"score": scoring.score,
							"trip_uuid": trip.id.trip_uuid,
							"mo_id": trip.mo_id,
							"start_time": trip.start_time,
							"end_time": trip.end_time,
							"start_altitude": trip.start_altitude,
							"start_latitude": trip.start_latitude,
							"start_longitude": trip.start_longitude,
							"end_altitude": trip.end_altitude,
							"end_latitude": trip.end_latitude,
							"end_longitude": trip.end_longitude
						};
					});
					deferred.resolve(tripList);
				}, function(error){
					deferred.reject(error);
				});
			}else{
				deferred.resolve([]); // empty
			}
		}, function(error){
			deferred.reject(error);
		});

		return deferred.promise;
	},

	/*
	 * Get statistics of driving behavior.
	 */
	getStatistics: function(tripIdList) {
		var deferred = Q.defer();

		var self = this;
		this.getList(tripIdList).then(function(response){
			if(response && response.length > 0){
				var tripuuids = response.map(function(summary){
					return summary.id.trip_uuid;
				});
				self._getListOfDetail(tripuuids).then(function(results){
					//summarize response here
					var body = {
							totalDistance  : 0.0
					}
					if (results && results.length > 0) {
						var scoring = null;
						var beviornames = [];
						results.forEach(function(result, resultindex){
							var distance = 0;
							var tripfeaturearray = result.trip_features;
							tripfeaturearray.forEach(function(tripfeature){
								if (tripfeature.feature_name == "distance") {
									distance =  tripfeature.feature_value - 0;
								}
							});
							body.totalDistance += distance;
							if (result.ctx_sub_trips && result.ctx_sub_trips.length > 0) {
								var subtripsarray = result.ctx_sub_trips;
								subtripsarray.forEach(function(subtrip, subtripindex){
									var subtripdistance = subtrip.length;
									// context features
									var ctx_features = subtrip.ctx_features;
									if (ctx_features && ctx_features.length > 0) {
										ctx_features.forEach(function(ctx_feature){
											var contextcategory = ctx_feature.context_category;
											if (!body[contextcategory]) {
												body[contextcategory] = {};
											}
											var bodycontext = body[contextcategory];
											var contextname = ctx_feature.context_name;
											if (!bodycontext[contextname]) {
												bodycontext[contextname] = 0;
											}
											bodycontext[contextname] += subtripdistance;
											if (!bodycontext.totalDistance) {
												bodycontext.totalDistance = 0;
											}
											bodycontext.totalDistance += subtripdistance;
										});
									}
								});
							}
							scoring = self._calculateBehaviorScores(result, scoring);
						});
						body["scoring"] = scoring;
						deferred.resolve(body);
					} else {
						console.error('analyze: error(getStatistics): Empty resonse');
						deferred.reject("{ \"(getStatistics)\": \" Empty \" }");
					}
				}, function(error){
					console.error('analyze: Error::' + error);
					deferred.reject("{ \"(getStatistics)\": \" Error \" }");
				});
			}else{
				deferred.resolve([]); // empty
			}
		}, function(error){
			deferred.reject(error);
		});
		return deferred.promise;
	},

	/*
	* Get Job List
	*/
	getJobInfoList: function(callback){
		console.log('Getting job list...');
		this._run("GET", "/jobcontrol/jobList", null, null, callback, (this._handleError).bind(this));
	},

	/*
	* Get a Job 
	*/
	getJobInfo: function(jobId, callback){
		console.log('Getting job info: job_id = ' + jobId);
		this._run("GET", "/jobcontrol/job", {job_id: jobId}, null, callback, (this._handleError).bind(this));
	},
	
	/*
	* Delete a Job
	*/
	deleteJobResult: function(jobId, callback){
		console.log('Deleting job result: job_id = ' + jobId);
		this._run("DELETE", "/drbresult/jobResult", {job_id: jobId}, null, callback, (this._handleError).bind(this));
	},
	
	/*
	* Internal methods
	*/
	_run: function(method, api, uriParam, body, callback, errorback){
		if(!api){
			errorback();
			return;
		}
		var config = this.driverInsightsConfig;
		var uri = config.baseURL + api + "?tenant_id=" + config.tenant_id;
		if(uriParam === null || uriParam === undefined){
			//do nothing
		}else if(typeof uriParam === "string"){
			uri += uriParam; // "&key1=value1&key2=value2..."
		}else if(typeof uriParam === "object"){
			uri += "&" + Object.keys(uriParam).map(function(key){return key + "=" + uriParam[key];}).join("&");
		}
		var options = {
			method: method,
			url: uri,
			headers: {
				"Content-Type": "application/json; charset: UTF-8"
			}
		};
		_.extend(options, this.authOptions);
		if(body){
			options.body = JSON.stringify(body);
			options.headers["Content-Length"] = Buffer.byteLength(options.body);
		}
		
		debug("Request: " + JSON.stringify(options));
		request(options, function(err, response, body){
			if(!err && response.statusCode === 200){
				try{
					result = JSON.parse(body);
					callback(result);
				}catch(err){
					errorback(err, response, body);
				}
			}else{
				errorback(err, response, body);
			}
		});
	},
	
	_handleError: function(err, response, body){
		console.error("analyze: Error::" + 
				(err || (response && response.statusCode + ": " + response.statusMessage)) +
				(body ? ('body::' + JSON.stringify(body) + '\n') : ''));
	},

	_watchJobStatus: function(){
		if(this.watchingJobs.length <= 0) return;

		var self = this;
		this.getJobInfoList(function(jobList){
			self.watchingJobs.forEach(function(watchedId, index){
				self.getJobInfo(watchedId, function(watchedInfo){
					if(watchedInfo.job_status === "RUNNING"){
						self._setWatchingTask();
					}else if(watchedInfo.job_status === "SUCCEEDED"){
						var watchedFrom = moment(watchedInfo.from).valueOf();
						var watchedTo = moment(watchedInfo.to).valueOf();
						jobList.forEach(function(jobInfo){
							if(watchedId !== jobInfo.job_id && jobInfo.job_status === "SUCCEEDED"){
								var otherFrom = moment(jobInfo.from).valueOf();
								var otherTo = moment(jobInfo.to).valueOf();
								var deleteJobId = null;
								if(watchedFrom === otherFrom && watchedTo === otherTo){
									// Delete prior submitted job if those ranges are same
									deleteJobId = watchedInfo.job_submit_time < jobInfo.job_submit_time ? watchedId : jobInfo.job_id;
								}else if(watchedFrom <= otherFrom && watchedTo >= otherTo){
									// Delete the other job when I'm containing the other job
									deleteJobId = jobInfo.job_id;
								}else if(watchedFrom >= otherFrom && watchedTo <= otherTo){
									// Delete me when I'm contained in the other job
									deleteJobId = watchedId;
								}
								self.deleteJobResult(deleteJobId, function(body){});
							}
						});
						self.watchingJobs.splice(index, 1); // watchingJobs.forEach must be finished before any getJobInfo callback
					}else{
						// KILLED, etc
						self.watchingJobs.splice(index, 1); // watchingJobs.forEach must be finished before any getJobInfo callback
					}
				});
			});
		});

	},

	_setWatchingTask: function(){
		if(this.timeoutId){
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
		if(this.watchingJobs.length > 0){
			this.timeoutId = setTimeout(this._watchJobStatus.bind(this), WATCH_JOB_STATUS_INTERVAL);
		}else{
			console.log("No more watching job left");
		}
	}
}

module.exports = driverInsightsAnalyze;
