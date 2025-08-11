const debounces = {};

export function debounce(func, delay) {
  const entry = debounces[func]
  if (entry) return undefined;

  const result = func.apply(this)

  debounces[func] = setTimeout(() => {
    delete debounces[func];
  }, delay);

  return result
}
