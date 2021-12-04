# Frequency Manager

对于前端系统中普遍存在的红点、气泡、弹窗、步骤引导等交互性展示元素，基于它们与业务逻辑低耦和、和按照特定频率出现的两个共有特点，提供一个通用的中心化的频率展示管理工具。

## Installation

```
npm install frequency-manager
```

## Usage

[这里有一个基于 React 应用的例子](https://github.com/ssshilele/frequency-manager/tree/master/example)

## Document

### 背景

- 频率展示元素大量存在，但缺乏有效的统一管理，分别独立控制比较繁琐且重复工作较多；
- 部分场景下多个元素相互竞争展示的逻辑比较麻烦；
- 与业务逻辑耦合严重；

本工具主要功能点有：

1. 提供基本的频率管理功能，包括展示次数、展示间隔、展示周期，以及额外的自定义逻辑；
2. 对于多个元素竞争展示的场景，提供基于优先级、最大展示数目、延时间隔等的调度功能；
3. 提供默认的展示记录本地持久化功能（基于 LocalStorage），也支持自定义扩展持久化；
4. 预设配置化，接口切面化，调用灵活。

### 概念

- **Element**：频率控制的基本单位，一个红点、气泡、弹窗等都可以是一个元素。单独使用 Element 类时需实现其中的 getCurrentTime、getStorage、setStorage 方法；
- **Bucket**：竞争逻辑的基本单位，多个元素参与相同的竞争逻辑，则它们共同组成一个分桶。单独使用 Bucket 类时需实现其中的 getCurrentTime、getElementClass 方法；
- **FrequencyManager**：管理器，可以包括多个分桶（默认只有一个），提供统一的 API 以让使用者在合适的时机主动调用。使用时需实现其中的 resetTime、getStorage、setStorage 方法；
- **LocalFrequencyManager**：FrequencyManager 基于 LocalStorage 的持久化方案实现。

### 配置

- Element

```javascript
{
  // 元素的 key，使用者需保证其唯一性
  key,

  // 元素需要被展示的次数，默认1次
  showCount,

  // 元素距上次出现的最小时间间隔（单位：ms），默认300ms
  delayInterval,

  // 一个展示周期的起始时间（时间戳）
  startTime,

  // 一个展示周期的长度（单位：ms）
  // 若 startTime 存在则以 startTime 为准，若 startTime 和 duration 都不存在，则表示展示周期为永久
  duration,

  // 自定义的判断是否可展示的方法，接受当前的存储记录作为参数，返回结果表示是否展示
  frequency,

  // 默认为 true，表示 frequency 逻辑与 showCount、delayInterval、startTime、duration 等配合使用
  // 若 frequency 为 false，则表示元素是否展示仅以 frequency 的返回结果为准
  combinative,
}
```

- Bucket

```javascript
{
  // 分桶的 Id，默认为 __DEFAULT_BUCKET_ID__，即变量 DEFAULT_BUCKET_ID 的值
  bucketId,

  // 元素列表
  elements,

  // 可同时展示的最大元素数目，默认无限制
  maxShowNum,

  // 每个批次的元素（maxShowNum 个）展示的最小时间间隔，默认为 0
  minInterval,
}
```

- FrequencyManager

```javascript
{
  // 除默认分桶外是否还有额外的自定义分桶，默认为 false
  useBucket,
}
```

需要注意的是，FrequencyManger 对于配置对象有一定的解析规则以方便使用者。

1. 配置对象是一个数组，此时该数组应当是一个元素配置列表。显然，此时只有默认分桶，且无竞争性逻辑。

```javascript
const freqManager = new FrequencyManager([
  {
    // 无任何额外配置，即：展示一次后永不再出现
    key: 'badge_a',
  },
  {
    // 展示3次
    key: 'badge_e',
    showCount: 3,
  },
  {
    // 每7天（时间段）内最多展示3次，且两次展示间隔至少12个小时
    key: 'badge_i',
    duration: 7 * 24 * 60 * 60 * 1000,
    delayInterval: 12 * 60 * 60 * 1000,
    showCount: 3,
  },
  {
    // 每天（自然日）最多展示2次，且总次数不超过5次，且最晚展示时间不超过 2022/01/01-零时
    key: 'badge_f',
    showCount: 2,
    startTime: new Date().setHours(0, 0, 0, 0),
    frequency(storage) {
      const {
        count = 0, // 已展示的次数
        lastTime = 0, // 最近一次展示的时间
        times = [], // 最近一个周期内的历次展示时间
        value, // 额外的自定义存储的值
      } = storage || {};
      return count < 5 && Date.now() < new Date('2022/01/01').getTime();
    },
  },
]);
```

2. 配置对象包含了竞争性元素，但未开启 useBucket，即只有默认分桶。

```javascript
const freqManager = new FrequencyManager({
  maxShowNum: 2,
  elements: [
    // 没有指定 priority，即认为不参与竞争的元素
    {
      key: 'badge_a',
    },

    // 参与竞争的元素
    {
      key: 'tooltip_b',
      priority: 1,
    },
    // 最多曝光3次（但若点击则永远隐藏），且相邻两次展示间隔至少1小时
    {
      key: 'tooltip_f',
      showCount: 3,
      priority: 2,
      delayInterval: 60 * 60 * 1000,
    },
    {
      // 每天（自然日）最多展示2次，且总次数不超过5次，且最晚展示时间不超过 2022/01/01 零时
      key: 'tooltip_g',
      priority: 5,
      startTime: new Date().setHours(0, 0, 0, 0),
      showCount: 2,
      frequency(storage) {
        // frequency 返回结果与其它条件都成立时才展示
        const { count = 0 } = storage || {};
        return count < 5 && Date.now() < new Date('2022/01/01').getTime();
      },
    },
    {
      // 完全自定义展示
      // 默认展示4次，且相邻两次展示间隔依次至少为 1天、3天、7天
      // 若用户触发了标记（marked），则改为永久每7天出现一次
      key: 'tooltip_d',
      priority: 9,
      combinative: false,
      frequency(storage) {
        const { count = 0, lastTime = 0, value } = storage || {};
        const intervals = [1, 3, 7];
        const unit = 24 * 60 * 60 * 1000;
        if (count === 0) {
          return true;
        } else if (value && value.marked) {
          return Date.now() - lastTime >= 7 * unit;
        } else {
          return (
            count < 4 && Date.now() - lastTime >= intervals[count - 1] * unit
          );
        }
      },
    },
  ],
});
```

3. 配置对象包含了 useBucket: true。此时除 useBucket、maxShowNum、elements、minInterval 之外的其余属性都将被认为是自定义的分桶。

```javascript
const freqManager = new FrequencyManager({
  {
    useBucket: true,

    // 默认分桶
    maxShowNum: 1,
    elements: [
      {
        key: 'tooltip_a',
        priority: 1,
      },
      {
        key: 'tooltip_b',
        priority: 2,
      },
    ]

    // 自定义分桶
    // 逐个展示弹框，展示间隔为至少10分钟
    dialogBucket: {
      maxShowNum: 1,
      minInterval: 10 * 60 * 1000,
      elements: [
        {
          key: 'dialog_1',
          priority: 1,
        },
        {
          key: 'dialog_2',
          priority: 2,
        },
        {
          key: 'dialog_3',
          priority: 3,
        },
      ],
    },
  },
})
```

### API

- **checkShow**：巡检指定范围的元素是否显示

  - 无参数：巡检所有分桶（或默认分桶）中的所有元素；

  - Object：巡检指定的一个分桶（或默认分桶）：

  ```javascript
  // 检测指定分桶中的所有元素
  checkShow({ bucketId: 'bucket_1' });

  // 检测指定分桶中的所有竞争元素
  checkShow({
    bucketId: 'bucket_2',
    onlyCompete: true, // 默认 false
  });

  // 检测指定分桶中的所有非竞争元素
  checkShow({
    bucketId: 'bucket_3',
    excludeCompete: true, // 默认 false
  });

  // 检测指定分桶中的一个非竞争元素
  checkShow({
    bucketId: 'bucket_4',
    key: 'badge_a',
  });

  // 检测指定分桶中的一批非竞争元素
  checkShow({
    bucketId: 'bucket_5',
    includes: ['badge_a', 'badge_b'],
  });

  // 检测指定分桶中除特定一批元素之外的所有非竞争元素
  checkShow({
    bucketId: 'bucket_6',
    excludes: ['badge_a', 'badge_b'],
  });

  // 注意：若未指定 bucketId，在上述示例同样可作用于默认分桶
  // 如，检测默认分桶中指定的一个元素
  checkShow({ key: 'badge_a' });

  // 另外：
  // onlyCompete 与 excludeCompete 不能同时为 true；
  // key、includes、excludes 不能同时生效，且优先级 key > includes > excludes；
  ```

  - Array：巡检指定的一批分桶，其中每一个分桶的参数都可以是上述示例之一。

  ```javascript
  checkShow([
    {
      key: 'badge_a',
    },
    {
      bucketId: 'custom_bucket',
      excludeCompete: true,
    },
  ]);
  ```

- **hide**：隐藏指定的某个元素

  ```javascript
  // 隐藏指定分桶中的指定元素
  // key 是必需的
  // 若未指定 bucketId，则作用于默认分桶
  hide({
    bucketId: 'bucket_1',
    key: 'badge_a',
  });

  // 有可选的额外参数
  hide({
    bucketId: 'bucket_2',
    key: 'badge_a',
    // 仅标记为隐藏，实际上等下一次 checkShow 的时候才真正消失
    immediate: false, // 默认 true
    // 将该元素已展示的次数直接记为 3
    count: 3,
    // 其它需要存储的自定义数据
    value: { marked: true },
  });
  ```

## License

[MIT License](LICENSE)
