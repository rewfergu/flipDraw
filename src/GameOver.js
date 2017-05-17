import React, { Component } from 'react';

class GameOver extends Component {
  render() {
    return (
      <div className="menu-bg" id="gameOver">
        <div className="menu">
          <h1 className="menu__title">You Win!</h1>
          <button className="menu__btn">Play Again</button>
        </div>
      </div>
      );
  }
}

export default GameOver;