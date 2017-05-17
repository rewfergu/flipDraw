import animals from 'animals';
import uniqueRandom from 'unique-random';


const a = animals.words.filter(function(item) {
  return item.length < 8;
});
const random = uniqueRandom(0, a.length - 1);

module.exports = function() {
  return a[random()];
}