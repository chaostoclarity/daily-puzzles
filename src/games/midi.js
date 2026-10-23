import mini from './mini.js';
import { generateMidi } from '../gen/mini.js';

export default {
  ...mini,
  id: 'midi',
  name: 'The Mido',
  tagline: 'A bigger 7x7 grid, still quick',
  slow: true,
  generate: generateMidi,
};
