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
angular.module('systemMonitoring', ['ui.router', 'ngAnimate', 'devices'])

    /* === APP CONFIG === */
    .config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
      
      $stateProvider
      .state('users', {
        url: '/users',
        templateUrl: 'partials/users/users.html',
        controller:  'usersCtrl'
      })
      .state('map', {
        url: '/map',
        templateUrl: 'partials/map/map.html',
        controller:  'mapCtrl'
      })
      .state('vehicle', {
        url: '/vehicle',
        templateUrl: 'partials/vehicle/vehicle.html',
        controller:  'vehicleCtrl'
      })
      $urlRouterProvider.otherwise('/map');
      
    }])

    .run(['$rootScope', '$state', function($rootScope, $state) {
        $rootScope.$on('$stateChangeStart', function(evt, to, params) {
          if (to.redirectTo) {
            evt.preventDefault();
            $state.go(to.redirectTo, params, {location: 'replace'})
          }
        });
    }])
    
    /* === GENERAL CONTROLLERS === */
    .controller('sidebar', ['$scope', '$state', function($scope, $state) {
       $scope.sidebarItems = [
           { title: "Map", route: "map", icon: 'icon-location', active: false },
           { title: 'Users', route: 'users', icon: 'icon-user', active: false},
           { title: "Vehicle", route: "vehicle", icon: 'icon-car', active: false }
       ];
       
       $scope.isActive = function() {  
           return $state.includes('overview');
       }
    }])
    
    .controller('mapCtrl', ['$rootScope', '$scope', function($rootScope, $scope) {
        var self = this;
        $scope.onChangeMapExtent = function(extent){
            $rootScope.mapLastSelectedArea = {id:'_last_selected', name: 'Last Selected', extent: extent};
            $scope.selectedRegion = {id: 'user_'+new Date(), name: 'User Defined', extent: extent};
        };
        
        //
        // Area is for focusing on a small region. 
        // - to set location, `center` (and `zoom`) or `extent` property
        //   - the default zoom value is 15
        //
        $scope.areas = [
          {id: 'tokyo1' ,name: 'Tokyo, Japan', center:  [139.731992,35.709026]},
          {id: 'vegas1'  , name: 'MGM Grand, Las Vegas', center:  [-115.165571,36.102118]},
          {id: 'vegas2' ,name: 'Mandalay Bay, Las Vegas', center:  [-115.176670,36.090754]},
          {id: 'munch1'  ,name: 'Hellabrunn Zoo, Munich', center:  [11.55848,48.0993]},
          {id: 'munch2'  ,name: 'Nymphenburg Palace, Munich', center:  [11.553583,48.176656]},
          {id: 'toronto1'  ,name: 'Yonge Street, Toronto, ON', center:  [-79.469372,44.007261]},
        ];
//        if(navigator.geolocation){
//            navigator.geolocation.getCurrentPosition(function(pos){
//                $scope.areas.push({
//                    id: 'current',
//                    name: 'Current Location',
//                    center: [pos.coords.longitude, pos.coords.latitude]});
//            });
//        }
        if($rootScope.mapLastSelectedArea){
            $scope.areas.push($rootScope.mapLastSelectedArea);
            $scope.selectedArea = $rootScope.mapLastSelectedArea;
        }else{
            $scope.selectedArea = $scope.areas[0];
        }
        
        //
        // Region is wider than area, e.g. to track the number of cars
        //
        $scope.regions = [
          {id: 'tokyo'  ,name: 'Tokyo, Japan', extent:  [139.03856214008624,35.53126066670448,140.16740735493002,35.81016922341598]},
          {id: 'vegas'  ,name: 'Las Vegas', extent: [-116.26637642089848,35.86905016413695,-114.00868599121098,36.423521308323046]},
          {id: "munich" ,name: 'Munich, Germany', extent: [10.982384418945298,48.01255711693946,12.111229633789048,48.24171763772631]},
          {id: "toronto",name: 'Toronto, Canada', extent: [-80.69297429492181,43.57305259767264,-78.43528386523431,44.06846938917488]},
        ];
        // make initial selection
        $scope.selectedRegion = $scope.regions[0];
    }])
    
    .controller('usersCtrl', ['$scope', function($scope, $state) {
        // empry
    }])

    .controller('vehicleCtrl', ['$scope', function($scope, $state) {
        // empty
    }])
;