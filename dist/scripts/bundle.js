(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
function initGame() {
  console.log('new game!!!!!!!!!!!');
}

module.exports = initGame;

},{}],2:[function(require,module,exports){
var initGame = require('./initGame');

// game setup variables
var FIREBASE_BASE = firebase;
var firebaseRef;
var firebasePath;
var path;
var pathReference;
var firebasePathsRef;

initGame();


var getUrlVars = function() {
  var vars = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
    vars[key] = value;
  });

  return vars;
};

var gameId = getUrlVars()['id'];

var player;
if (Cookies.get('player')) {
  player = Cookies.get('player');
  Cookies.set('player', '');
} else {
  player = getUrlVars()['player'];
}

document.querySelector('.wrapper').style.maxWidth = window.innerHeight / 1.7 + 'px';

// word tile variables
var wordlist = [
  "cat",
  "dog",
  "bird",
  "fish",
  "snake",
  "turtle",
  "snail",
];

var title = document.getElementById('drawingTitle');
var letterPool = document.getElementById('letter-pool');
var word = document.getElementById('word');
var currentPosition;
var currentLetter;
var jumble;
var solution;
var checkPosition;
var selection;

// setup paper.js
paper.install(window);
window.canvas = document.getElementById('canvas');
// canvas.width = window.innerWidth;
// canvas.height = window.innerHeight;
paper.setup(canvas);

// jQuery ready
$(function() {

  // check for exising game ID
  if (!gameId) {
    firebaseRef = FIREBASE_BASE.database().ref().push();
    console.log('pushing new game id', firebaseRef.key);
    var path = 'index.html?id=' + firebaseRef.key;
    //window.location = path;

    $('#menu').show();
    $('#drawBtn').attr('href', path);
    $('#guessBtn').attr('href', path);
  } else {
    $('#menu').hide();
    firebaseRef = FIREBASE_BASE.database().ref().child(gameId);
  }

  // setup firebase response to path data
  pathReference = {};
  firebasePathsRef = firebaseRef.child('paths');

  firebasePathsRef.on('child_changed', function(snapshot) {
    var firebaseData = snapshot.val();
    //console.log(firebaseData.path);
    pathReference[snapshot.key].pathData = firebaseData.path;
    view.update();
  });

  firebasePathsRef.on('child_added', function(snapshot) {
    var firebaseData = snapshot.val();
    pathReference[snapshot.key] = new Path();
    pathReference[snapshot.key].pathData = firebaseData.path;
    pathReference[snapshot.key].strokeColor = '#3b6cb7';
    pathReference[snapshot.key].strokeWidth = 3;
    view.update();
  });

  // select player draw
  $('#drawBtn').click(function() {
    var path = $(this).attr('href');
    path += '&player=guess';
    $(this).attr('href', path);
    Cookies.set('player', 'draw');

    // choose a word at random anyway
    selection = wordlist[Math.floor(Math.random() * wordlist.length)];

    // set up canvas
    const drawHeight = window.canvas.offsetHeight;
    const drawWidth = window.canvas.offsetWidth;

    // send data to firebase
    firebaseRef.set({
      word: selection,
      completed: false,
      drawHeight: drawHeight,
      drawWidth: drawWidth
    }, function() {
      window.location = path;
    });

    return false;
  });

  // select player guess
  $('#guessBtn').click(function() {
    var path = $(this).attr('href');
    path += '&player=draw';
    $(this).attr('href', path);
    Cookies.set('player', 'guess');

    // choose a word at random
    selection = wordlist[Math.floor(Math.random() * wordlist.length)];
    firebaseRef.set({
      word: selection,
      completed: false
    }, function() {
      window.location = path;
    });

    return false;
  });

  firebaseRef.child('completed').on('value', function(snapshot) {
    if (snapshot.val() === true) {
      $('#gameOver').show();
      paper.project.activeLayer.children = [];
      view.update();
      $('#word').empty();
      $('#letter-pool').empty();
      jumble = [];
      if (player === 'draw') {
        //Cookies.set('player', 'guess');
        player = 'guess';
      } else if (player === 'guess') {
        //Cookies.set('player', 'draw');
        player = 'draw';
      }
    } else {
      $('#gameOver').hide();
    }
  });

  $('#gameOver').click(function() {
    // choose a word at random
    selection = wordlist[Math.floor(Math.random() * wordlist.length)];

    // selection = selection.split('');
    firebaseRef.set({
      word: selection,
      completed: false
    });
  });

  // get current word from firebase
  firebaseRef.child('word').on('value', function(snapshot) {
    selection = snapshot.val();
    console.log(selection);
    jumble = new Array();
    solution = new Array();
    $('#word').empty();
    $('#letter-pool').empty();


    // *****
    // check for player type
    // setup paperjs for draw player
    // *****
    if (player === 'draw') {
      $('#drawingTitle').html(selection);
      $('#drawingTitle').show();
      $('#letter-pool').hide();
      $('#word').hide();

      var tool = new Tool();

      tool.onMouseDown = function(event) {
        if (player == 'draw') {
          // If we produced a path before, deselect it:
          if (path) {
            path.selected = false;
          }

          // Create a new path and set its stroke color to black:
          path = new Path({
            segments: [event.point],
            strokeColor: 'black',
            // Select the path, so we can see its segment points:
            fullySelected: true
          });

          firebasePath = firebasePathsRef.push();
          pathReference[firebasePath.key] = new Path();
        }
      }

      // While the user drags the mouse, points are added to the path
      // at the position of the mouse:
      tool.onMouseDrag = function(event) {
        if (player == 'draw') {
          path.add(event.point);
          firebasePath.set({
            path: path.pathData
          });
        }
      };

      // When the mouse is released, we simplify the path:
      tool.onMouseUp = function(event) {
        if (player == 'draw') {
          //path.simplify(10);
          path.fullySelected = false;
          path.remove();
        }
      }




      // *****
      // setup tiles for guess player
      // *****
    } else if (player === 'guess') {
      // split the characters into an array
      selection = selection.split('');

      $('#drawingTitle').hide();
      $('#letter-pool').show();
      $('#word').show();

      let getWidth = firebaseRef.child('drawWidth').once('value').then(function(data) {
        return data.val();
      });
      let getHeight = firebaseRef.child('drawHeight').once('value').then(function(data) {
        return data.val();
      });

      Promise.all([getHeight, getWidth]).then(values => {
        let drawWidth = values[1];
        let drawHeight = values[0];
        const aspectRatio = drawWidth / drawHeight;

        console.log('values', values);
        console.log('drawWidth', values[0]);
        console.log('drawHeight', values[1]);

        // scale canvas if necessary
        if (drawHeight > window.canvas.offsetHeight) {
          const imageDiff = window.canvas.offsetHeight / drawHeight;
          paper.view._matrix.scale(imageDiff);
          paper.view.update();
        }
      });




      // loop over the array and print out drop containers
      // push each character to a new array that we can shuffle
      selection.forEach(function(index) {
        var tile = document.createElement('div');
        tile.classList.add('position');
        tile.setAttribute('droppable', true);
        tile.setAttribute('data-letter', index);
        word.appendChild(tile);
        jumble.push(index);
      });

      // shuffle the characters in the new word array
      jumble.sort(function() {
        return 0.5 - Math.random();
      });

      // print out characters on screen;
      jumble.forEach(function(index) {
        var tile = document.createElement('div');
        var text = document.createTextNode(index);
        tile.classList.add('letter');
        tile.appendChild(text);
        letterPool.appendChild(tile);
      });

      // check if the letter tile is put in the right place
      checkPosition = function(position, letter) {
        //console.log(position, letter);
        if (position == letter) {
          return true;
        } else {
          return false;
        }
      }

      // add jquery ui drop function
      $('.position').droppable({
        tolerance: "pointer",
        over: function() {
          $(this).addClass('position--hover');
        },
        out: function() {
          $(this).removeClass('position--hover');
        },
        drop: function(event, ui) {
          //console.log(event);

          currentPosition = event.target;
          currentPosition.classList.remove('position--hover');

          if (checkPosition(currentPosition.getAttribute('data-letter'), ui.draggable.html())) {
            currentPosition.classList.add('position--correct');

            ui.draggable.css('position', 'absolute');
            ui.draggable.css('left', '-1px');
            ui.draggable.css('top', '-1px');
            $(currentPosition).append(ui.draggable);

            solution.push(ui.draggable.html());
            if (solution.join() === selection.join()) {
              //word.classList.add('word--correct');
              firebaseRef.child('completed').set(true);
              firebaseRef.child('paths').set([]);
            }
          } else {
            currentPosition.classList.add('position--incorrect');
            ui.draggable.animate({
              left: 0,
              top: 0
            }, 150, function() {
              currentPosition.classList.remove('position--incorrect');
            });
          }
        }
      });

      // add jquery ui drag function
      $('.letter').draggable({
        stop: function(event, ui) {
          //console.log(event);
          if (!ui.helper.parent().hasClass('position')) {
            ui.helper.animate({
              left: 0,
              top: 0
            }, 150);
          }
        }
      });
    }
  });

}); // jQuery ready







