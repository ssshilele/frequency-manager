import React from 'react';
import './index.scss'

function Badge ({ show }) {
  return show ? <div className="badge" /> : null;
}

export default Badge;
