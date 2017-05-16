import React, { Component } from 'react';
import { database, auth, authprovider } from './firebase.config';
import NewGame from './NewGame';

class Menu extends Component {
  constructor(props) {
    super(props);
    this.wordlist = [
      "cat",
      "dog",
      "bird",
      "fish",
      "snake",
      "turtle",
      "snail",
    ];

    this.selectDraw = this.selectDraw.bind(this);
    this.selectDraw = this.selectDraw.bind(this);
    this.closeMenu = this.closeMenu.bind(this);
  }

  toggleSignIn() {
    if (!auth.currentUser) {

      authprovider.addScope('https://www.googleapis.com/auth/plus.login');

      auth.signInWithPopup(authprovider).then(function(result) {
        // This gives you a Google Access Token. You can use it to access the Google API.
        // var token = result.credential.accessToken;
      }).catch(function(error) {
        var errorCode = error.code;
        if (errorCode === 'auth/account-exists-with-different-credential') {
          alert('You have already signed up with a different auth provider for that email.');
        } else {
          console.error(error);
        }
      });
    } else {
      // signout
      auth.signOut();
    }
  }

  setupGame(role) {
    // const _this = this;
    const gameRef = database.ref().push();
    const currentAnimal = this.wordlist[Math.floor(Math.random() * this.wordlist.length)];
    // gameRef.set({
    //   currentAnimal: currentAnimal,
    //   players: {
    //     player1: {
    //       id: this.props.uid,
    //       role: role
    //     }
    //   }
    // });

    gameRef.set({
      currentAnimal: currentAnimal,
      player1: role,
      [this.props.uid]: role,
    });
    var path = 'index.html?id=' + gameRef.key;
    window.location = path;
  }

  selectDraw() {
    this.setupGame(1);
  }

  selectGuess() {
    this.setupGame(-1);
  }

  closeMenu() {
    this.props.closeMenu();
  }

  render() {
    return (
      <div className="menu-bg" id="menu">
        <div className="menu">
          <h1 onClick={ this.closeMenu }><span>Flip</span>Draw</h1>
          { !this.props.gameId && <h2 className="menu__title">Start a new game.</h2> }
          <div className="menu__userImage">
            { this.props.userImage && <img src={ this.props.userImage } alt="user avatar" /> }
          </div>
          { !this.props.gameId && <NewGame selectDraw={ this.selectDraw } selectGuess={ this.selectGuess } /> }
          <button className="menu__btn" id="quickstart-sign-in" onClick={ this.toggleSignIn }>
            { !this.props.auth ? 'Sign in with Google' : 'Sign Out' }
          </button>
        </div>
      </div>
      );
  }
}

export default Menu;