import React, { Component } from 'react';

class NewGame extends Component {
  render() {
    return (
      <div>
        <button data-href="index.html" id="drawBtn" className="menu__btn" onClick={ this.props.selectDraw }>Draw</button>
        <button data-href="index.html" id="guessBtn" className="menu__btn" onClick={ this.props.selectGuess }>Guess</button>
      </div>
      );
  }
}

export default NewGame;
