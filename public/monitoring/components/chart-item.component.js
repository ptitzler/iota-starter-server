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
	var chartItemIdCount = 0;
	
	angular.module('systemMonitoring').
	component('chartItem', {
		templateUrl: scriptBaseUrl + 'chart-item.html',
		bindings: {
			title: '@',
			url: '@',
			chartType: '@',
			chartRotated: '@', // true or false
		},
		controller: function ChartItem($scope, $http) {
			var chartType = $scope.$ctrl.chartType || 'donut';
			var chartId = $scope.chartId = 'chartitem' + (++chartItemIdCount);
			var chartSelector = '#' + chartId;
			
			this.$onInit = function(){
				$http.get($scope.$ctrl.url).then(function(resp){
					var options = {
							bindto: chartSelector,
							data: {
								columns: resp.data.columns,
								type: chartType,
								order: null,
							},
							color: {
								pattern: ['#f05153','#f67734','#58a946', '#3774ba', '#01b39e']
							},
							axis: {
								rotated: ($scope.$ctrl.chartRotated === 'true'),
							},
					};
					if(chartType === 'donut'){
						options.donut = {
							title: 'Avg: ' + parseFloat(resp.data.average).toFixed(1),
						};
					}
					if(resp.data.categories){
						options.axis = options.axis || {};
						options.axis.x = {
							type: 'category', categories: resp.data.categories
						};
						options.color.pattern.reverse(); // make 'safer' colors beginning 
					}
					
					var chart = c3.generate(options);
					
					// update title
					if(chartType === 'donut'){
						var sel = d3.select(chartSelector + ' .c3-chart-arcs-title');
						sel.node().innerHTML = 'Avg: ' + parseFloat(resp.data.average).toFixed(1);
						sel.attr('fill', '#3a6284');
						sel.style('padding-top', '6px');
						sel.style('font-size', '24px');
						sel.style('font-weight', '500');
					}
				});
				
			};
		},
	});
})((function(){
	// tweak to use script-relative path
	var scripts = document.getElementsByTagName('script');
	var scriptUrl = scripts[scripts.length - 1].src;
	return scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);
})());
