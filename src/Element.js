import { isObject, isFunction, nonNegaLize } from './utils';

// 抽象类
// 使用时需实现其中的 getCurrentTime、getStorage、setStorage 方法
export default class Element {
  constructor(options) {
    this.init(options);
  }

  init(options) {
    if (!isObject(options)) {
      throw new Error(
        'FrequencyManager Error: Cannot initialize Element, expect options as Object.'
      );
    }

    let { frequency, showCount, delayInterval, duration, startTime } = options;
    showCount = nonNegaLize(showCount, 1); // 出现的次数，至少1次
    delayInterval = nonNegaLize(delayInterval, 300); // 距上次出现的最小时间间隔（单位：ms），默认300ms
    duration = nonNegaLize(duration); // 时间片段长度（单位：ms）
    startTime = nonNegaLize(startTime); // 起始时间，时间戳
    // 决定 frequency 自定义逻辑是否与其它逻辑（showCount、delayInterval、duration、startTime）组合使用
    const combinative = 'combinative' in options ? !!options.combinative : true;

    // key 是必需且唯一的
    this.key = options.key;
    // 元素信息
    this.context = {
      frequency,
      combinative,
      showCount,
      delayInterval,
      duration,
      startTime,
    };
    // 存储数据
    this.storage = undefined;
    // 当前的显示状态
    this.show = false;
    // 当前是否处于延迟隐藏状态
    this.fakeShow = false;
  }

  async checkShow() {
    if (this.show && !this.fakeShow) return true; // 已展示，无需再次校验

    const currentTime = this.getCurrentTime();
    const {
      frequency,
      combinative,
      delayInterval,
      showCount,
      startTime,
      duration,
    } = this.context;

    const storage = await this._getStorage();
    if (!isObject(storage)) {
      throw new Error(
        `FrequencyManager Error: Cannot get storage of ${this.key}`
      );
    }

    const { count, times } = storage;
    const lastShowTime = this.getLastShowTimeSync(storage);
    const durationStartTime = this._getStartTime(
      currentTime,
      startTime,
      duration
    );

    let nextShow = false;
    if (combinative) {
      nextShow = currentTime - lastShowTime >= delayInterval;
      if (nextShow) {
        if (durationStartTime > 0) {
          const ts = (times || []).filter(t => t >= durationStartTime);
          nextShow = !ts.length || ts.length < showCount;
        } else {
          nextShow = (+count || 0) < showCount;
        }
      }
      if (nextShow && isFunction(frequency)) {
        // 自定义当前元素以何种频率出现
        // frequency 方法接受当前的存储值作为参数，返回的结果表示是否展示
        nextShow = !!frequency(storage);
      }
    } else if (isFunction(frequency)) {
      nextShow = !!frequency(storage);
    }

    if (nextShow && durationStartTime === 0) {
      storage.lastTime = currentTime;
    }
    this.show = nextShow;
    this.fakeShow = false;
    this.storage = storage;

    return nextShow;
  }

  hide(arg) {
    if (!this.show && !this.fakeShow) return false; // 已隐藏，无需再次校验

    let value;
    let count = 0;
    let immediate = true;
    if (isObject(arg)) {
      value = arg.value;
      count = nonNegaLize(arg.count);
      immediate = 'immediate' in arg ? !!arg.immediate : immediate;
    }

    const currentTime = this.getCurrentTime();
    const { duration, startTime } = this.context;
    const { count: storageCount, times: storageTimes } = this.storage;
    const durationStartTime = this._getStartTime(
      currentTime,
      startTime,
      duration
    );

    this.show = false;
    this.fakeShow = !immediate;

    if (value !== undefined) {
      this.storage.value = value;
    }
    this.storage.count = count > 0 ? count : (+storageCount || 0) + 1;
    if (durationStartTime) {
      const ts = (storageTimes || []).filter(t => t >= durationStartTime);
      this.storage.times = ts.concat([currentTime]);
    } else {
      this.storage.lastTime = currentTime;
    }

    this.setStorage(this.key, this.storage);

    return false;
  }

  isShow() {
    return this.show || this.fakeShow;
  }

  async getLastShowTime() {
    const storage = await this._getStorage();
    if (isObject(storage)) {
      return this.getLastShowTimeSync(storage);
    }
  }
  getLastShowTimeSync(storage = this.storage) {
    const { times, lastTime } = storage;
    return Math.max.apply(null, (times || []).concat([lastTime || 0]));
  }

  async _getStorage() {
    let storage = this.storage;
    if (storage === undefined) {
      storage = await this.getStorage(this.key);
    }
    return storage;
  }

  _getStartTime(currentTime, startTime, duration) {
    return startTime || (duration ? currentTime - duration : 0);
  }
}