/**
 * Function called when clicking the Login/Logout button.
 */
// [START buttoncallback]
function toggleSignIn() {
  if (!firebase.auth().currentUser) {
    // [START createprovider]
    var provider = new firebase.auth.GoogleAuthProvider();
    // [END createprovider]
    // [START addscopes]
    provider.addScope('https://www.googleapis.com/auth/plus.login');
    // [END addscopes]
    // [START signin]
    firebase.auth().signInWithPopup(provider).then(function(result) {
      // This gives you a Google Access Token. You can use it to access the Google API.
      var token = result.credential.accessToken;
      // The signed-in user info.
      var user = result.user;
      // [START_EXCLUDE]
      document.getElementById('quickstart-oauthtoken').textContent = token;
      // [END_EXCLUDE]
    }).catch(function(error) {
      // Handle Errors here.
      var errorCode = error.code;
      var errorMessage = error.message;
      // The email of the user's account used.
      var email = error.email;
      // The firebase.auth.AuthCredential type that was used.
      var credential = error.credential;
      // [START_EXCLUDE]
      if (errorCode === 'auth/account-exists-with-different-credential') {
        alert('You have already signed up with a different auth provider for that email.');
        // If you are using multiple auth providers on your app you should handle linking
        // the user's accounts here.
      } else {
        console.error(error);
      }
      // [END_EXCLUDE]
    });
    // [END signin]
  } else {
    // [START signout]
    firebase.auth().signOut();
    // [END signout]
  }
  // [START_EXCLUDE]
  document.getElementById('quickstart-sign-in').disabled = true;
  // [END_EXCLUDE]
}
// [END buttoncallback]


/**
 * initApp handles setting up UI event listeners and registering Firebase auth listeners:
 *  - firebase.auth().onAuthStateChanged: This listener is called when the user is signed in or
 *    out, and that is where we update the UI.
 */
