import { deduplicate, isObject, nonNegaLize } from './utils';
import { DEFAULT_BUCKET_ID } from './constants';

// 抽象类
// 使用时需实现其中的 getCurrentTime、getElementClass 方法
export default class Bucket {
  constructor(options) {
    this.init(options);
  }

  init(options) {
    const bucket = this._parseArg(options);
    if (bucket === undefined) return;

    const { bucketId, elements, maxShowNum, minInterval } = bucket;
    // bucketId 是必需且唯一的
    this.bucketId = bucketId;
    // 元素列表（每个元素都必须带有唯一性的 key 属性）
    this.elements = elements;
    // 竞争性元素同时出现的最大数目（默认无限制）
    this.maxShowNum = maxShowNum;
    // 每个相邻竞争性元素展示的最小时间间隔（单位: ms）
    this.minInterval = minInterval;

    // 最近一次的竞争性元素展示时间
    this.lastCompeteShowTime = undefined;

    // 元素映射表
    this.store = {};

    // 按是否参与竞争分类（存在 priority 属性，即代表该元素参与竞争）
    const Element = this.getElementClass();
    this.competeListMap = this.elements.reduce((res, el) => {
      const { key } = el;
      const prop = 'priority' in el ? 'competeList' : 'normalList';

      if (res[prop] === undefined) {
        res[prop] = [key];
      } else {
        res[prop].push(key);
      }

      this.store[key] = new Element(el);
      this.store[key].priority = el.priority;

      return res;
    }, {});

    // 将竞争列表按优先级稳定降序排列（priority 值越大，优先级越高）
    this.competeListMap.competeList?.sort((a, b) => {
      const ap = this.store[a].priority;
      const bp = this.store[b].priority;
      return bp > ap ? 1 : bp < ap ? -1 : 0;
    });
  }

  async checkShow(arg) {
    if (arg !== undefined && !isObject(arg)) return;

    const _arg = arg || {};
    const onlyCompete = 'onlyCompete' in _arg ? !!_arg.onlyCompete : false;
    const excludeCompete =
      'excludeCompete' in _arg ? !!_arg.excludeCompete : false;
    const checkTasks = [];
    if (!onlyCompete) {
      checkTasks.push(this.checkNormalShow(arg));
    }
    if (!excludeCompete) {
      checkTasks.push(this.checkCompeteShow());
    }
    const checkResults = await Promise.all(checkTasks);
    return checkResults.reduce((res, result) => {
      if (result !== undefined) {
        Object.assign(res, result);
      }
      return res;
    }, {});
  }

  async checkNormalShow(arg) {
    const { normalList } = this.competeListMap;
    if (normalList === undefined) return;

    const checkKeys = this._parseCheckArg(arg);
    if (checkKeys === undefined) return;

    if (checkKeys.length > 0) {
      await Promise.all(checkKeys.map(key => this.store[key].checkShow()));
      return this.getCheckResult(checkKeys);
    }
  }

  async checkCompeteShow() {
    const {
      competeListMap: { competeList },
      maxShowNum,
      minInterval,
    } = this;

    if (competeList === undefined) return;

    const currentTime = this.getCurrentTime();

    if (!this.lastCompeteShowTime) {
      const lastCompeteShowTimes = await Promise.all(
        competeList.map(key => this.store[key].getLastShowTime())
      );
      this.lastCompeteShowTime = Math.max.apply(
        null,
        lastCompeteShowTimes.map(t => t || 0)
      );
    }

    // 延时间隔尚未结束
    if (
      minInterval > 0 &&
      currentTime - this.lastCompeteShowTime < minInterval
    ) {
      return this.getCheckResult(competeList);
    }

    let competeShowSize = 0;
    const _checkCompeteShow = async (index = 0) => {
      if (
        index < competeList.length &&
        (maxShowNum === 0 || competeShowSize < maxShowNum)
      ) {
        const _key = competeList[index];
        await this.store[_key].checkShow();
        if (this.store[_key].isShow()) {
          competeShowSize++;
          this.lastCompeteShowTime = currentTime;
        }
        await _checkCompeteShow(index + 1);
      }
    };

    await _checkCompeteShow();
    return this.getCheckResult(competeList);
  }

  async hide(arg) {
    const key = this._parseHideArg(arg);
    if (key === undefined) return;

    this.store[key].hide(arg);
    const { normalList = [], competeList = [] } = this.competeListMap;
    // 如果隐藏的是竞争性元素，则自动检查下一个是否需要显示
    if (competeList.includes(key) && !this.store[key].isShow()) {
      await this.checkCompeteShow();
    }
    return this.getCheckResult([...normalList, ...competeList]);
  }

  // 获取巡检结果
  getCheckResult(keyList) {
    return keyList.reduce((res, key) => {
      res[key] = this.store[key].isShow();
      return res;
    }, {});
  }

  has(key) {
    return this.store[key] !== undefined;
  }

  _parseArg(options) {
    if (!isObject(options)) {
      throw new Error(
        'FrequencyManager Error: Cannot initialize Bucket, expect options as Object or Array.'
      );
    }

    if (Array.isArray(options)) {
      return {
        bucketId: DEFAULT_BUCKET_ID,
        elements: deduplicate(options, 'key'),
        maxShowNum: 0,
        minInterval: 0,
      };
    }

    const { bucketId, elements, maxShowNum, minInterval } = options;

    if (!Array.isArray(elements)) {
      throw new Error(
        'FrequencyManager Error: Cannot initialize Bucket, expect elements as Array.'
      );
    }

    return {
      bucketId: 'bucketId' in options ? bucketId : DEFAULT_BUCKET_ID,
      elements: deduplicate(elements, 'key'),
      maxShowNum: nonNegaLize(maxShowNum),
      minInterval: nonNegaLize(minInterval),
    };
  }

  _parseCheckArg(arg) {
    if (arg !== undefined && !isObject(arg)) return;

    if (
      isObject(arg) &&
      !Array.isArray(arg) &&
      'key' in arg &&
      !this.has(arg.key)
    ) {
      throw new Error(
        `FrequencyManager Error: Cannot find Element by key ${arg.key}.`
      );
    }

    const { normalList } = this.competeListMap;
    let checkList = [];
    if (arg === undefined) {
      checkList = normalList;
    } else {
      const { key, includes, excludes } = arg;
      if (normalList.includes(key)) {
        // 检测指定的一个元素
        checkList.push(key);
      } else if (Array.isArray(includes) && includes.length > 0) {
        // 巡检指定的一批元素
        checkList = includes.filter(key => normalList.includes(key));
      } else if (Array.isArray(excludes) && excludes.length > 0) {
        // 巡检除 excludes 包含元素之外的元素
        checkList = normalList.filter(key => !excludes.includes(key));
      }
    }
    return checkList;
  }

  _parseHideArg(arg) {
    if (!isObject(arg)) return;
    if ('key' in arg && !this.has(arg.key)) {
      throw new Error(
        `FrequencyManager Error: Cannot find Element by key ${arg.key}.`
      );
    }

    return arg.key;
  }
}
