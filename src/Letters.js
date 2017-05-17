import React, { Component } from 'react';
// import Paper from 'paper';
import Dragula from 'react-dragula';

// import 'jquery-ui';
// import 'jquery-ui-touch-punch-c';

class Letters extends Component {
  constructor(props) {
    super(props);

    const _this = this;

    this.selection = null;
    this.currentPosition = null;
    this.jumble = [];
    this.solution = [];
    this.letterPool = null;
    this.word = null;
    this.drake = Dragula([], {
      revertOnSpill: true,
      accepts: function(el, target, source, sibling) {
        return _this.checkPosition(el, target);
      }
    });

    this.drake.on('drop', function(el, target) {
      _this.submitPosition(el, target);
    });
  }

  componentWillMount() {


    // let getWidth = this.props.gameRef.child('drawWidth').once('value').then(function(data) {
    //   return data.val();
    // });
    // let getHeight = this.props.gameRef.child('drawHeight').once('value').then(function(data) {
    //   return data.val();
    // });

    // Promise.all([getHeight, getWidth]).then(values => {
    //   let drawWidth = values[1];
    //   let drawHeight = values[0];
    //   // const aspectRatio = drawWidth / drawHeight;

    //   console.log('values', values);
    //   console.log('drawWidth', values[0]);
    //   console.log('drawHeight', values[1]);

    //   // scale canvas if necessary
    //   if (drawHeight > window.canvas.offsetHeight) {
    //     const imageDiff = window.canvas.offsetHeight / drawHeight;
    //     Paper.view._matrix.scale(imageDiff);
    //     Paper.view.update();
    //   }
    // });
  }

  componentDidMount() {
    const _this = this;

    this.letterPool = document.getElementById('letter-pool');
    this.word = document.getElementById('word');

    this.drawLetters();
  }

  drawLetters() {
    this.selection = this.props.currentAnimal.split('');
    console.log('current Animal', this.props.currentAnimal);

    const _this = this;
    this.letterPool.innerHTML = '';
    this.word.innerHTML = '';
    this.solution = [];
    this.jumble = [];

    // loop over the array and print out drop containers
    // push each character to a new array that we can shuffle
    this.selection.forEach(function(index) {
      var tile = document.createElement('div');
      tile.classList.add('position');
      tile.setAttribute('droppable', true);
      tile.setAttribute('data-letter', index);
      _this.drake.containers.push(tile);
      _this.word.appendChild(tile);
      _this.jumble.push(index);
    });

    // shuffle the characters in the new word array
    this.jumble
      .sort(function() {
        return 0.5 - Math.random();
      })
      .forEach(function(index) {
        var tile = document.createElement('div');
        var span = document.createElement('span');
        var text = document.createTextNode(index);

        // print out characters on screen;
        tile.classList.add('letter');
        tile.style.backgroundColor = `hsl(${Math.random() * 360 + 80}, 20%, 50%)`;
        tile.appendChild(span);
        span.appendChild(text);
        _this.letterPool.appendChild(tile);
      });

    this.drake.containers.push(document.getElementById('letter-pool'));
  }

  componentWillUpdate() {
    this.drawLetters();
  }

  // check if the letter tile is put in the right place
  // return true enables dragula to drop the letter
  checkPosition(source, target) {
    if (source.children[0].innerHTML === target.getAttribute('data-letter')) {
      return true;
    } else {
      return false;
    }
  }

  submitPosition(source, target) {
    const _this = this;

    if (source.children[0].innerHTML === target.getAttribute('data-letter')) {
      _this.solution.push(source.children[0].innerHTML);

      if (_this.solution.join() === _this.selection.join()) {
        this.props.gameOver();
        console.log('***** GAME OVER *****');
      }

      source.style.backgroundColor = '#4A5882';
      source.classList.add('position--correct');

      return true;
    } else {
      return false;
    }
  }

  dragulaDecorator(componentBackingInstance) {
    if (componentBackingInstance) {
      let options = { };
      Dragula([componentBackingInstance], options);
    }
  };

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