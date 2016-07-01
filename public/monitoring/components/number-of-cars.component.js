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
 * Additional styles, javascripts
 * my css: /monitoring/css/style.css, the base monitoring dashbaord css
 */

(function(scriptBaseUrl){
	angular.module('systemMonitoring').
	component('numberOfCars', {
		templateUrl: scriptBaseUrl + 'number-of-cars.html',
		bindings: {
			region: '<',
			regions: '<',
		},
		controller: function NumberOfCars($scope, $http) {
			// example data
			var sampleData = {
					all: 25,
					in_use: 11,
					available: 10,
					unavailable: 4,
			};
			// loading data
			var loadingData = {
					all: '--',
					in_use: '--',
					available: '--',
					unavailable: '--',
			};
			
			// initialize model
			$scope.counts = {}; // map region.id => counts
			$scope.counts._selection = loadingData;
			
			// initialize controller
			var regionTracker = null;
			var updateTracker = function(regions, selected_id){
				if (regions && regions.length > 0){
					if (regionTracker){
						regionTracker.stop();
						regionTracker = null;
					}
					regionTracker = new RegionTracker(regions, selected_id);
					regionTracker.start();
				}
			};
			$scope.$watch('$ctrl.region', function(region, oldValue){
				if(region)
					updateTracker([region], region.id);
			});
			$scope.$watch('$ctrl.regions', function(regions, oldValue){
				updateTracker(regions);
			});
			
			/*
			 * Car number tracker definition
			 */
			var RegionTracker = function(regions, selected_id){
				var active = true; // this is for deferred handlers to find the status
				var timeoutKey = null;
				
				// update number tracking
				var update = function(){
					regions.forEach(function(region, i){
						var extent = region.extent, region_id = region.id;
						// draw real-time location of cars
						var qs = ['min_lat='+extent[1], 'min_lng='+extent[0],
						          'max_lat='+extent[3], 'max_lng='+extent[2],
						          'countby=status'].join('&');
						$http.get('cars/query?' + qs).then(function(resp){
							if(!active) return;
							if(typeof resp.data.all !== 'undefined'){
								// update the model
								var counts = resp.data;
								var newData = {
									all: counts.all,
									in_use: counts.in_use,
									available: counts.available,
									unavailable: counts.unavailable,
								};
								$scope.counts[region_id] = newData;
								if(region_id === selected_id)
									$scope.counts._selection = newData;
							}else{
								console.error('Unknown number of car data from server: ', resp.data);
								$scope.counts[region_id] = loadingData;
								if(region_id === selected_id)
									$scope.counts._selection = loadingData;
							}
							// schedule next
							if(i == regions.length - 1)
								timeoutKey = setTimeout(update, 15000); // polling by 15 seconds
						}, function(e){
							if(!active) return;
							console.warn('Failed to execute car query. Setting sample data...');
							$scope.counts[region_id] = sampleData;
							if(region_id === selected_id)
								$scope.counts._selection = sampleData;
						});
					});
					if(!regions || regions.length == 0)
						timeoutKey = setTimeout(update, 15000); // polling by 15 seconds
				}
				
				// method to stop tracking
				this.stop = function(){
					// clear timeout
					if (timeoutKey) clearTimeout(timeoutKey);
					timeoutKey = null;
					// deactivate
					active = false;
				};
				
				// set loading data and start updating
				this.start = function(){
					$scope.counts = loadingData;
					update();
				}
			};
		},
	});
})((function(){
	// tweak to use script-relative path
	var scripts = document.getElementsByTagName('script');
	var scriptUrl = scripts[scripts.length - 1].src;
	return scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);
})());
