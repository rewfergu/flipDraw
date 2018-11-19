import React, { Component } from 'react';
import { database, auth, authprovider } from './firebase.config';
import NewGame from './NewGame';
import randomAnimal from './Animals';

class Menu extends Component {
  constructor(props) {
    super(props);

    this.selectDraw = this.selectDraw.bind(this);
    this.selectDraw = this.selectDraw.bind(this);
    this.closeMenu = this.closeMenu.bind(this);
    this.toggleSignIn = this.toggleSignIn.bind(this);
  }

  toggleSignIn() {
    const _this = this;
    if (!auth.currentUser) {
      console.log('current auth', auth.currentUser);

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
      _this.props.signOut();
      auth.signOut();
    }
  }

  setupGame(role) {
    // const _this = this;
    const currentAnimal = randomAnimal();
    const gameRef = database.ref().push({
      currentAnimal: currentAnimal,
      completed: false,
      player1: role,
      [this.props.uid]: role,
    });

    // gameRef.set({
    //   currentAnimal: currentAnimal,
    //   completed: false,
    //   player1: role,
    //   [this.props.uid]: role,
    // });

    var path = 'index.html?id=' + gameRef.key;
    window.location = path;
  }

  selectDraw() {
    console.log('select draw');
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
            { auth.currentUser && <img src={ this.props.userImage } alt="user avatar" /> }
          </div>
          { !this.props.gameId && <NewGame selectDraw={ this.selectDraw } selectGuess={ this.selectGuess } /> }
          <button className="menu__btn" id="quickstart-sign-in" onClick={ this.toggleSignIn }>
            { !auth.currentUser ? 'Sign in with Google' : 'Sign Out' }
          </button>
        </div>
      </div>
      );
  }
}

export default Menu;