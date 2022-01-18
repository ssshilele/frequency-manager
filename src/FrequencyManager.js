import Bucket from './Bucket';
import { deduplicate, isObject, throwError, withStorage } from './utils';
import { DEFAULT_BUCKET_ID } from './constants';

function parseArg(options) {
  let buckets = [];
  let defaultBucket = {
    bucketId: DEFAULT_BUCKET_ID,
    elements: [],
  };

  if (Array.isArray(options)) {
    defaultBucket.elements = options;
    buckets.push(defaultBucket);
    return buckets;
  }

  const { elements, maxShowNum, minInterval, ...restConfigs } = options;

  if (Array.isArray(elements)) {
    // 有默认分桶
    Object.assign(defaultBucket, {
      elements,
      maxShowNum,
      minInterval,
    });
  }
  // 自定义分桶
  buckets = Object.entries(restConfigs).map(([bucketId, config]) => {
    if (Array.isArray(config)) {
      return { elements: config, bucketId };
    } else {
      return { ...config, bucketId };
    }
  });
  if (defaultBucket.elements.length > 0) {
    buckets.unshift(defaultBucket);
  }
  return deduplicate(buckets, 'bucketId');
}

function parseCheckArg(arg, bucketMap) {
  let checkList = [];
  if (arg === undefined) {
    // 无参数，默认巡检所有分桶
    checkList = Object.keys(bucketMap).map(bucketId => ({ bucketId }));
  } else if (Array.isArray(arg)) {
    // 巡检指定的一批分桶
    checkList = deduplicate(
      arg.map(a => ({ bucketId: DEFAULT_BUCKET_ID, ...a })),
      'bucketId'
    );
  } else {
    // 巡检指定的一个分桶或默认分桶
    checkList.push({ bucketId: DEFAULT_BUCKET_ID, ...arg });
  }
  return checkList;
}

function attachBucket(option) {
  const { bucketId } = option;
  if (this.has(bucketId)) {
    this.bucketMap[bucketId].attachConfig(option);
  } else {
    this.bucketMap[bucketId] = new withStorage.call(this, Bucket)(option);
  }
}

function updateConfig(options) {
  const buckets = parseArg(options);
  buckets.forEach(item => attachBucket.call(this, item));
}

// 抽象类
// 使用时需实现其中的 resetTime, getStorage, setStorage 方法
export default class FrequencyManager {
  constructor(options) {
    this.init(options);
  }

  init(options) {
    if (!isObject(options)) {
      throwError('Cannot init FrequencyManager, expect an Object.');
    }

    // Bucket 映射表  按 bucketId 分桶
    this.bucketMap = {};

    updateConfig.call(this, options);
  }

  getCurrentTime() {
    return this.currentTime;
  }

  async checkShow(arg) {
    // 未传参数，或 arg === undefined，则巡检所有分桶
    // Object
    if (arg !== undefined && !isObject(arg)) return;

    const checkBuckets = parseCheckArg(arg, this.bucketMap).filter(
      ({ bucketId }) => this.has(bucketId)
    );

    await this.resetTime();

    if (checkBuckets.length > 0) {
      const results = await Promise.all(
        checkBuckets.map(({ bucketId, ...params }) =>
          this.bucketMap[bucketId].checkShow(
            Object.keys(params).length > 0 ? params : undefined
          )
        )
      );
      return results.reduce((res, item, index) => {
        if (!item) {
          const bucketId = checkBuckets[index].bucketId;
          if (bucketId === DEFAULT_BUCKET_ID) {
            Object.assign(res, item);
          } else {
            res[bucketId] = item;
          }
        }
        return res;
      }, {});
    }
  }

  async hide(arg) {
    if (!isObject(arg) || ('bucketId' in arg && !this.has(arg.bucketId)))
      return;

    const { bucketId = DEFAULT_BUCKET_ID } = arg;

    await this.resetTime();

    const result = await this.bucketMap[bucketId].hide(arg);
    if (!result) {
      if (bucketId === DEFAULT_BUCKET_ID) {
        return result;
      } else {
        return { [bucketId]: result };
      }
    }
  }

  has(bucketId) {
    return !!this.bucketMap[bucketId];
  }

  attachConfig(options) {
    if (isObject(options)) {
      updateConfig.call(this, options);
      return this.bucketMap;
    }
  }

  addBucket(option) {
    if (isObject(option)) {
      updateConfig.call(this, option);

      const bucketId = Array.isArray(option)
        ? DEFAULT_BUCKET_ID
        : 'bucketId' in option
        ? option.bucketId
        : DEFAULT_BUCKET_ID;
      if (this.has(bucketId)) {
        return this.bucketMap[bucketId];
      }
    }
  }

  addElement(option, bucketId = DEFAULT_BUCKET_ID) {
    if (this.has(bucketId)) {
      return this.bucketMap[bucketId].add(option);
    }
  }

  removeBucket(bucketId) {
    if (this.has(bucketId)) {
      delete this.bucketMap[bucketId];
      return true;
    }
  }

  removeElement(key, bucketId = DEFAULT_BUCKET_ID) {
    if (this.has(bucketId) && this.bucketMap[bucketId].has(key)) {
      return this.bucketMap[bucketId].remove(key);
    }
  }
}
