export function randomRgbColor() {
  return `rgba(${Math.floor(Math.random() * 255)},${Math.floor(
    Math.random() * 255
  )},${Math.floor(255)},${Math.random()})`;
}

export function randomItemFromArray(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function randomIntFromRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
