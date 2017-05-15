import React, { Component } from 'react';
import Menu from './Menu';
import { database, auth, } from './firebase.config';

import './css/style.css';

class App extends Component {
  constructor(props) {
    super(props);

    // this.app = firebase.initializeApp(FirebaseConfig);
    // this.fb = this.app.database();

    this.state = {
      auth: false,
      email: '',
      password: '',
      uid: '',
      userImage: '',
      gameId: null,
      showMenu: true
    };

    this.gameRef = null;
    this.openMenu = this.openMenu.bind(this);
    this.closeMenu = this.closeMenu.bind(this);
  }

  getUrlVars() {
    var vars = {};
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
      vars[key] = value;
    });

    return vars;
  };

  componentWillMount() {
    this.setState({
      gameId: this.getUrlVars()['id']
    }, () => {
      console.log('gameId', this.state.gameId);
    });
  }

  componentDidMount() {
    const _this = this;

    // check for exising game ID
    if (!this.state.gameId) {
      // display menu
      this.setState({
        showMenu: true
      });
    } else {
      const _this = this;
      // game has been started
      console.log('a game has been started');
      this.setState({
        showMenu: false
      });

      this.gameRef = database.ref().child(this.state.gameId);
    }

    auth.onAuthStateChanged(function(user) {
      if (user) {

        console.log('user is signed in', user);

        _this.setState({
          auth: true,
          displayName: user.displayName,
          email: user.email,
          emailVerified: user.emailVerified,
          photoURL: user.photoURL,
          isAnonymous: user.isAnonymous,
          uid: user.uid,
          providerData: user.providerData,
          userImage: user.photoURL
        })

        if (_this.state.gameId) {
          // which player is which
          let player1 = _this.gameRef.child('player1');
          player1.on('value', function(data) {
            _this.setState({
              player1: data.val()
            });
          });

          let myRole = _this.gameRef.child(user.uid);
          myRole.once('value').then(function(data) {
            const role = data.val();
            if (!role) {
              _this.gameRef.update({
                [user.uid]: (_this.state.player1 * -1)
              });
            } else {
              _this.setState({
                me: role
              });
            }
            console.log('myrole', role === 1 ? 'draw' : 'guess');
          });
        }
      } else {
        console.log('user not logged in');
        this.setState({
          showMenu: true
        });
      }
    });
  }

  login() {
    return (
      <div className="menu-bg" id="menu">
        <div className="menu">
          <h1><span>Flip</span>Draw</h1>
          <h2 className="menu__title">Start a new game.</h2>
          <div className="menu__userImage"></div>
          <a href="index.html" id="drawBtn" className="menu__btn">Draw</a>
          <a href="index.html" id="guessBtn" className="menu__btn">Guess</a>
          <button disabled className="menu__btn" id="quickstart-sign-in">Sign in with Google</button>
        </div>
      </div>
      );
  }

  openMenu() {
    this.setState({
      showMenu: true
    });
  }

  closeMenu() {
    this.setState({
      showMenu: false
    });
  }

  render() {
    return (
      <div className="App">
        <div className="wrapper">
          { this.state.showMenu && <Menu auth={ this.state.auth } uid={ this.state.uid } closeMenu={ this.closeMenu } gameId={ this.state.gameId } userImage={ this.state.userImage } /> }
          <header className="statusBar">
            <div className="gameTitle" onClick={ this.openMenu }>FlipDraw</div>
            <div className="userStatus" id="userStatus">
              <div className="userImage">
                { this.state.userImage && <img src={ this.state.userImage } alt="user avatar" /> }
              </div>
            </div>
          </header>
          <h1 id="drawingTitle"></h1>
          <canvas id="canvas"></canvas>
          <div className="action-bar">
            <div id="letter-pool" className="letter-pool"></div>
            <div id="word" className="word"></div>
          </div>
        </div>
      </div>
      );
  }
}

export default App;











// // game setup variables
// var FIREBASE_BASE = firebase;
// var this.gameRef;
// var firebasePath;
// var path;
// var pathReference;
// var firebasePathsRef;



// var player;
// if (Cookies.get('player')) {
//   player = Cookies.get('player');
//   Cookies.set('player', '');
// } else {
//   player = getUrlVars()['player'];
// }

