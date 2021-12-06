import React, { useEffect, useState } from 'react';
import Badge from '../Badge';
import Tooltip from '../tooltip';
import Dialog from '../Dialog';
import './index.scss';

function View({ freqStore, checkFreqShow, hideFreqShow, getFreqInstance }) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const dialogBucketStore = freqStore['dialogBucket'] || {};

  const handleBoxClick = params => () => {
    hideFreqShow(params);
  };

  const handleTooltipClick = params => e => {
    e.stopPropagation();
    hideFreqShow(params);
  };
  // tooltip_f 点击一次就永久隐藏，具体做法是直接将已展示次数置为最大值
  const handleTooltipFClick = e => {
    handleTooltipClick({ key: 'tooltip_f', count: 3 })(e);
  };

  const handleTooltipDClick = e => {
    e.stopPropagation();
    const { storageMap } = getFreqInstance();
    if (storageMap && !storageMap['tooltip_d']?.value) {
      setShowConfirmModal(true);
    } else {
      hideFreqShow({ key: 'tooltip_d' });
    }
  };
  const handleConfirmModal = params => () => {
    hideFreqShow({ key: 'tooltip_d', ...params });
    setShowConfirmModal(false);
  };

  const handleDialogClose = params => () => {
    hideFreqShow({ bucketId: 'dialogBucket', ...params });
  };

  useEffect(() => {
    checkFreqShow();
  }, []);

  useEffect(() => {
    // 对于 tooltip_2，曝光即计算次数
    // immediate: false 表示不会在视觉上立即隐藏该元素，但实际上已将其标记为“隐藏状态”
    if (freqStore['tooltip_f']) {
      hideFreqShow({ key: 'tooltip_f', immediate: false });
    }
  }, [freqStore['tooltip_f']]);

  return (
    <>
      <div className="main-container">
        <div className="box" onClick={handleBoxClick({ key: 'badge_a' })}>
          <div className="content">A</div>
          <Badge show={freqStore['badge_a']} />
        </div>
        <div className="box">
          <div className="content">B</div>
          <Tooltip
            id="b"
            show={freqStore['tooltip_b']}
            onClick={handleTooltipClick({ key: 'tooltip_b' })}
          />
        </div>
        <div className="box">
          <div className="content">C</div>
        </div>
        <div className="box">
          <div className="content">D</div>
          <Tooltip
            id="d"
            show={freqStore['tooltip_d']}
            onClick={handleTooltipDClick}
          />
        </div>
        <div className="box" onClick={handleBoxClick({ key: 'badge_e' })}>
          <div className="content">E</div>
          <Badge show={freqStore['badge_e']} />
        </div>
        <div className="box" onClick={handleBoxClick({ key: 'badge_f' })}>
          <div className="content">F</div>
          <Badge show={freqStore['badge_f']} />
          <Tooltip
            id="f"
            show={freqStore['tooltip_f']}
            onClick={handleTooltipFClick}
          />
        </div>
        <div className="box">
          <div className="content">G</div>
          <Tooltip
            id="g"
            show={freqStore['tooltip_g']}
            onClick={handleTooltipClick({ key: 'tooltip_g' })}
          />
        </div>
        <div className="box">
          <div className="content">H</div>
        </div>
        <div className="box" onClick={handleBoxClick({ key: 'badge_i' })}>
          <div className="content">I</div>
          <Badge show={freqStore['badge_i']} />
        </div>
      </div>
      {showConfirmModal ? (
        <Dialog
          title="是否每周提醒？"
          content="这个 Tooltip 还挺重要的，是否需要每周提醒您一次呢？"
          cancelText="不用了"
          confrimText="需要"
          onClose={handleConfirmModal()}
          onConfrim={handleConfirmModal({ value: { marked: true } })}
          onCancel={handleConfirmModal()}
        />
      ) : null}
      {dialogBucketStore['dialog_1'] ? (
        <Dialog
          title="欢迎体验"
          confrimText="我知道了"
          noCloseBtn
          onClose={handleDialogClose({ key: 'dialog_1' })}
          onConfrim={handleDialogClose({ key: 'dialog_1' })}
        />
      ) : null}
      {dialogBucketStore['dialog_2'] ? (
        <Dialog
          title="恭喜您获得体验资格"
          cancelText="以后再说"
          confrimText="立即体验"
          onClose={handleDialogClose({ key: 'dialog_2' })}
          onConfrim={handleDialogClose({ key: 'dialog_2' })}
          onCancel={handleDialogClose({ key: 'dialog_2' })}
        />
      ) : null}
      {dialogBucketStore['dialog_3'] ? (
        <Dialog
          title="你的频率管理器已送达，请查收"
          cancelText="放弃"
          onClose={handleDialogClose({ key: 'dialog_3' })}
          onConfrim={handleDialogClose({ key: 'dialog_3' })}
          onCancel={handleDialogClose({ key: 'dialog_3' })}
        />
      ) : null}
    </>
  );
}

export default View;
