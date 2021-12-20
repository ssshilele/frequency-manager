export function deduplicate(array, key) {
  const map = new Map();
  const arr = [];
  for (let i = array.length - 1; i >= 0; i--) {
    if (array[i]?.[key]) {
      const _key = array[i][key];
      if (!map.has(_key)) {
        arr.unshift(array[i]);
        map.set(_key, true);
      }
    }
  }
  return arr;
}

export function withStorage(_class) {
  const _this = this;
  return class extends _class {
    getCurrentTime() {
      return _this.getCurrentTime();
    }
    getStorage(key, force) {
      return _this.getStorage(key, force);
    }
    setStorage(key, storage) {
      return _this.setStorage(key, storage);
    }
  };
}

export function isObject(obj) {
  const type = typeof obj;
  return obj !== null && (type === 'object' || type === 'function');
}

export function isFunction(obj) {
  return typeof obj === 'function';
}

export function nonNegaLize(v, d = 0) {
  return Math.max(+v || 0, d);
}