// document.querySelector('.wrapper').style.maxWidth = window.innerHeight / 1.7 + 'px';

// // word tile variables
// var wordlist = [
//   "cat",
//   "dog",
//   "bird",
//   "fish",
//   "snake",
//   "turtle",
//   "snail",
// ];

// var title = document.getElementById('drawingTitle');
// var letterPool = document.getElementById('letter-pool');
// var word = document.getElementById('word');
// var currentPosition;
// var currentLetter;
// var jumble;
// var solution;
// var checkPosition;
// var selection;

// // setup paper.js
// paper.install(window);
// window.canvas = document.getElementById('canvas');
// // canvas.width = window.innerWidth;
// // canvas.height = window.innerHeight;
// paper.setup(canvas);

// // jQuery ready
// $(function() {



//   // setup firebase response to path data
//   pathReference = {};
//   firebasePathsRef = this.gameRef.child('paths');

//   firebasePathsRef.on('child_changed', function(snapshot) {
//     var firebaseData = snapshot.val();
//     //console.log(firebaseData.path);
//     pathReference[snapshot.key].pathData = firebaseData.path;
//     view.update();
//   });

//   firebasePathsRef.on('child_added', function(snapshot) {
//     var firebaseData = snapshot.val();
//     pathReference[snapshot.key] = new Path();
//     pathReference[snapshot.key].pathData = firebaseData.path;
//     pathReference[snapshot.key].strokeColor = '#3b6cb7';
//     pathReference[snapshot.key].strokeWidth = 3;
//     view.update();
//   });

//   // select player draw
//   $('#drawBtn').click(function() {
//     var path = $(this).attr('href');
//     path += '&player=guess';
//     $(this).attr('href', path);
//     Cookies.set('player', 'draw');

//     // choose a word at random anyway
//     selection = wordlist[Math.floor(Math.random() * wordlist.length)];

//     // set up canvas
//     const drawHeight = window.canvas.offsetHeight;
//     const drawWidth = window.canvas.offsetWidth;

//     // send data to firebase
//     this.gameRef.set({
//       word: selection,
//       completed: false,
//       drawHeight: drawHeight,
//       drawWidth: drawWidth
//     }, function() {
//       window.location = path;
//     });

//     return false;
//   });

//   // select player guess
//   $('#guessBtn').click(function() {
//     var path = $(this).attr('href');
//     path += '&player=draw';
//     $(this).attr('href', path);
//     Cookies.set('player', 'guess');

//     // choose a word at random
//     selection = wordlist[Math.floor(Math.random() * wordlist.length)];
//     this.gameRef.set({
//       word: selection,
//       completed: false
//     }, function() {
//       window.location = path;
//     });

//     return false;
//   });

//   this.gameRef.child('completed').on('value', function(snapshot) {
//     if (snapshot.val() === true) {
//       $('#gameOver').show();
//       paper.project.activeLayer.children = [];
//       view.update();
//       $('#word').empty();
//       $('#letter-pool').empty();
//       jumble = [];
//       if (player === 'draw') {
//         //Cookies.set('player', 'guess');
//         player = 'guess';
//       } else if (player === 'guess') {
//         //Cookies.set('player', 'draw');
//         player = 'draw';
//       }
//     } else {
//       $('#gameOver').hide();
//     }
//   });

//   $('#gameOver').click(function() {
//     // choose a word at random
//     selection = wordlist[Math.floor(Math.random() * wordlist.length)];

//     // selection = selection.split('');
//     this.gameRef.set({
//       word: selection,
//       completed: false
//     });
//   });

//   // get current word from firebase
//   this.gameRef.child('word').on('value', function(snapshot) {
//     selection = snapshot.val();
//     console.log(selection);
//     jumble = new Array();
//     solution = new Array();
//     $('#word').empty();
//     $('#letter-pool').empty();


//     // *****
//     // check for player type
//     // setup paperjs for draw player
//     // *****
//     if (player === 'draw') {
//       $('#drawingTitle').html(selection);
//       $('#drawingTitle').show();
//       $('#letter-pool').hide();
//       $('#word').hide();

//       var tool = new Tool();

