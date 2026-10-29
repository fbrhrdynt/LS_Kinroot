import { validate } from "./domain.js";
export function loadFamily(storage, key, seed) {
  const raw = storage.getItem(key);
  if (raw !== null) return validate(JSON.parse(raw));
  const initial = seed();
  validate(initial);
  storage.setItem(key, JSON.stringify(initial));
  return initial;
}
export function saveFamily(storage, key, next, previous) {
  validate(next);
  storage.setItem(key + ".previous", JSON.stringify(previous));
  storage.setItem(key, JSON.stringify(next));
}
