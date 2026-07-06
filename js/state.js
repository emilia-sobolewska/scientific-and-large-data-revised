export const state = {
  indicator: "NATGROWRT",
  year: 2020,
  selectedCountry: null,
};

const listeners = [];

export function subscribe(fn) {
  listeners.push(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}
