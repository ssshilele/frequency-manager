import { isObject } from './utils';
import FrequencyManager from './FrequencyManager';

// Local Storage Frequency Manager
export default class LocalFrequencyManager extends FrequencyManager {
  constructor(options) {
    super(options);
    this.frequencyShowKey = '__frequency_show_key__';
    // 统一保存 storage
    this.storageMap = undefined;
  }

  resetTime() {
    this.currentTime = Date.now();
  }
  getStorage(key, force) {
    if (force || this.storageMap === undefined) {
      this.storageMap = this.getLocalStorage();
    }
    return this.storageMap[key] || {};
  }
  setStorage(key, storage) {
    const storageMap = this.getLocalStorage();
    storageMap[key] = storage;
    this.setLocalStorage(storageMap);
    this.storageMap[key] = storage;
  }

  getLocalStorage() {
    const storageMap = JSON.parse(localStorage.getItem(this.frequencyShowKey));
    // 从未记录过
    if (storageMap === null || storageMap === undefined) {
      return {};
    }
    // 有记录，但格式错误
    if (!isObject(storageMap)) {
      throw new Error('FrequencyManager Error: StorageMap parse error.');
    }
    return storageMap;
  }

  setLocalStorage(storageMap) {
    return localStorage.setItem(
      this.frequencyShowKey,
      JSON.stringify(storageMap)
    );
  }
}
