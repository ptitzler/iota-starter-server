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
var debug = require('debug')('weatherCache');
debug.log = console.log.bind(console);

/**
 * General weather data cache. Weather data taken through a pair of the same api, location, units and lang is 
 * stored until its expried time. The max cache size is 100. When the size of cache data exceeds this number, 
 * oldest one is removed.
 */
var weatherCache = {
	cacheMap: {},
	cacheKeys: [],

	getCacheData : function(api, param) {
		var cacheMap = this.cacheMap;
		var cacheKeys = this.cacheKeys;
		var cacheKey = this.cacheKey(api, param);

		if (!cacheMap[cacheKey]) {
			return null;
		}	
	
		var cache = cacheMap[cacheKey];
		var currentTime = Math.round(Date.now()/1000);
		var expired = cache.metadata.expire_time_gmt || 0;
		
		// If cache is already expired, remove it and return null.
		if (0 >= expired || expired <= currentTime) {
			console.info("cache data has been expired: " + api + "," + param.latitude + "," + param.longitude);
			var index = _.indexOf(cacheKeys, cacheKey);
			cacheKeys.splice(index, 1);
			delete cacheMap[cacheKey];
			return null;
		}
		
		return cache;
	},
	
	pushCacheData : function(api, param, data) {
		var cacheMap = this.cacheMap;
		var cacheKeys = this.cacheKeys;
		var cacheKey = this.cacheKey(api, param);
		
		if (cacheMap[cacheKey]) {
			// Renew cache order if cache exists already
			var index = _.indexOf(cacheKeys, cacheKey);
			cacheKeys.splice(index, 1);
		} else if (cacheKeys.length >= 100) {
			// Remove oldest cache if total number of cache exceed 100
			var removed = cacheKeys.shift();
			delete cacheMap[removed];
		}
		
		// add data to cache
		cacheMap[cacheKey] = data;
		cacheKeys.push(cacheKey);
		console.info("weather data is stored to cache: " + api + "," + param.latitude + "," + param.longitude);
	},
	
	clearCacheData : function() {
		this.cacheMap = {};
		this.cacheKeys = [];
	},

	cacheKey : function(api, param) {
		var cacheKey = api + '+' + param.latitude + '+' + param.longitude;
		if (param.units) cacheKey += '+' + param.units;
		if (param.lang) cacheKey += '+' + param.lang;
		return cacheKey;
	}
}

module.exports = weatherCache;
