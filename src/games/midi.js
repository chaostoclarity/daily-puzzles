import mini from './mini.js';
import { generateMidi } from '../gen/mini.js';

export default {
  ...mini,
  id: 'midi',
  name: 'Midi Crossword',
  tagline: 'A bigger 7x7 grid, still quick',
  inspired: 'The Midi',
  slow: true,
  generate: generateMidi,
};
