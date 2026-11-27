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
      displayName: '',
      gameId: this.getUrlVars()['id'] || null,
      showMenu: true,
      completed: false,
      me: null,
      player1: null,
      currentAnimal: '',
      letters: ''
    };

    this.firebasePathsRef = null;
    this.firebasePath = null;
    this.path = null;
    this.pathReference = null;
    this.drawToolReady = false;
    this._rematching = false;

    // Firebase unsubscribe callbacks, invoked on unmount.
    this._unsubs = [];
    this._gameUnsubs = [];
    this._roleUnsubs = [];

    this.gameRef = null;
    this.openMenu = this.openMenu.bind(this);
    this.closeMenu = this.closeMenu.bind(this);
    this.resetGame = this.resetGame.bind(this);
    this.submitGuess = this.submitGuess.bind(this);
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


    this._unsubs.push(onAuthStateChanged(auth, function(user) {
      if (user) {

        console.log('user is signed in', user);

        _this.setState({
          auth: true,
          displayName: user.displayName,
          uid: user.uid,
          userImage: user.photoURL,
          // Signing in on an invite URL should reveal the game, not the menu.
          showMenu: !_this.state.gameId
        })

        if (_this.state.gameId) {
          _this.watchGame(user);
          _this.setupGameFromFirebase(user);
        }
      } else {
        console.log('user not logged in');
        // Drop the previous session's listeners so they cannot linger.
        _this._detachGameListeners();
        _this._detachRoleListeners();
        _this.setState({
          showMenu: true,
          me: null
        });
      }
    }));


  } // component did mount

  componentWillUnmount() {
    // Detach every Firebase listener so remounts / HMR don't stack handlers.
    this._unsubs.forEach(function(unsubscribe) { unsubscribe(); });
    this._unsubs = [];
    this._detachGameListeners();
    this._detachRoleListeners();
  }

  // All game listeners are registered here — i.e. only once we have an
  // authenticated user. Registering them earlier (before sign-in) would be
  // denied by the rules and the listener would die.
  watchGame(user) {
    const _this = this;
    const gameId = this.state.gameId;
    this._detachGameListeners();

    // Stroke relay. Malformed payloads are ignored rather than handed to Paper.
    _this._gameUnsubs.push(onChildChanged(ref(database, `${gameId}/paths`), function(snapshot) {
      const data = snapshot.val();
      if (!data || typeof data.path !== 'string' || !_this.pathReference[snapshot.key]) {
        return;
      }
      _this.pathReference[snapshot.key].pathData = data.path;
      Paper.view.update();
    }));

    _this._gameUnsubs.push(onChildAdded(ref(database, `${gameId}/paths`), function(snapshot) {
      const data = snapshot.val();
      if (!data || typeof data.path !== 'string') {
        return;
      }
      _this.pathReference[snapshot.key] = new Paper.Path();
      _this.pathReference[snapshot.key].pathData = data.path;
      _this.pathReference[snapshot.key].strokeColor = '#3b6cb7';
      _this.pathReference[snapshot.key].strokeWidth = 3;
      Paper.view.update();
    }));

    // Round over flag.
    _this._gameUnsubs.push(onValue(ref(database, `${gameId}/completed`), function(snapshot) {
      _this.setState({ completed: !!snapshot.val() });
      if (snapshot.val() === true) {
        // Round over: clear the local canvas. The next round starts blank.
        Paper.project.activeLayer.children = [];
        Paper.view.update();
      }
    }));

    // My own role — it decides what else I may read (word vs letters).
    _this._gameUnsubs.push(onValue(ref(database, `${gameId}/${user.uid}`), function(snapshot) {
      const role = snapshot.val();
      if (role !== 1 && role !== -1) {
        return;
      }
      _this.setState({ me: role });
      _this.watchRole(role);
    }));
  }

  // The drawer may read the secret word; the guesser only gets the letters.
  watchRole(role) {
    const _this = this;
    this._detachRoleListeners();

    if (role === 1) {
      _this._roleUnsubs.push(onValue(ref(database, `${this.state.gameId}/currentAnimal`), function(snapshot) {
        _this.setState({ currentAnimal: snapshot.val() || '' });
      }));
      if (!_this.drawToolReady) {
        _this.setupDrawPlayer();
      }
    } else if (role === -1) {
      _this.drawToolReady = false;
      _this._roleUnsubs.push(onValue(ref(database, `${this.state.gameId}/letters`), function(snapshot) {
        _this.setState({ letters: snapshot.val() || '' });
      }));
    }
  }

  _detachGameListeners() {
    this._gameUnsubs.forEach(function(unsubscribe) { unsubscribe(); });
    this._gameUnsubs = [];
  }

  _detachRoleListeners() {
    this._roleUnsubs.forEach(function(unsubscribe) { unsubscribe(); });
    this._roleUnsubs = [];
  }

  // Join the game if I have no role yet. Reads only my own slot and player1 —
  // the whole game node is no longer readable, so the word stays secret.
  setupGameFromFirebase(user) {
    const _this = this;
    const roleRef = ref(database, `${this.state.gameId}/${user.uid}`);

    get(roleRef).then(function(snapshot) {
      const myRole = snapshot.val();
      if (myRole === 1 || myRole === -1) {
        console.log('my role', myRole === 1 ? 'draw' : 'guess');
        return;
      }
      // No role yet: take the side opposite the creator.
      return get(ref(database, `${_this.state.gameId}/player1`)).then(function(player1Snap) {
        const newRole = (player1Snap.val() || 1) * -1;
        console.log('my role', newRole === 1 ? 'draw' : 'guess');
        return set(roleRef, newRole);
      });
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
        _this.lastPathWrite = 0;
      }
    }

    // While the user drags the mouse, points are added to the path
    // at the position of the mouse:
    tool.onMouseDrag = function(event) {
      if (_this.state.me === 1) {
        _this.path.add(event.point);
        // Coalesce: writing on every mousemove re-uploads the whole growing
        // path and broadcasts it, which is a large, trivially scriptable cost.
        const now = Date.now();
        if (now - _this.lastPathWrite < 100) {
          return;
        }
        _this.lastPathWrite = now;
        set(_this.firebasePath, {
          path: _this.path.pathData
        });
      }
    };

    // When the mouse is released, persist the finished stroke — the last
    // coalesced write may predate the final points.
    tool.onMouseUp = function(event) {
      if (_this.state.me === 1 && _this.path && _this.firebasePath) {
        _this.path.fullySelected = false;
        set(_this.firebasePath, {
          path: _this.path.pathData
        });
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

  // Propose a guess to the server; functions/checkGuess decides whether it wins.
  submitGuess(word) {
    if (!this.state.gameId || !this.state.uid) {
      return;
    }
    set(ref(database, `${this.state.gameId}/guesses/${this.state.uid}`), word);
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

  // Ask the server to start a new round; functions/startRematch swaps the roles
  // and picks a new word (the client is not allowed to write those fields).
  playAgain() {
    if (!this.state.gameId) {
      return;
    }
    set(ref(database, `${this.state.gameId}/rematch`), true);
  }

  signOut() {
    // clear auth data in state
    this.setState({
      auth: false,
      uid: null,
      userImage: null,
      displayName: null,
      me: null
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
          { this.state.me === -1 && <Letters submitGuess={this.submitGuess} letters={this.state.letters} /> }
        </div>
      </div>
      );
  }
}

export default App;
