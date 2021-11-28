import React from 'react';
import './index.scss'

function Tooltip ({ id, show, onClick }) {
  return show ? (
    <div className="tooltip" onClick={onClick}>
      <div className="tooltip-content">I'm tooltip {id}.</div>
    </div>
  ) : null;
}

export default Tooltip;
