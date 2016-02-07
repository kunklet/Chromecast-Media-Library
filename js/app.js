/*
// Copyright 2014 John Kunkel All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
*/

var mediaApp = angular.module('mediaApp', []);

mediaApp.factory('CastData', function () {
	var castData = {
		session: null,
		showReceiverPicker: false,
		receiverIcon: 'off',
		showActivityControls: false,
		showVideoPlayer: true,
		showPlayIcons: true,
		showCastIcons: false,
		progressBarClass: null,
		progressBarPercent: 0,
		progressBarSeconds: 0.0,
		progressBarPromise: null,
		isPaused: false,
		isPlaying: true,
		showMute: true,
		showUnmute: false,
		mediaName: ''
	};
	return castData;
});

mediaApp.directive('a', function() {
    return {
        restrict: 'E',
        link: function(scope, elem, attrs) {
            if(attrs.ngClick || attrs.href === '' || attrs.href === '#'){
                elem.on('click', function(e){
                    e.preventDefault();
                });
            }
        }
   };
});

mediaApp.controller('CastCtrl', function($scope, $http, $interval, $timeout, CastData) {

	$scope.useJsonMovieListFile = false;

	$scope.year = new Date().getFullYear();

	// get all the cast data from the factory
	$scope.castData = CastData;

	if($scope.useJsonMovieListFile) {
		$http.get('movieList.json').success(function(data) {
			$scope.movies = data;
			$scope.resetMediaIcons();
		});
	} else {
		$scope.movies = [
			{"name": "Big Buck Bunny", "src": "http:\/\/commondatastorage.googleapis.com\/gtv-videos-bucket\/sample\/BigBuckBunny.mp4"},
			{"name": "Elephant Dream", "src": "http:\/\/commondatastorage.googleapis.com\/gtv-videos-bucket\/sample\/ElephantsDream.mp4"}
		];
	}

	$scope.resetMediaIcons = function() {
		angular.forEach($scope.movies, function(value, key) {
			$scope.movies[key].playClass = 'play-icon';
			$scope.movies[key].glyphIcon = 'glyphicon-play';
			$scope.movies[key].castClass = 'cast-icon';
		});
	};

	// start recursive timeout to find/wait for the cast object
	angular.element(document).ready(function() {
		$scope.resetMediaIcons();
		$scope.bootAttempts = 0;
		$scope.bootCast();
	});

	$scope.bootCast = function() {
		if (chrome.cast && chrome.cast.isAvailable) {
			$scope.initializeApi();
		} else if($scope.bootAttempts < 100) {
			$scope.initializePromise = $timeout(
				function() {
					$scope.bootCast();
				},
				100
			);
		}
	};

	$scope.initializeApi = function() {
		$scope.castData.sessionRequest = new chrome.cast.SessionRequest(chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
		$scope.castData.apiConfig = new chrome.cast.ApiConfig($scope.castData.sessionRequest, $scope.sessionListener, $scope.receiverListener);
		chrome.cast.initialize($scope.castData.apiConfig, $scope.onInitSuccess, $scope.onCastError);
	};

	$scope.onInitSuccess = function() {
		//console.log('Init Success');
	};

	$scope.sessionListener = function(e) {
		$scope.castData.session = e;
		$scope.castData.receiverIcon = 'on';
		$scope.castData.showVideoPlayer = false;
		$scope.castData.showPlayIcons = false;
		$scope.castData.showCastIcons = true;
		$scope.castData.showActivityControls = true;
		$scope.castData.selectedReceiverName = $scope.castData.session.receiver.friendlyName;

		// the extension already has a session and media loaded so lets go with that data
		if ($scope.castData.session.media.length > 0) {
			$scope.checkMuteStatus($scope.castData.session.media[0]);
			$scope.checkPlayStatus($scope.castData.session.media[0]);
			$scope.castData.progressBarSeconds = $scope.castData.session.media[0].currentTime;
			$scope.startProgressBar();
			// find the currently playing movie and update it with what is currently playing
			angular.forEach($scope.movies, function(value, key) {
				if($scope.movies[key].src == $scope.castData.session.media[0].media.customData.src) {
					$scope.movies[key] = $scope.castData.session.media[0].media.customData;
					$scope.castData.mediaName = $scope.castData.session.media[0].media.customData.name;
				}
			});
			$scope.castData.session.addMediaListener($scope.onMediaDiscovered);
			$scope.castData.session.addUpdateListener($scope.sessionUpdateListener);
			$scope.castData.session.media[0].addUpdateListener($scope.mediaUpdateListener);
		}
		$scope.$apply();
	};

	$scope.receiverListener = function(e) {
		if( e === 'available' ) {
			$scope.castData.showReceiverPicker = true;
			$scope.$apply();
		}
	};

	$scope.selectReceiver = function() {
		chrome.cast.requestSession($scope.sessionListener, $scope.onCastError);
	};

	$scope.onMediaDiscovered = function(media) {
		$scope.castData.session.media[0].addUpdateListener($scope.mediaUpdateListener);
		$scope.castData.session.addUpdateListener($scope.sessionUpdateListener);
	};

	$scope.sessionUpdateListener = function(isAlive) {
		if(!isAlive) {
			// session is closed reset the UI
			$scope.resetMediaIcons();
			$scope.resetProgressBar();
			$scope.castData.session = null;
			$scope.castData.receiverIcon = 'off';
			$scope.castData.showVideoPlayer = true;
			$scope.castData.showPlayIcons = true;
			$scope.castData.showCastIcons = false;
			$scope.castData.showActivityControls = false;
			$scope.castData.selectedReceiverName = null;
			$scope.castData.mediaName = '';
			$scope.$apply();
		}
	};

	$scope.mediaUpdateListener = function(data) {
		//console.log('media updated');
		if($scope.castData.session.media.length === 1) {
			//console.log($scope.castData.session.media[0].playerState);
			$scope.castData.progressBarSeconds = $scope.castData.session.media[0].currentTime;
			if($scope.castData.session.media[0].playerState == "PLAYING") {
				$scope.startProgressBar();
			} else if($scope.castData.session.media[0].playerState == "PAUSED") {
				$scope.pauseProgressBar();
			} else if($scope.castData.session.media[0].playerState == "IDLE") {
				if($scope.castData.session.media[0].idleReason == 'FINISHED') {
					$scope.stopMedia();
				} else {
					$scope.pauseProgressBar();
				}
			}
		} else {
			$scope.stopSuccess();
		}
	};

	$scope.castMovie = function(movie) {
		var mediaInfo = new chrome.cast.media.MediaInfo(movie.src);
		mediaInfo.contentType = 'video/mp4';
		mediaInfo.customData = movie;
		$scope.resetMediaIcons();
		$scope.resetProgressBar();
		var request = new chrome.cast.media.LoadRequest(mediaInfo);
		request.autoplay = true;
		request.currentTime = 0;
		movie.castClass = 'cast-icon playing';
		$scope.loadingProgressBar();
		$scope.castData.showActivityControls = true;
		$scope.castData.mediaName = movie.name;
		$scope.castData.session.loadMedia(request, $scope.onMediaDiscovered, $scope.onCastError);
	};

	$scope.onCastError = function(e) {
		if(e.code.trim() == "session_error" && e.description.trim() == "No receiver for this session") {
			$scope.sessionUpdateListener(false);
		} else {
			console.log(e);
		}
	};

	$scope.checkMediaCommand = function(command) {
		return ($scope.castData.session &&
			$scope.castData.session.media.length === 1 &&
			($scope.castData.session.media[0].supportsCommand(command) || command == 'play' || command == 'stop')
		);
	};
	/**
	* Handles a stop Media request.
	*/
	$scope.stopMedia = function() {
		if ($scope.checkMediaCommand('stop')) {
			if($scope.castData.session.media.length > 0) {
				if($scope.castData.session.media[0].playerState != 'IDLE' && $scope.castData.session.media[0].idleReason != 'FINISHED') {
					$scope.castData.session.media[0].stop(null, $scope.stopSuccess, $scope.onCastError);
				} else if($scope.castData.session.media[0].playerState == 'IDLE' && $scope.castData.session.media[0].idleReason == 'FINISHED') {
					// there is no move so run stopSuccess to reset the ui
					$scope.stopSuccess();
				}
			} else {
				// there is no move so run stopSuccess to reset the ui
				$scope.stopSuccess();
			}
		}
	};

	$scope.stopSuccess = function() {
		$scope.castData.mediaName = '';
		$scope.castData.isPaused = false;
		$scope.castData.isPlaying = true;
		$scope.castData.showUnmute = false;
		$scope.castData.showMute = true;
		$scope.resetMediaIcons();
		$scope.resetProgressBar();
		$scope.$apply();
	};

	/**
	* Handles a play media request.
	*/
	$scope.playMedia = function() {
		if ($scope.checkMediaCommand('play')) {
			$scope.castData.session.media[0].play(null, $scope.playSuccess, $scope.onCastError);
		}
	};

	$scope.playSuccess = function() {
		$scope.checkPlayStatus($scope.castData.session.media[0]);
		$scope.$apply();
	};

	/**
	* Handles a pause media request.
	*/
	$scope.pauseMedia = function() {
		if ($scope.checkMediaCommand(chrome.cast.media.MediaCommand.PAUSE)) {
			$scope.castData.session.media[0].pause(null, $scope.pauseSuccess, $scope.onCastError);
		}
	};

	$scope.pauseSuccess = function() {
		$scope.checkPlayStatus($scope.castData.session.media[0]);
		$scope.pauseProgressBar();
		$scope.$apply();
	};

	$scope.checkPlayStatus = function(media) {
		//check if we are playing or not
		if(media.playerState == "PLAYING") {
			$scope.castData.isPaused = false;
			$scope.castData.isPlaying = true;
		} else {
			$scope.castData.isPaused = true;
			$scope.castData.isPlaying = false;
		}
		$scope.$apply();
	};

	/**
	* Handles a mute media request.
	*/
	$scope.muteMedia = function() {
		if ($scope.checkMediaCommand(chrome.cast.media.MediaCommand.STREAM_MUTE)) {
			var curVolume = $scope.castData.session.media[0].volume;
			curVolume.muted = true;
			var volumeRequest = new chrome.cast.media.VolumeRequest(curVolume);
			$scope.castData.session.media[0].setVolume(volumeRequest, $scope.muteSuccess, $scope.onCastError);
		}
	};

	/**
	* Handles an unmute media request.
	* @private
	*/
	$scope.unmuteMedia = function() {
		if ($scope.checkMediaCommand(chrome.cast.media.MediaCommand.STREAM_MUTE)) {
			var curVolume = $scope.castData.session.media[0].volume;
			curVolume.muted = false;
			var volumeRequest = new chrome.cast.media.VolumeRequest(curVolume);
			$scope.castData.session.media[0].setVolume(volumeRequest, $scope.muteSuccess, $scope.onCastError);
		}
	};

	$scope.muteSuccess = function() {
		$scope.checkMuteStatus($scope.castData.session.media[0]);
	};

	$scope.checkMuteStatus = function(media) {
		//check if we are muted or not
		if(media.volume.muted) {
			$scope.castData.showUnmute = true;
			$scope.castData.showMute = false;
		} else {
			$scope.castData.showUnmute = false;
			$scope.castData.showMute = true;
		}
		$scope.$apply();
	};

	/**
	* Handles a set media volume request.
	*/
	$scope.changeVolume = function(direction) {
		if ($scope.checkMediaCommand(chrome.cast.media.MediaCommand.STREAM_VOLUME)) {
			var curVolume = $scope.castData.session.media[0].volume;
			if(curVolume.level < 1 && direction == 'up') {
				curVolume.level += 0.1;
			} else if(curVolume.level > 0 && direction == 'down'){
				curVolume.level -= 0.1;
			}
			$scope.castData.session.setReceiverVolumeLevel(curVolume.level, $scope.volumeSuccess, $scope.onCastError);
		}
	};

	$scope.volumeSuccess = function() {
		//
	};

	$scope.seekMedia = function(direction, seconds) {
		if ($scope.checkMediaCommand(chrome.cast.media.MediaCommand.SEEK)) {
			var curPosition = $scope.castData.progressBarSeconds;
			var endPosition = $scope.castData.session.media[0].media.duration;
			if(direction == 'backward') {
				curPosition -= seconds;
				if(curPosition < 0) {
					curPosition = 0;
				}
			} else if(direction == 'forward'){
				curPosition += seconds;
				if(curPosition > endPosition) {
					curPosition = endPosition;
				}
			}
			$scope.pauseProgressBar();
			$scope.castData.progressBarSeconds = curPosition;
			var seekRequest = new chrome.cast.media.SeekRequest();
			seekRequest.currentTime = curPosition;
			$scope.castData.session.media[0].seek(seekRequest, $scope.seekSuccess, $scope.onCastError);
		}
	};

	$scope.seekPosition = function(event) {
		if ($scope.checkMediaCommand(chrome.cast.media.MediaCommand.SEEK)) {
			var endPosition = $scope.castData.session.media[0].media.duration;
			var barWidth = event.srcElement.clientWidth;
			if(event.srcElement.className.trim() == "progress-bar") {
				barWidth = event.srcElement.parentElement.clientWidth;
			}
			var percent = event.offsetX / barWidth;
			var newTime = (endPosition * percent);
			$scope.castData.progressBarSeconds = newTime;
			var seekRequest = new chrome.cast.media.SeekRequest();
			seekRequest.currentTime = newTime;
			$scope.castData.session.media[0].seek(seekRequest, $scope.seekSuccess, $scope.onCastError);
		}
	};

	$scope.seekSuccess = function() {
		//console.log('seek success');
	};

	$scope.startProgressBar = function() {
		if($scope.castData.session.media.length === 1) {
			$scope.castData.progressBarSeconds = $scope.castData.session.media[0].currentTime;
			if($scope.castData.session.media[0].playerState == "PLAYING") {
				$scope.nonanimatedProgressBar();
				if($scope.castData.progressBarPromise === null) {
					$scope.castData.progressBarPromise = $interval(function() {$scope.updateProgressBar();}, 100);
				}
			}
		}
	};

	$scope.updateProgressBar = function() {
		if($scope.castData.session.media.length === 1) {
			$scope.castData.progressBarSeconds += 0.1;
			$scope.castData.progressBarPercent = ($scope.castData.progressBarSeconds / $scope.castData.session.media[0].media.duration) * 100;
			if( $scope.castData.progressBarPercent >= 100) {
				$scope.pauseProgressBar();
			}
		} else {
			$scope.resetProgressBar();
		}
	};

	$scope.pauseProgressBar = function() {
		$interval.cancel($scope.castData.progressBarPromise);
		$scope.castData.progressBarPromise = null;
		$scope.animatedProgressBar();
	};

	$scope.resetProgressBar = function() {
		$interval.cancel($scope.castData.progressBarPromise);
		$scope.castData.progressBarPromise = null;
		$scope.castData.progressBarSeconds = 0.0;
		$scope.castData.progressBarPercent = 0.0;
		$scope.castData.progressBarClass = null;
		$scope.nonanimatedProgressBar();
	};

	$scope.animatedProgressBar = function() {
		$scope.castData.progressBarClass = 'progress-striped active';
	};

	$scope.nonanimatedProgressBar = function() {
		$scope.castData.progressBarClass = '';
	};

	$scope.loadingProgressBar = function() {
		$scope.castData.progressBarPercent = 100.0;
		$scope.castData.progressBarClass = 'progress-striped active';
	};

	/* non cast methods */
	$scope.playMovie = function(movie) {
		var video = jQuery("#video");
		if(movie.glyphIcon == 'glyphicon-play') {
			video.attr("src", movie.src);
			video.get(0).play();
			$scope.resetMediaIcons();
			movie.glyphIcon = 'glyphicon-stop';
		} else {
			$scope.stopMovie();
		}
	};

	$scope.stopMovie = function() {
		var video = jQuery("#video");
		video.get(0).pause();
		video.attr("src", '');
		$scope.resetMediaIcons();
	};
});