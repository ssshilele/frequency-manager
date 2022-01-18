import Element from './Element';
import {
  deduplicate,
  isObject,
  nonNegaLize,
  throwError,
  withStorage,
} from './utils';
import { DEFAULT_BUCKET_ID } from './constants';

function parseArg(options) {
  if (Array.isArray(options)) {
    return {
      bucketId: DEFAULT_BUCKET_ID,
      elements: deduplicate(options, 'key'),
      maxShowNum: 0,
      minInterval: 0,
    };
  }

  const { bucketId, elements, maxShowNum, minInterval } = options;

  return {
    bucketId: 'bucketId' in options ? bucketId : DEFAULT_BUCKET_ID,
    elements: Array.isArray(elements) ? deduplicate(elements, 'key') : [],
    maxShowNum: nonNegaLize(maxShowNum),
    minInterval: nonNegaLize(minInterval),
  };
}

function parseCheckArg(arg, normalList) {
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

function getListProp(el) {
  return 'priority' in el ? 'competeList' : 'normalList';
}

function attachElement(el) {
  if (isObject(el) && 'key' in el) {
    const { key } = el;
    const listMap = this.competeListMap;
    const prop = getListProp(el);

    if (this.has(key)) {
      // 已有该元素，更新配置
      const idx = this.elements.findIndex(item => item.key === key);
      Object.assign(this.elements[idx], el);

      const oldEl = this.store[key];
      const oldProp = getListProp(oldEl);
      oldEl.attachConfig(el);
      if ('priority' in el) {
        oldEl.priority = el.priority;
      }

      if (prop !== oldProp) {
        const idx = listMap[oldProp]?.indexOf(key);
        if (idx >= 0) {
          listMap[oldProp].splice(idx, 1);
          listMap[prop] ??= [];
          listMap[prop].push(key);
        }
      }
    } else {
      // 未有，新增该元素
      this.elements.push(el);

      this.store[key] = new withStorage.call(this, Element)(el);
      this.store[key].priority = el.priority;

      listMap[prop] ??= [];
      listMap[prop].push(key);
    }
  }
}

function updateConfig(bucket) {
  const { elements, maxShowNum, minInterval } = bucket;

  Object.assign(this, {
    // 竞争性元素同时出现的最大数目（默认无限制）
    maxShowNum,
    // 每个相邻竞争性元素展示的最小时间间隔（单位: ms）
    minInterval,
  });

  // 按是否参与竞争分类（存在 priority 属性，即代表该元素参与竞争）
  elements.forEach(el => attachElement.call(this, el));

  sortCompeteList.call(this);
}

// 将竞争列表按优先级稳定降序排列（priority 值越大，优先级越高）
function sortCompeteList() {
  this.competeListMap.competeList?.sort((a, b) => {
    const ap = this.store[a].priority;
    const bp = this.store[b].priority;
    return bp > ap ? 1 : bp < ap ? -1 : 0;
  });
}

// 获取巡检结果
function getCheckResult(keyList) {
  return keyList.reduce((res, key) => {
    res[key] = this.store[key].isShow();
    return res;
  }, {});
}

// 抽象类
// 使用时需实现其中的 getCurrentTime, getStorage, setStorage 方法
export default class Bucket {
  constructor(options) {
    this.init(options);
  }

  init(options) {
    if (!isObject(options)) {
      throwError('Cannot init Bucket, expect an Object or Array.');
    } else if (!Array.isArray(options) && !('bucketId' in options)) {
      throwError(`Cannot init Bucket, not find property 'bucketId'.`);
    }

    const bucket = parseArg(options);

    // bucketId 是必需且唯一的
    this.bucketId = bucket.bucketId;

    // 最近一次的竞争性元素展示时间
    this.lastCompeteShowTime = undefined;

    // 元素列表（每个元素都必须带有唯一性的 key 属性）
    this.elements = [];

    // 元素映射表
    this.store = {};

    // 竞争分类表
    this.competeListMap = {};

    updateConfig.call(this, bucket);
  }

  async checkShow(arg) {
    // 未传参数，或 arg === undefined，则巡检所有元素
    // Object
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
      if (result) {
        Object.assign(res, result);
      }
      return res;
    }, {});
  }

  async checkNormalShow(arg) {
    if (arg !== undefined && !isObject(arg)) return;

    const { normalList } = this.competeListMap;
    if (!normalList) return;

    const checkKeys = parseCheckArg(arg, normalList).filter(key =>
      this.has(key)
    );

    if (checkKeys.length > 0) {
      await Promise.all(checkKeys.map(key => this.store[key].checkShow()));
      return getCheckResult.call(this, checkKeys);
    }
  }

  async checkCompeteShow() {
    const {
      competeListMap: { competeList },
      maxShowNum,
      minInterval,
    } = this;

    if (!competeList) return;

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
      return getCheckResult.call(this, competeList);
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
    return getCheckResult.call(this, competeList);
  }

  async hide(arg) {
    if (!isObject(arg) || !this.has(arg.key)) return;

    const { key } = arg;
    this.store[key].hide(arg);
    const { normalList = [], competeList = [] } = this.competeListMap;
    // 如果隐藏的是竞争性元素，则自动检查下一个是否需要显示
    if (competeList.includes(key) && !this.store[key].isShow()) {
      await this.checkCompeteShow();
    }
    return getCheckResult.call(this, [...normalList, ...competeList]);
  }

  attachConfig(options) {
    if (!isObject(options)) return;

    const bucket = parseArg({
      bucketId,
      maxShowNum:
        'maxShowNum' in options ? options.maxShowNum : this.maxShowNum,
      minInterval:
        'minInterval' in options ? options.minInterval : this.minInterval,
      elements: Array.isArray(options)
        ? options
        : Array.isArray(options.elements)
        ? options.elements
        : [],
    });

    updateConfig.call(this, bucket);

    return {
      bucketId: this.bucketId,
      maxShowNum: this.maxShowNum,
      minInterval: this.minInterval,
      elements: this.elements,
    };
  }

  has(key) {
    return !!this.store[key];
  }

  add(option) {
    if (isObject(option) && !Array.isArray(option) && 'key' in option) {
      attachElement.call(this, option);
      sortCompeteList.call(this);
      return this.store[option.key];
    }
  }

  remove(key) {
    if (this.has(key)) {
      const el = this.store[key];
      const list = this.competeListMap[getListProp(el)];

      const elementIdx = this.elements.findIndex(el => el.key === key);
      if (elementIdx >= 0) {
        this.elements.splice(elementIdx, 1);
      }

      delete this.store[key];

      const competeIdx = list.indexOf(item => item === key);
      if (competeIdx >= 0) {
        list.splice(competeIdx, 1);
      }

      return true;
    }
  }
}
