import { deduplicate, isObject } from './utils';
import { DEFAULT_BUCKET_ID } from './constants';
import Element from './Element';
import Bucket from './Bucket';

function getElementImplement() {
  const _this = this;
  return class extends Element {
    getCurrentTime() {
      return _this.getCurrentTime();
    }
    getStorage(key, force) {
      return _this.getStorage(key, force);
    }
    setStorage(key, storage) {
      return _this.setStorage(key, storage);
    }
  }
}

function getBucketImplement() {
  const _this = this;
  return class extends Bucket {
    getElementClass() {
      return getElementImplement.call(_this);
    }
    getCurrentTime() {
      return _this.getCurrentTime();
    }
  }
}

// 抽象类
// 需实现其中的 resetTime、getStorage、setStorage 方法
export default class FrequencyManager {
  constructor(options) {
    this.init(options);
  }

  init(options) {
    const buckets = this._parseArg(options);
    if (buckets === undefined) return;

    // 按 bucketId 分桶
    const Bucket = getBucketImplement.call(this);
    this.bucketMap = buckets.reduce((res, option) => {
      res[option.bucketId] = new Bucket(option);
      return res;
    }, {});
  }

  getCurrentTime() {
    return this.currentTime;
  }

  async checkShow(arg) {
    const checkBuckets = this._parseCheckArg(arg);
    if (checkBuckets === undefined) return;

    this.resetTime();

    if (checkBuckets.length > 0) {
      const results = await Promise.all(
        checkBuckets.map(({ bucketId, ...params }) =>
          this.bucketMap[bucketId].checkShow(
            Object.keys(params).length > 0 ? params : undefined
          )
        )
      );
      return results.reduce((res, result, index) => {
        if (result !== undefined) {
          const bucketId = checkBuckets[index].bucketId;
          if (bucketId === DEFAULT_BUCKET_ID) {
            Object.assign(res, result);
          } else {
            res[bucketId] = result;
          }
        }
        return res;
      }, {});
    }
  }

  async hide(arg) {
    const bucketId = this._parseHideArg(arg);
    if (bucketId === undefined) return;

    this.resetTime();

    const result = await this.bucketMap[bucketId].hide(arg);
    if (result !== undefined) {
      if (bucketId === DEFAULT_BUCKET_ID) {
        return result;
      } else {
        return { [bucketId]: result };
      }
    }
  }

  has(bucketId) {
    return this.bucketMap[bucketId] !== undefined;
  }

  _parseArg(options) {
    if (!isObject(options)) {
      throw new Error('FrequencyManager Error: Cannot initialize FrequencyManager, expect options as Object.');
    }

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

    const {
      useBucket = false,
      elements,
      maxShowNum,
      minInterval,
      ...restConfigs
    } = options;

    if (Array.isArray(elements)) {
      // 有默认分桶
      Object.assign(defaultBucket, {
        elements,
        maxShowNum,
        minInterval,
      });
    }
    if (useBucket) {
      // 使用自定义分桶
      buckets = Object.entries(restConfigs)
        .map(([bucketId, config]) => {
          const bucket = { bucketId };
          if (Array.isArray(config)) {
            bucket['elements'] = config;
          } else {
            Object.assign(bucket, config);
          }
          return bucket;
        });
    }
    if (defaultBucket.elements.length > 0) {
      buckets.unshift(defaultBucket);
    }
    return deduplicate(buckets, 'bucketId');
  }

  _parseCheckArg(arg) {
    if (arg !== undefined && !isObject(arg)) return;

    if (isObject(arg) && !Array.isArray(arg) && ('bucketId' in arg) && !this.has(arg.bucketId)) {
      throw new Error(`FrequencyManager Error: Cannot find Bucket by bucketId ${arg.bucketId}.`);
    }

    let checkList = [];
    if (arg === undefined) {
      // 无参数，默认巡检所有分桶
      checkList = Object.keys(this.bucketMap)
        .map(bucketId => ({ bucketId }));
    } else if (Array.isArray(arg)) {
      // 巡检指定的一批分桶
      checkList = arg.filter(({ bucketId }) => this.has(bucketId));
    } else {
      // 巡检指定的一个分桶或默认分桶
      checkList.push({ bucketId: DEFAULT_BUCKET_ID, ...arg });
    }
    return deduplicate(checkList, 'bucketId');
  }

  _parseHideArg(arg) {
    if (!isObject(arg)) return;
    if ('bucketId' in arg && !this.has(arg.bucketId)) {
      throw new Error(`FrequencyManager Error: Cannot find Bucket by bucketId ${arg.bucketId}.`);
    }

    return arg.bucketId || DEFAULT_BUCKET_ID;
  }
}
