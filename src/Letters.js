import React, { Component } from 'react';
import Dragula from 'react-dragula';

// The guesser's board. It is built from `props.letters` — a scrambled string of
// the word's letters — and the slots carry no positional hint, so the answer is
// never present in the client. The assembled word is submitted to the server,
// which decides whether it is correct.
class Letters extends Component {
  constructor(props) {
    super(props);

    const _this = this;

    this.letterPool = null;
    this.word = null;

    this.drake = Dragula([], {
      revertOnSpill: true,
      accepts: function(el, target) {
        // A slot holds one tile; the pool always accepts.
        if (target && target.classList && target.classList.contains('position')) {
          return !target.querySelector('.letter');
        }
        return true;
      },
    });

    this.drake.on('drop', function() {
      _this.onDrop();
    });
  }

  componentDidMount() {
    this.letterPool = document.getElementById('letter-pool');
    this.word = document.getElementById('word');
    this.buildBoard();
  }

  componentDidUpdate(prevProps) {
    // Rebuild only when the letters actually change (new word / new round).
    if (prevProps.letters !== this.props.letters) {
      this.buildBoard();
    }
  }

  buildBoard() {
    const _this = this;
    const letters = String(this.props.letters || '');

    this.letterPool.innerHTML = '';
    this.word.innerHTML = '';

    // One empty slot per letter.
    for (let i = 0; i < letters.length; i++) {
      const slot = document.createElement('div');
      slot.classList.add('position');
      _this.drake.containers.push(slot);
      _this.word.appendChild(slot);
    }

    // The tiles, shuffled for display only.
    const tiles = letters.split('');
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    tiles.forEach(function(letter) {
      const tile = document.createElement('div');
      const span = document.createElement('span');
      tile.classList.add('letter');
      tile.style.backgroundColor = `hsl(${Math.random() * 360 + 80}, 20%, 50%)`;
      span.appendChild(document.createTextNode(letter));
      tile.appendChild(span);
      _this.letterPool.appendChild(tile);
    });

    _this.drake.containers.push(_this.letterPool);
  }

  // The letters currently placed in the slots, in order.
  currentGuess() {
    const slots = Array.prototype.slice.call(this.word.querySelectorAll('.position'));
    return slots.reduce(function(guess, slot) {
      const tile = slot.querySelector('.letter');
      return guess + (tile ? tile.textContent : '');
    }, '');
  }

  onDrop() {
    const slots = Array.prototype.slice.call(this.word.querySelectorAll('.position'));
    const filled = slots.length > 0 && slots.every(function(slot) {
      return !!slot.querySelector('.letter');
    });
    if (!filled) {
      return;
    }

    const guess = this.currentGuess();
    // Propose the word; the server (functions/checkGuess) decides if it wins.
    this.props.submitGuess(guess);
    console.log('***** GUESS SUBMITTED *****', guess);
  }

  render() {
    return (
      <div className="action-bar">
        <div id="letter-pool" className="letter-pool"></div>
        <div id="word" className="word"></div>
      </div>
    );
  }
}

export default Letters;
