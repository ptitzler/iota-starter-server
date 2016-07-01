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
 * This connectedDevicesCache provides cached device latest info, updated by
 * notifications from IoT Platform.
 * 
 * Clients can access the cache, and also can register listeners to get notification
 * upon notifications from IoT platform.
 * 
 * Events:
 * `event`: Received any events from IoT Platform
 *    function(arg) where arg := {updated: [], touched: [], deleted: [deleted], payloads: []}
 *  - note that the devices in the list are no longer available from `getConnectedDevice(id)`
 * 
 * Device Data:
 * - lastUpdateTime: the last ts when any device data is updated
 * - lastUpdatedate: human readable version of lastUpdateTime
 * - lastEventTime: 
 * - [other properties]: ones from devices
 * 
 */

var _ = require('underscore');
var IOTF = require('../watsonIoT');
var EventEmitter = require("events").EventEmitter;

cached_devices = {};

var connectedDevicesCache = module.exports = new EventEmitter();

function cacheDevice(type, deviceID, payload){
	if(!cached_devices[type]){
		cached_devices[type] = {};
	}
	if(!cached_devices[type][deviceID]) {
		cached_devices[type][deviceID]={deviceID:deviceID, deviceType: type};
		cached_devices[type][deviceID].lastUpdateTime = -1; // no data yet
	}
	if(payload){
		var changed = false;
		var device = cached_devices[type][deviceID]
		for (var key in payload){
			if (payload[key] !== device[key]){
				device[key] = payload[key];
				changed = true;
			}
		}
		var now = new Date();
		device.lastEventTime = now.getTime();
		if(changed){
			device.lastUpdateTime = now.getTime();
			device.lastUpdatedate = now.toGMTString();
			connectedDevicesCache.emit('event', {updated: [device], touched: [], deleted: [], payloads: [payload]});
		} else {
			connectedDevicesCache.emit('event', {updated: [], touched: [device], deleted: [], payloads: [payload]});
		}
	}
}

function deleteDevice(type, deviceID){
	if (cached_devices[type] && cached_devices[type][deviceID]){
		var device = cached_devices[type][deviceID]
		delete cached_devices[type][deviceID];
		
		var now = new Date();
		device.lastEventTime = now.getTime();
		connectedDevicesCache.emit('event', {updated: [], touched: [], deleted: [device], payloads: []});
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

connectedDevicesCache.deleteDevice = function(typeID, deviceID){
	deleteDevice(typeID, deviceID);
};
