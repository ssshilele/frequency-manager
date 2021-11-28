import React, { useState } from 'react';
import withFreqManage from './HOCs/withFreqManage';
import View from './components/View';
import './flexible.js';
import './App.scss';

const Demo = withFreqManage(View);

function App() {
  const demo1Config = [
    {
      // 无任何配置，默认展示一次后不再出现
      key: 'badge_a',
    },
    {
      // 最多展示3次
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
          count = 0,  // 已展示的次数
          lastTime = 0, // 最近一次展示的时间
          times = [],  // 最近一个周期内的历次展示时间
          value,  // 自定义存储的值
        } = storage || {};
        return count < 5 && Date.now() < new Date('2022/01/01').getTime();
      },
    },
  ];
  const demo2Config = {
    maxShowNum: 2,
    elements: [
      // 不参与竞争的元素
      ...demo1Config,

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
        frequency(storage) {   // frequency 返回结果与其它条件都成立时才展示
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
            return count < 4 && Date.now() - lastTime >= intervals[count - 1] * unit;
          }
        },
      },
    ],
  };
  const demo3Config = {
    useBucket: true,

    // 默认分桶
    ...demo2Config,

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
  };

  const [activeTypes, setActiveTypes] = useState({
    'demo-1': true,
    'demo-2': false,
    'demo-3': false,
  });

  const handleRowTypeChange = (prop) => () => {
    setActiveTypes({
      ...activeTypes,
      [prop]: !activeTypes[prop],
    });
  };

  return (
    <div className="App">
      <div className="demo-row">
        <div className="row-header" onClick={handleRowTypeChange('demo-1')}>
          <div className={`arrow ${activeTypes['demo-1'] ? 'active' : ''}`} />
          Demo1
        </div>
        {activeTypes['demo-1'] ? (
          <div className="row-body">
            <Demo freqConfig={demo1Config} />
          </div>
        ) : null}
      </div>
      <div className="demo-row">
        <div className="row-header" onClick={handleRowTypeChange('demo-2')}>
          <div className={`arrow ${activeTypes['demo-2'] ? 'active' : ''}`} />
          Demo2
        </div>
        {activeTypes['demo-2'] ? (
          <div className="row-body">
            <Demo freqConfig={demo2Config} />
          </div>
        ) : null}
      </div>
      <div className="demo-row">
        <div className="row-header" onClick={handleRowTypeChange('demo-3')}>
          <div className={`arrow ${activeTypes['demo-3'] ? 'active' : ''}`} />
          Demo3
        </div>
        {activeTypes['demo-3'] ? (
          <div className="row-body">
            <Demo freqConfig={demo3Config} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;
