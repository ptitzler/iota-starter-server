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
	component('statusBarNumber', {
		templateUrl: scriptBaseUrl + 'status-bar-number.html',
		bindings: {
			title: '@',
			src: '@',
		},
		controller: function NumberOfCars($scope, $http) {
			var self = this;
			// example data
			$scope.title = $scope.$ctrl.title;
			$scope.value = '--';
			$scope.value_today = '--';
			$scope.value_week = '--';
			$scope.value_month = '--';
			// initialize with REST call
			$http.get(self.src).then(function(resp){
				if(typeof resp.data.value !== 'undefined'){
					$scope.title = $scope.$ctrl.title;
					$scope.value = resp.data.value;
					$scope.value_today = resp.data.value_today;
					$scope.value_week = resp.data.value_week;
					$scope.value_month = resp.data.value_month;
				}else{
					console.error('Unknown user count data', resp.data);
				}
			});
		},
	});
})((function(){
	// tweak to use script-relative path
	var scripts = document.getElementsByTagName('script');
	var scriptUrl = scripts[scripts.length - 1].src;
	return scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);
})());
