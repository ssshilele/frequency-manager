import React from 'react';
import './index.scss';

function Dialog({
  title = '',
  content = '',
  noCloseBtn = false,
  confrimText = '确认',
  cancelText = '取消',
  onClose,
  onConfrim,
  onCancel,
}) {
  return (
    <div className="dialog" onClick={onClose}>
      <div className="dialog-container" onClick={e => e.stopPropagation()}>
        <div className="header">
          <div className="title">{title}</div>
          {noCloseBtn ? null : (
            <div className="close-button" onClick={onClose} />
          )}
        </div>
        <div className="content">{content}</div>
        <div className="footer">
          {cancelText ? (
            <div className="button cancel-button" onClick={onCancel}>
              {cancelText}
            </div>
          ) : null}
          <div className="button confirm-button" onClick={onConfrim}>
            {confrimText}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dialog;
