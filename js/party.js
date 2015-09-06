(function() {

	var app = angular.module('party', ['ngRoute']);

	app.config(function($routeProvider) {
        $routeProvider.
          when('/', {
            templateUrl: 'views/lobby.html',
            controller: 'LobbyController',
            controllerAs: 'lobby'
          }).
          when('/room/:room', {
            templateUrl: 'views/party.html',
            controller: 'PartyController',
            controllerAs: 'party'
          }).
          otherwise({
            redirectTo: '/'
          });
      });

	app.factory('webrtc', function() {

		var webrtc = new SimpleWebRTC({
		  // the id/element dom element that will hold "our" video
		  localVideoEl: 'localVideo',
		  // the id/element dom element that will hold remote videos
		  remoteVideosEl: '',
		  // immediately ask for camera access
		  autoRequestMedia: false
		});

		setTimeout(function(){ webrtc.startLocalVideo(); }, 1000);

		// we have to wait until it's ready
		webrtc.on('readyToCall', function () {
		  // you can name it anything
		  //webrtc.joinRoom('test-party-room');
		});

		return webrtc;

	});

	app.service('user', function() {

		this.nick = 'dude';
		this.style = {top: '15vh', left: '37.5vh'};
		this.audioStyle = {opacity: 0};
		this.silent = true;
		this.media = {video: true, audio: true};

	});

	app.service('game', function(webrtc) {

		function player(peer) {
			return {
				peer: peer,
				role: undefined,
				send: function(message) {
			        this.peer.sendDirectly('game', 'message', message);
			    }
			}
		}

		this.players = [];
		var game = this;

		this.start = function() {
			webrtc.getPeers().forEach(function(peer) {
				game.players.push(player(peer));
			});
			console.log(game.players);
		}

		this.selectAction = function(action) {
			this.actionSelected(action)
		}

		this.actionSelected = function(action) {
			console.log(action);
		}

		webrtc.on("channelMessage", function(peer, channel, message) { console.log(peer, channel, message); });

	});

	app.controller('PeersController', function($scope, webrtc, user) {

		console.log(webrtc);

		$scope.peers = [];
		user.style = {top: '37.5vh', left: '75vh'};

		var peerCtrl = this;

		// a peer video has been added
		webrtc.on('videoAdded', function (video, peer) {
		    video.oncontextmenu = function () { return false; };
		    peerCtrl.addPeer(peer, video);
		    $scope.$apply();
		    var source = document.createElement('source');
		    source.src = video.src;
		    var videoEl = document.getElementById(video.id);
		    if(videoEl) {
		    	videoEl.appendChild(source);
		    	videoEl.play();
		    }
		});

		// a peer video was removed
		webrtc.on('videoRemoved', function (video, peer) {
			var toRemove = peer;
			$scope.peers = _.reject($scope.peers, function(peer) { return peer.id === toRemove.id });
			peerCtrl.arrangePeers();
			$scope.$apply();
		});

		this.addPeer = function(peer, video) {
			if($scope.peers.length >= 12) return;
			if(!peer) peer = {};
			peer.style = {top:'0vh', left: '0vh'};
			var id = video?video.id:'';
			peer.video = '<video id="'+id+'" poster="img/white.png"></video>';
			$scope.peers.push(peer);		
			this.arrangePeers();
		}

		this.arrangePeers = function() {
			var count = $scope.peers.length;
			if(count==0) {
				if(webrtc.roomName) user.style = {top: '37.5vh', left: '75vh'};
				else user.style = {top: '15vh', left: '37.5vh'};
				return;
			}
			var angle = 2*Math.PI/(count+1);
			var i = 0.5;
			var top = 0.75*(100 - 50*(Math.cos(i*angle)+1))+'vh';
			var left = 0.75*(50*(Math.sin(i*angle)+1))+'vh';
			user.style = {top: top, left: left};
			i++;
			$scope.peers.forEach(function(peer) {
				var top = 0.75*(100 - 50*(Math.cos(i*angle)+1))+'vh';
				var left = 0.75*(50*(Math.sin(i*angle)+1))+'vh';
				peer.style = {top: top, left: left};
				i++;
			});
		}

		this.mute = function() {
			webrtc.mute();
		}

	});

	app.controller('MessageController', function($scope, game) {

		this.message = 'Welcome to party.js';

		this.actions = ['Continue', 'Leave', 'Lollygag', 'Fuck off', 'Jesus Christ'];

		this.start = function() {
			game.start();
		}

		this.choice = function(action) {
			game.selectAction(action);
		}

	});

	app.controller('PartyController', function($routeParams, webrtc) {

		webrtc.joinRoom('partyjs_'+$routeParams.room);
		console.log('joined room '+webrtc.roomName);

	});

	app.controller('LobbyController', function(webrtc, user, $scope) {

		webrtc.leaveRoom();
		user.style = {top: '15vh', left: '37.5vh'};

	});

	app.controller('UserController', function(user, webrtc, $scope) {

		this.user = user;

		// local volume has changed
		webrtc.on('volumeChange', function (volume, treshold) {
		    //if(volume > treshold) console.log(volume, treshold);
		    if (volume < -45) volume = -45; // -45 to -20 is
    		if (volume > -20) volume = -20; // a good range
		    var volumeLevel = (volume + 45) / 25;
		    if(volumeLevel > user.audioStyle.opacity) {
		    	var volumeEl = document.getElementById("localVolume");
				var opacity = window.getComputedStyle(volumeEl, null).getPropertyValue("opacity");;
		    	if(volumeLevel > opacity) user.silent = false;
		    } else {
		    	user.silent = true;
		    }
		    user.audioStyle = {opacity: volumeLevel};
		    $scope.$apply();
		});

	});

	app.controller('LocalMediaController', function(user, webrtc) {

		this.media = user.media;

		this.toggleVideo = function() {
			if(this.media.video) {
				webrtc.pauseVideo();
				this.media.video = false;
			} else {
				webrtc.resumeVideo();
				this.media.video = true;
			}
		}

		this.toggleAudio = function() {
			if(this.media.audio) {
				webrtc.mute();
				this.media.audio = false;
			} else {
				webrtc.unmute();
				this.media.audio = true;
			}
		}

	});

	app.filter('unsafe', function($sce) {
        return function(val) {
            return $sce.trustAsHtml(val);
        };
    });

})();