//       tool.onMouseDown = function(event) {
//         if (player == 'draw') {
//           // If we produced a path before, deselect it:
//           if (path) {
//             path.selected = false;
//           }

//           // Create a new path and set its stroke color to black:
//           path = new Path({
//             segments: [event.point],
//             strokeColor: 'black',
//             // Select the path, so we can see its segment points:
//             fullySelected: true
//           });

//           firebasePath = firebasePathsRef.push();
//           pathReference[firebasePath.key] = new Path();
//         }
//       }

//       // While the user drags the mouse, points are added to the path
//       // at the position of the mouse:
//       tool.onMouseDrag = function(event) {
//         if (player == 'draw') {
//           path.add(event.point);
//           firebasePath.set({
//             path: path.pathData
//           });
//         }
//       };

//       // When the mouse is released, we simplify the path:
//       tool.onMouseUp = function(event) {
//         if (player == 'draw') {
//           //path.simplify(10);
//           path.fullySelected = false;
//           path.remove();
//         }
//       }




//     // *****
//     // setup tiles for guess player
//     // *****
//     } else if (player === 'guess') {
//       // split the characters into an array
//       selection = selection.split('');

//       $('#drawingTitle').hide();
//       $('#letter-pool').show();
//       $('#word').show();

//       let getWidth = this.gameRef.child('drawWidth').once('value').then(function(data) {
//         return data.val();
//       });
//       let getHeight = this.gameRef.child('drawHeight').once('value').then(function(data) {
//         return data.val();
//       });

//       Promise.all([getHeight, getWidth]).then(values => {
//         let drawWidth = values[1];
//         let drawHeight = values[0];
//         const aspectRatio = drawWidth / drawHeight;

//         console.log('values', values);
//         console.log('drawWidth', values[0]);
//         console.log('drawHeight', values[1]);

//         // scale canvas if necessary
//         if (drawHeight > window.canvas.offsetHeight) {
//           const imageDiff = window.canvas.offsetHeight / drawHeight;
//           paper.view._matrix.scale(imageDiff);
//           paper.view.update();
//         }
//       });




//       // loop over the array and print out drop containers
//       // push each character to a new array that we can shuffle
//       selection.forEach(function(index) {
//         var tile = document.createElement('div');
//         tile.classList.add('position');
//         tile.setAttribute('droppable', true);
//         tile.setAttribute('data-letter', index);
//         word.appendChild(tile);
//         jumble.push(index);
//       });

//       // shuffle the characters in the new word array
//       jumble.sort(function() {
//         return 0.5 - Math.random();
//       });

//       // print out characters on screen;
//       jumble.forEach(function(index) {
//         var tile = document.createElement('div');
//         var text = document.createTextNode(index);
//         tile.classList.add('letter');
//         tile.appendChild(text);
//         letterPool.appendChild(tile);
//       });

//       // check if the letter tile is put in the right place
//       checkPosition = function(position, letter) {
//         //console.log(position, letter);
//         if (position == letter) {
//           return true;
//         } else {
//           return false;
//         }
//       }

//       // add jquery ui drop function
//       $('.position').droppable({
//         tolerance: "pointer",
//         over: function() {
//           $(this).addClass('position--hover');
//         },
//         out: function() {
//           $(this).removeClass('position--hover');
//         },
//         drop: function(event, ui) {
//           //console.log(event);

//           currentPosition = event.target;
//           currentPosition.classList.remove('position--hover');

//           if (checkPosition(currentPosition.getAttribute('data-letter'), ui.draggable.html())) {
//             currentPosition.classList.add('position--correct');

//             ui.draggable.css('position', 'absolute');
//             ui.draggable.css('left', '-1px');
//             ui.draggable.css('top', '-1px');
//             $(currentPosition).append(ui.draggable);

//             solution.push(ui.draggable.html());
//             if (solution.join() === selection.join()) {
//               //word.classList.add('word--correct');
//               this.gameRef.child('completed').set(true);
//               this.gameRef.child('paths').set([]);
//             }
//           } else {
//             currentPosition.classList.add('position--incorrect');
//             ui.draggable.animate({
//               left: 0,
//               top: 0
//             }, 150, function() {
//               currentPosition.classList.remove('position--incorrect');
//             });
//           }
//         }
//       });

