import React, { Component } from 'react';
import Menu from './Menu';
import Letters from './Letters';
import {
  ref,
  get,
  onChildAdded,
  onChildChanged,
  onValue,
  push,
  set,
  update,
} from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { database, auth } from './firebase.config';
import Paper from 'paper';
import randomAnimal from './Animals';

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
      gameId: this.getUrlVars()['id'] || null,
      showMenu: true,
      completed: false
    };

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
      this.gameRef = ref(database, this.state.gameId);

      // setup firebase response to path data
      this.pathReference = {};
      this.firebasePathsRef = ref(database, `${this.state.gameId}/paths`);
    }


    onAuthStateChanged(auth, function(user) {
      if (user) {

        console.log('user is signed in', user);

        _this.setState({
          auth: true,
          displayName: user.displayName,
          uid: user.uid,
          userImage: user.photoURL
        })

        if (_this.state.gameId) {
          _this.watchGame(user);
          _this.setupGameFromFirebase(user);
        }
      } else {
        console.log('user not logged in');
        _this.setState({
          showMenu: true
        });
      }
    });


    // Only watch game data once a game reference exists; the landing page
    // (no `?id=` in the URL) has none.
    if (this.gameRef) {
    onChildChanged(this.firebasePathsRef, function(snapshot) {
      var firebaseData = snapshot.val();
      //console.log(firebaseData.path);
      _this.pathReference[snapshot.key].pathData = firebaseData.path;
      Paper.view.update();
    });


    onChildAdded(this.firebasePathsRef, function(snapshot) {
      var firebaseData = snapshot.val();
      _this.pathReference[snapshot.key] = new Paper.Path();
      _this.pathReference[snapshot.key].pathData = firebaseData.path;
      _this.pathReference[snapshot.key].strokeColor = '#3b6cb7';
      _this.pathReference[snapshot.key].strokeWidth = 3;
      Paper.view.update();
    });


    // Round over flag. Roles and the word are watched separately in
    // watchGame(); a rematch is applied by whoever clicks "Play Again".
    onValue(ref(database, `${this.state.gameId}/completed`), function(snapshot) {
      _this.setState({ completed: !!snapshot.val() });

      if (snapshot.val() === true) {
        // Round over: clear the local canvas. The next round starts blank.
        Paper.project.activeLayer.children = [];
        Paper.view.update();
      }
    });

    // Current word (changes at the start of every round).
    onValue(ref(database, `${this.state.gameId}/currentAnimal`), function(snapshot) {
      _this.setState({ currentAnimal: snapshot.val() });
    });
    }

  } // component did mount

  // Watch the live game state so a rematch (which swaps roles) is reflected
  // for both players.
  watchGame(user) {
    const _this = this;

    onValue(ref(database, `${this.state.gameId}/player1`), function(snapshot) {
      if (snapshot.val() != null) {
        _this.setState({ player1: snapshot.val() });
      }
    });

    onValue(ref(database, `${this.state.gameId}/${user.uid}`), function(snapshot) {
      const role = snapshot.val();
      if (role !== 1 && role !== -1) {
        return;
      }
      _this.setState({ me: role });
      if (role === 1) {
        // I'm the draw player for this round.
        if (!_this.drawToolReady) {
          _this.setupDrawPlayer();
        }
      } else {
        _this.drawToolReady = false;
      }
    });
  }

  setupGameFromFirebase(user) {
    const _this = this;

    get(this.gameRef).then(function(snapshot) {
      const gameData = snapshot.val();

      // who am I?
      let myRole = gameData[user.uid];

      if (myRole === 1) {
        // I'm the draw player — watchGame() sets up the tool for role 1.
      } else if (myRole === -1) {
        // I'm the guess player
      } else {
        // unknown
        // I'm the opposite of player1
        myRole = gameData.player1 * -1;
        update(_this.gameRef, {
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
    _this.drawToolReady = true;
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
    update(this.gameRef, {
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

        _this.firebasePath = push(_this.firebasePathsRef);
        _this.pathReference[_this.firebasePath.key] = new Paper.Path();
      }
    }

    // While the user drags the mouse, points are added to the path
    // at the position of the mouse:
    tool.onMouseDrag = function(event) {
      if (_this.state.me === 1) {
        _this.path.add(event.point);
        set(_this.firebasePath, {
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
    update(this.gameRef, {
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

  // Start a new round: swap the roles, choose a new word and clear the board.
  // Runs once, driven by whoever clicks "Play Again".
  playAgain() {
    if (this._rematching) {
      return;
    }
    this._rematching = true;
    const _this = this;

    get(this.gameRef).then(function(snapshot) {
      const data = snapshot.val() || {};
      const next = {
        completed: false,
        paths: null,
        player1: (data.player1 || 1) * -1,
        currentAnimal: randomAnimal(),
      };
      // Swap every player's role (values are 1 / -1; ignore metrics).
      Object.keys(data).forEach(function(key) {
        const value = data[key];
        if (value === 1 || value === -1) {
          next[key] = value * -1;
        }
      });
      return update(_this.gameRef, next);
    }).catch(function(error) {
      console.error('Could not start a new round', error);
    }).then(function() {
      _this._rematching = false;
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
