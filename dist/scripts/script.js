// game setup variables
var FIREBASE_BASE = new Firebase('https://svgpad.firebaseio.com/');
var firebaseRef;
var firebasePath;
var path;
var pathReferenceDraw;
var pathReferenceGuess;
var firebasePathsRef;

var getUrlVars = function() {
  var vars = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
    vars[key] = value;
  });

  return vars;
};

var gameId = getUrlVars()['id'];

// word tile variables
var wordlist = [
  "cat",
  "dog",
  "bird",
  "fish",
  "snake",
  "turtle",
  "snail",
];

var title = document.getElementById('title');
var letterPool = document.getElementById('letter-pool');
var word = document.getElementById('word');
var currentPosition;
var currentLetter;
var jumble = [];
var solution;
var checkPosition;
var selection;

selection = wordlist[Math.floor(Math.random() * wordlist.length)];

// check for exising game ID
if (!gameId) {
  firebaseRef = FIREBASE_BASE.push();
  var path = 'index.html?id=' + firebaseRef.key();
  window.location = path;
} else {
  firebaseRef = FIREBASE_BASE.child(gameId);
}

firebaseRef.child('word').set(selection);

// setup paper.js
paper.install(window);
//var scope = new paper.PaperScope();
var scope = {};
var guessCanvas = document.getElementById('guessCanvas');
var drawCanvas = document.getElementById('drawCanvas');

scope.guess = new paper.PaperScope();
scope.draw = new paper.PaperScope();

paper = scope.guess;
paper.setup(guessCanvas);

paper = scope.draw;
paper.setup(drawCanvas);

// jQuery ready
$(function() {

  // setup firebase response to path data
  pathReferenceDraw = {};
  pathReferenceGuess = {};
  firebasePathsRef = firebaseRef.child('paths');

  firebasePathsRef.on('child_changed', function(snapshot) {
    var firebaseData = snapshot.val();

    paper = scope.guess;
    pathReferenceGuess[snapshot.key()].pathData = firebaseData.path;
    scope.guess.view.update();

    paper = scope.draw;
    pathReferenceDraw[snapshot.key()].pathData = firebaseData.path;
    scope.draw.view.update();

  });

  firebasePathsRef.on('child_added', function(snapshot) {
    var firebaseData = snapshot.val();

    paper = scope.guess;
    pathReferenceGuess[snapshot.key()] = new scope.guess.Path();
    console.log(pathReferenceGuess[snapshot.key()]);
    pathReferenceGuess[snapshot.key()].pathData = firebaseData.path;
    pathReferenceGuess[snapshot.key()].strokeColor = 'red';
    pathReferenceGuess[snapshot.key()].strokeWidth = 3;
    scope.guess.view.update();

    paper = scope.draw;
    pathReferenceDraw[snapshot.key()] = new scope.draw.Path();
    pathReferenceDraw[snapshot.key()].pathData = firebaseData.path;
    pathReferenceDraw[snapshot.key()].strokeColor = 'red';
    pathReferenceDraw[snapshot.key()].strokeWidth = 3;
    scope.draw.view.update();
  });

  firebaseRef.child('completed').on('value', function(snapshot) {
    if (snapshot.val() === true) {
      $('#gameOver').show();

      paper = scope.guess;
      paper.project.activeLayer.children = [];
      scope.guess.view.update();

      paper = scope.draw;
      paper.project.activeLayer.children = [];
      scope.draw.view.update();

      view.update();
      $('#word').empty();
      $('#letter-pool').empty();
      jumble = [];
    } else {
      $('#gameOver').hide();
    }
  });

  $('#gameOver').click(function() {
    selection = wordlist[Math.floor(Math.random() * wordlist.length)];
    firebaseRef.set({word: selection, completed: false});
  });

  // get current word from firebase
  firebaseRef.child('word').on('value', function(snapshot){
    selection = snapshot.val();
    $('#drawTitle').html(selection);
    console.log(selection);
    jumble = new Array();
    solution = new Array();
    $('#word').empty();
    $('#letter-pool').empty();

    // split the characters into an array
    selection = selection.split('');

    // loop over the array and print out drop containers
    // push each character to a new array that we can shuffle
    selection.forEach(function(index) {
      var tile = document.createElement('div');
      tile.classList.add('position');
      tile.setAttribute('droppable', true);
      tile.setAttribute('data-letter', index);
      word.appendChild(tile);
      jumble.push(index);
    });

    // shuffle the characters in the new word array
    jumble.sort(function() {
      return 0.5 - Math.random();
    });

    // print out characters on screen;
    jumble.forEach(function(index){
      var tile = document.createElement('div');
      var text = document.createTextNode(index);
      tile.classList.add('letter');
      tile.appendChild(text);
      letterPool.appendChild(tile);
    });




    var tool = new Tool();

    tool.onMouseDown = function(event) {
      // If we produced a path before, deselect it:
      if (path) {
        path.selected = false;
      }

      // Create a new path and set its stroke color to black:
      path = new Path({
        segments: [event.point],
        strokeColor: 'red',
        strokeWidth: 3,
        fullySelected: true
      });



      firebasePath = firebasePathsRef.push();
      paper = scope.guess;
      pathReferenceDraw[firebasePath.key()] = new scope.draw.Path();
      paper = scope.draw;
      pathReferenceGuess[firebasePath.key()] = new scope.guess.Path();
    }

    // While the user drags the mouse, points are added to the path
    // at the position of the mouse:
    tool.onMouseDrag = function(event) {
      path.add(event.point);
      firebasePath.set({path: path.pathData});
    };

    // When the mouse is released, we simplify the path:
    tool.onMouseUp = function(event) {
      path.fullySelected = false;
      path.remove();
    }




    // *****
    // setup tiles for guess player
    // *****



    //$('#title').hide();
    //$('#letter-pool').show();
    //$('#word').show();

    // check if the letter tile is put in the right place
    checkPosition = function(position, letter) {
      //console.log(position, letter);
      if (position == letter) {
        return true;
      } else {
        return false;
      }
    }

    // add jquery ui drop function
    $('.position').droppable({
      tolerance: "pointer",
      over: function() {
        $(this).addClass('position--hover');
      },
      out: function() {
        $(this).removeClass('position--hover');
      },
      drop: function(event, ui) {
        //console.log(event);

        currentPosition = event.target;
        currentPosition.classList.remove('position--hover');

        if (checkPosition(currentPosition.getAttribute('data-letter'), ui.draggable.html())) {
          currentPosition.classList.add('position--correct');

          ui.draggable.css('position', 'absolute');
          ui.draggable.css('left', '-1px');
          ui.draggable.css('top', '-1px');
          $(currentPosition).append(ui.draggable);

          solution.push(ui.draggable.html());
          if (solution.join() === selection.join()) {
            //word.classList.add('word--correct');
            firebaseRef.child('completed').set(true);
            firebaseRef.child('paths').set([]);
          }
        } else {
          currentPosition.classList.add('position--incorrect');
          ui.draggable.animate({
            left: 0,
            top: 0
          }, 150, function() {
            currentPosition.classList.remove('position--incorrect');
          });
        }
      }
    });

    // add jquery ui drag function
    $('.letter').draggable({
      stop: function( event, ui ) {
        //console.log(event);
        if (!ui.helper.parent().hasClass('position')) {
          ui.helper.animate({
            left: 0,
            top: 0
          }, 150);
        }
      }
    });

  });

}); // jQuery ready
