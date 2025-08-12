const debounces = {};

export function debounce(func, delay) {
    if (debounces[func]) return undefined;

    const result = func.apply(this);

    debounces[func] = setTimeout(() => {
        delete debounces[func];
    }, delay);

    return result;
}
