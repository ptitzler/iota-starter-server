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
var IOTF = require('../watsonIoT');

cached_devices = {};

var connectedDevicesCache = exports;

function cacheDevice(type, deviceID, payload){
	if(!cached_devices[type]){
		cached_devices[type] = {};
	}
	if(!cached_devices[type][deviceID]) {
		cached_devices[type][deviceID]={deviceID:deviceID, deviceType: type};
		cached_devices[type][deviceID].lastUpdateTime = -1; // no data yet
	}
	if(payload)	{
		for (var key in payload)		{
			if (payload[key] !== cached_devices[type][deviceID][key]){
				var now = new Date();
				var currentTime = now.getTime();
				cached_devices[type][deviceID].lastUpdateTime = currentTime;
				cached_devices[type][deviceID].lastUpdatedate = now.toGMTString();
				_.extend(cached_devices[type][deviceID], payload);
				break;
			}
		}
	}
}

function deleteDevice(type, deviceID){
	if (cached_devices[type] && cached_devices[type][deviceID]){
		delete cached_devices[type][deviceID];
	}
}

IOTF.on("+", function(payload, deviceType, deviceId){
	cacheDevice(deviceType, deviceId, payload);
});

IOTF.on("+_DeviceStatus", function(deviceType, deviceId, payload, topic){
	switch (payload.Action){
	case "Connect":
		cacheDevice(deviceType, deviceId);
		break;
	case "Disconnect":
		deleteDevice(deviceType, deviceId);
		break;
	}

});

connectedDevicesCache.getConnectedDevices = function(){
	var devices = [];
	_.each(cached_devices, function(devicesOfType){
		_.each(devicesOfType, function(device){
			devices.push(device);
		});
	});
	return devices;
};

connectedDevicesCache.getConnectedDevicesOfType = function(type){
	var devices = [];
	_.each(cached_devices[type], function(device){
		devices.push(device);
	});
	return devices;
};

connectedDevicesCache.getConnectedDevice = function(id){
	for (var type in cached_devices){
		if(cached_devices[type][id]){
			return cached_devices[type][id];
		}
	}
};

connectedDevicesCache.getConnectedDevicesCache = function(){
	return cached_devices;
};