//       // add jquery ui drag function
//       $('.letter').draggable({
//         stop: function(event, ui) {
//           //console.log(event);
//           if (!ui.helper.parent().hasClass('position')) {
//             ui.helper.animate({
//               left: 0,
//               top: 0
//             }, 150);
//           }
//         }
//       });
//     }
//   });

// }); // jQuery ready







// /**
//  * Function called when clicking the Login/Logout button.
//  */
// // [START buttoncallback]
// function toggleSignIn() {
//   if (!firebase.auth().currentUser) {
//     // [START createprovider]
//     var provider = new firebase.auth.GoogleAuthProvider();
//     // [END createprovider]
//     // [START addscopes]
//     provider.addScope('https://www.googleapis.com/auth/plus.login');
//     // [END addscopes]
//     // [START signin]
//     firebase.auth().signInWithPopup(provider).then(function(result) {
//       // This gives you a Google Access Token. You can use it to access the Google API.
//       var token = result.credential.accessToken;
//       // The signed-in user info.
//       var user = result.user;
//       // [START_EXCLUDE]
//       document.getElementById('quickstart-oauthtoken').textContent = token;
//     // [END_EXCLUDE]
//     }).catch(function(error) {
//       // Handle Errors here.
//       var errorCode = error.code;
//       var errorMessage = error.message;
//       // The email of the user's account used.
//       var email = error.email;
//       // The firebase.auth.AuthCredential type that was used.
//       var credential = error.credential;
//       // [START_EXCLUDE]
//       if (errorCode === 'auth/account-exists-with-different-credential') {
//         alert('You have already signed up with a different auth provider for that email.');
//       // If you are using multiple auth providers on your app you should handle linking
//       // the user's accounts here.
//       } else {
//         console.error(error);
//       }
//     // [END_EXCLUDE]
//     });
//   // [END signin]
//   } else {
//     // [START signout]
//     firebase.auth().signOut();
//   // [END signout]
//   }
//   // [START_EXCLUDE]
//   document.getElementById('quickstart-sign-in').disabled = true;
// // [END_EXCLUDE]
// }
// // [END buttoncallback]


/**
 * initApp handles setting up UI event listeners and registering Firebase auth listeners:
 *  - firebase.auth().onAuthStateChanged: This listener is called when the user is signed in or
 *    out, and that is where we update the UI.
 */
// function initApp() {
// Listening for auth state changes.
// [START authstatelistener]
//   firebase.auth().onAuthStateChanged(function(user) {
//     if (user) {

//       console.log('user is signed in');


//       // User is signed in.
//       var displayName = user.displayName;
//       var email = user.email;
//       var emailVerified = user.emailVerified;
//       var photoURL = user.photoURL;
//       var isAnonymous = user.isAnonymous;
//       var uid = user.uid;
//       var providerData = user.providerData;
//       // [START_EXCLUDE]
//       // document.getElementById('quickstart-sign-in-status').textContent = 'Signed in';
//       document.getElementById('quickstart-sign-in').textContent = 'Sign out';
//       // document.getElementById('quickstart-account-details').textContent = JSON.stringify(user, null, '  ');
//       // console.log('auth data', user.photoURL);
//       var userImage = `<img src="${user.photoURL}" />`;
//       document.querySelector('.userImage').innerHTML = userImage;
//       document.querySelector('.menu__userImage').innerHTML = userImage;
//     // [END_EXCLUDE]
//     } else {
//       // User is signed out.
//       // [START_EXCLUDE]
//       // document.getElementById('quickstart-sign-in-status').textContent = 'Signed out';
//       document.getElementById('quickstart-sign-in').textContent = 'Sign in with Google';
//     // document.getElementById('quickstart-account-details').textContent = 'null';
//     // document.getElementById('quickstart-oauthtoken').textContent = 'null';
//     // [END_EXCLUDE]
//     }
//     // [START_EXCLUDE]
//     document.getElementById('quickstart-sign-in').disabled = false;
//   // [END_EXCLUDE]
//   });
//   // [END authstatelistener]
//   document.getElementById('quickstart-sign-in').addEventListener('click', toggleSignIn, false);
// }
// window.onload = function() {
//   initApp();
// }