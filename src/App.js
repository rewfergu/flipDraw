import React, { Component } from 'react';
import Menu from './Menu';
import Letters from './Letters';
import { database, auth, } from './firebase.config';
import Paper from 'paper';

import './css/style.css';

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      auth: false,
      email: '',
      password: '',
      uid: '',
      userImage: '',
      gameId: null,
      showMenu: true,
      completed: false
    };

    this.wordlist = [
      "cat",
      "dog",
      "bird",
      "fish",
      "snake",
      "turtle",
      "snail",
    ];

    this.firebasePathsRef = null;
    this.firebasePath = null;
    this.path = null;
    this.pathReference = null;

    this.gameRef = null;
    this.openMenu = this.openMenu.bind(this);
    this.closeMenu = this.closeMenu.bind(this);
    this.resetGame = this.resetGame.bind(this);
    this.gameOver = this.gameOver.bind(this);
    this.playAgain = this.playAgain.bind(this);
    this.signOut = this.signOut.bind(this);


    // this.title = document.getElementById('drawingTitle');
    this.currentPosition = null;
    this.currentLetter = null;
    this.checkPosition = null;
    this.selection = null;
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

  componentWillUpdate() {
    
  }

  componentDidMount() {
    // setup Paper.js
    //Paper.install(window);
    const canvas = document.getElementById('canvas');
    // canvas.width = window.innerWidth;
    // canvas.height = window.innerHeight;
    Paper.setup(canvas);

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

      // setup firebase reference to this game
      this.gameRef = database.ref().child(this.state.gameId);

      // setup firebase response to path data
      this.pathReference = {};
      this.firebasePathsRef = this.gameRef.child('paths');
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
        _this.setState({
          showMenu: true
        });
      }
    });


    this.firebasePathsRef.on('child_changed', function(snapshot) {
      var firebaseData = snapshot.val();
      //console.log(firebaseData.path);
      _this.pathReference[snapshot.key].pathData = firebaseData.path;
      Paper.view.update();
    });


    this.firebasePathsRef.on('child_added', function(snapshot) {
      var firebaseData = snapshot.val();
      _this.pathReference[snapshot.key] = new Paper.Path();
      _this.pathReference[snapshot.key].pathData = firebaseData.path;
      _this.pathReference[snapshot.key].strokeColor = '#3b6cb7';
      _this.pathReference[snapshot.key].strokeWidth = 3;
      Paper.view.update();
    });


    this.gameRef.child('completed').on('value', function(snapshot) {
      _this.setState({completed: snapshot.val()});
      
      if (snapshot.val() === true) {
        // game over

      const currentAnimal = _this.wordlist[Math.floor(Math.random() * _this.wordlist.length)];
      const newPlayer1 = _this.state.player1 * -1;

      _this.setState({
        me: _this.state.me * -1,
      });


      _this.gameRef.update({
        [_this.state.uid]: _this.state.me,
        player1: newPlayer1,
        currentAnimal
      });

      Paper.project.activeLayer.children = [];
      Paper.view.update();
        
      } else {
        // game not over
        _this.state.me === 1 ? _this.setupDrawPlayer() : null;
      }
    });

    // get current word from firebase
    this.gameRef.child('currentAnimal').on('value', function(snapshot) {
      _this.setState({
        currentAnimal: snapshot.val()
      }, function() {
        _this.forceUpdate();
      });
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
        _this.setupDrawPlayer();
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
    const _this = this;
    // var path = $(this).attr('href');
    // path += '&player=guess';
    // $(this).attr('href', path);
    // Cookies.set('player', 'draw');

    // choose a word at random anyway
    console.log('setting up player: draw');

    // set up canvas
    const drawHeight = window.canvas.offsetHeight;
    const drawWidth = window.canvas.offsetWidth;

    // send data to firebase
    this.gameRef.update({
      drawHeight: drawHeight,
      drawWidth: drawWidth
    });

    var tool = new Paper.Tool();

    console.log('tool', tool);

    tool.onMouseDown = function(event) {
      if (_this.state.me === 1) {
        // If we produced a path before, deselect it:
        if (_this.path) {
          _this.path.selected = false;
        }

        // Create a new path and set its stroke color to black:
        _this.path = new Paper.Path({
          segments: [event.point],
          strokeColor: 'black',
          // Select the path, so we can see its segment points:
          fullySelected: true
        });

        _this.firebasePath = _this.firebasePathsRef.push();
        _this.pathReference[_this.firebasePath.key] = new Paper.Path();
      }
    }

    // While the user drags the mouse, points are added to the path
    // at the position of the mouse:
    tool.onMouseDrag = function(event) {
      if (_this.state.me === 1) {
        _this.path.add(event.point);
        _this.firebasePath.set({
          path: _this.path.pathData
        });
      }
    };

    // When the mouse is released, we simplify the path:
    tool.onMouseUp = function(event) {
      if (_this.state.me === 1) {
        //path.simplify(10);
        _this.path.fullySelected = false;
        _this.path.remove();
      }
    }
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
    this.gameRef.update({
      completed: true,
      paths: [],
    });

  }

  resetGame() {
     return (
      <div className="menu-bg" id="gameOver">
        <div className="menu">
          <h1 className="menu__title">You Win!</h1>
          <button className="menu__btn" onClick={this.playAgain}>Play Again</button>
        </div>
      </div>
    )    
  }

  playAgain() {
    this.gameRef.update({
      completed: false,
    });
  }

  signOut() {
    // clear auth data in state
    this.setState({
      auth: false,
      uid: null,
      userImage: null,
      displayName: null
    });
  }

  render() {
    return (
      <div className="App">
        <div className="wrapper">

          { this.state.showMenu && <Menu auth={ this.state.auth } uid={ this.state.uid } closeMenu={ this.closeMenu } gameId={ this.state.gameId } setupDrawPlayer={ this.setupDrawPlayer } setupGuessPlayer={ this.setupGuessPlayer }
                                     userImage={ this.state.userImage } signOut={this.signOut} /> }

          { this.state.completed && this.resetGame() }

          <header className="statusBar">
            <div className="gameTitle" onClick={ this.openMenu }>FlipDraw</div>
            <div className="userStatus" id="userStatus">
              <div className="userImage">
                { this.state.userImage && <img src={ this.state.userImage } alt="user avatar" /> }
              </div>
            </div>
          </header>
          { this.state.me === 1 && <h1 id="drawingTitle">{ this.state.currentAnimal }</h1> }
          <canvas id="canvas"></canvas>
          { 
            // <DrawingBoard /> ↑↑↑↑↑↑↑↑
          }
          { this.state.me === -1 && <Letters gameOver={this.gameOver} currentAnimal={this.state.currentAnimal} /> }
        </div>
      </div>
      );
  }
}

export default App;
