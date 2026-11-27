import animals from 'animals';
import { consecutiveUniqueRandom } from 'unique-random';

const a = animals.words.filter(function(item) {
  return item.length < 8;
});
const random = consecutiveUniqueRandom(0, a.length - 1);

export default function() {
  return a[random()];
}
