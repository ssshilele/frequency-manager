import React from 'react';
import hoistNonReactStatic from 'hoist-non-react-statics';
import LocalFrequencyManager, { DEFAULT_BUCKET_ID } from 'frequency-manager';

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}

const withFreqManage = Component => {
  class FreqManager extends React.Component {
    freqManager = undefined;
    state = {
      freqStore: {},
    };

    getFreqInstance = () => {
      if (this.freqManager !== undefined) {
        return this.freqManager;
      }
      return this.initFreqInstance();
    };
    initFreqInstance = () => {
      // 从 freqConfig 读取配置
      const { freqConfig } = this.props;
      this.freqManager = new LocalFrequencyManager(freqConfig);

      // 重置 freqStore
      const freqStore = {};
      const { [DEFAULT_BUCKET_ID]: defaultBucket, ...restBuckets } =
        this.freqManager.bucketMap;
      Object.keys(restBuckets).forEach(bucketId => {
        freqStore[bucketId] = {};
      });
      this.setState({ freqStore });

      return this.freqManager;
    };
    checkFreqShow = async arg => {
      const showStore = await this.getFreqInstance().checkShow(arg);
      this.setFreqStore(showStore);
    };
    hideFreqShow = async arg => {
      const showStore = await this.getFreqInstance().hide(arg);
      this.setFreqStore(showStore);
    };
    setFreqStore = showStore => {
      if (isObject(showStore)) {
        // 数据写入到 freqStore
        const { freqStore } = this.state;
        Object.assign(freqStore, showStore);
        this.setState({ freqStore });
      }
    };

    render() {
      const { forwardRef, ...rest } = this.props;
      return (
        <Component
          ref={forwardRef}
          {...this.state}
          getFreqInstance={this.getFreqInstance}
          initFreqInstance={this.initFreqInstance}
          checkFreqShow={this.checkFreqShow}
          hideFreqShow={this.hideFreqShow}
          {...rest}
        />
      );
    }
  }

  FreqManager.displayName = `withFreqManage(${
    Component.displayName || Component.name || 'Component'
  })`;

  const wrapped = React.forwardRef((props, ref) => (
    <FreqManager {...props} forwardRef={ref} />
  ));

  hoistNonReactStatic(wrapped, Component);

  return wrapped;
};

export default withFreqManage;