function initApp() {
  // Listening for auth state changes.
  // [START authstatelistener]
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {

      console.log('user is signed in');


      // User is signed in.
      var displayName = user.displayName;
      var email = user.email;
      var emailVerified = user.emailVerified;
      var photoURL = user.photoURL;
      var isAnonymous = user.isAnonymous;
      var uid = user.uid;
      var providerData = user.providerData;
      // [START_EXCLUDE]
      // document.getElementById('quickstart-sign-in-status').textContent = 'Signed in';
      document.getElementById('quickstart-sign-in').textContent = 'Sign out';
      // document.getElementById('quickstart-account-details').textContent = JSON.stringify(user, null, '  ');
      // console.log('auth data', user.photoURL);
      var userImage = `<img src="${user.photoURL}" />`;
      document.querySelector('.userImage').innerHTML = userImage;
      document.querySelector('.menu__userImage').innerHTML = userImage;
      // [END_EXCLUDE]
    } else {
      // User is signed out.
      // [START_EXCLUDE]
      // document.getElementById('quickstart-sign-in-status').textContent = 'Signed out';
      document.getElementById('quickstart-sign-in').textContent = 'Sign in with Google';
      // document.getElementById('quickstart-account-details').textContent = 'null';
      // document.getElementById('quickstart-oauthtoken').textContent = 'null';
      // [END_EXCLUDE]
    }
    // [START_EXCLUDE]
    document.getElementById('quickstart-sign-in').disabled = false;
    // [END_EXCLUDE]
  });
  // [END authstatelistener]
  document.getElementById('quickstart-sign-in').addEventListener('click', toggleSignIn, false);
}
window.onload = function() {
  initApp();
};

},{"./initGame":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzY3JpcHRzL2luaXRHYW1lLmpzIiwic2NyaXB0cy9zY3JpcHQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJmdW5jdGlvbiBpbml0R2FtZSgpIHtcbiAgY29uc29sZS5sb2coJ25ldyBnYW1lISEhISEhISEhISEnKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbml0R2FtZTtcbiIsInZhciBpbml0R2FtZSA9IHJlcXVpcmUoJy4vaW5pdEdhbWUnKTtcblxuLy8gZ2FtZSBzZXR1cCB2YXJpYWJsZXNcbnZhciBGSVJFQkFTRV9CQVNFID0gZmlyZWJhc2U7XG52YXIgZmlyZWJhc2VSZWY7XG52YXIgZmlyZWJhc2VQYXRoO1xudmFyIHBhdGg7XG52YXIgcGF0aFJlZmVyZW5jZTtcbnZhciBmaXJlYmFzZVBhdGhzUmVmO1xuXG5pbml0R2FtZSgpO1xuXG5cbnZhciBnZXRVcmxWYXJzID0gZnVuY3Rpb24oKSB7XG4gIHZhciB2YXJzID0ge307XG4gIHZhciBwYXJ0cyA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmLnJlcGxhY2UoL1s/Jl0rKFtePSZdKyk9KFteJl0qKS9naSwgZnVuY3Rpb24obSwga2V5LCB2YWx1ZSkge1xuICAgIHZhcnNba2V5XSA9IHZhbHVlO1xuICB9KTtcblxuICByZXR1cm4gdmFycztcbn07XG5cbnZhciBnYW1lSWQgPSBnZXRVcmxWYXJzKClbJ2lkJ107XG5cbnZhciBwbGF5ZXI7XG5pZiAoQ29va2llcy5nZXQoJ3BsYXllcicpKSB7XG4gIHBsYXllciA9IENvb2tpZXMuZ2V0KCdwbGF5ZXInKTtcbiAgQ29va2llcy5zZXQoJ3BsYXllcicsICcnKTtcbn0gZWxzZSB7XG4gIHBsYXllciA9IGdldFVybFZhcnMoKVsncGxheWVyJ107XG59XG5cbmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy53cmFwcGVyJykuc3R5bGUubWF4V2lkdGggPSB3aW5kb3cuaW5uZXJIZWlnaHQgLyAxLjcgKyAncHgnO1xuXG4vLyB3b3JkIHRpbGUgdmFyaWFibGVzXG52YXIgd29yZGxpc3QgPSBbXG4gIFwiY2F0XCIsXG4gIFwiZG9nXCIsXG4gIFwiYmlyZFwiLFxuICBcImZpc2hcIixcbiAgXCJzbmFrZVwiLFxuICBcInR1cnRsZVwiLFxuICBcInNuYWlsXCIsXG5dO1xuXG52YXIgdGl0bGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJhd2luZ1RpdGxlJyk7XG52YXIgbGV0dGVyUG9vbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsZXR0ZXItcG9vbCcpO1xudmFyIHdvcmQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd29yZCcpO1xudmFyIGN1cnJlbnRQb3NpdGlvbjtcbnZhciBjdXJyZW50TGV0dGVyO1xudmFyIGp1bWJsZTtcbnZhciBzb2x1dGlvbjtcbnZhciBjaGVja1Bvc2l0aW9uO1xudmFyIHNlbGVjdGlvbjtcblxuLy8gc2V0dXAgcGFwZXIuanNcbnBhcGVyLmluc3RhbGwod2luZG93KTtcbndpbmRvdy5jYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FudmFzJyk7XG4vLyBjYW52YXMud2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcbi8vIGNhbnZhcy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG5wYXBlci5zZXR1cChjYW52YXMpO1xuXG4vLyBqUXVlcnkgcmVhZHlcbiQoZnVuY3Rpb24oKSB7XG5cbiAgLy8gY2hlY2sgZm9yIGV4aXNpbmcgZ2FtZSBJRFxuICBpZiAoIWdhbWVJZCkge1xuICAgIGZpcmViYXNlUmVmID0gRklSRUJBU0VfQkFTRS5kYXRhYmFzZSgpLnJlZigpLnB1c2goKTtcbiAgICBjb25zb2xlLmxvZygncHVzaGluZyBuZXcgZ2FtZSBpZCcsIGZpcmViYXNlUmVmLmtleSk7XG4gICAgdmFyIHBhdGggPSAnaW5kZXguaHRtbD9pZD0nICsgZmlyZWJhc2VSZWYua2V5O1xuICAgIC8vd2luZG93LmxvY2F0aW9uID0gcGF0aDtcblxuICAgICQoJyNtZW51Jykuc2hvdygpO1xuICAgICQoJyNkcmF3QnRuJykuYXR0cignaHJlZicsIHBhdGgpO1xuICAgICQoJyNndWVzc0J0bicpLmF0dHIoJ2hyZWYnLCBwYXRoKTtcbiAgfSBlbHNlIHtcbiAgICAkKCcjbWVudScpLmhpZGUoKTtcbiAgICBmaXJlYmFzZVJlZiA9IEZJUkVCQVNFX0JBU0UuZGF0YWJhc2UoKS5yZWYoKS5jaGlsZChnYW1lSWQpO1xuICB9XG5cbiAgLy8gc2V0dXAgZmlyZWJhc2UgcmVzcG9uc2UgdG8gcGF0aCBkYXRhXG4gIHBhdGhSZWZlcmVuY2UgPSB7fTtcbiAgZmlyZWJhc2VQYXRoc1JlZiA9IGZpcmViYXNlUmVmLmNoaWxkKCdwYXRocycpO1xuXG4gIGZpcmViYXNlUGF0aHNSZWYub24oJ2NoaWxkX2NoYW5nZWQnLCBmdW5jdGlvbihzbmFwc2hvdCkge1xuICAgIHZhciBmaXJlYmFzZURhdGEgPSBzbmFwc2hvdC52YWwoKTtcbiAgICAvL2NvbnNvbGUubG9nKGZpcmViYXNlRGF0YS5wYXRoKTtcbiAgICBwYXRoUmVmZXJlbmNlW3NuYXBzaG90LmtleV0ucGF0aERhdGEgPSBmaXJlYmFzZURhdGEucGF0aDtcbiAgICB2aWV3LnVwZGF0ZSgpO1xuICB9KTtcblxuICBmaXJlYmFzZVBhdGhzUmVmLm9uKCdjaGlsZF9hZGRlZCcsIGZ1bmN0aW9uKHNuYXBzaG90KSB7XG4gICAgdmFyIGZpcmViYXNlRGF0YSA9IHNuYXBzaG90LnZhbCgpO1xuICAgIHBhdGhSZWZlcmVuY2Vbc25hcHNob3Qua2V5XSA9IG5ldyBQYXRoKCk7XG4gICAgcGF0aFJlZmVyZW5jZVtzbmFwc2hvdC5rZXldLnBhdGhEYXRhID0gZmlyZWJhc2VEYXRhLnBhdGg7XG4gICAgcGF0aFJlZmVyZW5jZVtzbmFwc2hvdC5rZXldLnN0cm9rZUNvbG9yID0gJyMzYjZjYjcnO1xuICAgIHBhdGhSZWZlcmVuY2Vbc25hcHNob3Qua2V5XS5zdHJva2VXaWR0aCA9IDM7XG4gICAgdmlldy51cGRhdGUoKTtcbiAgfSk7XG5cbiAgLy8gc2VsZWN0IHBsYXllciBkcmF3XG4gICQoJyNkcmF3QnRuJykuY2xpY2soZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBhdGggPSAkKHRoaXMpLmF0dHIoJ2hyZWYnKTtcbiAgICBwYXRoICs9ICcmcGxheWVyPWd1ZXNzJztcbiAgICAkKHRoaXMpLmF0dHIoJ2hyZWYnLCBwYXRoKTtcbiAgICBDb29raWVzLnNldCgncGxheWVyJywgJ2RyYXcnKTtcblxuICAgIC8vIGNob29zZSBhIHdvcmQgYXQgcmFuZG9tIGFueXdheVxuICAgIHNlbGVjdGlvbiA9IHdvcmRsaXN0W01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHdvcmRsaXN0Lmxlbmd0aCldO1xuXG4gICAgLy8gc2V0IHVwIGNhbnZhc1xuICAgIGNvbnN0IGRyYXdIZWlnaHQgPSB3aW5kb3cuY2FudmFzLm9mZnNldEhlaWdodDtcbiAgICBjb25zdCBkcmF3V2lkdGggPSB3aW5kb3cuY2FudmFzLm9mZnNldFdpZHRoO1xuXG4gICAgLy8gc2VuZCBkYXRhIHRvIGZpcmViYXNlXG4gICAgZmlyZWJhc2VSZWYuc2V0KHtcbiAgICAgIHdvcmQ6IHNlbGVjdGlvbixcbiAgICAgIGNvbXBsZXRlZDogZmFsc2UsXG4gICAgICBkcmF3SGVpZ2h0OiBkcmF3SGVpZ2h0LFxuICAgICAgZHJhd1dpZHRoOiBkcmF3V2lkdGhcbiAgICB9LCBmdW5jdGlvbigpIHtcbiAgICAgIHdpbmRvdy5sb2NhdGlvbiA9IHBhdGg7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pO1xuXG4gIC8vIHNlbGVjdCBwbGF5ZXIgZ3Vlc3NcbiAgJCgnI2d1ZXNzQnRuJykuY2xpY2soZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBhdGggPSAkKHRoaXMpLmF0dHIoJ2hyZWYnKTtcbiAgICBwYXRoICs9ICcmcGxheWVyPWRyYXcnO1xuICAgICQodGhpcykuYXR0cignaHJlZicsIHBhdGgpO1xuICAgIENvb2tpZXMuc2V0KCdwbGF5ZXInLCAnZ3Vlc3MnKTtcblxuICAgIC8vIGNob29zZSBhIHdvcmQgYXQgcmFuZG9tXG4gICAgc2VsZWN0aW9uID0gd29yZGxpc3RbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogd29yZGxpc3QubGVuZ3RoKV07XG4gICAgZmlyZWJhc2VSZWYuc2V0KHtcbiAgICAgIHdvcmQ6IHNlbGVjdGlvbixcbiAgICAgIGNvbXBsZXRlZDogZmFsc2VcbiAgICB9LCBmdW5jdGlvbigpIHtcbiAgICAgIHdpbmRvdy5sb2NhdGlvbiA9IHBhdGg7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH0pO1xuXG4gIGZpcmViYXNlUmVmLmNoaWxkKCdjb21wbGV0ZWQnKS5vbigndmFsdWUnLCBmdW5jdGlvbihzbmFwc2hvdCkge1xuICAgIGlmIChzbmFwc2hvdC52YWwoKSA9PT0gdHJ1ZSkge1xuICAgICAgJCgnI2dhbWVPdmVyJykuc2hvdygpO1xuICAgICAgcGFwZXIucHJvamVjdC5hY3RpdmVMYXllci5jaGlsZHJlbiA9IFtdO1xuICAgICAgdmlldy51cGRhdGUoKTtcbiAgICAgICQoJyN3b3JkJykuZW1wdHkoKTtcbiAgICAgICQoJyNsZXR0ZXItcG9vbCcpLmVtcHR5KCk7XG4gICAgICBqdW1ibGUgPSBbXTtcbiAgICAgIGlmIChwbGF5ZXIgPT09ICdkcmF3Jykge1xuICAgICAgICAvL0Nvb2tpZXMuc2V0KCdwbGF5ZXInLCAnZ3Vlc3MnKTtcbiAgICAgICAgcGxheWVyID0gJ2d1ZXNzJztcbiAgICAgIH0gZWxzZSBpZiAocGxheWVyID09PSAnZ3Vlc3MnKSB7XG4gICAgICAgIC8vQ29va2llcy5zZXQoJ3BsYXllcicsICdkcmF3Jyk7XG4gICAgICAgIHBsYXllciA9ICdkcmF3JztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgJCgnI2dhbWVPdmVyJykuaGlkZSgpO1xuICAgIH1cbiAgfSk7XG5cbiAgJCgnI2dhbWVPdmVyJykuY2xpY2soZnVuY3Rpb24oKSB7XG4gICAgLy8gY2hvb3NlIGEgd29yZCBhdCByYW5kb21cbiAgICBzZWxlY3Rpb24gPSB3b3JkbGlzdFtNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiB3b3JkbGlzdC5sZW5ndGgpXTtcblxuICAgIC8vIHNlbGVjdGlvbiA9IHNlbGVjdGlvbi5zcGxpdCgnJyk7XG4gICAgZmlyZWJhc2VSZWYuc2V0KHtcbiAgICAgIHdvcmQ6IHNlbGVjdGlvbixcbiAgICAgIGNvbXBsZXRlZDogZmFsc2VcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gZ2V0IGN1cnJlbnQgd29yZCBmcm9tIGZpcmViYXNlXG4gIGZpcmViYXNlUmVmLmNoaWxkKCd3b3JkJykub24oJ3ZhbHVlJywgZnVuY3Rpb24oc25hcHNob3QpIHtcbiAgICBzZWxlY3Rpb24gPSBzbmFwc2hvdC52YWwoKTtcbiAgICBjb25zb2xlLmxvZyhzZWxlY3Rpb24pO1xuICAgIGp1bWJsZSA9IG5ldyBBcnJheSgpO1xuICAgIHNvbHV0aW9uID0gbmV3IEFycmF5KCk7XG4gICAgJCgnI3dvcmQnKS5lbXB0eSgpO1xuICAgICQoJyNsZXR0ZXItcG9vbCcpLmVtcHR5KCk7XG5cblxuICAgIC8vICoqKioqXG4gICAgLy8gY2hlY2sgZm9yIHBsYXllciB0eXBlXG4gICAgLy8gc2V0dXAgcGFwZXJqcyBmb3IgZHJhdyBwbGF5ZXJcbiAgICAvLyAqKioqKlxuICAgIGlmIChwbGF5ZXIgPT09ICdkcmF3Jykge1xuICAgICAgJCgnI2RyYXdpbmdUaXRsZScpLmh0bWwoc2VsZWN0aW9uKTtcbiAgICAgICQoJyNkcmF3aW5nVGl0bGUnKS5zaG93KCk7XG4gICAgICAkKCcjbGV0dGVyLXBvb2wnKS5oaWRlKCk7XG4gICAgICAkKCcjd29yZCcpLmhpZGUoKTtcblxuICAgICAgdmFyIHRvb2wgPSBuZXcgVG9vbCgpO1xuXG4gICAgICB0b29sLm9uTW91c2VEb3duID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKHBsYXllciA9PSAnZHJhdycpIHtcbiAgICAgICAgICAvLyBJZiB3ZSBwcm9kdWNlZCBhIHBhdGggYmVmb3JlLCBkZXNlbGVjdCBpdDpcbiAgICAgICAgICBpZiAocGF0aCkge1xuICAgICAgICAgICAgcGF0aC5zZWxlY3RlZCA9IGZhbHNlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIENyZWF0ZSBhIG5ldyBwYXRoIGFuZCBzZXQgaXRzIHN0cm9rZSBjb2xvciB0byBibGFjazpcbiAgICAgICAgICBwYXRoID0gbmV3IFBhdGgoe1xuICAgICAgICAgICAgc2VnbWVudHM6IFtldmVudC5wb2ludF0sXG4gICAgICAgICAgICBzdHJva2VDb2xvcjogJ2JsYWNrJyxcbiAgICAgICAgICAgIC8vIFNlbGVjdCB0aGUgcGF0aCwgc28gd2UgY2FuIHNlZSBpdHMgc2VnbWVudCBwb2ludHM6XG4gICAgICAgICAgICBmdWxseVNlbGVjdGVkOiB0cnVlXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBmaXJlYmFzZVBhdGggPSBmaXJlYmFzZVBhdGhzUmVmLnB1c2goKTtcbiAgICAgICAgICBwYXRoUmVmZXJlbmNlW2ZpcmViYXNlUGF0aC5rZXldID0gbmV3IFBhdGgoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBXaGlsZSB0aGUgdXNlciBkcmFncyB0aGUgbW91c2UsIHBvaW50cyBhcmUgYWRkZWQgdG8gdGhlIHBhdGhcbiAgICAgIC8vIGF0IHRoZSBwb3NpdGlvbiBvZiB0aGUgbW91c2U6XG4gICAgICB0b29sLm9uTW91c2VEcmFnID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKHBsYXllciA9PSAnZHJhdycpIHtcbiAgICAgICAgICBwYXRoLmFkZChldmVudC5wb2ludCk7XG4gICAgICAgICAgZmlyZWJhc2VQYXRoLnNldCh7XG4gICAgICAgICAgICBwYXRoOiBwYXRoLnBhdGhEYXRhXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIFdoZW4gdGhlIG1vdXNlIGlzIHJlbGVhc2VkLCB3ZSBzaW1wbGlmeSB0aGUgcGF0aDpcbiAgICAgIHRvb2wub25Nb3VzZVVwID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKHBsYXllciA9PSAnZHJhdycpIHtcbiAgICAgICAgICAvL3BhdGguc2ltcGxpZnkoMTApO1xuICAgICAgICAgIHBhdGguZnVsbHlTZWxlY3RlZCA9IGZhbHNlO1xuICAgICAgICAgIHBhdGgucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG5cblxuICAgICAgLy8gKioqKipcbiAgICAgIC8vIHNldHVwIHRpbGVzIGZvciBndWVzcyBwbGF5ZXJcbiAgICAgIC8vICoqKioqXG4gICAgfSBlbHNlIGlmIChwbGF5ZXIgPT09ICdndWVzcycpIHtcbiAgICAgIC8vIHNwbGl0IHRoZSBjaGFyYWN0ZXJzIGludG8gYW4gYXJyYXlcbiAgICAgIHNlbGVjdGlvbiA9IHNlbGVjdGlvbi5zcGxpdCgnJyk7XG5cbiAgICAgICQoJyNkcmF3aW5nVGl0bGUnKS5oaWRlKCk7XG4gICAgICAkKCcjbGV0dGVyLXBvb2wnKS5zaG93KCk7XG4gICAgICAkKCcjd29yZCcpLnNob3coKTtcblxuICAgICAgbGV0IGdldFdpZHRoID0gZmlyZWJhc2VSZWYuY2hpbGQoJ2RyYXdXaWR0aCcpLm9uY2UoJ3ZhbHVlJykudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIHJldHVybiBkYXRhLnZhbCgpO1xuICAgICAgfSk7XG4gICAgICBsZXQgZ2V0SGVpZ2h0ID0gZmlyZWJhc2VSZWYuY2hpbGQoJ2RyYXdIZWlnaHQnKS5vbmNlKCd2YWx1ZScpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICByZXR1cm4gZGF0YS52YWwoKTtcbiAgICAgIH0pO1xuXG4gICAgICBQcm9taXNlLmFsbChbZ2V0SGVpZ2h0LCBnZXRXaWR0aF0pLnRoZW4odmFsdWVzID0+IHtcbiAgICAgICAgbGV0IGRyYXdXaWR0aCA9IHZhbHVlc1sxXTtcbiAgICAgICAgbGV0IGRyYXdIZWlnaHQgPSB2YWx1ZXNbMF07XG4gICAgICAgIGNvbnN0IGFzcGVjdFJhdGlvID0gZHJhd1dpZHRoIC8gZHJhd0hlaWdodDtcblxuICAgICAgICBjb25zb2xlLmxvZygndmFsdWVzJywgdmFsdWVzKTtcbiAgICAgICAgY29uc29sZS5sb2coJ2RyYXdXaWR0aCcsIHZhbHVlc1swXSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdkcmF3SGVpZ2h0JywgdmFsdWVzWzFdKTtcblxuICAgICAgICAvLyBzY2FsZSBjYW52YXMgaWYgbmVjZXNzYXJ5XG4gICAgICAgIGlmIChkcmF3SGVpZ2h0ID4gd2luZG93LmNhbnZhcy5vZmZzZXRIZWlnaHQpIHtcbiAgICAgICAgICBjb25zdCBpbWFnZURpZmYgPSB3aW5kb3cuY2FudmFzLm9mZnNldEhlaWdodCAvIGRyYXdIZWlnaHQ7XG4gICAgICAgICAgcGFwZXIudmlldy5fbWF0cml4LnNjYWxlKGltYWdlRGlmZik7XG4gICAgICAgICAgcGFwZXIudmlldy51cGRhdGUoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cblxuXG5cbiAgICAgIC8vIGxvb3Agb3ZlciB0aGUgYXJyYXkgYW5kIHByaW50IG91dCBkcm9wIGNvbnRhaW5lcnNcbiAgICAgIC8vIHB1c2ggZWFjaCBjaGFyYWN0ZXIgdG8gYSBuZXcgYXJyYXkgdGhhdCB3ZSBjYW4gc2h1ZmZsZVxuICAgICAgc2VsZWN0aW9uLmZvckVhY2goZnVuY3Rpb24oaW5kZXgpIHtcbiAgICAgICAgdmFyIHRpbGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgdGlsZS5jbGFzc0xpc3QuYWRkKCdwb3NpdGlvbicpO1xuICAgICAgICB0aWxlLnNldEF0dHJpYnV0ZSgnZHJvcHBhYmxlJywgdHJ1ZSk7XG4gICAgICAgIHRpbGUuc2V0QXR0cmlidXRlKCdkYXRhLWxldHRlcicsIGluZGV4KTtcbiAgICAgICAgd29yZC5hcHBlbmRDaGlsZCh0aWxlKTtcbiAgICAgICAganVtYmxlLnB1c2goaW5kZXgpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIHNodWZmbGUgdGhlIGNoYXJhY3RlcnMgaW4gdGhlIG5ldyB3b3JkIGFycmF5XG4gICAgICBqdW1ibGUuc29ydChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIDAuNSAtIE1hdGgucmFuZG9tKCk7XG4gICAgICB9KTtcblxuICAgICAgLy8gcHJpbnQgb3V0IGNoYXJhY3RlcnMgb24gc2NyZWVuO1xuICAgICAganVtYmxlLmZvckVhY2goZnVuY3Rpb24oaW5kZXgpIHtcbiAgICAgICAgdmFyIHRpbGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgdmFyIHRleHQgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShpbmRleCk7XG4gICAgICAgIHRpbGUuY2xhc3NMaXN0LmFkZCgnbGV0dGVyJyk7XG4gICAgICAgIHRpbGUuYXBwZW5kQ2hpbGQodGV4dCk7XG4gICAgICAgIGxldHRlclBvb2wuYXBwZW5kQ2hpbGQodGlsZSk7XG4gICAgICB9KTtcblxuICAgICAgLy8gY2hlY2sgaWYgdGhlIGxldHRlciB0aWxlIGlzIHB1dCBpbiB0aGUgcmlnaHQgcGxhY2VcbiAgICAgIGNoZWNrUG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbiwgbGV0dGVyKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2cocG9zaXRpb24sIGxldHRlcik7XG4gICAgICAgIGlmIChwb3NpdGlvbiA9PSBsZXR0ZXIpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gYWRkIGpxdWVyeSB1aSBkcm9wIGZ1bmN0aW9uXG4gICAgICAkKCcucG9zaXRpb24nKS5kcm9wcGFibGUoe1xuICAgICAgICB0b2xlcmFuY2U6IFwicG9pbnRlclwiLFxuICAgICAgICBvdmVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAkKHRoaXMpLmFkZENsYXNzKCdwb3NpdGlvbi0taG92ZXInKTtcbiAgICAgICAgfSxcbiAgICAgICAgb3V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAkKHRoaXMpLnJlbW92ZUNsYXNzKCdwb3NpdGlvbi0taG92ZXInKTtcbiAgICAgICAgfSxcbiAgICAgICAgZHJvcDogZnVuY3Rpb24oZXZlbnQsIHVpKSB7XG4gICAgICAgICAgLy9jb25zb2xlLmxvZyhldmVudCk7XG5cbiAgICAgICAgICBjdXJyZW50UG9zaXRpb24gPSBldmVudC50YXJnZXQ7XG4gICAgICAgICAgY3VycmVudFBvc2l0aW9uLmNsYXNzTGlzdC5yZW1vdmUoJ3Bvc2l0aW9uLS1ob3ZlcicpO1xuXG4gICAgICAgICAgaWYgKGNoZWNrUG9zaXRpb24oY3VycmVudFBvc2l0aW9uLmdldEF0dHJpYnV0ZSgnZGF0YS1sZXR0ZXInKSwgdWkuZHJhZ2dhYmxlLmh0bWwoKSkpIHtcbiAgICAgICAgICAgIGN1cnJlbnRQb3NpdGlvbi5jbGFzc0xpc3QuYWRkKCdwb3NpdGlvbi0tY29ycmVjdCcpO1xuXG4gICAgICAgICAgICB1aS5kcmFnZ2FibGUuY3NzKCdwb3NpdGlvbicsICdhYnNvbHV0ZScpO1xuICAgICAgICAgICAgdWkuZHJhZ2dhYmxlLmNzcygnbGVmdCcsICctMXB4Jyk7XG4gICAgICAgICAgICB1aS5kcmFnZ2FibGUuY3NzKCd0b3AnLCAnLTFweCcpO1xuICAgICAgICAgICAgJChjdXJyZW50UG9zaXRpb24pLmFwcGVuZCh1aS5kcmFnZ2FibGUpO1xuXG4gICAgICAgICAgICBzb2x1dGlvbi5wdXNoKHVpLmRyYWdnYWJsZS5odG1sKCkpO1xuICAgICAgICAgICAgaWYgKHNvbHV0aW9uLmpvaW4oKSA9PT0gc2VsZWN0aW9uLmpvaW4oKSkge1xuICAgICAgICAgICAgICAvL3dvcmQuY2xhc3NMaXN0LmFkZCgnd29yZC0tY29ycmVjdCcpO1xuICAgICAgICAgICAgICBmaXJlYmFzZVJlZi5jaGlsZCgnY29tcGxldGVkJykuc2V0KHRydWUpO1xuICAgICAgICAgICAgICBmaXJlYmFzZVJlZi5jaGlsZCgncGF0aHMnKS5zZXQoW10pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjdXJyZW50UG9zaXRpb24uY2xhc3NMaXN0LmFkZCgncG9zaXRpb24tLWluY29ycmVjdCcpO1xuICAgICAgICAgICAgdWkuZHJhZ2dhYmxlLmFuaW1hdGUoe1xuICAgICAgICAgICAgICBsZWZ0OiAwLFxuICAgICAgICAgICAgICB0b3A6IDBcbiAgICAgICAgICAgIH0sIDE1MCwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRQb3NpdGlvbi5jbGFzc0xpc3QucmVtb3ZlKCdwb3NpdGlvbi0taW5jb3JyZWN0Jyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBhZGQganF1ZXJ5IHVpIGRyYWcgZnVuY3Rpb25cbiAgICAgICQoJy5sZXR0ZXInKS5kcmFnZ2FibGUoe1xuICAgICAgICBzdG9wOiBmdW5jdGlvbihldmVudCwgdWkpIHtcbiAgICAgICAgICAvL2NvbnNvbGUubG9nKGV2ZW50KTtcbiAgICAgICAgICBpZiAoIXVpLmhlbHBlci5wYXJlbnQoKS5oYXNDbGFzcygncG9zaXRpb24nKSkge1xuICAgICAgICAgICAgdWkuaGVscGVyLmFuaW1hdGUoe1xuICAgICAgICAgICAgICBsZWZ0OiAwLFxuICAgICAgICAgICAgICB0b3A6IDBcbiAgICAgICAgICAgIH0sIDE1MCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG59KTsgLy8galF1ZXJ5IHJlYWR5XG5cblxuXG5cblxuXG5cbi8qKlxuICogRnVuY3Rpb24gY2FsbGVkIHdoZW4gY2xpY2tpbmcgdGhlIExvZ2luL0xvZ291dCBidXR0b24uXG4gKi9cbi8vIFtTVEFSVCBidXR0b25jYWxsYmFja11cbmZ1bmN0aW9uIHRvZ2dsZVNpZ25JbigpIHtcbiAgaWYgKCFmaXJlYmFzZS5hdXRoKCkuY3VycmVudFVzZXIpIHtcbiAgICAvLyBbU1RBUlQgY3JlYXRlcHJvdmlkZXJdXG4gICAgdmFyIHByb3ZpZGVyID0gbmV3IGZpcmViYXNlLmF1dGguR29vZ2xlQXV0aFByb3ZpZGVyKCk7XG4gICAgLy8gW0VORCBjcmVhdGVwcm92aWRlcl1cbiAgICAvLyBbU1RBUlQgYWRkc2NvcGVzXVxuICAgIHByb3ZpZGVyLmFkZFNjb3BlKCdodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL3BsdXMubG9naW4nKTtcbiAgICAvLyBbRU5EIGFkZHNjb3Blc11cbiAgICAvLyBbU1RBUlQgc2lnbmluXVxuICAgIGZpcmViYXNlLmF1dGgoKS5zaWduSW5XaXRoUG9wdXAocHJvdmlkZXIpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAvLyBUaGlzIGdpdmVzIHlvdSBhIEdvb2dsZSBBY2Nlc3MgVG9rZW4uIFlvdSBjYW4gdXNlIGl0IHRvIGFjY2VzcyB0aGUgR29vZ2xlIEFQSS5cbiAgICAgIHZhciB0b2tlbiA9IHJlc3VsdC5jcmVkZW50aWFsLmFjY2Vzc1Rva2VuO1xuICAgICAgLy8gVGhlIHNpZ25lZC1pbiB1c2VyIGluZm8uXG4gICAgICB2YXIgdXNlciA9IHJlc3VsdC51c2VyO1xuICAgICAgLy8gW1NUQVJUX0VYQ0xVREVdXG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncXVpY2tzdGFydC1vYXV0aHRva2VuJykudGV4dENvbnRlbnQgPSB0b2tlbjtcbiAgICAgIC8vIFtFTkRfRVhDTFVERV1cbiAgICB9KS5jYXRjaChmdW5jdGlvbihlcnJvcikge1xuICAgICAgLy8gSGFuZGxlIEVycm9ycyBoZXJlLlxuICAgICAgdmFyIGVycm9yQ29kZSA9IGVycm9yLmNvZGU7XG4gICAgICB2YXIgZXJyb3JNZXNzYWdlID0gZXJyb3IubWVzc2FnZTtcbiAgICAgIC8vIFRoZSBlbWFpbCBvZiB0aGUgdXNlcidzIGFjY291bnQgdXNlZC5cbiAgICAgIHZhciBlbWFpbCA9IGVycm9yLmVtYWlsO1xuICAgICAgLy8gVGhlIGZpcmViYXNlLmF1dGguQXV0aENyZWRlbnRpYWwgdHlwZSB0aGF0IHdhcyB1c2VkLlxuICAgICAgdmFyIGNyZWRlbnRpYWwgPSBlcnJvci5jcmVkZW50aWFsO1xuICAgICAgLy8gW1NUQVJUX0VYQ0xVREVdXG4gICAgICBpZiAoZXJyb3JDb2RlID09PSAnYXV0aC9hY2NvdW50LWV4aXN0cy13aXRoLWRpZmZlcmVudC1jcmVkZW50aWFsJykge1xuICAgICAgICBhbGVydCgnWW91IGhhdmUgYWxyZWFkeSBzaWduZWQgdXAgd2l0aCBhIGRpZmZlcmVudCBhdXRoIHByb3ZpZGVyIGZvciB0aGF0IGVtYWlsLicpO1xuICAgICAgICAvLyBJZiB5b3UgYXJlIHVzaW5nIG11bHRpcGxlIGF1dGggcHJvdmlkZXJzIG9uIHlvdXIgYXBwIHlvdSBzaG91bGQgaGFuZGxlIGxpbmtpbmdcbiAgICAgICAgLy8gdGhlIHVzZXIncyBhY2NvdW50cyBoZXJlLlxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICB9XG4gICAgICAvLyBbRU5EX0VYQ0xVREVdXG4gICAgfSk7XG4gICAgLy8gW0VORCBzaWduaW5dXG4gIH0gZWxzZSB7XG4gICAgLy8gW1NUQVJUIHNpZ25vdXRdXG4gICAgZmlyZWJhc2UuYXV0aCgpLnNpZ25PdXQoKTtcbiAgICAvLyBbRU5EIHNpZ25vdXRdXG4gIH1cbiAgLy8gW1NUQVJUX0VYQ0xVREVdXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdxdWlja3N0YXJ0LXNpZ24taW4nKS5kaXNhYmxlZCA9IHRydWU7XG4gIC8vIFtFTkRfRVhDTFVERV1cbn1cbi8vIFtFTkQgYnV0dG9uY2FsbGJhY2tdXG5cblxuLyoqXG4gKiBpbml0QXBwIGhhbmRsZXMgc2V0dGluZyB1cCBVSSBldmVudCBsaXN0ZW5lcnMgYW5kIHJlZ2lzdGVyaW5nIEZpcmViYXNlIGF1dGggbGlzdGVuZXJzOlxuICogIC0gZmlyZWJhc2UuYXV0aCgpLm9uQXV0aFN0YXRlQ2hhbmdlZDogVGhpcyBsaXN0ZW5lciBpcyBjYWxsZWQgd2hlbiB0aGUgdXNlciBpcyBzaWduZWQgaW4gb3JcbiAqICAgIG91dCwgYW5kIHRoYXQgaXMgd2hlcmUgd2UgdXBkYXRlIHRoZSBVSS5cbiAqL1xuZnVuY3Rpb24gaW5pdEFwcCgpIHtcbiAgLy8gTGlzdGVuaW5nIGZvciBhdXRoIHN0YXRlIGNoYW5nZXMuXG4gIC8vIFtTVEFSVCBhdXRoc3RhdGVsaXN0ZW5lcl1cbiAgZmlyZWJhc2UuYXV0aCgpLm9uQXV0aFN0YXRlQ2hhbmdlZChmdW5jdGlvbih1c2VyKSB7XG4gICAgaWYgKHVzZXIpIHtcblxuICAgICAgY29uc29sZS5sb2coJ3VzZXIgaXMgc2lnbmVkIGluJyk7XG5cblxuICAgICAgLy8gVXNlciBpcyBzaWduZWQgaW4uXG4gICAgICB2YXIgZGlzcGxheU5hbWUgPSB1c2VyLmRpc3BsYXlOYW1lO1xuICAgICAgdmFyIGVtYWlsID0gdXNlci5lbWFpbDtcbiAgICAgIHZhciBlbWFpbFZlcmlmaWVkID0gdXNlci5lbWFpbFZlcmlmaWVkO1xuICAgICAgdmFyIHBob3RvVVJMID0gdXNlci5waG90b1VSTDtcbiAgICAgIHZhciBpc0Fub255bW91cyA9IHVzZXIuaXNBbm9ueW1vdXM7XG4gICAgICB2YXIgdWlkID0gdXNlci51aWQ7XG4gICAgICB2YXIgcHJvdmlkZXJEYXRhID0gdXNlci5wcm92aWRlckRhdGE7XG4gICAgICAvLyBbU1RBUlRfRVhDTFVERV1cbiAgICAgIC8vIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdxdWlja3N0YXJ0LXNpZ24taW4tc3RhdHVzJykudGV4dENvbnRlbnQgPSAnU2lnbmVkIGluJztcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdxdWlja3N0YXJ0LXNpZ24taW4nKS50ZXh0Q29udGVudCA9ICdTaWduIG91dCc7XG4gICAgICAvLyBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncXVpY2tzdGFydC1hY2NvdW50LWRldGFpbHMnKS50ZXh0Q29udGVudCA9IEpTT04uc3RyaW5naWZ5KHVzZXIsIG51bGwsICcgICcpO1xuICAgICAgLy8gY29uc29sZS5sb2coJ2F1dGggZGF0YScsIHVzZXIucGhvdG9VUkwpO1xuICAgICAgdmFyIHVzZXJJbWFnZSA9IGA8aW1nIHNyYz1cIiR7dXNlci5waG90b1VSTH1cIiAvPmA7XG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcudXNlckltYWdlJykuaW5uZXJIVE1MID0gdXNlckltYWdlO1xuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLm1lbnVfX3VzZXJJbWFnZScpLmlubmVySFRNTCA9IHVzZXJJbWFnZTtcbiAgICAgIC8vIFtFTkRfRVhDTFVERV1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlciBpcyBzaWduZWQgb3V0LlxuICAgICAgLy8gW1NUQVJUX0VYQ0xVREVdXG4gICAgICAvLyBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncXVpY2tzdGFydC1zaWduLWluLXN0YXR1cycpLnRleHRDb250ZW50ID0gJ1NpZ25lZCBvdXQnO1xuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3F1aWNrc3RhcnQtc2lnbi1pbicpLnRleHRDb250ZW50ID0gJ1NpZ24gaW4gd2l0aCBHb29nbGUnO1xuICAgICAgLy8gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3F1aWNrc3RhcnQtYWNjb3VudC1kZXRhaWxzJykudGV4dENvbnRlbnQgPSAnbnVsbCc7XG4gICAgICAvLyBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncXVpY2tzdGFydC1vYXV0aHRva2VuJykudGV4dENvbnRlbnQgPSAnbnVsbCc7XG4gICAgICAvLyBbRU5EX0VYQ0xVREVdXG4gICAgfVxuICAgIC8vIFtTVEFSVF9FWENMVURFXVxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdxdWlja3N0YXJ0LXNpZ24taW4nKS5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIC8vIFtFTkRfRVhDTFVERV1cbiAgfSk7XG4gIC8vIFtFTkQgYXV0aHN0YXRlbGlzdGVuZXJdXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdxdWlja3N0YXJ0LXNpZ24taW4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZVNpZ25JbiwgZmFsc2UpO1xufVxud2luZG93Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICBpbml0QXBwKCk7XG59O1xuIl19
