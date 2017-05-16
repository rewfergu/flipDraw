import React, { Component } from 'react';
import Menu from './Menu';
import { database, auth, } from './firebase.config';
import paper from 'paper';

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

    this.firebasePathsRef = null;
    this.gameRef = null;
    this.jumble = [];
    this.solution = [];
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
    // setup paper.js
    paper.install(window);
    const canvas = document.getElementById('canvas');
    // canvas.width = window.innerWidth;
    // canvas.height = window.innerHeight;
    paper.setup(canvas);

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
          uid: user.uid,
          userImage: user.photoURL
        })

        if (_this.state.gameId) {
          _this.setupGameFromFirebase(user);
        }
      } else {
        console.log('user not logged in');
        this.setState({
          showMenu: true
        });
      }
    });

    // setup firebase response to path data
    let pathReference = {};
    this.firebasePathsRef = this.gameRef.child('paths');

    this.firebasePathsRef.on('child_changed', function(snapshot) {
      var firebaseData = snapshot.val();
      //console.log(firebaseData.path);
      pathReference[snapshot.key].pathData = firebaseData.path;
      paper.view.update();
    });

    this.firebasePathsRef.on('child_added', function(snapshot) {
      var firebaseData = snapshot.val();
      pathReference[snapshot.key] = new paper.Path();
      pathReference[snapshot.key].pathData = firebaseData.path;
      pathReference[snapshot.key].strokeColor = '#3b6cb7';
      pathReference[snapshot.key].strokeWidth = 3;
      paper.view.update();
    });

    this.gameRef.child('completed').on('value', function(snapshot) {
      if (snapshot.val() === true) {
        // $('#gameOver').show();
        paper.project.activeLayer.children = [];
        paper.view.update();
        // $('#word').empty();
        // $('#letter-pool').empty();
        this.jumble = [];
        if (this.state.me === 1) {
          //Cookies.set('player', 'guess');
          // player = 'guess';
        } else if (this.state.me === -1) {
          //Cookies.set('player', 'draw');
          // player = 'draw';
        }
      } else {
        // $('#gameOver').hide();
      }
    });

    // get current word from firebase
    this.gameRef.child('word').on('value', function(snapshot) {
      const selection = snapshot.val();
      console.log(selection);
      _this.jumble = [];
      _this.solution = [];
    // $('#word').empty();
    // $('#letter-pool').empty();
    });
  } // component did mount

  setupGameFromFirebase(user) {
    const _this = this;

    this.gameRef.once('value').then(function(snapshot) {
      const gameData = snapshot.val();

      // who am I?
      let myRole = gameData[user.uid];

      if (myRole === 1) {
        // I'm the draw player
      } else if (myRole === -1) {
        // I'm the guess player
      } else {
        // unknown
        // I'm the opposite of player1
        myRole = gameData.player1 * -1;
        _this.gameRef.update({
          [user.uid]: myRole
        });
      }

      _this.setState({
        player1: gameData.player1,
        me: myRole,
        currentAnimal: gameData.currentAnimal
      });

      console.log('my role', myRole === 1 ? 'draw' : 'guess');
    });
  }



  resetAnimal() {}

  setupDrawPlayer() {
    // var path = $(this).attr('href');
    // path += '&player=guess';
    // $(this).attr('href', path);
    // Cookies.set('player', 'draw');

    // choose a word at random anyway


    // set up canvas
    const drawHeight = window.canvas.offsetHeight;
    const drawWidth = window.canvas.offsetWidth;

    // send data to firebase
    this.gameRef.set({
      word: this.selection,
      completed: false,
      drawHeight: drawHeight,
      drawWidth: drawWidth
    }, function() {
      //window.location = path;
    });





    // $('#drawingTitle').html(selection);
    //   $('#drawingTitle').show();
    //   $('#letter-pool').hide();
    //   $('#word').hide();

    //   var tool = new Tool();

    //   tool.onMouseDown = function(event) {
    //     if (player == 'draw') {
    //       // If we produced a path before, deselect it:
    //       if (path) {
    //         path.selected = false;
    //       }

    //       // Create a new path and set its stroke color to black:
    //       path = new Path({
    //         segments: [event.point],
    //         strokeColor: 'black',
    //         // Select the path, so we can see its segment points:
    //         fullySelected: true
    //       });

    //       firebasePath = firebasePathsRef.push();
    //       pathReference[firebasePath.key] = new Path();
    //     }
    //   }

    //   // While the user drags the mouse, points are added to the path
    //   // at the position of the mouse:
    //   tool.onMouseDrag = function(event) {
    //     if (player == 'draw') {
    //       path.add(event.point);
    //       firebasePath.set({
    //         path: path.pathData
    //       });
    //     }
    //   };

  //   // When the mouse is released, we simplify the path:
  //   tool.onMouseUp = function(event) {
  //     if (player == 'draw') {
  //       //path.simplify(10);
  //       path.fullySelected = false;
  //       path.remove();
  //     }
  //   }
  }

  setupGuessPlayer() {
    // var path = $(this).attr('href');
    // path += '&player=draw';
    // $(this).attr('href', path);
    // Cookies.set('player', 'guess');

    // choose a word at random
    this.selection = this.wordlist[Math.floor(Math.random() * this.wordlist.length)];
    this.gameRef.set({
      word: this.selection,
      completed: false
    }, function() {
      //window.location = path;
    });





    // // split the characters into an array
    //   selection = selection.split('');

    //   $('#drawingTitle').hide();
    //   $('#letter-pool').show();
    //   $('#word').show();

    //   let getWidth = this.gameRef.child('drawWidth').once('value').then(function(data) {
    //     return data.val();
    //   });
    //   let getHeight = this.gameRef.child('drawHeight').once('value').then(function(data) {
    //     return data.val();
    //   });

    //   Promise.all([getHeight, getWidth]).then(values => {
    //     let drawWidth = values[1];
    //     let drawHeight = values[0];
    //     const aspectRatio = drawWidth / drawHeight;

    //     console.log('values', values);
    //     console.log('drawWidth', values[0]);
    //     console.log('drawHeight', values[1]);

    //     // scale canvas if necessary
    //     if (drawHeight > window.canvas.offsetHeight) {
    //       const imageDiff = window.canvas.offsetHeight / drawHeight;
    //       paper.view._matrix.scale(imageDiff);
    //       paper.view.update();
    //     }
    //   });




    //   // loop over the array and print out drop containers
    //   // push each character to a new array that we can shuffle
    //   selection.forEach(function(index) {
    //     var tile = document.createElement('div');
    //     tile.classList.add('position');
    //     tile.setAttribute('droppable', true);
    //     tile.setAttribute('data-letter', index);
    //     word.appendChild(tile);
    //     jumble.push(index);
    //   });

    //   // shuffle the characters in the new word array
    //   jumble.sort(function() {
    //     return 0.5 - Math.random();
    //   });

    //   // print out characters on screen;
    //   jumble.forEach(function(index) {
    //     var tile = document.createElement('div');
    //     var text = document.createTextNode(index);
    //     tile.classList.add('letter');
    //     tile.appendChild(text);
    //     letterPool.appendChild(tile);
    //   });

    //   // check if the letter tile is put in the right place
    //   checkPosition = function(position, letter) {
    //     //console.log(position, letter);
    //     if (position == letter) {
    //       return true;
    //     } else {
    //       return false;
    //     }
    //   }

    //   // add jquery ui drop function
    //   $('.position').droppable({
    //     tolerance: "pointer",
    //     over: function() {
    //       $(this).addClass('position--hover');
    //     },
    //     out: function() {
    //       $(this).removeClass('position--hover');
    //     },
    //     drop: function(event, ui) {
    //       //console.log(event);

    //       currentPosition = event.target;
    //       currentPosition.classList.remove('position--hover');

    //       if (checkPosition(currentPosition.getAttribute('data-letter'), ui.draggable.html())) {
    //         currentPosition.classList.add('position--correct');

    //         ui.draggable.css('position', 'absolute');
    //         ui.draggable.css('left', '-1px');
    //         ui.draggable.css('top', '-1px');
    //         $(currentPosition).append(ui.draggable);

    //         solution.push(ui.draggable.html());
    //         if (solution.join() === selection.join()) {
    //           //word.classList.add('word--correct');
    //           this.gameRef.child('completed').set(true);
    //           this.gameRef.child('paths').set([]);
    //         }
    //       } else {
    //         currentPosition.classList.add('position--incorrect');
    //         ui.draggable.animate({
    //           left: 0,
    //           top: 0
    //         }, 150, function() {
    //           currentPosition.classList.remove('position--incorrect');
    //         });
    //       }
    //     }
    //   });

  //   // add jquery ui drag function
  //   $('.letter').draggable({
  //     stop: function(event, ui) {
  //       //console.log(event);
  //       if (!ui.helper.parent().hasClass('position')) {
  //         ui.helper.animate({
  //           left: 0,
  //           top: 0
  //         }, 150);
  //       }
  //     }
  //   });
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

  gameOver() {
    // choose a word at random
    this.selection = this.wordlist[Math.floor(Math.random() * this.wordlist.length)];

    // selection = selection.split('');
    this.gameRef.set({
      word: this.selection,
      completed: false
    });
  }

  render() {
    return (
      <div className="App">
        <div className="wrapper">
          { this.state.showMenu && <Menu auth={ this.state.auth } uid={ this.state.uid } closeMenu={ this.closeMenu } gameId={ this.state.gameId } setupDrawPlayer={ this.setupDrawPlayer } setupGuessPlayer={ this.setupGuessPlayer }
                                     userImage={ this.state.userImage } /> }
          <header className="statusBar">
            <div className="gameTitle" onClick={ this.openMenu }>FlipDraw</div>
            <div className="userStatus" id="userStatus">
              <div className="userImage">
                { this.state.userImage && <img src={ this.state.userImage } alt="user avatar" /> }
              </div>
            </div>
          </header>
          <h1 id="drawingTitle">{ this.state.currentAnimal }</h1>
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




// var title = document.getElementById('drawingTitle');
// var letterPool = document.getElementById('letter-pool');
// var word = document.getElementById('word');
// var currentPosition;
// var currentLetter;
// var jumble;
// var solution;
// var checkPosition;
// var selection;
